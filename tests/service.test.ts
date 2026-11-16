import { describe, expect, it } from "vitest";
import { MemoryStore } from "@/lib/memory-store";
import { screeningInput } from "@/lib/schema";
import {
  addParty,
  addPartyByToken,
  claimChurch,
  decideAttendance,
  createChurch,
  createScreening,
  deleteScreening,
  eventByToken,
  getEvent,
  joinChurch,
  listEvents,
  removeParty,
  ServiceError,
  updateScreening,
} from "@/lib/service";
import type { UserRecord } from "@/lib/types";
import { assertSafeFirestoreProject } from "@/lib/project";

const cinema = {
  placeId: "cinema-1",
  name: "Harbour Cinema",
  lat: 1.3,
  lng: 103.8,
  address: "1 Harbour Road",
};

async function person(store: MemoryStore, name: string): Promise<UserRecord> {
  const user: UserRecord = {
    id: name.toLowerCase(),
    googleSub: name,
    name,
    email: `${name.toLowerCase()}@example.com`,
    churchId: null,
  };
  await store.saveUser(user);
  return user;
}

describe("whole-theatre booking", () => {
  it("keeps one host and hides a private viewing from other churches", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    const ben = await person(store, "Ben");
    const cara = await person(store, "Cara");
    const adaChurch = await createChurch(store, ada, { name: "Ada Church", lat: 1.3, lng: 103.8 });
    await createChurch(store, ben, { name: "Ben Church", lat: 1.35, lng: 103.85 });

    const viewing = await createScreening(store, ada, {
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 10,
      visibility: "private",
      cinema,
    });
    expect(viewing.hostChurchId).toBe(adaChurch.id);
    expect(viewing.hostChurchName).toBe("Ada Church");
    expect(await listEvents(store, ben)).toEqual([]);

    await expect(joinChurch(store, ben, adaChurch.inviteCode)).rejects.toBeInstanceOf(ServiceError);
    await joinChurch(store, cara, adaChurch.inviteCode);
    const caraEvents = await listEvents(store, cara);
    expect(caraEvents).toHaveLength(1);
    await addParty(store, cara, viewing.id, { members: 2, guests: 1 });

    const opened = await updateScreening(store, ada, viewing.id, { visibility: "open" });
    expect(opened.hostChurchId).toBe(adaChurch.id);
    expect(opened.taken).toBe(3);

    await addParty(store, ben, viewing.id, { members: 4, guests: 0 });
    const filled = await listEvents(store, ada);
    expect(filled[0]?.hostChurchId).toBe(adaChurch.id);
    expect(filled[0]?.taken).toBe(7);
    expect(filled[0]?.parties.map((party) => party.churchName).sort()).toEqual(["Ada Church", "Ben Church"]);

    const dan = await person(store, "Dan");
    await expect(addParty(store, dan, viewing.id, { members: 4, guests: 0 })).rejects.toThrow(/Only 3 seats are left/);
    expect((await listEvents(store, ada))[0]?.taken).toBe(7);

    await expect(
      updateScreening(store, ada, viewing.id, { hostChurchId: ben.churchId }),
    ).rejects.toThrow(/host church stays the same/);

    const closed = await updateScreening(store, ada, viewing.id, { visibility: "private" });
    expect(await listEvents(store, ben)).toEqual([]);
    expect(closed.parties).toHaveLength(2);
    expect((await listEvents(store, cara))[0]?.parties).toHaveLength(2);

    const bens = closed.parties.find((party) => party.personName === "Ben");
    expect(bens).toBeTruthy();
    await expect(removeParty(store, ben, viewing.id, caraEvents[0]!.viewerPartyId || "missing")).rejects.toThrow(
      /No viewing/,
    );
    await removeParty(store, ada, viewing.id, bens!.id);
    expect((await listEvents(store, ada))[0]?.parties.map((party) => party.personName)).toEqual(["Cara"]);
  });

  it("lets someone join a private viewing with the Gather link", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    const ben = await person(store, "Ben");
    const adaChurch = await createChurch(store, ada, { name: "Ada Church", lat: 1.3, lng: 103.8 });
    await createChurch(store, ben, { name: "Ben Church", lat: 1.35, lng: 103.85 });
    const viewing = await createScreening(store, ada, {
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 10,
      visibility: "private",
      cinema,
    });
    const token = viewing.joinPath.split("/").pop() ?? "";
    expect(await listEvents(store, ben)).toEqual([]);
    await expect(eventByToken(store, ben, "NOTATOKENNOTATOK")).rejects.toThrow(/does not match/);
    const opened = await eventByToken(store, ben, token);
    expect(opened.hostChurchId).toBe(adaChurch.id);
    const joined = await addPartyByToken(store, ben, token, { members: 2, guests: 1 });
    expect(joined.hostChurchId).toBe(adaChurch.id);
    expect(joined.taken).toBe(3);
    expect(await listEvents(store, ben)).toEqual([]);
    expect((await listEvents(store, ada))[0]?.parties.map((party) => party.churchName)).toEqual(["Ben Church"]);
  });

  it("lets an invited Google account become an owner", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    const ben = await person(store, "Ben");
    const church = await createChurch(store, ada, { name: "Ada Church", lat: 1.3, lng: 103.8 });
    await joinChurch(store, ben, church.ownerInviteCode);
    const saved = await store.getChurch(church.id);
    expect(saved?.ownerIds).toEqual([ada.id, ben.id]);
    expect(saved?.leaderUserId).toBe(ada.id);
    const viewing = await createScreening(store, ben, {
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "UTC",
      capacity: 20,
      visibility: "private",
      cinema,
    });
    expect(viewing.hostChurchId).toBe(church.id);
    expect(viewing.viewerIsHost).toBe(true);
  });

  it("lets the host church delete a viewing", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    const ben = await person(store, "Ben");
    await createChurch(store, ada, { name: "Ada Church", lat: 1.3, lng: 103.8 });
    await createChurch(store, ben, { name: "Ben Church", lat: 1.35, lng: 103.85 });
    const viewing = await createScreening(store, ada, {
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 10,
      visibility: "open",
      cinema,
    });
    await store.saveParty({ id: "party-ben", eventId: viewing.id, userId: ben.id, churchId: null, members: 2, guests: 1 });
    await expect(deleteScreening(store, ben, viewing.id)).rejects.toThrow(/host church/);
    await deleteScreening(store, ada, viewing.id);
    expect(await store.getScreening(viewing.id)).toBeNull();
    expect(await store.listParties(viewing.id)).toEqual([]);
    expect(await listEvents(store, null)).toEqual([]);
  });

  it("keeps reserved seats until the host accepts an update", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    const ben = await person(store, "Ben");
    await createChurch(store, ada, { name: "Ada Church", lat: 1.3, lng: 103.8 });
    const viewing = await createScreening(store, ada, {
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 10,
      visibility: "open",
      cinema,
    });
    const asked = await addParty(store, ben, viewing.id, { members: 2, guests: 1 });
    const partyId = asked.viewerPartyId ?? "";
    const accepted = await decideAttendance(store, ada, viewing.id, partyId, "accept");
    expect(accepted.taken).toBe(3);
    const changed = await addParty(store, ben, viewing.id, { members: 6, guests: 0 });
    expect(changed.taken).toBe(3);
    expect(changed.parties.find((party) => party.id === partyId)?.proposedMembers).toBe(6);
    const kept = await decideAttendance(store, ada, viewing.id, partyId, "declineUpdate");
    expect(kept.taken).toBe(3);
    expect(kept.parties.find((party) => party.id === partyId)?.proposedMembers).toBeNull();
    await addParty(store, ben, viewing.id, { members: 4, guests: 1 });
    const applied = await decideAttendance(store, ada, viewing.id, partyId, "accept");
    expect(applied.taken).toBe(5);
    const revoked = await decideAttendance(store, ada, viewing.id, partyId, "revoke");
    expect(revoked.taken).toBe(0);
  });

  it("refuses a booking from someone who does not own the church", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    await expect(
      createScreening(store, ada, {
        startsAt: "2026-12-05T11:00:00.000Z",
        timeZone: "Asia/Singapore",
        capacity: 10,
        visibility: "private",
        cinema,
      }),
    ).rejects.toThrow(/Claim a church/);
  });

  it("refuses a capacity below the seats already taken", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    await createChurch(store, ada, { name: "Ada Church", lat: 1, lng: 2 });
    const viewing = await createScreening(store, ada, {
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "UTC",
      capacity: 10,
      visibility: "private",
      cinema,
    });
    await addParty(store, ada, viewing.id, { members: 6, guests: 0 });
    await expect(updateScreening(store, ada, viewing.id, { capacity: 5 })).rejects.toThrow(/seats already taken/);
  });

  it("does not accept a host church on the booking payload", () => {
    const parsed = screeningInput.safeParse({
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "UTC",
      capacity: 10,
      visibility: "private",
      cinema,
      hostChurchId: "someone-else",
    });
    expect(parsed.success).toBe(false);
  });

  it("lists open viewings before sign-in and keeps private ones hidden", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    await createChurch(store, ada, { name: "Ada Church", lat: 1.3, lng: 103.8 });
    await createScreening(store, ada, {
      title: "The Chosen",
      durationMinutes: 55,
      videoUrl: "https://youtu.be/abcdefghijk",
      verses: [{ reference: "John 1:14", text: "The Word became flesh." }],
      bookingStatus: "tbd",
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 40,
      visibility: "open",
    });
    await createScreening(store, ada, {
      startsAt: "2026-12-06T11:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 40,
      visibility: "private",
      cinema,
    });
    const publicEvents = await listEvents(store, null);
    expect(publicEvents).toHaveLength(1);
    expect(publicEvents[0]?.title).toBe("The Chosen");
    expect(publicEvents[0]?.durationMinutes).toBe(55);
    expect(publicEvents[0]?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk");
    expect(publicEvents[0]?.verses[0]?.reference).toBe("John 1:14");
    expect(publicEvents[0]?.bookingStatus).toBe("tbd");
    expect(publicEvents[0]?.cinema).toBeNull();
    expect(publicEvents[0]?.parties).toEqual([]);
    const opened = await getEvent(store, null, publicEvents[0]!.id);
    expect(opened.verses[0]?.reference).toBe("John 1:14");
    const hidden = await listEvents(store, ada);
    const privateId = hidden.find((event) => event.visibility === "private")?.id;
    await expect(getEvent(store, null, privateId!)).rejects.toThrow(/Sign in/);
  });

  it("holds a cinema for a date once a booking is pending or booked", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    const ben = await person(store, "Ben");
    await createChurch(store, ada, { name: "Ada Church", placeId: "church-ada", lat: 1.3, lng: 103.8 });
    await createChurch(store, ben, { name: "Ben Church", placeId: "church-ben", lat: 1.35, lng: 103.85 });
    await createScreening(store, ada, {
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 20,
      visibility: "open",
      bookingStatus: "pending",
      cinema,
    });
    const shared = await createScreening(store, ben, {
      startsAt: "2026-12-05T14:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 120,
      visibility: "open",
      bookingStatus: "tbd",
      screeningMode: "shared",
      requestStatus: "sent",
      expectedHeadcount: 45,
      cinema,
    });
    expect(shared.screeningMode).toBe("shared");
    expect(shared.expectedHeadcount).toBe(45);
    await createScreening(store, ada, {
      startsAt: "2026-12-05T11:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 20,
      visibility: "open",
      bookingStatus: "booked",
      cinema,
    });
    await expect(
      createScreening(store, ben, {
        startsAt: "2026-12-19T14:00:00.000Z",
        timeZone: "Asia/Singapore",
        capacity: 20,
        visibility: "open",
        bookingStatus: "booked",
        cinema,
      }),
    ).resolves.toMatchObject({ bookingStatus: "booked" });
    await expect(
      createScreening(store, ben, {
        startsAt: "2026-12-05T14:00:00.000Z",
        timeZone: "Asia/Singapore",
        capacity: 20,
        visibility: "open",
        bookingStatus: "booked",
        cinema,
      }),
    ).rejects.toThrow(/already has a private booking/);
    const later = await createScreening(store, ben, {
      startsAt: "2026-12-12T14:00:00.000Z",
      timeZone: "Asia/Singapore",
      capacity: 20,
      visibility: "open",
      bookingStatus: "booked",
      cinema,
    });
    expect(later.bookingStatus).toBe("booked");
    await expect(
      createScreening(store, ada, {
        startsAt: "2026-12-05T11:00:00.000Z",
        timeZone: "Asia/Singapore",
        capacity: 10,
        visibility: "open",
        bookingStatus: "pending",
      }),
    ).rejects.toThrow(/Choose a cinema/);
  });

  it("lets someone claim an unclaimed church and refuses a second claim", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    const ben = await person(store, "Ben");
    await store.saveChurch({
      id: "grace",
      name: "Grace Church",
      placeId: "place-grace",
      lat: 1.35,
      lng: 103.82,
      address: "1 Grace Road",
      leaderUserId: "",
      ownerIds: [],
      inviteCode: "JOIN2345",
      ownerInviteCode: "OWNR2345",
      catchment: [],
    });
    const claimed = await claimChurch(store, ada, {
      name: "Grace Church",
      placeId: "place-grace",
      lat: 1.35,
      lng: 103.82,
      address: "1 Grace Road",
    });
    expect(claimed.ownerIds).toEqual([ada.id]);
    await expect(
      claimChurch(store, ben, {
        name: "Grace Church",
        placeId: "place-grace",
        lat: 1.35,
        lng: 103.82,
      }),
    ).rejects.toThrow(/already claimed/);
    await expect(
      claimChurch(store, ada, {
        name: "Other Church",
        placeId: "place-other",
        lat: 1.2,
        lng: 103.7,
      }),
    ).rejects.toThrow(/already own a church/);
  });

  it("rejects a preview that is not a YouTube link", async () => {
    const store = new MemoryStore();
    const ada = await person(store, "Ada");
    await createChurch(store, ada, { name: "Ada Church", lat: 1, lng: 2 });
    await expect(
      createScreening(store, ada, {
        startsAt: "2026-12-05T11:00:00.000Z",
        timeZone: "UTC",
        capacity: 10,
        visibility: "open",
        videoUrl: "https://example.com/watch?v=abcdefghijk",
        cinema,
      }),
    ).rejects.toThrow(/YouTube/);
  });

  it("refuses the Waymark Google Cloud project", () => {
    expect(() => assertSafeFirestoreProject("project-60413c08-2fb7-476d-803")).toThrow(/Waymark/);
    expect(() => assertSafeFirestoreProject("gather-local")).not.toThrow();
  });
});
