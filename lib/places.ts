import { configureMaps, loadMapsLibrary } from "@/lib/maps";

export type PlacePin = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
};

function toPin(place: google.maps.places.Place): PlacePin | null {
  const location = place.location;
  if (!place.id || !location) return null;
  return {
    placeId: place.id,
    name: place.displayName || "Place",
    address: place.formattedAddress || "",
    lat: location.lat(),
    lng: location.lng(),
  };
}

const fields = ["id", "displayName", "formattedAddress", "location"];

export async function searchCinemas(key: string, center: { lat: number; lng: number }): Promise<PlacePin[]> {
  configureMaps(key);
  const { Place } = await loadMapsLibrary("places");
  const { places } = await Place.searchNearby({
    fields,
    includedPrimaryTypes: ["movie_theater"],
    maxResultCount: 20,
    locationRestriction: { center, radius: 30000 },
  });
  return places.flatMap((place) => {
    const pin = toPin(place);
    return pin ? [pin] : [];
  });
}

export async function searchChurches(
  key: string,
  query: string,
  center?: { lat: number; lng: number },
): Promise<PlacePin[]> {
  configureMaps(key);
  const { Place } = await loadMapsLibrary("places");
  const { places } = await Place.searchByText({
    textQuery: query,
    fields,
    maxResultCount: 5,
    locationBias: center ? { center, radius: 50000 } : undefined,
  });
  return places.flatMap((place) => {
    const pin = toPin(place);
    return pin ? [pin] : [];
  });
}
