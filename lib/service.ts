import { CRUCIFIXION_TITLE, isChosenSg } from "@/lib/chosen";
import { applyCandidateUpdate, candidatesFromCinemas, withCandidates } from "@/lib/candidates";
import { enquiryNext, findSharedEnquiry, nextSaturdayISO, readyToConfirm, weekendKey } from "@/lib/enquiries";
import { localDateKey } from "@/lib/format";
import { groupByCinemaDate, nearbyChurches, type MatchRequest } from "@/lib/matches";
import { inviteCode, joinToken, newId, normalizeInviteCode, referenceCode } from "@/lib/ids";
import { enquiryMailto, privateCinemaById } from "@/lib/private-cinemas";
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
  RequestMode,
  RequestStatus,
  ChurchRequestRecord,
  CinemaCandidate,
  EnquiryRecord,
  EnquiryView,
  FollowUpKind,
  FollowUpRecord,
  FollowUpView,
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
  screeningMode?: RequestMode;
  requestStatus?: RequestStatus;
  expectedHeadcount?: number;
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
  screeningMode?: RequestMode;
  requestStatus?: RequestStatus;
  expectedHeadcount?: number;
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
    inviteCode: "",
    ownerInviteCode: "",
    catchment: owner ? church.catchment : [],
    fictional: church.fictional === true,
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
    if (screening.id === exceptId || screening.bookingStatus !== "booked" || !screening.cinemaId) continue;
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
        status: party.status ?? "accepted",
        proposedMembers: party.proposedMembers ?? null,
        proposedGuests: party.proposedGuests ?? null,
      };
    }),
  );
  partyViews.sort((a, b) => a.personName.localeCompare(b.personName) || a.id.localeCompare(b.id));
  const seated = parties.filter((party) => (party.status ?? "accepted") !== "declined");
  const taken = seatsTaken(seated);
  return {
    id: screening.id,
    title: screening.title,
    durationMinutes: screening.durationMinutes,
    videoUrl: screening.videoUrl,
    embedUrl: youtubeEmbedUrl(screening.videoUrl),
    verses: screening.verses,
    bookingStatus: screening.bookingStatus,
    screeningMode: screening.screeningMode,
    requestStatus: screening.requestStatus,
    expectedHeadcount: screening.expectedHeadcount,
    startsAt: screening.startsAt,
    timeZone: screening.timeZone,
    capacity: screening.capacity,
    visibility: screening.visibility,
    joinPath: `/e/${screening.joinToken}`,
    hostChurchId: screening.hostChurchId,
    hostChurchName: screening.hostedBy?.trim() || host?.name || "Host",
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
    user: { id: user.id, name: user.name, email: user.email, churchId: user.churchId, isChosenSg: isChosenSg(user.email) },
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
    fictional: false,
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
  if (cinema && bookingStatus === "booked") {
    await assertCinemaFree(store, cinema.placeId, startsAt, input.timeZone);
  }
  const screening: ScreeningRecord = {
    id: newId(),
    hostChurchId: church.id,
    cinemaId: cinema?.id ?? null,
    title: input.title?.trim() || "The Chosen Crucifixion",
    durationMinutes: input.durationMinutes ?? 0,
    videoUrl: cleanVideo(input.videoUrl, false),
    verses: cleanVerses(input.verses),
    bookingStatus,
    screeningMode: input.screeningMode ?? (input.visibility === "open" ? "shared" : "private"),
    requestStatus: input.requestStatus ?? "sent",
    expectedHeadcount: input.expectedHeadcount ?? input.capacity,
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
  if (cinemaPlaceId && bookingStatus === "booked") {
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
    screeningMode: patch.screeningMode ?? screening.screeningMode,
    requestStatus: patch.requestStatus ?? screening.requestStatus,
    expectedHeadcount: patch.expectedHeadcount ?? screening.expectedHeadcount,
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
    if (screening.bookingStatus !== "booked") continue;
    if (localDateKey(screening.startsAt, timeZone) !== day) continue;
    const [cinema, host] = await Promise.all([store.getCinema(screening.cinemaId), store.getChurch(screening.hostChurchId)]);
    if (!cinema?.placeId) continue;
    holds.push({
      placeId: cinema.placeId,
      cinemaName: cinema.name,
      bookingStatus: screening.bookingStatus,
      hostChurchName: screening.hostedBy?.trim() || host?.name || "Host",
    });
  }
  return holds;
}

export async function areaMatches(store: Store, user: UserRecord) {
  if (!isChosenSg(user.email)) throw new ServiceError("Only The Chosen Singapore can see area matches.", 403);
  const screenings = await store.listScreenings();
  const requests: MatchRequest[] = [];
  for (const screening of screenings) {
    const [church, cinema] = await Promise.all([
      store.getChurch(screening.hostChurchId),
      screening.cinemaId ? store.getCinema(screening.cinemaId) : Promise.resolve(null),
    ]);
    if (!church) continue;
    requests.push({
      id: screening.id,
      hostChurchId: church.id,
      hostChurchName: church.name,
      churchLat: church.lat,
      churchLng: church.lng,
      cinemaPlaceId: cinema?.placeId ?? null,
      cinemaName: cinema?.name ?? null,
      date: localDateKey(screening.startsAt, screening.timeZone),
      screeningMode: screening.screeningMode,
      requestStatus: screening.requestStatus,
      expectedHeadcount: screening.expectedHeadcount,
      capacity: screening.capacity,
    });
  }
  return { groups: groupByCinemaDate(requests), nearby: nearbyChurches(requests) };
}

export async function deleteScreening(store: Store, user: UserRecord, id: string): Promise<void> {
  const screening = await store.getScreening(id);
  if (!screening) throw new ServiceError("No viewing with that id.", 404);
  if (!(await hostLeader(store, user, screening))) throw new ServiceError("Only the host church can delete this viewing.", 403);
  await store.deleteViewing(id);
}

export async function setRequestStatus(store: Store, user: UserRecord, id: string, requestStatus: RequestStatus): Promise<EventView> {
  const screening = await store.getScreening(id);
  if (!screening) throw new ServiceError("No viewing with that id.", 404);
  const host = await hostLeader(store, user, screening);
  if (!host && !isChosenSg(user.email)) throw new ServiceError("Only the host church or The Chosen Singapore can record a response.", 403);
  screening.requestStatus = requestStatus;
  await store.saveScreening(screening);
  return toEventView(store, screening, user);
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
  if (existing && (existing.status ?? "accepted") === "accepted") {
    const same = input.members === existing.members && input.guests === existing.guests;
    existing.proposedMembers = same ? null : input.members;
    existing.proposedGuests = same ? null : input.guests;
    await store.saveParty(existing);
    return toEventView(store, screening, user);
  }
  const seated = parties.filter((party) => (party.status ?? "accepted") !== "declined");
  const problem = fitProblem(screening.capacity, seated, input, existing?.id);
  if (problem) throw new ServiceError(problem, 400);
  const party: PartyRecord = {
    id: existing?.id ?? newId(),
    eventId: screening.id,
    userId: user.id,
    churchId: user.churchId,
    members: input.members,
    guests: input.guests,
    status: "requested",
    proposedMembers: null,
    proposedGuests: null,
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

export async function decideAttendance(
  store: Store,
  user: UserRecord,
  eventId: string,
  partyId: string,
  action: "accept" | "declineUpdate" | "revoke",
): Promise<EventView> {
  const screening = await store.getScreening(eventId);
  if (!screening) throw new ServiceError("No viewing with that id.", 404);
  if (!(await hostLeader(store, user, screening))) throw new ServiceError("Only the host church can answer attendance requests.", 403);
  const party = await store.getParty(partyId);
  if (!party || party.eventId !== screening.id) throw new ServiceError("No request with that id.", 404);
  if (action === "declineUpdate") {
    if (party.proposedMembers == null && party.proposedGuests == null) throw new ServiceError("There is no update to decline.", 400);
    party.proposedMembers = null;
    party.proposedGuests = null;
    await store.saveParty(party);
    return toEventView(store, screening, user);
  }
  if (action === "revoke") {
    party.status = "declined";
    party.proposedMembers = null;
    party.proposedGuests = null;
    await store.saveParty(party);
    return toEventView(store, screening, user);
  }
  const next = {
    members: party.proposedMembers ?? party.members,
    guests: party.proposedGuests ?? party.guests,
  };
  const parties = await store.listParties(screening.id);
  const seated = parties.filter((item) => item.id !== party.id && (item.status ?? "accepted") !== "declined");
  const problem = fitProblem(screening.capacity, seated, next);
  if (problem) throw new ServiceError(problem, 400);
  party.members = next.members;
  party.guests = next.guests;
  party.status = "accepted";
  party.proposedMembers = null;
  party.proposedGuests = null;
  await store.saveParty(party);
  return toEventView(store, screening, user);
}

export async function postArrangeDraft(store: Store, user: UserRecord, requestId: string, publish = true): Promise<EnquiryView> {
  const request = await store.getRequest(requestId);
  if (!request) throw new ServiceError("No request with that id.", 404);
  const church = await store.getChurch(request.churchId);
  if (!church || !isChurchOwner(church, user.id)) throw new ServiceError("Only the host church can post this screening.", 403);
  const enquiry = await store.getEnquiry(request.enquiryId);
  if (!enquiry) throw new ServiceError("No enquiry with that id.", 404);
  const startsAt = new Date(`${request.preferredDates[0]}T${request.preferredTime}:00+08:00`).toISOString();
  const cinema = request.cinemaPlaceId ? await store.findCinemaByPlaceId(request.cinemaPlaceId) : null;
  let screening = enquiry.screeningId ? await store.getScreening(enquiry.screeningId) : null;
  if (!publish && !screening) throw new ServiceError("This screening is not published.", 400);
  if (!screening) {
    screening = {
      id: newId(),
      hostChurchId: church.id,
      cinemaId: cinema?.id ?? null,
      title: CRUCIFIXION_TITLE,
      durationMinutes: 120,
      videoUrl: "",
      verses: [],
      bookingStatus: "tbd",
      screeningMode: request.mode,
      requestStatus: "sent",
      expectedHeadcount: request.expectedHeadcount,
      startsAt,
      timeZone: "Asia/Singapore",
      capacity: Math.max(request.expectedHeadcount, 1),
      visibility: publish ? "open" : "private",
      joinToken: joinToken(),
      hostedBy: request.hostedBy?.trim() || church.name,
    };
  } else {
    screening.visibility = publish ? "open" : "private";
    screening.hostedBy = request.hostedBy?.trim() || church.name;
    screening.startsAt = startsAt;
    screening.capacity = Math.max(request.expectedHeadcount, 1);
    screening.expectedHeadcount = request.expectedHeadcount;
    screening.screeningMode = request.mode;
    screening.cinemaId = cinema?.id ?? screening.cinemaId;
  }
  enquiry.screeningId = screening.id;
  await store.commitEnquiry({ enquiry, screening });
  return toEnquiryView(store, enquiry, user);
}

export function seatsLeft(capacity: number, parties: Array<{ members: number; guests: number }>) {
  return seatsRemaining(capacity, parties);
}

type ChurchRequestInput = {
  mode: RequestMode;
  expectedHeadcount: number;
  preferredDates: string[];
  preferredTime: string;
  cinema?: CinemaInput;
  cinemas?: CinemaInput[];
  accessibilityNeeds: string;
  coordinatorName: string;
  coordinatorPhone: string;
  coordinatorEmail: string;
  hostedBy?: string;
};

function assertIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ServiceError("Enter a real date.", 400);
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ServiceError("Enter a real date.", 400);
  }
}

async function freshReference(store: Store, kind: "R" | "E"): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = referenceCode(kind);
    const taken = kind === "R" ? await store.findRequestByReference(code) : await store.findEnquiryByReference(code);
    if (!taken) return code;
  }
  return referenceCode(kind);
}

