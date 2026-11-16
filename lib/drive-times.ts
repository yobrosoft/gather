import { worstTravel } from "@/lib/rank";
import { configureMaps, loadMapsLibrary } from "@/lib/maps";

export type LatLng = { lat: number; lng: number };
export type DriveStop = LatLng & { id: string };

const cache = new Map<string, number | null>();

function cacheKey(origins: LatLng[], stop: DriveStop): string {
  const from = origins.map((origin) => `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}`).join(";");
  return `${from}|${stop.id}|${stop.lat.toFixed(4)},${stop.lng.toFixed(4)}`;
}

export async function worstDriveMinutes(
  mapsKey: string,
  origins: LatLng[],
  stops: DriveStop[],
): Promise<Record<string, number | null>> {
  const result: Record<string, number | null> = {};
  const missing: DriveStop[] = [];
  const originSlice = origins.slice(0, 5);
  for (const stop of stops) {
    const key = cacheKey(originSlice, stop);
    if (cache.has(key)) result[stop.id] = cache.get(key) ?? null;
    else missing.push(stop);
  }
  if (missing.length === 0 || originSlice.length === 0 || !mapsKey) return result;

  configureMaps(mapsKey);
  const { RouteMatrix } = await loadMapsLibrary("routes");
  for (let index = 0; index < missing.length; index += 25) {
    const chunk = missing.slice(index, index + 25);
    const { matrix } = await RouteMatrix.computeRouteMatrix({
      origins: originSlice.map((origin) => ({ lat: origin.lat, lng: origin.lng })),
      destinations: chunk.map((stop) => ({ lat: stop.lat, lng: stop.lng })),
      travelMode: "DRIVING",
      fields: ["durationMillis", "condition"],
    });
    chunk.forEach((stop, destinationIndex) => {
      const minutes = originSlice.map((_, originIndex) => {
        const item = matrix.rows[originIndex]?.items[destinationIndex];
        if (!item || item.condition !== "ROUTE_EXISTS" || item.durationMillis == null || !Number.isFinite(item.durationMillis)) {
          return null;
        }
        return item.durationMillis / 60000;
      });
      const worst = worstTravel(minutes);
      cache.set(cacheKey(originSlice, stop), worst);
      result[stop.id] = worst;
    });
  }
  return result;
}
