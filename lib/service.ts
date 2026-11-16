import { localDateKey } from "@/lib/format";
import { inviteCode, joinToken, newId, normalizeInviteCode } from "@/lib/ids";
import { churchOwnerIds, isChurchOwner } from "@/lib/owners";
import { fitProblem, seatsRemaining, seatsTaken } from "@/lib/seats";
import type { Store } from "@/lib/store";
import type {
  BookingStatus,
  ChurchRecord,
  EventView,
  PartyRecord,
  PublicChurch,
  ScreeningRecord,
  UserRecord,
  VenueHold,
  Verse,
  Visibility,
} from "@/lib/types";
import { canSeeScreening } from "@/lib/visibility";
import { youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/youtube";

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type CinemaInput = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address?: string;
};

type VerseInput = {
  reference: string;
  text?: string;
  translation?: string;
  bibleId?: number;
  passageId?: string;
  copyright?: string;
};

type ScreeningInput = {
  title?: string;
  durationMinutes?: number;
  videoUrl?: string;
  verses?: VerseInput[];
  bookingStatus?: BookingStatus;
  startsAt: string;
  timeZone: string;
  capacity: number;
  visibility: Visibility;
  cinema?: CinemaInput | null;
};

type ScreeningPatch = {
  title?: string;
  durationMinutes?: number;
  videoUrl?: string;
  verses?: VerseInput[];
  bookingStatus?: BookingStatus;
  startsAt?: string;
  timeZone?: string;
  capacity?: number;
  visibility?: Visibility;
  cinema?: CinemaInput | null;
  hostChurchId?: unknown;
};

function presentChurch(church: ChurchRecord, user: UserRecord): PublicChurch {
  const owner = isChurchOwner(church, user.id);
  return {
    id: church.id,
    name: church.name,
    placeId: church.placeId,
    lat: church.lat,
    lng: church.lng,
    address: church.address,
    isOwner: owner,
    inviteCode: owner ? church.inviteCode : "",
    ownerInviteCode: owner ? church.ownerInviteCode : "",
    catchment: owner ? church.catchment : [],
  };
}

function assertTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
  } catch {
    throw new ServiceError("Pick a valid time zone.", 400);
  }
}

function assertWhen(startsAt: string) {
  if (Number.isNaN(Date.parse(startsAt))) throw new ServiceError("Enter a date and time.", 400);
}

async function withJoinToken(store: Store, screening: ScreeningRecord): Promise<ScreeningRecord> {
  if (screening.joinToken) return screening;
  const next = { ...screening, joinToken: joinToken() };
  await store.saveScreening(next);
  return next;
}

async function hostLeader(store: Store, user: UserRecord, screening: ScreeningRecord): Promise<boolean> {
  if (user.churchId !== screening.hostChurchId) return false;
  const church = await store.getChurch(screening.hostChurchId);
  return Boolean(church && isChurchOwner(church, user.id));
}

async function requireScreening(store: Store, user: UserRecord, id: string, token?: string): Promise<ScreeningRecord> {
  const screening = await store.getScreening(id);
  const allowed = Boolean(screening && ((token && screening.joinToken === token) || canSeeScreening(screening, user)));
  if (!screening || !allowed) throw new ServiceError("No viewing with that id.", 404);
  return withJoinToken(store, screening);
}

function cleanVerses(verses: VerseInput[] | undefined): Verse[] {
  return (verses ?? []).flatMap((verse) => {
    const reference = verse.reference.trim();
    if (!reference) return [];
    const next: Verse = { reference, text: verse.text?.trim() ?? "" };
    if (verse.translation?.trim()) next.translation = verse.translation.trim();
    if (verse.bibleId) next.bibleId = verse.bibleId;
    if (verse.passageId?.trim()) next.passageId = verse.passageId.trim();
    if (verse.copyright?.trim()) next.copyright = verse.copyright.trim();
    return [next];
  });
}

function cleanVideo(url: string | undefined, required: boolean): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) {
    if (required) throw new ServiceError("Add a YouTube link for the preview.", 400);
    return "";
  }
  const watch = youtubeWatchUrl(trimmed);
  if (!watch) throw new ServiceError("Use a YouTube link for the preview.", 400);
  return watch;
}

