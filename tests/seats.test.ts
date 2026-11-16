import { describe, expect, it } from "vitest";
import { fitProblem, seatsRemaining, seatsTaken } from "@/lib/seats";

describe("seats", () => {
  it("sums members and guests", () => {
    expect(seatsTaken([{ members: 4, guests: 1 }, { members: 2, guests: 0 }])).toBe(7);
    expect(seatsRemaining(10, [{ members: 4, guests: 1 }])).toBe(5);
  });

  it("rejects a party larger than the seats left", () => {
    const parties = [{ id: "a", members: 8, guests: 0 }];
    expect(fitProblem(10, parties, { members: 3, guests: 0 })).toMatch(/Only 2 seats are left/);
  });

  it("counts the seats a replaced party frees", () => {
    const parties = [{ id: "a", members: 8, guests: 0 }];
    expect(fitProblem(10, parties, { members: 6, guests: 0 }, "a")).toBeNull();
    expect(fitProblem(10, parties, { members: 9, guests: 2 }, "a")).toMatch(/Only 10 seats are left/);
  });

  it("rejects an empty party", () => {
    expect(fitProblem(10, [], { members: 0, guests: 0 })).toMatch(/at least one person/);
  });
});
