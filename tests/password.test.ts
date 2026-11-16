import { describe, expect, it } from "vitest";
import { checkPassword, hashPassword } from "@/lib/password";

describe("password", () => {
  it("accepts the password that was hashed and rejects another", async () => {
    const stored = await hashPassword("correct-horse");
    expect(stored.startsWith("scrypt$")).toBe(true);
    expect(await checkPassword("correct-horse", stored)).toBe(true);
    expect(await checkPassword("wrong-horse", stored)).toBe(false);
    expect(await checkPassword("correct-horse", "not-a-hash")).toBe(false);
  });
});