async function assertCinemaFree(
  store: Store,
  placeId: string,
  startsAt: string,
  timeZone: string,
  exceptId?: string,
) {
  const day = localDateKey(startsAt, timeZone);
  if (!day) throw new ServiceError("Enter a date and time.", 400);
  const screenings = await store.listScreenings();
  for (const screening of screenings) {
    if (screening.id === exceptId || screening.bookingStatus === "tbd" || !screening.cinemaId) continue;
    if (localDateKey(screening.startsAt, timeZone) !== day) continue;
    const cinema = await store.getCinema(screening.cinemaId);
    if (cinema?.placeId === placeId) {
      throw new ServiceError("That cinema already has a private booking on this date.", 409);
    }
  }
}

export async function toEventView(store: Store, screening: ScreeningRecord, user: UserRecord | null): Promise<EventView> {
  screening = await withJoinToken(store, screening);
  const [cinema, host, parties] = await Promise.all([
    screening.cinemaId ? store.getCinema(screening.cinemaId) : Promise.resolve(null),
    store.getChurch(screening.hostChurchId),
    store.listParties(screening.id),
  ]);
  const partyViews = await Promise.all(
    parties.map(async (party) => {
      const [person, church] = await Promise.all([
        store.getUser(party.userId),
        party.churchId ? store.getChurch(party.churchId) : Promise.resolve(null),
      ]);
      return {
        id: party.id,
        userId: party.userId,
        personName: person?.name || "Someone",
        churchId: party.churchId,
        churchName: church?.name ?? null,
        members: party.members,
        guests: party.guests,
      };
    }),
  );
  partyViews.sort((a, b) => a.personName.localeCompare(b.personName) || a.id.localeCompare(b.id));
  const taken = seatsTaken(parties);
  return {
    id: screening.id,
    title: screening.title,
    durationMinutes: screening.durationMinutes,
    videoUrl: screening.videoUrl,
    embedUrl: youtubeEmbedUrl(screening.videoUrl),
    verses: screening.verses,
    bookingStatus: screening.bookingStatus,
    startsAt: screening.startsAt,
    timeZone: screening.timeZone,
    capacity: screening.capacity,
    visibility: screening.visibility,
    joinPath: `/e/${screening.joinToken}`,
    hostChurchId: screening.hostChurchId,
    hostChurchName: host?.name || "Host church",
    cinema: cinema
      ? {
          id: cinema.id,
          placeId: cinema.placeId,
          name: cinema.name,
          lat: cinema.lat,
          lng: cinema.lng,
          address: cinema.address,
        }
      : null,
    taken,
    remaining: screening.capacity - taken,
    viewerIsHost: user ? await hostLeader(store, user, screening) : false,
    viewerPartyId: user ? parties.find((party) => party.userId === user.id)?.id ?? null : null,
    parties: user ? partyViews : [],
  };
}

export async function sessionView(store: Store, user: UserRecord) {
  let church = user.churchId ? await store.getChurch(user.churchId) : null;
  if (church && isChurchOwner(church, user.id) && !church.ownerInviteCode) {
    church.ownerInviteCode = await freshCode(store);
    await store.saveChurch(church);
  }
  return {
    user: { id: user.id, name: user.name, email: user.email, churchId: user.churchId },
    church: church ? presentChurch(church, user) : null,
  };
}

export async function createChurch(
  store: Store,
  user: UserRecord,
  input: { name: string; placeId?: string; lat: number; lng: number; address?: string },
): Promise<ChurchRecord> {
  if (await store.findChurchOwnedBy(user.id)) throw new ServiceError("You already own a church.", 409);
  if (user.churchId) throw new ServiceError("This account is already in a church.", 409);
  const church: ChurchRecord = {
    id: newId(),
    name: input.name.trim(),
    placeId: input.placeId?.trim() ?? "",
    lat: input.lat,
    lng: input.lng,
    address: input.address?.trim() ?? "",
    leaderUserId: user.id,
    ownerIds: [user.id],
    inviteCode: await freshCode(store),
    ownerInviteCode: await freshCode(store),
    catchment: [],
  };
  user.churchId = church.id;
  await store.saveChurch(church);
  await store.saveUser(user);
  return church;
}

