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
  const [summary, setSummary] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!mapsKey || !destination || !containerRef.current) return;
    const destinationPoint = destination;
    const container = containerRef.current;
    let cancel = false;
    configureMaps(mapsKey);
    (async () => {
      try {
        const [maps, markers, core] = await Promise.all([
          loadMapsLibrary("maps"),
          loadMapsLibrary("marker"),
          loadMapsLibrary("core"),
        ]);
        if (cancel) return;
        const map = new maps.Map(container, {
          center: destinationPoint,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          backgroundColor: "#0c0d0c",
          styles: NIGHT,
        });
        new markers.Marker({
          map,
          position: destinationPoint,
          title: destinationPoint.name,
        });
        const origin = await locate();
        if (cancel) return;
        if (!origin) {
          setNote("Allow location to draw the drive from where you are.");
          return;
        }
        new markers.Marker({ map, position: origin, title: "You" });
        const { Route } = await loadMapsLibrary("routes");
        const { routes } = await Route.computeRoutes({
          origin,
          destination: destinationPoint,
          travelMode: "DRIVING",
          fields: ["path", "durationMillis", "distanceMeters"],
        });
        const route = routes?.[0];
        if (!route?.path?.length) {
          setNote("The drive could not be drawn. Open it in Google Maps.");
          return;
        }
        route.createPolylines({ polylineOptions: { strokeColor: "#12c4b6", strokeWeight: 5 } }).forEach((line) => line.setMap(map));
        const bounds = new core.LatLngBounds();
        bounds.extend(origin);
        bounds.extend(destinationPoint);
        map.fitBounds(bounds, 48);
        const minutes = route.durationMillis ? Math.max(1, Math.round(route.durationMillis / 60000)) : null;
        const distance = route.distanceMeters ? formatDistance(route.distanceMeters) : null;
        setSummary([minutes ? `${minutes} min drive` : "", distance].filter(Boolean).join(" · "));
      } catch {
        if (!cancel) setNote("The drive could not be drawn. Open it in Google Maps.");
      }
    })();
    return () => {
      cancel = true;
      container.replaceChildren();
    };
  }, [mapsKey, destination]);

  if (!destination) {
    return <p className="muted text-sm">The venue is not set yet, so there is no drive to show.</p>;
  }

  const mapsLink = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving`;

  return (
    <section className="space-y-3" aria-label="Directions">
      <div>
        <h2 className="eyebrow">Directions</h2>
        <p className="mt-2 text-sm">{destination.name}</p>
        {destination.address ? <p className="muted text-sm">{destination.address}</p> : null}
        {summary ? <p className="mt-1 text-sm">{summary}</p> : null}
      </div>
      {mapsKey ? <div ref={containerRef} className="h-64 overflow-hidden rounded-2xl bg-[#0c0d0c]" /> : null}
      {note ? <p className="muted text-sm">{note}</p> : null}
      <a className="link text-sm" href={mapsLink} target="_blank" rel="noreferrer">
        Open in Google Maps
      </a>
    </section>
  );
}

function locate(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}
