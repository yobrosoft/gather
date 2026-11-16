import "server-only";

import { homedir } from "os";
import path from "path";
import { FileStore } from "@/lib/file-store";
import type { MemoryStore } from "@/lib/memory-store";
import { assertSafeFirestoreProject } from "@/lib/project";

export type Store = MemoryStore;

let singleton: Store | null = null;
let logged = false;

export function dataDir(): string {
  return process.env.GATHER_DATA_DIR?.trim() || path.join(homedir(), ".local", "share", "gather");
}

export function dataFile(): string {
  return process.env.GATHER_DATA_FILE?.trim() || path.join(dataDir(), "store.json");
}

export function storeKind(): "file" | "firestore-emulator" | "firestore" {
  if (process.env.FIRESTORE_EMULATOR_HOST?.trim()) return "firestore-emulator";
  if (process.env.GATHER_USE_FIRESTORE === "live") return "firestore";
  return "file";
}

export async function getStore(): Promise<Store> {
  if (singleton) return singleton;
  const kind = storeKind();
  if (kind === "file") {
    singleton = new FileStore(dataFile());
  } else {
    const projectId = process.env.GATHER_FIRESTORE_PROJECT?.trim() || (kind === "firestore-emulator" ? "gather-local" : "");
    if (!projectId) throw new Error("Set GATHER_FIRESTORE_PROJECT to the Gather Cloud project.");
    assertSafeFirestoreProject(projectId);
    const { createFirestoreStore } = await import("@/lib/firestore-store");
    singleton = createFirestoreStore(projectId);
  }
  if (!logged) {
    logged = true;
    console.log(
      kind === "file" ? "Gather store: local file" : kind === "firestore" ? "Gather store: Firestore" : "Gather store: Firestore emulator",
    );
  }
  return singleton;
}