async function toEnquiryView(store: Store, enquiry: EnquiryRecord, user: UserRecord): Promise<EnquiryView> {
  const requests = (await store.listRequestsForEnquiry(enquiry.id)).sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.reference.localeCompare(b.reference),
  );
  const churches = await Promise.all(requests.map((request) => store.getChurch(request.churchId)));
  const partner = isChosenSg(user.email);
  const cinemaRecord = await store.findCinemaByPlaceId(enquiry.cinemaPlaceId);
  const catalog = privateCinemaById(enquiry.cinemaPlaceId);
  const hasHall = Boolean(enquiry.cinemaPlaceId);
  const screening = enquiry.screeningId ? await store.getScreening(enquiry.screeningId) : null;
  const requestViews = requests.map((request, index) => {
    const church = churches[index];
    const showContact = partner || user.churchId === request.churchId;
    return {
      id: request.id,
      reference: request.reference,
      churchId: request.churchId,
      churchName: church?.name || "Church",
      fictional: church?.fictional === true,
      expectedHeadcount: request.expectedHeadcount,
      preferredDates: request.preferredDates,
      preferredTime: request.preferredTime,
      accessibilityNeeds: request.accessibilityNeeds,
      candidates: withCandidates(request).candidates,
      coordinatorName: showContact ? request.coordinatorName : "",
      coordinatorPhone: showContact ? request.coordinatorPhone : "",
      coordinatorEmail: showContact ? request.coordinatorEmail : "",
      hostedBy: request.hostedBy?.trim() || church?.name || "",
      createdAt: request.createdAt,
    };
  });
  const mailto =
    partner && catalog
      ? enquiryMailto(
          catalog,
          enquiry,
          requests.map((request, index) => ({
            churchName: churches[index]?.name || "Church",
            expectedHeadcount: request.expectedHeadcount,
            preferredDates: request.preferredDates,
            preferredTime: request.preferredTime,
            accessibilityNeeds: request.accessibilityNeeds,
            coordinatorName: request.coordinatorName,
            coordinatorPhone: request.coordinatorPhone,
            coordinatorEmail: request.coordinatorEmail,
          })),
        )
      : null;
  return {
    id: enquiry.id,
    reference: enquiry.reference,
    mode: enquiry.mode,
    cinemaName: hasHall ? catalog?.name || cinemaRecord?.name || "Cinema" : "",
    cinemaAddress: hasHall ? catalog?.address || cinemaRecord?.address || "" : "",
    hasHall,
    weekendKey: enquiry.weekendKey,
    status: enquiry.status,
    expectedTotal: requests.reduce((sum, request) => sum + request.expectedHeadcount, 0),
    proposedHall: enquiry.proposedHall,
    proposedWhen: enquiry.proposedWhen,
    proposedTerms: enquiry.proposedTerms,
    verifiedAvailability: enquiry.verifiedAvailability,
    verifiedRights: enquiry.verifiedRights,
    verifiedTerms: enquiry.verifiedTerms,
    next: enquiryNext(enquiry),
    screeningId: enquiry.screeningId,
    published: screening?.visibility === "open",
    joinPath: screening?.joinToken ? `/e/${screening.joinToken}` : null,
    mailto,
    requests: requestViews,
  };
}

