import "server-only";

import type { PublicConfig } from "@/lib/types";

export type { PublicConfig };

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function publicConfig(): PublicConfig {
  return {
    mapsKey: clean(process.env.GOOGLE_MAPS_API_KEY),
    googleClientId: clean(process.env.GOOGLE_CLIENT_ID),
    devAuth: process.env.GATHER_DEV_AUTH === "1",
  };
}
