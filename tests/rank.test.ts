import { describe, expect, it } from "vitest";
import {
  memberEventScore,
  partitionByTravel,
  rankEventsForMember,
  worstTravel,
} from "@/lib/rank";

describe("travel", () => {
  it("uses the longest drive, so a catchment pin can outrank a nearer cinema", () => {
    const nearChurchFarFromMembers = worstTravel([8, 42]);
    const balanced = worstTravel([18, 20]);
    expect(nearChurchFarFromMembers).toBe(42);
    expect(balanced).toBe(20);
    const ranked = partitionByTravel([
      { id: "near-building", worstTravelMinutes: nearChurchFarFromMembers, fullness: 0 },
      { id: "balanced", worstTravelMinutes: balanced, fullness: 1 },
    ]);
    expect(ranked.recommended.map((place) => place.id)).toEqual(["balanced"]);
    expect(ranked.dimmed.map((place) => place.id)).toEqual(["near-building"]);
  });

  it("returns null when any origin has no route", () => {
    expect(worstTravel([10, null])).toBeNull();
    expect(worstTravel([])).toBeNull();
  });

  it("sorts bookable cinemas by travel only", () => {
    const ranked = partitionByTravel([
      { id: "far", worstTravelMinutes: 30 },
      { id: "close", worstTravelMinutes: 12 },
      { id: "unknown", worstTravelMinutes: null },
      { id: "beyond", worstTravelMinutes: 50 },
    ]);
    expect(ranked.recommended.map((place) => place.id)).toEqual(["close", "far"]);
    expect(ranked.dimmed.map((place) => place.id)).toEqual(["beyond"]);
    expect(ranked.unknown.map((place) => place.id)).toEqual(["unknown"]);
  });
});

describe("member ranking", () => {
  it("keeps the viewer's own church first, then a fuller convenient viewing", () => {
    const own = { id: "own", hostChurchId: "ada", travelMinutes: 40, taken: 10, capacity: 10 };
    const filling = { id: "filling", hostChurchId: "ben", travelMinutes: 10, taken: 80, capacity: 100 };
    const empty = { id: "empty", hostChurchId: "cara", travelMinutes: 5, taken: 0, capacity: 100 };
    const fullOther = { id: "full", hostChurchId: "dan", travelMinutes: 5, taken: 100, capacity: 100 };
    const ranked = rankEventsForMember([empty, fullOther, filling, own], "ada");
    expect(ranked.recommended.map((event) => event.id)).toEqual(["own", "filling", "empty"]);
    expect(memberEventScore(10, 80, 100)).toBeGreaterThan(memberEventScore(5, 0, 100));
  });

  it("hides far opened viewings from the recommended list", () => {
    const ranked = rankEventsForMember(
      [{ id: "far", hostChurchId: "ben", travelMinutes: 50, taken: 10, capacity: 100 }],
      "ada",
    );
    expect(ranked.recommended).toEqual([]);
    expect(ranked.dimmed.map((event) => event.id)).toEqual(["far"]);
  });
});
