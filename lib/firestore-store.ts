import "server-only";

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { MemoryStore, normalizeScreening } from "@/lib/memory-store";
import { churchOwnerIds } from "@/lib/owners";
import { assertSafeFirestoreProject } from "@/lib/project";
import type { ChurchRecord, ChurchRequestRecord, CinemaRecord, EnquiryRecord, FollowUpRecord, PartyRecord, ScreeningRecord, UserRecord } from "@/lib/types";

/**
 * Opens the Firestore emulator, or live Firestore when GATHER_USE_FIRESTORE=live.
 * Live mode still refuses the Waymark project.
 */
export function createFirestoreStore(projectId: string): MemoryStore {
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST?.trim());
  const live = process.env.GATHER_USE_FIRESTORE === "live";
  if (!emulator && !live) {
    throw new Error("Refusing to open Firestore without FIRESTORE_EMULATOR_HOST or GATHER_USE_FIRESTORE=live.");
  }
  assertSafeFirestoreProject(projectId);
  if (getApps().length === 0) initializeApp({ projectId });
  return new FirestoreStore(getFirestore()) as unknown as MemoryStore;
}

class FirestoreStore {
  constructor(private readonly db: Firestore) {}

  private col(name: string) {
    return this.db.collection(name);
  }

  async getUser(id: string) {
    const snap = await this.col("users").doc(id).get();
    return snap.exists ? (snap.data() as UserRecord) : null;
  }