async function visibleEnquiries(store: Store, user: UserRecord): Promise<EnquiryRecord[]> {
  const enquiries = await store.listEnquiries();
  if (isChosenSg(user.email)) return enquiries;
  if (!user.churchId) return [];
  const mine = await store.listRequestsForChurch(user.churchId);
  const ids = new Set(mine.map((request) => request.enquiryId));
  return enquiries.filter((enquiry) => ids.has(enquiry.id));
}

export async function listEnquiryViews(store: Store, user: UserRecord): Promise<EnquiryView[]> {
  const views = await Promise.all((await visibleEnquiries(store, user)).map((enquiry) => toEnquiryView(store, enquiry, user)));
  views.sort((a, b) => a.weekendKey.localeCompare(b.weekendKey) || a.cinemaName.localeCompare(b.cinemaName) || a.reference.localeCompare(b.reference));
  return views;
}

export async function createChurchRequest(store: Store, user: UserRecord, input: ChurchRequestInput): Promise<EnquiryView> {
  if (!user.churchId) throw new ServiceError("Claim a church before you request a screening.", 403);
  const church = await store.getChurch(user.churchId);
  if (!church || !isChurchOwner(church, user.id)) throw new ServiceError("Only an owner can request a screening.", 403);
  const dates = [...new Set(input.preferredDates.map((date) => date.trim()))].filter(Boolean).sort();
  if (dates.length < 1) throw new ServiceError("Add at least one preferred date.", 400);
  for (const date of dates) assertIsoDate(date);
  if (!input.coordinatorPhone.trim() && !input.coordinatorEmail.trim()) {
    throw new ServiceError("Add a phone or email so the cinema can reply.", 400);
  }
  const weekend = weekendKey(dates);
  const selected = input.cinemas?.length ? input.cinemas : input.cinema ? [input.cinema] : [];
  if (selected.length < 1) throw new ServiceError("Add at least one cinema.", 400);
  if (selected.length > 6) throw new ServiceError("Compare at most six cinemas.", 400);
  const savedCinemas = [];
  for (const cinema of selected) savedCinemas.push(await upsertCinema(store, cinema));
  const candidates = candidatesFromCinemas(savedCinemas.map((cinema) => cinema.placeId));
  const placeId = candidates.length === 1 ? candidates[0].cinemaId : "";
  const enquiries = await store.listEnquiries();
  const own = await store.listRequestsForChurch(church.id);
  const duplicate = own.find((request) => {
    const enquiry = enquiries.find((item) => item.id === request.enquiryId);
    return Boolean(enquiry && enquiry.weekendKey === weekend && (enquiry.status === "pending" || enquiry.status === "proposed"));
  });
  if (duplicate) throw new ServiceError("This church already asked for this viewing on that weekend.", 409);

  let enquiry = input.mode === "shared" && placeId ? findSharedEnquiry(enquiries, placeId, weekend) : null;
  if (!enquiry) {
    enquiry = {
      id: newId(),
      reference: await freshReference(store, "E"),
      mode: input.mode,
      cinemaPlaceId: placeId,
      weekendKey: weekend,
      status: "pending",
      proposedHall: "",
      proposedWhen: "",
      proposedTerms: "",
      verifiedAvailability: false,
      verifiedRights: false,
      verifiedTerms: false,
      screeningId: null,
    };
  }
  const request: ChurchRequestRecord = {
    id: newId(),
    reference: await freshReference(store, "R"),
    enquiryId: enquiry.id,
    churchId: church.id,
    mode: input.mode,
    expectedHeadcount: input.expectedHeadcount,
    preferredDates: dates,
    preferredTime: input.preferredTime,
    cinemaPlaceId: placeId,
    candidates,
    accessibilityNeeds: input.accessibilityNeeds.trim(),
    coordinatorName: input.coordinatorName.trim(),
    coordinatorPhone: input.coordinatorPhone.trim(),
    coordinatorEmail: input.coordinatorEmail.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
  };
  await store.commitEnquiry({ enquiry, request });
  return toEnquiryView(store, enquiry, user);
}