export async function claimChurch(
  store: Store,
  user: UserRecord,
  input: { name: string; placeId?: string; lat: number; lng: number; address?: string },
): Promise<ChurchRecord> {
  const placeId = input.placeId?.trim() ?? "";
  if (!placeId) throw new ServiceError("Search Google Maps and pick your church.", 400);
  const owned = await store.findChurchOwnedBy(user.id);
  if (owned) {
    if (owned.placeId === placeId) return owned;
    throw new ServiceError("You already own a church.", 409);
  }
  if (user.churchId) throw new ServiceError("This account is already in a church.", 409);
  const existing = await store.findChurchByPlaceId(placeId);
  if (!existing) return createChurch(store, user, { ...input, placeId });
  if (churchOwnerIds(existing).length > 0) throw new ServiceError("This church is already claimed.", 409);
  existing.name = input.name.trim() || existing.name;
  existing.lat = input.lat;
  existing.lng = input.lng;
  existing.address = input.address?.trim() ?? existing.address;
  existing.leaderUserId = user.id;
  existing.ownerIds = [user.id];
  if (!existing.inviteCode) existing.inviteCode = await freshCode(store);
  if (!existing.ownerInviteCode) existing.ownerInviteCode = await freshCode(store);
  user.churchId = existing.id;
  await store.saveChurch(existing);
  await store.saveUser(user);
  return existing;
}

export async function churchClaimStatus(store: Store, placeId: string, user: UserRecord | null) {
  const church = await store.findChurchByPlaceId(placeId);
  if (!church || churchOwnerIds(church).length === 0) {
    return { status: "unclaimed" as const, name: church?.name ?? null };
  }
  if (user && isChurchOwner(church, user.id)) return { status: "yours" as const, name: church.name };
  return { status: "claimed" as const, name: church.name };
}

export async function updateChurch(
  store: Store,
  user: UserRecord,
  patch: {
    name?: string;
    placeId?: string;
    lat?: number;
    lng?: number;
    address?: string;
    catchment?: ChurchRecord["catchment"];
  },
): Promise<ChurchRecord> {
  const church = user.churchId ? await store.getChurch(user.churchId) : null;
  if (!church || !isChurchOwner(church, user.id)) {
    throw new ServiceError("Only an owner can change the church.", 403);
  }
  if (patch.catchment && patch.catchment.length > 4) throw new ServiceError("Drop up to four pins.", 400);
  const next: ChurchRecord = {
    ...church,
    name: patch.name?.trim() || church.name,
    placeId: patch.placeId !== undefined ? patch.placeId : church.placeId,
    lat: patch.lat ?? church.lat,
    lng: patch.lng ?? church.lng,
    address: patch.address !== undefined ? patch.address.trim() : church.address,
    catchment: patch.catchment ?? church.catchment,
  };
  await store.saveChurch(next);
  return next;
}

export async function joinChurch(store: Store, user: UserRecord, code: string): Promise<ChurchRecord> {
  const normalized = normalizeInviteCode(code);
  const asMember = await store.findChurchByInvite(normalized);
  const asOwner = asMember ? null : await store.findChurchByOwnerInvite(normalized);
  const church = asMember ?? asOwner;
  if (!church) throw new ServiceError("That invite code does not match a church.", 404);
  const becomingOwner = Boolean(asOwner);
  if (user.churchId === church.id && (!becomingOwner || isChurchOwner(church, user.id))) return church;
  const owned = await store.findChurchOwnedBy(user.id);
  if (owned && owned.id !== church.id) {
    throw new ServiceError("You own a church, so this account stays with it.", 409);
  }
  if (becomingOwner && !isChurchOwner(church, user.id)) {
    church.ownerIds = [...churchOwnerIds(church), user.id];
    await store.saveChurch(church);
  }
  user.churchId = church.id;
  await store.saveUser(user);
  return church;
}

async function freshCode(store: Store): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = inviteCode();
    if (!(await store.findChurchByInvite(code)) && !(await store.findChurchByOwnerInvite(code))) return code;
  }
  return inviteCode();
}

async function upsertCinema(store: Store, input: CinemaInput) {
  const existing = await store.findCinemaByPlaceId(input.placeId);
  const cinema = {
    id: existing?.id ?? newId(),
    placeId: input.placeId,
    name: input.name.trim(),
    lat: input.lat,
    lng: input.lng,
    address: input.address?.trim() ?? existing?.address ?? "",
  };
  await store.saveCinema(cinema);
  return cinema;
}

