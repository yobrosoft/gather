import type { Visibility } from "@/lib/types";

export function canSeeScreening(
  screening: { hostChurchId: string; visibility: Visibility },
  viewer: { churchId: string | null },
): boolean {
  if (screening.visibility === "open") return true;
  return viewer.churchId != null && viewer.churchId === screening.hostChurchId;
}
