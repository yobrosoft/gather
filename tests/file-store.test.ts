import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { FileStore } from "@/lib/file-store";

describe("file store", () => {
  it("reloads a church from disk", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "gather-"));
    const file = path.join(dir, "store.json");
    const first = new FileStore(file);
    await first.saveChurch({
      id: "church-1",
      name: "Ada Church",
      placeId: "",
      lat: 1,
      lng: 2,
      address: "",
      leaderUserId: "ada",
      ownerIds: ["ada"],
      inviteCode: "ABCD2345",
      ownerInviteCode: "OWNER234",
      catchment: [],
    });
    const second = new FileStore(file);
    expect((await second.getChurch("church-1"))?.name).toBe("Ada Church");
  });
});
