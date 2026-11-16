"use client";

import { useEffect, useRef, useState } from "react";
import { ScreeningMap, type MapPin } from "@/components/screening-map";
import { BackButton, Button } from "@/components/ui";
import { worstDriveMinutes } from "@/lib/drive-times";
import { formatWhen } from "@/lib/format";
import { searchCinemas, type PlacePin } from "@/lib/places";
import type { PublicChurch, VenueHold } from "@/lib/types";
import type { CinemaDraft } from "@/components/viewing-form";

const COLLAPSED = 92;

export function VenuePicker({
  mapsKey,
  church,
  startsAt,
  timeZone,
  exceptId,
  selectedPlaceId,
  onBack,
  onChoose,
}: {
  mapsKey: string;
  church: PublicChurch;
  startsAt: string;
  timeZone: string;
  exceptId: string | null;
  selectedPlaceId: string | null;
  onBack: () => void;
  onChoose: (cinema: CinemaDraft) => void;
}) {
  const [cinemas, setCinemas] = useState<PlacePin[]>([]);
  const [holds, setHolds] = useState<VenueHold[]>([]);
  const [travel, setTravel] = useState<Record<string, number | null>>({});
  const [selected, setSelected] = useState<string | null>(selectedPlaceId);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sheetHeight, setSheetHeight] = useState(420);
  const drag = useRef<{ y: number; height: number } | null>(null);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const params = new URLSearchParams({ startsAt, timeZone });
    if (exceptId) params.set("except", exceptId);
    Promise.all([
      searchCinemas(mapsKey, { lat: church.lat, lng: church.lng }),
      fetch(`/api/venues?${params}`, { cache: "no-store" }).then(async (response) => {
        const body = (await response.json()) as { holds?: VenueHold[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Could not check cinema availability.");
        return body.holds ?? [];
      }),
    ])
      .then(([pins, booked]) => {
        if (cancel) return;
        setCinemas(pins);
        setHolds(booked);
        setLoading(false);
      })
      .catch((loadError: unknown) => {
        if (cancel) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load cinemas.");
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [mapsKey, church.lat, church.lng, startsAt, timeZone, exceptId]);

  useEffect(() => {
    setSheetHeight(Math.round(window.innerHeight * 0.5));
  }, []);

  function expandedHeight() {
    return Math.round(window.innerHeight * 0.5);
  }

  function onHandleDown(event: React.PointerEvent<HTMLButtonElement>) {
    drag.current = { y: event.clientY, height: sheetHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onHandleMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const max = Math.round(window.innerHeight * 0.78);
    const next = drag.current.height - (event.clientY - drag.current.y);
    setSheetHeight(Math.min(max, Math.max(COLLAPSED, next)));
  }

  function onHandleUp(event: React.PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const dy = event.clientY - drag.current.y;
    if (dy > 28) setSheetHeight(COLLAPSED);
    else if (dy < -28) setSheetHeight(expandedHeight());
    drag.current = null;
  }

  const cinemaKey = cinemas.map((cinema) => cinema.placeId).join(",");
  useEffect(() => {
    if (!mapsKey || cinemas.length === 0) return;
    let cancel = false;
    const origins = [{ lat: church.lat, lng: church.lng }, ...church.catchment];
    worstDriveMinutes(
      mapsKey,
      origins,
      cinemas.map((cinema) => ({ id: cinema.placeId, lat: cinema.lat, lng: cinema.lng })),
    )
      .then((times) => {
        if (!cancel) setTravel(times);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [mapsKey, cinemaKey, church.lat, church.lng, church.catchment]);

  const holdFor = (placeId: string) => holds.find((hold) => hold.placeId === placeId);
  const ordered = cinemas.slice().sort((a, b) => {
    const aHeld = holdFor(a.placeId) ? 1 : 0;
    const bHeld = holdFor(b.placeId) ? 1 : 0;
    if (aHeld !== bHeld) return aHeld - bHeld;
    const aTime = travel[a.placeId] ?? 9999;
    const bTime = travel[b.placeId] ?? 9999;
    return aTime - bTime;
  });
  const pins: MapPin[] = [
    {
      id: "church",
      lat: church.lat,
      lng: church.lng,
      label: church.name,
      color: "#f4efe6",
      kind: "church",
    },
    ...ordered.map((cinema) => ({
      id: `cinema:${cinema.placeId}`,
      lat: cinema.lat,
      lng: cinema.lng,
      label: cinema.name,
      color: "#f4efe6",
      kind: "theatre" as const,
      dimmed: Boolean(holdFor(cinema.placeId)),
      selected: selected === cinema.placeId,
    })),
  ];

  return (
    <div className="flex h-dvh flex-col">
      <div className="relative min-h-0 flex-1">
        <ScreeningMap
          mapsKey={mapsKey}
          center={{ lat: church.lat, lng: church.lng }}
          zoom={13}
          pins={pins}
          onPick={(id) => {
            if (id.startsWith("cinema:")) setSelected(id.slice("cinema:".length));
          }}
          onMapClick={() => undefined}
          onStatus={(_ready, message) => {
            if (message) setError(message);
          }}
        />
      </div>
      <section
        aria-label="Cinemas"
        className="sheet flex w-full shrink-0 flex-col overflow-hidden rounded-t-[1.4rem] shadow-[0_-12px_40px_rgb(0_0_0/0.45)]"
        style={{ height: sheetHeight }}
      >
        <button
          type="button"
          className="sheet-handle"
          aria-label="Drag the cinema list"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <span className="sheet-grab" />
          <span className="muted text-xs">{sheetHeight < 140 ? "Drag up for cinemas" : "Drag down to see the map"}</span>
        </button>
        <div className="sheet-scroll">
        <BackButton onClick={onBack} />
        <h1 className="display mt-3 text-3xl">Choose a cinema</h1>
        <p className="muted mt-2 text-sm">
          Nearby cinemas for {formatWhen(startsAt, timeZone)}. A pending or booked mark is a private booking already in Gather
          that day, so it is not available. Confirm the hire with the cinema, then set the booking stage.
        </p>
        {error ? (
          <p role="alert" className="alert mt-2 text-sm">
            {error}
          </p>
        ) : null}
        {loading ? <p className="muted mt-3 text-sm">Looking up cinemas…</p> : null}
        {!loading && ordered.length === 0 ? <p className="muted mt-3 text-sm">No cinemas showed up near the church.</p> : null}
        <ul className="mt-3 space-y-2">
          {ordered.map((cinema) => {
            const hold = holdFor(cinema.placeId);
            const minutes = travel[cinema.placeId];
            const drive = minutes == null ? "Drive time unavailable" : `${Math.max(1, Math.round(minutes))} min drive`;
            return (
              <li key={cinema.placeId} className="panel text-sm">
                <p className="font-semibold">{cinema.name}</p>
                <p className="muted">{cinema.address}</p>
                <p className="mt-1">{hold ? `${hold.bookingStatus === "booked" ? "Booked" : "Pending booking"} · ${hold.hostChurchName}` : `Available · ${drive}`}</p>
                <Button
                  type="button"
                  className="mt-2"
                  tone={hold ? "plain" : "primary"}
                  disabled={Boolean(hold)}
                  onClick={() =>
                    onChoose({
                      placeId: cinema.placeId,
                      name: cinema.name,
                      lat: cinema.lat,
                      lng: cinema.lng,
                      address: cinema.address,
                    })
                  }
                >
                  {hold ? "Not available that date" : "Use this cinema"}
                </Button>
              </li>
            );
          })}
        </ul>
        </div>
      </section>
    </div>
  );
}
