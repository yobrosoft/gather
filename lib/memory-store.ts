import { churchOwnerIds } from "@/lib/owners";
import { withCandidates } from "@/lib/candidates";
import type {
  BookingStatus,
  ChurchRecord,
  ChurchRequestRecord,
  CinemaRecord,
  EnquiryRecord,
  FollowUpRecord,
  PartyRecord,
  ScreeningRecord,
  UserRecord,
  Verse,
} from "@/lib/types";

export type StoreData = {
  users: UserRecord[];
  churches: ChurchRecord[];
  cinemas: CinemaRecord[];
  screenings: ScreeningRecord[];
  parties: PartyRecord[];
  requests: ChurchRequestRecord[];
  enquiries: EnquiryRecord[];
  followUps: FollowUpRecord[];
};

export function emptyData(): StoreData {
  return { users: [], churches: [], cinemas: [], screenings: [], parties: [], requests: [], enquiries: [], followUps: [] };
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
    screeningMode: raw.screeningMode === "shared" || raw.screeningMode === "private" ? raw.screeningMode : raw.visibility === "open" ? "shared" : "private",
    requestStatus:
      raw.requestStatus === "accepted" || raw.requestStatus === "declined" || raw.requestStatus === "needs_partner" || raw.requestStatus === "sent"
        ? raw.requestStatus
        : bookingStatus === "booked"
          ? "accepted"
          : "sent",
    expectedHeadcount: typeof raw.expectedHeadcount === "number" && raw.expectedHeadcount > 0 ? raw.expectedHeadcount : raw.capacity,
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
    fictional: church.fictional === true,
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
    const base = emptyData();
    this.data = copy({
      ...base,
      ...data,
      requests: data.requests ?? [],
      enquiries: data.enquiries ?? [],
      followUps: data.followUps ?? [],
    });
  }

  async getUser(id: string) {
    return copy(this.data.users.find((user) => user.id === id) ?? null);
  }

  async findUserBySub(sub: string) {
    return copy(this.data.users.find((user) => user.googleSub === sub) ?? null);
  }

  async findUserByEmail(email: string) {
    const needle = email.trim().toLowerCase();
    return copy(this.data.users.find((user) => user.email.toLowerCase() === needle) ?? null);
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

  async deleteViewing(id: string) {
    this.data.screenings = this.data.screenings.filter((screening) => screening.id !== id);
    this.data.parties = this.data.parties.filter((party) => party.eventId !== id);
    this.data.followUps = this.data.followUps.filter((followUp) => followUp.eventId !== id);
    for (const enquiry of this.data.enquiries) {
      if (enquiry.screeningId !== id) continue;
      enquiry.screeningId = null;
      if (enquiry.status === "confirmed") enquiry.status = "proposed";
    }
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

  async listRequests() {
    return copy(this.data.requests).map(withCandidates);
  }

  async listRequestsForChurch(churchId: string) {
    return copy(this.data.requests.filter((request) => request.churchId === churchId)).map(withCandidates);
  }

  async listRequestsForEnquiry(enquiryId: string) {
    return copy(this.data.requests.filter((request) => request.enquiryId === enquiryId)).map(withCandidates);
  }

  async getRequest(id: string) {
    const found = this.data.requests.find((request) => request.id === id);
    return found ? withCandidates(copy(found)) : null;
  }

  async findRequestByReference(reference: string) {
    const found = this.data.requests.find((request) => request.reference === reference);
    return found ? withCandidates(copy(found)) : null;
  }

  async saveRequest(request: ChurchRequestRecord) {
    upsert(this.data.requests, request);
  }

  async listEnquiries() {
    return copy(this.data.enquiries);
  }

  async getEnquiry(id: string) {
    return copy(this.data.enquiries.find((enquiry) => enquiry.id === id) ?? null);
  }

  async findEnquiryByReference(reference: string) {
    return copy(this.data.enquiries.find((enquiry) => enquiry.reference === reference) ?? null);
  }

  async saveEnquiry(enquiry: EnquiryRecord) {
    upsert(this.data.enquiries, enquiry);
  }

  async commitEnquiry(parts: { enquiry: EnquiryRecord; request?: ChurchRequestRecord; screening?: ScreeningRecord }) {
    upsert(this.data.enquiries, parts.enquiry);
    if (parts.request) upsert(this.data.requests, parts.request);
    if (parts.screening) upsert(this.data.screenings, parts.screening);
  }

  async listFollowUps(eventId: string) {
    return copy(this.data.followUps.filter((followUp) => followUp.eventId === eventId));
  }

  async findFollowUp(eventId: string, userId: string) {
    return copy(this.data.followUps.find((followUp) => followUp.eventId === eventId && followUp.userId === userId) ?? null);
  }

  async saveFollowUp(followUp: FollowUpRecord) {
    upsert(this.data.followUps, followUp);
  }
}