export async function createScreening(store: Store, user: UserRecord, input: ScreeningInput): Promise<EventView> {
  if (!user.churchId) throw new ServiceError("Claim a church before you add a viewing.", 403);
  const church = await store.getChurch(user.churchId);
  if (!church || !isChurchOwner(church, user.id)) {
    throw new ServiceError("Only an owner can add a viewing.", 403);
  }
  assertWhen(input.startsAt);
  assertTimeZone(input.timeZone);
  const startsAt = new Date(input.startsAt).toISOString();
  const bookingStatus = input.bookingStatus ?? (input.cinema ? "booked" : "tbd");
  const cinema = input.cinema ? await upsertCinema(store, input.cinema) : null;
  if ((bookingStatus === "pending" || bookingStatus === "booked") && !cinema) {
    throw new ServiceError("Choose a cinema before you mark this as pending or booked.", 400);
  }
  if (cinema && bookingStatus !== "tbd") {
    await assertCinemaFree(store, cinema.placeId, startsAt, input.timeZone);
  }
  const screening: ScreeningRecord = {
    id: newId(),
    hostChurchId: church.id,
    cinemaId: cinema?.id ?? null,
    title: input.title?.trim() || "The Chosen",
    durationMinutes: input.durationMinutes ?? 0,
    videoUrl: cleanVideo(input.videoUrl, false),
    verses: cleanVerses(input.verses),
    bookingStatus,
    startsAt,
    timeZone: input.timeZone,
    capacity: input.capacity,
    visibility: input.visibility,
    joinToken: joinToken(),
  };
  await store.saveScreening(screening);
  return toEventView(store, screening, user);
}

export async function updateScreening(
  store: Store,
  user: UserRecord,
  id: string,
  patch: ScreeningPatch,
): Promise<EventView> {
  if (Object.prototype.hasOwnProperty.call(patch, "hostChurchId")) {
    throw new ServiceError("The host church stays the same.", 400);
  }
  const screening = await requireScreening(store, user, id);
  if (!(await hostLeader(store, user, screening))) {
    throw new ServiceError("Only the host church can change this viewing.", 403);
  }
  if (patch.startsAt) assertWhen(patch.startsAt);
  if (patch.timeZone) assertTimeZone(patch.timeZone);
  if (patch.capacity != null) {
    const taken = seatsTaken(await store.listParties(screening.id));
    if (patch.capacity < taken) {
      throw new ServiceError("Capacity cannot be smaller than the seats already taken.", 400);
    }
  }
  const startsAt = patch.startsAt ? new Date(patch.startsAt).toISOString() : screening.startsAt;
  const timeZone = patch.timeZone || screening.timeZone;
  let cinemaId = screening.cinemaId;
  let cinemaPlaceId: string | null = null;
  if (patch.cinema === null) {
    cinemaId = null;
  } else if (patch.cinema) {
    const cinema = await upsertCinema(store, patch.cinema);
    cinemaId = cinema.id;
    cinemaPlaceId = cinema.placeId;
  } else if (cinemaId) {
    cinemaPlaceId = (await store.getCinema(cinemaId))?.placeId ?? null;
  }
  const bookingStatus = patch.bookingStatus ?? screening.bookingStatus;
  if ((bookingStatus === "pending" || bookingStatus === "booked") && !cinemaId) {
    throw new ServiceError("Choose a cinema before you mark this as pending or booked.", 400);
  }
  if (cinemaPlaceId && bookingStatus !== "tbd") {
    await assertCinemaFree(store, cinemaPlaceId, startsAt, timeZone, screening.id);
  }
  const next: ScreeningRecord = {
    ...screening,
    cinemaId,
    title: patch.title?.trim() || screening.title,
    durationMinutes: patch.durationMinutes ?? screening.durationMinutes,
    videoUrl: patch.videoUrl !== undefined ? cleanVideo(patch.videoUrl, false) : screening.videoUrl,
    verses: patch.verses ? cleanVerses(patch.verses) : screening.verses,
    bookingStatus,
    startsAt,
    timeZone,
    capacity: patch.capacity ?? screening.capacity,
    visibility: patch.visibility ?? screening.visibility,
    joinToken: screening.joinToken,
  };
  await store.saveScreening(next);
  return toEventView(store, next, user);
}

