export const TRAVEL_BUDGET_MINUTES = 35;

export function worstTravel(minutes: Array<number | null>): number | null {
  if (minutes.length === 0) return null;
  if (minutes.some((minute) => minute == null || !Number.isFinite(minute) || minute < 0)) return null;
  return Math.max(...(minutes as number[]));
}

export function convenienceScore(travelMinutes: number): number {
  return Math.min(1, Math.max(0, 1 - travelMinutes / TRAVEL_BUDGET_MINUTES));
}

export function memberEventScore(travelMinutes: number, taken: number, capacity: number): number {
  const fullness = capacity > 0 ? taken / capacity : 0;
  return 0.7 * convenienceScore(travelMinutes) + 0.3 * fullness;
}

export type TravelPlace = {
  id: string;
  worstTravelMinutes: number | null;
};

export function partitionByTravel<T extends TravelPlace>(places: T[]): {
  recommended: T[];
  dimmed: T[];
  unknown: T[];
} {
  const recommended: T[] = [];
  const dimmed: T[] = [];
  const unknown: T[] = [];
  for (const place of places) {
    if (place.worstTravelMinutes == null) unknown.push(place);
    else if (place.worstTravelMinutes <= TRAVEL_BUDGET_MINUTES) recommended.push(place);
    else dimmed.push(place);
  }
  const byTravel = (a: T, b: T) =>
    (a.worstTravelMinutes ?? 0) - (b.worstTravelMinutes ?? 0) || a.id.localeCompare(b.id);
  recommended.sort(byTravel);
  dimmed.sort(byTravel);
  unknown.sort((a, b) => a.id.localeCompare(b.id));
  return { recommended, dimmed, unknown };
}

export type MemberEvent = {
  id: string;
  hostChurchId: string;
  travelMinutes: number | null;
  taken: number;
  capacity: number;
};

export function rankEventsForMember<T extends MemberEvent>(
  events: T[],
  userChurchId: string | null,
): { recommended: T[]; dimmed: T[] } {
  const own = events.filter((event) => userChurchId != null && event.hostChurchId === userChurchId);
  const others = events.filter(
    (event) => (userChurchId == null || event.hostChurchId !== userChurchId) && event.taken < event.capacity,
  );
  const scored: T[] = [];
  const dimmed: T[] = [];
  for (const event of others) {
    if (event.travelMinutes != null && event.travelMinutes > TRAVEL_BUDGET_MINUTES) dimmed.push(event);
    else scored.push(event);
  }
  const scoreOf = (event: T) =>
    event.travelMinutes == null ? -1 : memberEventScore(event.travelMinutes, event.taken, event.capacity);
  own.sort((a, b) => a.id.localeCompare(b.id));
  scored.sort((a, b) => scoreOf(b) - scoreOf(a) || a.id.localeCompare(b.id));
  dimmed.sort((a, b) => (a.travelMinutes ?? 0) - (b.travelMinutes ?? 0) || a.id.localeCompare(b.id));
  return { recommended: [...own, ...scored], dimmed };
}
