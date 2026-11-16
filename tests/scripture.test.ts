import { describe, expect, it } from "vitest";
import { canonicalPassageId, passageId, sortBibles } from "@/lib/scripture";

describe("scripture passages", () => {
  it("builds an exact verse and a same-chapter range", () => {
    expect(passageId("jhn", 3, 16)).toBe("JHN.3.16");
    expect(passageId("JHN", 3, 16, 18)).toBe("JHN.3.16-18");
    expect(canonicalPassageId("mat.1.1")).toBe("MAT.1.1");
  });

  it("rejects a range that crosses chapters", () => {
    expect(() => canonicalPassageId("JHN.3.16-4.1")).toThrow(/one chapter/);
  });

  it("puts NIV and ESV ahead of other translations", () => {
    expect(
      sortBibles([
        { id: 1, abbreviation: "KJV", title: "King James" },
        { id: 111, abbreviation: "NIV", title: "New International Version" },
        { id: 59, abbreviation: "ESV", title: "English Standard Version" },
      ]).map((bible) => bible.abbreviation),
    ).toEqual(["NIV", "ESV", "KJV"]);
  });
});
