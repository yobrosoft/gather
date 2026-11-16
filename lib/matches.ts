import { distanceKm } from "@/lib/geo";
import { AUDITORIUM_SEATS } from "@/lib/chosen";
import type { RequestMode, RequestStatus } from "@/lib/types";

export type MatchRequest = {
  id: string;
  hostChurchId: string;
  hostChurchName: string;
  churchLat: number;
  churchLng: number;
  cinemaPlaceId: string | null;
  cinemaName: string | null;
  date: string;
  screeningMode: RequestMode;
  requestStatus: RequestStatus;
  expectedHeadcount: number;
  capacity: number;
};

export type AreaGroup = {
  key: string;
  date: string;
  cinemaPlaceId: string;
  cinemaName: string;
  expectedTotal: number;
  hallSeats: number;
  couldFill: boolean;
  requests: MatchRequest[];
};

export type NearbyCluster = {
  date: string;
  churches: string[];
  expectedTotal: number;
};

export function groupByCinemaDate(requests: MatchRequest[]): AreaGroup[] {
  const groups = new Map<string, MatchRequest[]>();
  for (const request of requests) {
    if (!request.cinemaPlaceId || request.requestStatus === "declined") continue;
    const key = `${request.date}|${request.cinemaPlaceId}`;
    const list = groups.get(key) ?? [];
    list.push(request);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const expectedTotal = list.reduce((sum, request) => sum + request.expectedHeadcount, 0);
      const hallSeats = Math.max(AUDITORIUM_SEATS, ...list.map((request) => request.capacity));
      return {
        key,
        date: list[0]?.date ?? "",
        cinemaPlaceId: list[0]?.cinemaPlaceId ?? "",
        cinemaName: list[0]?.cinemaName || "Cinema",
        expectedTotal,
        hallSeats,
        couldFill: expectedTotal >= hallSeats || expectedTotal >= AUDITORIUM_SEATS,
        requests: list.slice().sort((a, b) => b.expectedHeadcount - a.expectedHeadcount || a.hostChurchName.localeCompare(b.hostChurchName)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || b.expectedTotal - a.expectedTotal || a.cinemaName.localeCompare(b.cinemaName));
}

export function nearbyChurches(requests: MatchRequest[], km = 8): NearbyCluster[] {
  const byDate = new Map<string, MatchRequest[]>();
  for (const request of requests) {
    if (request.requestStatus === "declined") continue;
    const list = byDate.get(request.date) ?? [];
    if (!list.some((item) => item.hostChurchId === request.hostChurchId)) list.push(request);
    byDate.set(request.date, list);
  }
  const clusters: NearbyCluster[] = [];
  for (const [date, list] of byDate) {
    const used = new Set<string>();
    for (const church of list) {
      if (used.has(church.hostChurchId)) continue;
      const group = list.filter(
        (other) =>
          other.hostChurchId === church.hostChurchId ||
          distanceKm({ lat: church.churchLat, lng: church.churchLng }, { lat: other.churchLat, lng: other.churchLng }) <= km,
      );
      if (group.length < 2) continue;
      for (const item of group) used.add(item.hostChurchId);
      clusters.push({
        date,
        churches: group.map((item) => item.hostChurchName),
        expectedTotal: group.reduce((sum, item) => sum + item.expectedHeadcount, 0),
      });
    }
  }
  return clusters.sort((a, b) => a.date.localeCompare(b.date) || b.expectedTotal - a.expectedTotal);
}
