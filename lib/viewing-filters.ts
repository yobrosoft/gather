import { bookingLabel } from "@/lib/format";
import type { BookingStatus, EventView } from "@/lib/types";

export type ViewingQuery = {
  query: string;
  churchId: string;
  stage: "" | BookingStatus;
  ownedOnly: boolean;
};

export function matchesViewing(event: EventView, filters: ViewingQuery): boolean {
  if (filters.ownedOnly && !event.viewerIsHost) return false;
  if (filters.churchId && event.hostChurchId !== filters.churchId) return false;
  if (filters.stage && event.bookingStatus !== filters.stage) return false;
  const needle = filters.query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    event.title,
    event.hostChurchName,
    event.cinema?.name ?? "",
    event.cinema?.address ?? "",
    bookingLabel(event.bookingStatus),
    ...event.verses.flatMap((verse) => [verse.reference, verse.text, verse.translation ?? ""]),
  ]
    .join("\n")
    .toLowerCase();
  return haystack.includes(needle);
}

export function hostChurchOptions(events: EventView[]): Array<{ id: string; name: string }> {
  const names = new Map<string, string>();
  for (const event of events) names.set(event.hostChurchId, event.hostChurchName);
  return [...names.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
