import { describe, expect, it } from "vitest";
import type { EventView } from "@/lib/types";
import { hostChurchOptions, matchesViewing } from "@/lib/viewing-filters";

function viewing(patch: Partial<EventView>): EventView {
  return {
    id: "1",
    title: "The Chosen",
    durationMinutes: 50,
    videoUrl: "",
    embedUrl: null,
    verses: [{ reference: "John 1:14", text: "The Word became flesh." }],
    bookingStatus: "booked",
    startsAt: "2026-12-05T11:00:00.000Z",
    timeZone: "Asia/Singapore",
    capacity: 40,
    visibility: "open",
    joinPath: "/e/abc",
    hostChurchId: "ada",
    hostChurchName: "Ada Church",
    cinema: { id: "c", placeId: "p", name: "Harbour Cinema", lat: 1, lng: 2, address: "1 Harbour Road" },
    taken: 0,
    remaining: 40,
    viewerIsHost: false,
    viewerPartyId: null,
    parties: [],
    ...patch,
  };
}

const open = { query: "", churchId: "", stage: "" as const, ownedOnly: false };

describe("viewing filters", () => {
  const events = [
    viewing({ id: "ada", hostChurchName: "Ada Church" }),
    viewing({
      id: "ben",
      title: "Christmas showing",
      hostChurchId: "ben",
      hostChurchName: "Ben Church",
      bookingStatus: "pending",
      viewerIsHost: true,
      cinema: null,
      verses: [],
    }),
  ];

  it("matches a church name, a title, or a verse", () => {
    expect(events.filter((event) => matchesViewing(event, { ...open, query: "ben church" })).map((event) => event.id)).toEqual(["ben"]);
    expect(events.filter((event) => matchesViewing(event, { ...open, query: "john 1" })).map((event) => event.id)).toEqual(["ada"]);
    expect(events.filter((event) => matchesViewing(event, { ...open, query: "harbour" })).map((event) => event.id)).toEqual(["ada"]);
  });

  it("filters by church, booking stage, and ownership", () => {
    expect(events.filter((event) => matchesViewing(event, { ...open, churchId: "ada" }))).toHaveLength(1);
    expect(events.filter((event) => matchesViewing(event, { ...open, stage: "pending" })).map((event) => event.id)).toEqual(["ben"]);
    expect(events.filter((event) => matchesViewing(event, { ...open, ownedOnly: true })).map((event) => event.id)).toEqual(["ben"]);
  });

  it("lists host churches in name order", () => {
    expect(hostChurchOptions(events)).toEqual([
      { id: "ada", name: "Ada Church" },
      { id: "ben", name: "Ben Church" },
    ]);
  });
});