async function hostChurchFor(store: Store, user: UserRecord, hostedBy: string): Promise<ChurchRecord> {
  const name = hostedBy.trim() || "Host";
  const current = user.churchId ? await store.getChurch(user.churchId) : null;
  const owned = current ?? (await store.findChurchOwnedBy(user.id));
  if (owned && isChurchOwner(owned, user.id)) {
    if (user.churchId !== owned.id) {
      user.churchId = owned.id;
      await store.saveUser(user);
    }
    return owned;
  }
  const church: ChurchRecord = {
    id: newId(),
    name,
    placeId: "",
    lat: 1.3521,
    lng: 103.8198,
    address: "",
    leaderUserId: user.id,
    ownerIds: [user.id],
    inviteCode: await freshCode(store),
    ownerInviteCode: await freshCode(store),
    catchment: [],
    fictional: false,
  };
  await store.saveChurch(church);
  user.churchId = church.id;
  await store.saveUser(user);
  return church;
}

export async function saveArrangeDraft(
  store: Store,
  user: UserRecord,
  input: ChurchRequestInput & { requestId?: string; candidates?: Array<Omit<CinemaCandidate, "note"> & { note?: string }> },
): Promise<EnquiryView> {
  const church = await hostChurchFor(store, user, input.hostedBy ?? "");
  const dates = [...new Set(input.preferredDates.map((date) => date.trim()))].filter(Boolean).sort();
  if (dates.length < 1) throw new ServiceError("Add at least one preferred date.", 400);
  for (const date of dates) assertIsoDate(date);
  if (!input.coordinatorEmail.trim()) throw new ServiceError("Add an email so the cinema can reply.", 400);
  const selected = input.cinemas ?? [];
  if (selected.length > 6) throw new ServiceError("Compare at most six cinemas.", 400);
  const savedCinemas = [];
  for (const cinema of selected) savedCinemas.push(await upsertCinema(store, cinema));
  const cinemaIds = savedCinemas.map((cinema) => cinema.placeId);
  const weekend = weekendKey(dates);
  const request = input.requestId ? await store.getRequest(input.requestId) : null;
  if (input.requestId && !request) throw new ServiceError("No request with that id.", 404);
  if (request && request.churchId !== church.id) throw new ServiceError("Only the host church can update these cinemas.", 403);
  const notes = new Map((input.candidates ?? []).map((candidate) => [candidate.cinemaId, candidate]));
  const prior = new Map((request?.candidates ?? []).map((candidate) => [candidate.cinemaId, candidate]));
  const candidates = cinemaIds.map((cinemaId) => {
    const incoming = notes.get(cinemaId);
    const previous = prior.get(cinemaId);
    return {
      cinemaId,
      status: incoming?.status ?? previous?.status ?? "considering",
      quote: incoming?.quote ?? previous?.quote ?? "",
      note: incoming?.note ?? previous?.note ?? "",
    };
  });
  const chosen = candidates.find((candidate) => candidate.status === "chosen");
  const placeId = candidates.length === 1 ? (candidates[0]?.cinemaId ?? "") : (chosen?.cinemaId ?? "");
  const fields = {
    mode: input.mode,
    expectedHeadcount: input.expectedHeadcount,
    preferredDates: dates,
    preferredTime: input.preferredTime,
    cinemaPlaceId: placeId,
    candidates,
    accessibilityNeeds: input.accessibilityNeeds.trim(),
    coordinatorName: input.coordinatorName.trim(),
    coordinatorPhone: input.coordinatorPhone.trim(),
    coordinatorEmail: input.coordinatorEmail.trim().toLowerCase(),
    hostedBy: input.hostedBy?.trim() ?? "",
  };
  if (!request) {
    const enquiry: EnquiryRecord = {
      id: newId(),
      reference: await freshReference(store, "E"),
      mode: input.mode,
      cinemaPlaceId: placeId,
      weekendKey: weekend,
      status: "pending",
      proposedHall: "",
      proposedWhen: "",
      proposedTerms: "",
      verifiedAvailability: false,
      verifiedRights: false,
      verifiedTerms: false,
      screeningId: null,
    };
    const created: ChurchRequestRecord = {
      id: newId(),
      reference: await freshReference(store, "R"),
      enquiryId: enquiry.id,
      churchId: church.id,
      createdAt: new Date().toISOString(),
      ...fields,
    };
    await store.commitEnquiry({ enquiry, request: created });
    return toEnquiryView(store, enquiry, user);
  }
  const enquiry = await store.getEnquiry(request.enquiryId);
  if (!enquiry) throw new ServiceError("No enquiry with that id.", 404);
  if (enquiry.status === "confirmed") throw new ServiceError("This screening is already confirmed.", 409);
  const siblings = await store.listRequestsForEnquiry(enquiry.id);
  if (siblings.length === 1) {
    enquiry.mode = input.mode;
    enquiry.weekendKey = weekend;
    enquiry.cinemaPlaceId = placeId;
  }
  await store.commitEnquiry({ enquiry, request: { ...request, ...fields } });
  return toEnquiryView(store, enquiry, user);
}