export async function listEvents(store: Store, user: UserRecord | null): Promise<EventView[]> {
  const screenings = await store.listScreenings();
  const visible = screenings.filter((screening) => (user ? canSeeScreening(screening, user) : screening.visibility === "open"));
  const views = await Promise.all(visible.map((screening) => toEventView(store, screening, user)));
  views.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  return views;
}

export async function venueHolds(store: Store, startsAt: string, timeZone: string, exceptId?: string): Promise<VenueHold[]> {
  assertWhen(startsAt);
  assertTimeZone(timeZone);
  const day = localDateKey(startsAt, timeZone);
  const screenings = await store.listScreenings();
  const holds: VenueHold[] = [];
  for (const screening of screenings) {
    if (screening.id === exceptId || !screening.cinemaId) continue;
    if (screening.bookingStatus !== "pending" && screening.bookingStatus !== "booked") continue;
    if (localDateKey(screening.startsAt, timeZone) !== day) continue;
    const [cinema, host] = await Promise.all([store.getCinema(screening.cinemaId), store.getChurch(screening.hostChurchId)]);
    if (!cinema?.placeId) continue;
    holds.push({
      placeId: cinema.placeId,
      cinemaName: cinema.name,
      bookingStatus: screening.bookingStatus,
      hostChurchName: host?.name || "Host church",
    });
  }
  return holds;
}

export async function getEvent(store: Store, user: UserRecord | null, id: string): Promise<EventView> {
  const screening = await store.getScreening(id);
  if (!screening) throw new ServiceError("No viewing with that id.", 404);
  if (!user) {
    if (screening.visibility !== "open") throw new ServiceError("Sign in to see this viewing.", 401);
    return toEventView(store, await withJoinToken(store, screening), null);
  }
  return toEventView(store, await requireScreening(store, user, id), user);
}

export async function eventByToken(store: Store, user: UserRecord, token: string): Promise<EventView> {
  const found = await store.findScreeningByToken(token);
  if (!found) throw new ServiceError("That link does not match a viewing.", 404);
  return toEventView(store, await withJoinToken(store, found), user);
}

export async function addParty(
  store: Store,
  user: UserRecord,
  eventId: string,
  input: { members: number; guests: number },
  token?: string,
): Promise<EventView> {
  const screening = await requireScreening(store, user, eventId, token);
  const parties = await store.listParties(screening.id);
  const existing = parties.find((party) => party.userId === user.id);
  const problem = fitProblem(screening.capacity, parties, input, existing?.id);
  if (problem) throw new ServiceError(problem, 400);
  const party: PartyRecord = {
    id: existing?.id ?? newId(),
    eventId: screening.id,
    userId: user.id,
    churchId: user.churchId,
    members: input.members,
    guests: input.guests,
  };
  await store.saveParty(party);
  return toEventView(store, screening, user);
}

export async function addPartyByToken(
  store: Store,
  user: UserRecord,
  token: string,
  input: { members: number; guests: number },
): Promise<EventView> {
  const screening = await store.findScreeningByToken(token);
  if (!screening) throw new ServiceError("That link does not match a viewing.", 404);
  return addParty(store, user, screening.id, input, token);
}

export async function removePartyByToken(store: Store, user: UserRecord, token: string, partyId: string): Promise<EventView> {
  const screening = await store.findScreeningByToken(token);
  if (!screening) throw new ServiceError("That link does not match a viewing.", 404);
  return removeParty(store, user, screening.id, partyId, token);
}

export async function removeParty(
  store: Store,
  user: UserRecord,
  eventId: string,
  partyId: string,
  token?: string,
): Promise<EventView> {
  const screening = await requireScreening(store, user, eventId, token);
  const party = await store.getParty(partyId);
  if (!party || party.eventId !== screening.id) throw new ServiceError("No party with that id.", 404);
  const isSelf = party.userId === user.id;
  if (!isSelf && !(await hostLeader(store, user, screening))) {
    throw new ServiceError("You can only remove your own party.", 403);
  }
  await store.deleteParty(party.id);
  return toEventView(store, screening, user);
}

export function seatsLeft(capacity: number, parties: Array<{ members: number; guests: number }>) {
  return seatsRemaining(capacity, parties);
}
