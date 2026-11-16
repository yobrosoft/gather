import { describe, expect, it } from "vitest";
import { fitRank, findSharedEnquiry, nextSaturdayISO, readyToConfirm, seatFit, seatFitLabel, weekendKey } from "@/lib/enquiries";
import { MemoryStore } from "@/lib/memory-store";
import {
  createChurch,
  createChurchRequest,
  ensureTampinesDemo,
  postArrangeDraft,
  saveArrangeDraft,
  updateCandidate,
  listEnquiryViews,
  listEvents,
  listFollowUpViews,
  saveFollowUp,
  ServiceError,
  updateEnquiry,
} from "@/lib/service";
import type { EnquiryRecord, UserRecord } from "@/lib/types";

const cinema = {
  placeId: "gv-tampines",
  name: "GV Tampines",
  lat: 1.3526,
  lng: 103.9447,
  address: "Tampines Mall",
};

function enquiry(patch: Partial<EnquiryRecord>): EnquiryRecord {
  return {
    id: "e",
    reference: "E-TEST",
    mode: "shared",
    cinemaPlaceId: "gv-tampines",
    weekendKey: "2027-03-29",
    status: "pending",
    proposedHall: "",
    proposedWhen: "",
    proposedTerms: "",
    verifiedAvailability: false,
    verifiedRights: false,
    verifiedTerms: false,
    screeningId: null,
    ...patch,
  };
}

async function person(store: MemoryStore, name: string, email = `${name.toLowerCase()}@example.com`): Promise<UserRecord> {
  const user: UserRecord = { id: name.toLowerCase(), googleSub: name, name, email, churchId: null };
  await store.saveUser(user);
  return user;
}

async function owner(store: MemoryStore, name: string) {
  const user = await person(store, name);
  await createChurch(store, user, { name: `${name} Church`, placeId: `place-${name}`, lat: 1.35, lng: 103.94, address: name });
  return user;
}

function requestBody(mode: "private" | "shared", count: number) {
  return {
    mode,
    expectedHeadcount: count,
    preferredDates: ["2027-04-03"],
    preferredTime: "19:00",
    cinema,
    accessibilityNeeds: "Step-free access",
    coordinatorName: "Ada",
    coordinatorPhone: "60000000",
    coordinatorEmail: "ada@example.com",
  };
}