export async function updateCandidate(
  store: Store,
  user: UserRecord,
  requestId: string,
  input: { cinemaId: string; status: CinemaCandidate["status"]; quote: string; note?: string },
): Promise<EnquiryView> {
  const request = await store.getRequest(requestId);
  if (!request) throw new ServiceError("No request with that id.", 404);
  const church = await store.getChurch(request.churchId);
  if (!church || !isChurchOwner(church, user.id)) throw new ServiceError("Only the host church can update these cinemas.", 403);
  if (!request.candidates.some((candidate) => candidate.cinemaId === input.cinemaId)) {
    throw new ServiceError("That cinema is not on this shortlist.", 404);
  }
  const enquiry = await store.getEnquiry(request.enquiryId);
  if (!enquiry) throw new ServiceError("No enquiry with that id.", 404);
  if (enquiry.status === "confirmed") throw new ServiceError("This screening is already confirmed.", 409);
  request.candidates = applyCandidateUpdate(request.candidates, input);
  const chosen = request.candidates.find((candidate) => candidate.status === "chosen");
  const placeId = request.candidates.length === 1 ? request.candidates[0].cinemaId : (chosen?.cinemaId ?? "");
  request.cinemaPlaceId = placeId;
  enquiry.cinemaPlaceId = placeId;
  await store.commitEnquiry({ enquiry, request });
  return toEnquiryView(store, enquiry, user);
}

