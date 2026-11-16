"use client";

import { useEffect, useRef, useState } from "react";
import { configureMaps, loadMapsLibrary } from "@/lib/maps";

const NIGHT = [
  { elementType: "geometry", stylers: [{ color: "#161715" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#d9d2c5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#161715" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e2c2e" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2b28" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e1f1c" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2620" }] },
];

export function DirectionsMap({
  mapsKey,
  destination,
}: {
  mapsKey: string;
  destination: { lat: number; lng: number; name: string; address: string } | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const linesRef = useRef<google.maps.Polyline[]>([]);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const fittedRef = useRef(false);
  const [summary, setSummary] = useState("");
  const [note, setNote] = useState("");
  const [drawing, setDrawing] = useState(false);
  const lat = destination?.lat;
  const lng = destination?.lng;
  const name = destination?.name ?? "";

  useEffect(() => {
    if (!mapsKey || lat == null || lng == null || !containerRef.current) return;
    const container = containerRef.current;
    let cancel = false;
    configureMaps(mapsKey);
    (async () => {
      try {
        const [maps, markers] = await Promise.all([loadMapsLibrary("maps"), loadMapsLibrary("marker")]);
        if (cancel) return;
        const map = new maps.Map(container, {
          center: { lat, lng },
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          backgroundColor: "#0c0d0c",
          styles: NIGHT,
        });
        mapRef.current = map;
        new markers.Marker({ map, position: { lat, lng }, title: name });
      } catch {
        if (!cancel) setNote("The map could not be shown. Open the location in Google Maps.");
      }
    })();
    return () => {
      cancel = true;
      mapRef.current = null;
      linesRef.current = [];
      originMarkerRef.current = null;
      fittedRef.current = false;
      container.replaceChildren();
    };
  }, [mapsKey, lat, lng, name]);

  async function showDirections() {
    const map = mapRef.current;
    if (!map || lat == null || lng == null || drawing) return;
    setDrawing(true);
    setNote("");
    try {
      const origin = await locate();
      if (!origin) {
        setNote("Location is off. Open Google Maps for directions.");
        return;
      }
      const [routesLib, markers, core] = await Promise.all([
        loadMapsLibrary("routes"),
        loadMapsLibrary("marker"),
        loadMapsLibrary("core"),
      ]);
      const { routes } = await routesLib.Route.computeRoutes({
        origin,
        destination: { lat, lng },
        travelMode: "DRIVING",
        fields: ["path", "durationMillis", "distanceMeters"],
      });
      const route = routes?.[0];
      if (!route?.path?.length) {
        setNote("Directions could not be drawn here. Open Google Maps.");
        return;
      }
      linesRef.current.forEach((line) => line.setMap(null));
      linesRef.current = route.createPolylines({ polylineOptions: { strokeColor: "#12c4b6", strokeWeight: 5 } });
      linesRef.current.forEach((line) => line.setMap(map));
      originMarkerRef.current?.setMap(null);
      originMarkerRef.current = new markers.Marker({ map, position: origin, title: "You" });
      if (!fittedRef.current) {
        const bounds = new core.LatLngBounds();
        bounds.extend(origin);
        bounds.extend({ lat, lng });
        map.fitBounds(bounds, 48);
        fittedRef.current = true;
      }
      const minutes = route.durationMillis ? Math.max(1, Math.round(route.durationMillis / 60000)) : null;
      const distance = route.distanceMeters ? formatDistance(route.distanceMeters) : null;
      setSummary([minutes ? `${minutes} min drive` : "", distance].filter(Boolean).join(" · "));
    } catch {
      setNote("Directions could not be drawn here. Open Google Maps.");
    } finally {
      setDrawing(false);
    }
  }

  if (!destination || lat == null || lng == null) {
    return <p className="muted text-sm">The venue is not set yet.</p>;
  }

  const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  return (
    <section className="space-y-3" aria-label="Location">
      <div>
        <h2 className="eyebrow">Location</h2>
        <p className="mt-2 text-sm">{destination.name}</p>
        {destination.address ? <p className="muted text-sm">{destination.address}</p> : null}
        {summary ? <p className="mt-1 text-sm">{summary}</p> : null}
      </div>
      {mapsKey ? <div ref={containerRef} className="h-64 overflow-hidden rounded-2xl bg-[#0c0d0c]" /> : null}
      {note ? <p className="muted text-sm">{note}</p> : null}
      <div className="flex flex-wrap gap-3">
        {mapsKey ? (
          <button type="button" className="btn" disabled={drawing} onClick={() => void showDirections()}>
            {drawing ? "Finding directions…" : "Directions"}
          </button>
        ) : null}
        <a className="btn btn-plain" href={mapsLink} target="_blank" rel="noreferrer">
          Google Maps
        </a>
      </div>
    </section>
  );
}

function locate(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  });
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}
