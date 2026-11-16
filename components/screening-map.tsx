"use client";

import { useEffect, useRef, useState } from "react";
import { configureMaps, loadMapsLibrary } from "@/lib/maps";

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  kind?: "church" | "theatre";
  dimmed?: boolean;
  selected?: boolean;
};

const CHURCH_ICON = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M22 2h4v6h6v4h-6v6h-4v-6h-6V8h6z"/><path fill="#fff" d="M6 24.5 24 12l18 12.5V46H6z"/><path fill="currentColor" d="M20 32h8v14h-8z"/></svg>`;
const THEATRE_ICON = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M8 10h32a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z"/><path fill="currentColor" d="M20 16.5v11l10-5.5z"/><path fill="#fff" d="M6 38h36v4H6zM10 36h4v2h-4zM22 36h4v2h-4zM34 36h4v2h-4z"/></svg>`;

export function ScreeningMap({
  mapsKey,
  center,
  zoom,
  pins,
  onPick,
  onMapClick,
  onStatus,
}: {
  mapsKey: string;
  center: { lat: number; lng: number };
  zoom: number;
  pins: MapPin[];
  onPick: (id: string) => void;
  onMapClick: (point: { lat: number; lng: number }) => void;
  onStatus: (ready: boolean, error: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const onPickRef = useRef(onPick);
  const onMapClickRef = useRef(onMapClick);
  const onStatusRef = useRef(onStatus);
  onPickRef.current = onPick;
  onMapClickRef.current = onMapClick;
  onStatusRef.current = onStatus;
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapsKey || !containerRef.current) {
      setMapReady(false);
      onStatusRef.current(false, "");
      return;
    }
    const container = containerRef.current;
    let cancel = false;
    configureMaps(mapsKey);
    (async () => {
      try {
        const maps = await loadMapsLibrary("maps");
        if (cancel) return;
        const map = new maps.Map(container, {
          center,
          zoom,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          backgroundColor: "#0c0d0c",
          styles: [
            { elementType: "geometry", stylers: [{ color: "#161715" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#d9d2c5" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#161715" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e2c2e" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#2a2b28" }] },
            { featureType: "poi", elementType: "geometry", stylers: [{ color: "#1e1f1c" }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#1a2620" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
          ],
        });
        map.addListener("click", (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          onMapClickRef.current({ lat: event.latLng.lat(), lng: event.latLng.lng() });
        });
        mapRef.current = map;
        setMapReady(true);
        onStatusRef.current(true, "");
      } catch (error) {
        if (!cancel) onStatusRef.current(false, error instanceof Error ? error.message : "Google Maps did not load.");
      }
    })();
    return () => {
      cancel = true;
      mapRef.current = null;
      setMapReady(false);
      container.replaceChildren();
    };
    // The map is created once per key. Center updates are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsKey]);

  useEffect(() => {
    if (!mapReady) return;
    mapRef.current?.panTo(center);
    mapRef.current?.setZoom(zoom);
  }, [center.lat, center.lng, zoom, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const Pin = labelPinClass();
    const drawn: google.maps.OverlayView[] = [];
    for (const pin of pins) {
      const overlay = new Pin(pin, () => onPickRef.current(pin.id));
      overlay.setMap(map);
      drawn.push(overlay);
    }
    return () => {
      for (const overlay of drawn) overlay.setMap(null);
    };
  }, [pins, mapReady]);

  if (!mapsKey) {
    return (
      <div className="grid h-full place-items-center bg-[#0c0d0c] px-8 text-center text-sm text-[#b7b0a4]">
        <p>A Google Maps key shows nearby cinemas here. Until then, sample theatres are listed below.</p>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full bg-[#0c0d0c]" />;
}

function labelPinClass() {
  return class LabelPin extends google.maps.OverlayView {
    private div: HTMLButtonElement | null = null;

    constructor(
      private readonly pin: MapPin,
      private readonly onPick: () => void,
    ) {
      super();
    }

    override onAdd() {
      const div = document.createElement("button");
      div.type = "button";
      const featured = this.pin.kind === "church" || (this.pin.kind === "theatre" && this.pin.selected);
      div.className = featured ? "map-pin map-pin-feature" : "map-pin";
      div.title = this.pin.label;
      div.style.background = this.pin.color;
      div.style.opacity = this.pin.dimmed ? "0.45" : "1";
      div.style.color = "#171614";
      if (featured) {
        const icon = document.createElement("span");
        icon.className = "pin-icon";
        icon.style.background = this.pin.kind === "church" ? "#12c4b6" : "#171614";
        icon.style.color = this.pin.kind === "church" ? "#04221f" : "#12c4b6";
        icon.innerHTML = this.pin.kind === "church" ? CHURCH_ICON : THEATRE_ICON;
        const label = document.createElement("span");
        label.className = "pin-label";
        label.textContent = this.pin.label;
        div.append(icon, label);
      } else {
        div.textContent = this.pin.label;
      }
      if (this.pin.selected) div.style.outline = "3px solid #12c4b6";
      div.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.onPick();
      });
      this.div = div;
      this.getPanes()?.overlayMouseTarget.appendChild(div);
    }

    override draw() {
      const point = this.getProjection()?.fromLatLngToDivPixel(new google.maps.LatLng(this.pin.lat, this.pin.lng));
      if (!point || !this.div) return;
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
    }

    override onRemove() {
      this.div?.remove();
      this.div = null;
    }
  };
}