async function buildConfirmedScreening(store: Store, enquiry: EnquiryRecord, requests: ChurchRequestRecord[]): Promise<ScreeningRecord> {
  const ordered = requests.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const host = ordered[0];
  if (!host) throw new ServiceError("This enquiry has no church requests.", 400);
  const cinema = await store.findCinemaByPlaceId(enquiry.cinemaPlaceId);
  if (!cinema) throw new ServiceError("The cinema on this enquiry is missing.", 400);
  const startsAt = new Date(enquiry.proposedWhen).toISOString();
  await assertCinemaFree(store, cinema.placeId, startsAt, "Asia/Singapore");
  const total = ordered.reduce((sum, request) => sum + request.expectedHeadcount, 0);
  return {
    id: newId(),
    hostChurchId: host.churchId,
    cinemaId: cinema.id,
    title: CRUCIFIXION_TITLE,
    durationMinutes: 120,
    videoUrl: "",
    verses: [],
    bookingStatus: "booked",
    screeningMode: enquiry.mode,
    requestStatus: "accepted",
    expectedHeadcount: total,
    startsAt,
    timeZone: "Asia/Singapore",
    capacity: Math.max(total, 1),
    visibility: enquiry.mode === "shared" ? "open" : "private",
    joinToken: joinToken(),
  };
}

