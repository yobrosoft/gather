import { describe, expect, it } from "vitest";
import { groupByCinemaDate, nearbyChurches, type MatchRequest } from "@/lib/matches";

function request(patch: Partial<MatchRequest>): MatchRequest {
  return {
    id: "1",
    hostChurchId: "a",
    hostChurchName: "Ada Church",
    churchLat: 1.3,
    churchLng: 103.8,
    cinemaPlaceId: "shaw",
    cinemaName: "Shaw",
    date: "2026-12-05",
    screeningMode: "shared",
    requestStatus: "sent",
    expectedHeadcount: 40,
    capacity: 120,
    ...patch,
  };
}

describe("area matches", () => {
  it("adds churches at the same cinema and date until they can fill a hall", () => {
    const groups = groupByCinemaDate([
      request({ id: "ada", expectedHeadcount: 40 }),
      request({ id: "ben", hostChurchId: "b", hostChurchName: "Ben Church", expectedHeadcount: 50 }),
      request({ id: "later", date: "2026-12-12", expectedHeadcount: 90 }),
    ]);
    expect(groups[0]?.expectedTotal).toBe(90);
    expect(groups[0]?.couldFill).toBe(true);
    expect(groups[0]?.requests).toHaveLength(2);
  });

  it("clusters churches a short drive apart on the same day", () => {
    const clusters = nearbyChurches([
      request({ cinemaPlaceId: "shaw" }),
      request({
        id: "ben",
        hostChurchId: "b",
        hostChurchName: "Ben Church",
        churchLat: 1.31,
        churchLng: 103.81,
        cinemaPlaceId: "gv",
        cinemaName: "GV",
        expectedHeadcount: 30,
      }),
    ]);
    expect(clusters[0]?.churches).toEqual(["Ada Church", "Ben Church"]);
    expect(clusters[0]?.expectedTotal).toBe(70);
  });
});
