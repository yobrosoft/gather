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

export function storeKind(): "file" | "firestore-emulator" {
  return process.env.FIRESTORE_EMULATOR_HOST?.trim() ? "firestore-emulator" : "file";
}

export async function getStore(): Promise<Store> {
  if (singleton) return singleton;
  if (storeKind() === "firestore-emulator") {
    const projectId = process.env.GATHER_FIRESTORE_PROJECT?.trim() || "gather-local";
    assertSafeFirestoreProject(projectId);
    const { createFirestoreStore } = await import("@/lib/firestore-store");
    singleton = createFirestoreStore(projectId);
  } else {
    singleton = new FileStore(dataFile());
  }
  if (!logged) {
    logged = true;
    console.log(storeKind() === "file" ? "Gather store: local file" : "Gather store: Firestore emulator");
  }
  return singleton;
}