export async function updateEnquiry(
  store: Store,
  user: UserRecord,
  id: string,
  patch: {
    proposedHall?: string;
    proposedWhen?: string;
    proposedTerms?: string;
    verifiedAvailability?: boolean;
    verifiedRights?: boolean;
    verifiedTerms?: boolean;
    simulate?: boolean;
  },
): Promise<EnquiryView> {
  if (!isChosenSg(user.email)) throw new ServiceError("Only The Chosen Singapore can update an enquiry.", 403);
  const enquiry = await store.getEnquiry(id);
  if (!enquiry) throw new ServiceError("No enquiry with that id.", 404);
  if (enquiry.status === "confirmed") throw new ServiceError("This enquiry is already confirmed.", 409);
  if (enquiry.status === "declined") throw new ServiceError("This enquiry was declined.", 409);
  const requests = await store.listRequestsForEnquiry(enquiry.id);
  const first = requests.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (patch.simulate && first) {
    if (!enquiry.proposedHall.trim()) enquiry.proposedHall = "Standard hall";
    if (!enquiry.proposedWhen.trim()) enquiry.proposedWhen = `${first.preferredDates[0]}T${first.preferredTime}:00+08:00`;
    if (!enquiry.proposedTerms.trim()) {
      enquiry.proposedTerms =
        "Simulated reply: the hall can be held for this group, subject to the cinema's hire fee and a screening-rights agreement. This is not a signed booking.";
    }
  }
  if (patch.proposedHall !== undefined) enquiry.proposedHall = patch.proposedHall.trim();
  if (patch.proposedWhen !== undefined) {
    if (Number.isNaN(Date.parse(patch.proposedWhen))) throw new ServiceError("Enter the date and time the cinema proposed.", 400);
    enquiry.proposedWhen = patch.proposedWhen.trim();
  }
  if (patch.proposedTerms !== undefined) enquiry.proposedTerms = patch.proposedTerms.trim();
  if (patch.verifiedAvailability !== undefined) enquiry.verifiedAvailability = patch.verifiedAvailability;
  if (patch.verifiedRights !== undefined) enquiry.verifiedRights = patch.verifiedRights;
  if (patch.verifiedTerms !== undefined) enquiry.verifiedTerms = patch.verifiedTerms;

  let screening: ScreeningRecord | undefined;
  if (readyToConfirm(enquiry)) {
    if (!enquiry.cinemaPlaceId) throw new ServiceError("Book a hall before you confirm this request.", 400);
    screening = await buildConfirmedScreening(store, enquiry, requests);
    enquiry.status = "confirmed";
    enquiry.screeningId = screening.id;
  } else if (enquiry.proposedHall.trim() || enquiry.proposedTerms.trim() || enquiry.proposedWhen.trim()) {
    enquiry.status = "proposed";
  } else {
    enquiry.status = "pending";
  }
  await store.commitEnquiry({ enquiry, screening });
  return toEnquiryView(store, enquiry, user);
}

const DEMO_USER_ID = "demo-coordinator";

export async function ensureTampinesDemo(store: Store, user: UserRecord): Promise<EnquiryView[]> {
  if (!isChosenSg(user.email)) throw new ServiceError("Only The Chosen Singapore can load the Tampines demo.", 403);
  const existing = await store.getEnquiry("demo-enquiry-shared");
  if (!existing) {
    if (!(await store.getUser(DEMO_USER_ID))) {
      await store.saveUser({
        id: DEMO_USER_ID,
        googleSub: "demo:tampines",
        name: "Demo coordinator",
        email: "demo-tampines@example.com",
        churchId: null,
      });
    }
    const churches = [
      ["demo-church-tampines", "Tampines Outreach (fictional)", "demo-place-tampines", 1.3526, 103.9447, "Tampines, Singapore", "DEMOTAMP", "DEMOOWNT"],
      ["demo-church-bedok", "Bedok Neighbour Church (fictional)", "demo-place-bedok", 1.324, 103.93, "Bedok, Singapore", "DEMOBEDK", "DEMOOWNB"],
      ["demo-church-pasir", "Pasir Ris Chapel (fictional)", "demo-place-pasir", 1.3721, 103.9493, "Pasir Ris, Singapore", "DEMOPASR", "DEMOOWNP"],
    ] as const;
    for (const [id, name, placeId, lat, lng, address, inviteCodeValue, ownerInviteCode] of churches) {
      if (await store.getChurch(id)) continue;
      await store.saveChurch({
        id,
        name,
        placeId,
        lat,
        lng,
        address,
        leaderUserId: DEMO_USER_ID,
        ownerIds: [DEMO_USER_ID],
        inviteCode: inviteCodeValue,
        ownerInviteCode,
        catchment: [],
        fictional: true,
      });
    }
    const cinema = privateCinemaById("gv-tampines");
    if (!cinema) throw new ServiceError("GV Tampines is missing from the cinema list.", 500);
    await upsertCinema(store, { placeId: cinema.id, name: cinema.name, lat: cinema.lat, lng: cinema.lng, address: cinema.address });
    const date = nextSaturdayISO();
    const weekend = weekendKey([date]);
    const blank = {
      proposedHall: "",
      proposedWhen: "",
      proposedTerms: "",
      verifiedAvailability: false,
      verifiedRights: false,
      verifiedTerms: false,
      screeningId: null,
      cinemaPlaceId: cinema.id,
      weekendKey: weekend,
    };
    const privateEnquiry: EnquiryRecord = { id: "demo-enquiry-private", reference: "E-PRIV", mode: "private", status: "pending", ...blank };
    const sharedEnquiry: EnquiryRecord = { id: "demo-enquiry-shared", reference: "E-120", mode: "shared", status: "pending", ...blank };
    const stamp = new Date().toISOString();
    const common = {
      preferredDates: [date],
      preferredTime: "19:00",
      cinemaPlaceId: cinema.id,
      candidates: [{ cinemaId: cinema.id, status: "considering" as const, quote: "", note: "" }],
      accessibilityNeeds: "Step-free access for guests who use wheelchairs",
      coordinatorName: "Demo coordinator",
      coordinatorPhone: "+65 6000 0000",
      coordinatorEmail: "demo-tampines@example.com",
    };
    await store.commitEnquiry({
      enquiry: privateEnquiry,
      request: {
        id: "demo-request-private",
        reference: "R-T150",
        enquiryId: privateEnquiry.id,
        churchId: "demo-church-tampines",
        mode: "private",
        expectedHeadcount: 150,
        createdAt: stamp,
        ...common,
      },
    });
    await store.commitEnquiry({
      enquiry: sharedEnquiry,
      request: {
        id: "demo-request-80",
        reference: "R-B080",
        enquiryId: sharedEnquiry.id,
        churchId: "demo-church-bedok",
        mode: "shared",
        expectedHeadcount: 80,
        createdAt: stamp,
        ...common,
      },
    });
    await store.commitEnquiry({
      enquiry: sharedEnquiry,
      request: {
        id: "demo-request-40",
        reference: "R-P040",
        enquiryId: sharedEnquiry.id,
        churchId: "demo-church-pasir",
        mode: "shared",
        expectedHeadcount: 40,
        createdAt: new Date(Date.now() + 1000).toISOString(),
        ...common,
        accessibilityNeeds: "A quiet seat near the aisle",
      },
    });
  }
  return listEnquiryViews(store, user);
}