describe("enquiry rules", () => {
  it("labels halls that cannot hold 150, and halls with no published size", () => {
    expect(seatFit({ min: 102, max: 110 }, 150)).toBe("too_small");
    expect(seatFit({ min: 182, max: 252 }, 150)).toBe("fits");
    expect(seatFit({ min: 139, max: 249 }, 150)).toBe("unverified");
    expect(seatFit({ min: 66, max: 340 }, 150)).toBe("unverified");
    expect(seatFit({ min: null, max: null }, 150)).toBe("unverified");
    expect(seatFitLabel({ min: null, max: null }, 150, "Standard halls")).toBe("Seat count not verified.");
    expect(fitRank("fits")).toBeLessThan(fitRank("unverified"));
    expect(fitRank("unverified")).toBeLessThan(fitRank("too_small"));
  });

  it("keeps a private request off a shared enquiry for the same weekend", () => {
    const shared = enquiry({ id: "shared" });
    expect(findSharedEnquiry([shared], "gv-tampines", "2027-03-29")?.id).toBe("shared");
    expect(weekendKey(["2027-04-03"])).toBe("2027-03-29");
    expect(nextSaturdayISO(new Date("2026-11-16T00:00:00+08:00"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps 150 private and combines 80 and 40 into 120", async () => {
    process.env.CHOSEN_SG_EMAILS = "partner@example.com";
    const store = new MemoryStore();
    const tampines = await owner(store, "Tampines");
    const bedok = await owner(store, "Bedok");
    const pasir = await owner(store, "Pasir");
    const partner = await person(store, "Partner", "partner@example.com");

    const privateEnquiry = await createChurchRequest(store, tampines, requestBody("private", 150));
    const firstShared = await createChurchRequest(store, bedok, requestBody("shared", 80));
    const combined = await createChurchRequest(store, pasir, requestBody("shared", 40));

    expect(privateEnquiry.expectedTotal).toBe(150);
    expect(privateEnquiry.mode).toBe("private");
    expect(privateEnquiry.requests).toHaveLength(1);
    expect(combined.id).toBe(firstShared.id);
    expect(combined.expectedTotal).toBe(120);
    expect(combined.requests.map((request) => request.expectedHeadcount).sort()).toEqual([40, 80]);
    expect(combined.reference).not.toBe(privateEnquiry.reference);

    await expect(createChurchRequest(store, bedok, requestBody("shared", 80))).rejects.toBeInstanceOf(ServiceError);
    expect(await listEvents(store, null)).toEqual([]);

    const proposed = await updateEnquiry(store, partner, combined.id, { simulate: true });
    expect(proposed.status).toBe("proposed");
    expect(proposed.proposedTerms).toContain("Simulated reply");
    expect(proposed.joinPath).toBeNull();
    expect(await listEvents(store, null)).toEqual([]);

    const oneCheck = await updateEnquiry(store, partner, combined.id, { verifiedAvailability: true, verifiedRights: true });
    expect(oneCheck.status).toBe("proposed");
    expect(readyToConfirm(oneCheck)).toBe(false);

    const confirmed = await updateEnquiry(store, partner, combined.id, { verifiedTerms: true });
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.joinPath).toMatch(/^\/e\//);
    expect(confirmed.next).toContain("Friends can be invited");
    const publicEvents = await listEvents(store, null);
    expect(publicEvents).toHaveLength(1);
    expect(publicEvents[0]?.expectedHeadcount).toBe(120);
    expect(publicEvents[0]?.visibility).toBe("open");

    const guest = await person(store, "Guest");
    await saveFollowUp(store, guest, publicEvents[0]!.id, { kind: "introduction", shareContact: false });
    await expect(
      saveFollowUp(store, guest, publicEvents[0]!.id, { kind: "discussion", shareContact: true, name: "Guest" }),
    ).rejects.toThrow(/email or a phone/);
    await saveFollowUp(store, guest, publicEvents[0]!.id, {
      kind: "discussion",
      shareContact: true,
      name: "Guest",
      email: "guest@example.com",
    });
    const hostView = await listFollowUpViews(store, partner, publicEvents[0]!.id);
    expect(hostView.some((row) => row.email === "guest@example.com")).toBe(true);
    const stranger = await person(store, "Stranger");
    const hidden = await listFollowUpViews(store, stranger, publicEvents[0]!.id);
    expect(hidden).toEqual([]);
  });

  it("updates the same arrange draft instead of starting over", async () => {
    const store = new MemoryStore();
    const church = await owner(store, "Draft");
    const first = await saveArrangeDraft(store, church, {
      ...requestBody("private", 150),
      cinemas: [],
    });
    const requestId = first.requests[0]?.id ?? "";
    expect(first.requests[0]?.candidates).toEqual([]);
    const second = await saveArrangeDraft(store, church, {
      ...requestBody("private", 150),
      requestId,
      cinemas: [cinema, { placeId: "gv-bishan", name: "GV Bishan", lat: 1.35, lng: 103.85, address: "Junction 8" }],
      candidates: [{ cinemaId: "gv-tampines", status: "quoted", quote: "S$1400", note: "Spoke to sales" }],
    });
    expect(second.requests).toHaveLength(1);
    expect(second.requests[0]?.id).toBe(requestId);
    expect(second.requests[0]?.candidates).toHaveLength(2);
    expect(second.requests[0]?.candidates.find((candidate) => candidate.cinemaId === "gv-tampines")?.quote).toBe("S$1400");
  });

  it("hides a published screening when it is unpublished", async () => {
    const store = new MemoryStore();
    const church = await owner(store, "Pub");
    const draft = await saveArrangeDraft(store, church, { ...requestBody("private", 40), cinemas: [cinema] });
    const requestId = draft.requests[0]?.id ?? "";
    const published = await postArrangeDraft(store, church, requestId, true);
    expect(published.published).toBe(true);
    expect(await listEvents(store, null)).toHaveLength(1);
    const hidden = await postArrangeDraft(store, church, requestId, false);
    expect(hidden.published).toBe(false);
    expect(await listEvents(store, null)).toEqual([]);
  });

  it("tracks quotes for several candidate cinemas", async () => {
    const store = new MemoryStore();
    const tampines = await owner(store, "Quote");
    const enquiry = await createChurchRequest(store, tampines, {
      ...requestBody("private", 150),
      cinemas: [cinema, { placeId: "gv-bishan", name: "GV Bishan", lat: 1.35, lng: 103.85, address: "Junction 8" }],
    });
    expect(enquiry.hasHall).toBe(false);
    expect(enquiry.requests[0]?.candidates).toHaveLength(2);
    const requestId = enquiry.requests[0]?.id ?? "";
    const quoted = await updateCandidate(store, tampines, requestId, { cinemaId: "gv-tampines", status: "quoted", quote: "S$1400" });
    expect(quoted.requests[0]?.candidates.find((candidate) => candidate.cinemaId === "gv-tampines")).toMatchObject({
      status: "quoted",
      quote: "S$1400",
    });
    const chosen = await updateCandidate(store, tampines, requestId, { cinemaId: "gv-bishan", status: "chosen", quote: "S$900" });
    expect(chosen.cinemaName).toBe("GV Bishan");
    expect(chosen.requests[0]?.candidates.find((candidate) => candidate.cinemaId === "gv-tampines")?.status).toBe("quoted");
  });

  it("loads the Tampines demo as two enquiries", async () => {
    process.env.CHOSEN_SG_EMAILS = "partner@example.com";
    const store = new MemoryStore();
    const partner = await person(store, "Partner", "partner@example.com");
    const enquiries = await ensureTampinesDemo(store, partner);
    await ensureTampinesDemo(store, partner);
    const privateEnquiry = enquiries.find((item) => item.reference === "E-PRIV");
    const sharedEnquiry = enquiries.find((item) => item.reference === "E-120");
    expect(privateEnquiry?.hasHall).toBe(true);
    expect(privateEnquiry?.cinemaName).toBe("GV Tampines");
    expect(privateEnquiry?.expectedTotal).toBe(150);
    expect(privateEnquiry?.requests[0]?.fictional).toBe(true);
    expect(sharedEnquiry?.expectedTotal).toBe(120);
    expect(sharedEnquiry?.requests).toHaveLength(2);
    const again = await listEnquiryViews(store, partner);
    expect(again.filter((item) => item.reference === "E-120")).toHaveLength(1);
  });
});
