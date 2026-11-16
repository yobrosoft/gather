import { churchOwnerIds } from "@/lib/owners";
import type { BookingStatus, ChurchRecord, CinemaRecord, PartyRecord, ScreeningRecord, UserRecord, Verse } from "@/lib/types";

export type StoreData = {
  users: UserRecord[];
  churches: ChurchRecord[];
  cinemas: CinemaRecord[];
  screenings: ScreeningRecord[];
  parties: PartyRecord[];
};

export function emptyData(): StoreData {
  return { users: [], churches: [], cinemas: [], screenings: [], parties: [] };
}

function copy<T>(value: T): T {
  return structuredClone(value);
}

function cleanVerses(value: unknown): Verse[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((verse) => {
    if (!verse || typeof verse !== "object") return [];
    const reference = "reference" in verse && typeof verse.reference === "string" ? verse.reference.trim() : "";
    const text = "text" in verse && typeof verse.text === "string" ? verse.text.trim() : "";
    if (!reference) return [];
    const next: Verse = { reference, text };
    if ("translation" in verse && typeof verse.translation === "string" && verse.translation.trim()) {
      next.translation = verse.translation.trim();
    }
    if ("bibleId" in verse && typeof verse.bibleId === "number") next.bibleId = verse.bibleId;
    if ("passageId" in verse && typeof verse.passageId === "string" && verse.passageId.trim()) {
      next.passageId = verse.passageId.trim();
    }
    if ("copyright" in verse && typeof verse.copyright === "string" && verse.copyright.trim()) {
      next.copyright = verse.copyright.trim();
    }
    return [next];
  });
}

export function normalizeScreening(raw: ScreeningRecord): ScreeningRecord {
  const cinemaId = raw.cinemaId ? raw.cinemaId : null;
  const status = raw.bookingStatus;
  const bookingStatus: BookingStatus =
    status === "tbd" || status === "pending" || status === "booked" ? status : cinemaId ? "booked" : "tbd";
  return {
    ...raw,
    cinemaId,
    durationMinutes: typeof raw.durationMinutes === "number" && raw.durationMinutes > 0 ? raw.durationMinutes : 0,
    videoUrl: typeof raw.videoUrl === "string" ? raw.videoUrl : "",
    verses: cleanVerses(raw.verses),
    bookingStatus,
    joinToken: raw.joinToken || "",
  };
}

function normalizeChurch(church: ChurchRecord): ChurchRecord {
  const ownerIds = churchOwnerIds(church);
  return {
    ...church,
    ownerIds,
    leaderUserId: church.leaderUserId || ownerIds[0] || "",
    ownerInviteCode: church.ownerInviteCode || "",
  };
}

function upsert<T extends { id: string }>(list: T[], item: T) {
  const index = list.findIndex((entry) => entry.id === item.id);
  const next = copy(item);
  if (index === -1) list.push(next);
  else list[index] = next;
}

export class MemoryStore {
  constructor(private data: StoreData = emptyData()) {}

  snapshot(): StoreData {
    return copy(this.data);
  }

  replace(data: StoreData) {
    this.data = copy(data);
  }

  async getUser(id: string) {
    return copy(this.data.users.find((user) => user.id === id) ?? null);
  }

  async findUserBySub(sub: string) {
    return copy(this.data.users.find((user) => user.googleSub === sub) ?? null);
  }

  async saveUser(user: UserRecord) {
    upsert(this.data.users, user);
  }

  async getChurch(id: string) {
    const found = this.data.churches.find((church) => church.id === id);
    return found ? normalizeChurch(copy(found)) : null;
  }

  async findChurchByInvite(code: string) {
    const needle = code.trim().toUpperCase();
    const found = this.data.churches.find((church) => church.inviteCode === needle);
    return found ? normalizeChurch(copy(found)) : null;
  }

  async findChurchByOwnerInvite(code: string) {
    const needle = code.trim().toUpperCase();
    const found = this.data.churches.find((church) => church.ownerInviteCode === needle);
    return found ? normalizeChurch(copy(found)) : null;
  }

  async findChurchOwnedBy(userId: string) {
    const found = this.data.churches.find((church) => churchOwnerIds(church).includes(userId));
    return found ? normalizeChurch(copy(found)) : null;
  }

  async findChurchByPlaceId(placeId: string) {
    const needle = placeId.trim();
    if (!needle) return null;
    const found = this.data.churches.find((church) => church.placeId === needle);
    return found ? normalizeChurch(copy(found)) : null;
  }

  async saveChurch(church: ChurchRecord) {
    upsert(this.data.churches, church);
  }

  async getCinema(id: string) {
    return copy(this.data.cinemas.find((cinema) => cinema.id === id) ?? null);
  }

  async findCinemaByPlaceId(placeId: string) {
    return copy(this.data.cinemas.find((cinema) => cinema.placeId === placeId) ?? null);
  }

  async saveCinema(cinema: CinemaRecord) {
    upsert(this.data.cinemas, cinema);
  }

  async listScreenings() {
    return copy(this.data.screenings).map((screening) => normalizeScreening(screening));
  }

  async getScreening(id: string) {
    const found = this.data.screenings.find((screening) => screening.id === id);
    return found ? normalizeScreening(copy(found)) : null;
  }

  async findScreeningByToken(token: string) {
    const found = this.data.screenings.find((screening) => screening.joinToken === token);
    return found ? normalizeScreening(copy(found)) : null;
  }

  async saveScreening(screening: ScreeningRecord) {
    upsert(this.data.screenings, screening);
  }

  async listParties(eventId: string) {
    return copy(this.data.parties.filter((party) => party.eventId === eventId));
  }

  async getParty(id: string) {
    return copy(this.data.parties.find((party) => party.id === id) ?? null);
  }

  async saveParty(party: PartyRecord) {
    upsert(this.data.parties, party);
  }

  async deleteParty(id: string) {
    this.data.parties = this.data.parties.filter((party) => party.id !== id);
  }
}