async function canRespond(store: Store, user: UserRecord, screening: ScreeningRecord): Promise<boolean> {
  if (screening.visibility === "open" || canSeeScreening(screening, user)) return true;
  const parties = await store.listParties(screening.id);
  return parties.some((party) => party.userId === user.id);
}

export async function saveFollowUp(
  store: Store,
  user: UserRecord,
  eventId: string,
  input: { kind: FollowUpKind; shareContact: boolean; name?: string; email?: string; phone?: string },
): Promise<FollowUpView> {
  const screening = await store.getScreening(eventId);
  if (!screening) throw new ServiceError("No viewing with that id.", 404);
  if (!(await canRespond(store, user, screening))) throw new ServiceError("Sign in to see this viewing.", 403);
  const share = input.kind !== "none" && input.shareContact;
  const email = input.email?.trim().toLowerCase() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (share && !email && !phone) throw new ServiceError("Add an email or a phone, or leave contact details off.", 400);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ServiceError("Enter a valid email.", 400);
  const existing = await store.findFollowUp(eventId, user.id);
  const followUp: FollowUpRecord = {
    id: existing?.id ?? newId(),
    eventId,
    userId: user.id,
    kind: input.kind,
    shareContact: share,
    name: share ? input.name?.trim() || user.name : "",
    email: share ? email : "",
    phone: share ? phone : "",
  };
  await store.saveFollowUp(followUp);
  return {
    id: followUp.id,
    kind: followUp.kind,
    shareContact: followUp.shareContact,
    personName: user.name,
    name: followUp.name,
    email: followUp.email,
    phone: followUp.phone,
    mine: true,
  };
}

export async function listFollowUpViews(store: Store, user: UserRecord, eventId: string): Promise<FollowUpView[]> {
  const screening = await store.getScreening(eventId);
  if (!screening) throw new ServiceError("No viewing with that id.", 404);
  if (!(await canRespond(store, user, screening)) && !isChosenSg(user.email)) {
    throw new ServiceError("Sign in to see this viewing.", 403);
  }
  const host = await hostLeader(store, user, screening);
  const partner = isChosenSg(user.email);
  const rows = await store.listFollowUps(eventId);
  const visible = host || partner ? rows : rows.filter((row) => row.userId === user.id);
  const views: FollowUpView[] = [];
  for (const row of visible) {
    const person = await store.getUser(row.userId);
    const showContact = host || partner || row.userId === user.id;
    views.push({
      id: row.id,
      kind: row.kind,
      shareContact: row.shareContact,
      personName: person?.name || "Guest",
      name: showContact ? row.name : "",
      email: showContact ? row.email : "",
      phone: showContact ? row.phone : "",
      mine: row.userId === user.id,
    });
  }
  views.sort((a, b) => a.personName.localeCompare(b.personName));
  return views;
}