  async findUserBySub(sub: string) {
    const snap = await this.col("users").where("googleSub", "==", sub).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as UserRecord);
  }

  async findUserByEmail(email: string) {
    const snap = await this.col("users").where("email", "==", email.trim().toLowerCase()).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as UserRecord);
  }

  async saveUser(user: UserRecord) {
    await this.col("users").doc(user.id).set(user);
  }

  async getChurch(id: string) {
    const snap = await this.col("churches").doc(id).get();
    return snap.exists ? normalizeStoredChurch(snap.data() as ChurchRecord) : null;
  }

  async findChurchByInvite(code: string) {
    const snap = await this.col("churches").where("inviteCode", "==", code.trim().toUpperCase()).limit(1).get();
    return snap.empty ? null : normalizeStoredChurch(snap.docs[0].data() as ChurchRecord);
  }

  async findChurchByOwnerInvite(code: string) {
    const snap = await this.col("churches").where("ownerInviteCode", "==", code.trim().toUpperCase()).limit(1).get();
    return snap.empty ? null : normalizeStoredChurch(snap.docs[0].data() as ChurchRecord);
  }

  async findChurchOwnedBy(userId: string) {
    const owned = await this.col("churches").where("ownerIds", "array-contains", userId).limit(1).get();
    if (!owned.empty) return normalizeStoredChurch(owned.docs[0].data() as ChurchRecord);
    const legacy = await this.col("churches").where("leaderUserId", "==", userId).limit(1).get();
    return legacy.empty ? null : normalizeStoredChurch(legacy.docs[0].data() as ChurchRecord);
  }

  async findChurchByPlaceId(placeId: string) {
    const needle = placeId.trim();
    if (!needle) return null;
    const snap = await this.col("churches").where("placeId", "==", needle).limit(1).get();
    return snap.empty ? null : normalizeStoredChurch(snap.docs[0].data() as ChurchRecord);
  }

  async saveChurch(church: ChurchRecord) {
    await this.col("churches").doc(church.id).set(church);
  }

  async getCinema(id: string) {
    const snap = await this.col("cinemas").doc(id).get();
    return snap.exists ? (snap.data() as CinemaRecord) : null;
  }

  async findCinemaByPlaceId(placeId: string) {
    const snap = await this.col("cinemas").where("placeId", "==", placeId).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as CinemaRecord);
  }

  async saveCinema(cinema: CinemaRecord) {
    await this.col("cinemas").doc(cinema.id).set(cinema);
  }

  async listScreenings() {
    const snap = await this.col("screenings").get();
    return snap.docs.map((doc) => normalizeScreening(doc.data() as ScreeningRecord));
  }

  async getScreening(id: string) {
    const snap = await this.col("screenings").doc(id).get();
    return snap.exists ? normalizeScreening(snap.data() as ScreeningRecord) : null;
  }

  async findScreeningByToken(token: string) {
    const snap = await this.col("screenings").where("joinToken", "==", token).limit(1).get();
    return snap.empty ? null : normalizeScreening(snap.docs[0].data() as ScreeningRecord);
  }

  async saveScreening(screening: ScreeningRecord) {
    await this.col("screenings").doc(screening.id).set(screening);
  }

  async deleteViewing(id: string) {
    const parties = await this.col("parties").where("eventId", "==", id).get();
    const followUps = await this.col("followUps").where("eventId", "==", id).get();
    const enquiries = await this.col("enquiries").where("screeningId", "==", id).get();
    await Promise.all([
      this.col("screenings").doc(id).delete(),
      ...parties.docs.map((doc) => doc.ref.delete()),
      ...followUps.docs.map((doc) => doc.ref.delete()),
      ...enquiries.docs.map((doc) => {
        const enquiry = doc.data() as EnquiryRecord;
        return doc.ref.set({ ...enquiry, screeningId: null, status: enquiry.status === "confirmed" ? "proposed" : enquiry.status });
      }),
    ]);
  }

  async listParties(eventId: string) {
    const snap = await this.col("parties").where("eventId", "==", eventId).get();
    return snap.docs.map((doc) => doc.data() as PartyRecord);
  }

  async getParty(id: string) {
    const snap = await this.col("parties").doc(id).get();
    return snap.exists ? (snap.data() as PartyRecord) : null;
  }

  async saveParty(party: PartyRecord) {
    await this.col("parties").doc(party.id).set(party);
  }

  async deleteParty(id: string) {
    await this.col("parties").doc(id).delete();
  }

  async listRequests() {
    const snap = await this.col("requests").get();
    return snap.docs.map((doc) => doc.data() as ChurchRequestRecord);
  }

  async listRequestsForChurch(churchId: string) {
    const snap = await this.col("requests").where("churchId", "==", churchId).get();
    return snap.docs.map((doc) => doc.data() as ChurchRequestRecord);
  }

  async listRequestsForEnquiry(enquiryId: string) {
    const snap = await this.col("requests").where("enquiryId", "==", enquiryId).get();
    return snap.docs.map((doc) => doc.data() as ChurchRequestRecord);
  }

  async getRequest(id: string) {
    const snap = await this.col("requests").doc(id).get();
    return snap.exists ? (snap.data() as ChurchRequestRecord) : null;
  }

  async findRequestByReference(reference: string) {
    const snap = await this.col("requests").where("reference", "==", reference).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as ChurchRequestRecord);
  }

  async saveRequest(request: ChurchRequestRecord) {
    await this.col("requests").doc(request.id).set(request);
  }

  async listEnquiries() {
    const snap = await this.col("enquiries").get();
    return snap.docs.map((doc) => doc.data() as EnquiryRecord);
  }

  async getEnquiry(id: string) {
    const snap = await this.col("enquiries").doc(id).get();
    return snap.exists ? (snap.data() as EnquiryRecord) : null;
  }

  async findEnquiryByReference(reference: string) {
    const snap = await this.col("enquiries").where("reference", "==", reference).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as EnquiryRecord);
  }

  async saveEnquiry(enquiry: EnquiryRecord) {
    await this.col("enquiries").doc(enquiry.id).set(enquiry);
  }

  async commitEnquiry(parts: { enquiry: EnquiryRecord; request?: ChurchRequestRecord; screening?: ScreeningRecord }) {
    await this.saveEnquiry(parts.enquiry);
    if (parts.request) await this.saveRequest(parts.request);
    if (parts.screening) await this.saveScreening(parts.screening);
  }

  async listFollowUps(eventId: string) {
    const snap = await this.col("followUps").where("eventId", "==", eventId).get();
    return snap.docs.map((doc) => doc.data() as FollowUpRecord);
  }

  async findFollowUp(eventId: string, userId: string) {
    const snap = await this.col("followUps").where("eventId", "==", eventId).where("userId", "==", userId).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as FollowUpRecord);
  }

  async saveFollowUp(followUp: FollowUpRecord) {
    await this.col("followUps").doc(followUp.id).set(followUp);
  }
}

function normalizeStoredChurch(church: ChurchRecord): ChurchRecord {
  const ownerIds = churchOwnerIds(church);
  return {
    ...church,
    ownerIds,
    leaderUserId: church.leaderUserId || ownerIds[0] || "",
    ownerInviteCode: church.ownerInviteCode || "",
  };
}
