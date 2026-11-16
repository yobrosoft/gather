import "server-only";

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { MemoryStore, normalizeScreening } from "@/lib/memory-store";
import { churchOwnerIds } from "@/lib/owners";
import { assertSafeFirestoreProject } from "@/lib/project";
import type { ChurchRecord, CinemaRecord, PartyRecord, ScreeningRecord, UserRecord } from "@/lib/types";

/**
 * Opens Firestore only when FIRESTORE_EMULATOR_HOST is already set.
 * The project id is gather-local unless GATHER_FIRESTORE_PROJECT overrides it.
 */
export function createFirestoreStore(projectId: string): MemoryStore {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.trim()) {
    throw new Error("Refusing to open Firestore without FIRESTORE_EMULATOR_HOST.");
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
