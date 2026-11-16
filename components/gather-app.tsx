"use client";

import { useCallback, useEffect, useState } from "react";
import { ChurchSheet } from "@/components/church-sheet";
import { ScreeningMap, type MapPin } from "@/components/screening-map";
import { SignInPanel } from "@/components/sign-in-panel";
import { Button } from "@/components/ui";
import { ViewingCard } from "@/components/viewing-card";
import { ViewingDetail } from "@/components/viewing-detail";
import { ViewingForm, type ViewingDraft } from "@/components/viewing-form";
import { VenuePicker } from "@/components/venue-picker";
import { nextSaturdayEveningValue } from "@/lib/format";
import { searchChurches } from "@/lib/places";
import type { BookingStatus, EventView, PublicChurch, PublicConfig, PublicUser } from "@/lib/types";
import { hostChurchOptions, matchesViewing } from "@/lib/viewing-filters";

async function send(url: string, method = "GET", body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    event?: EventView;
    status?: "unclaimed" | "claimed" | "yours";
  };
  if (!response.ok) throw new Error(payload.error || "That did not work.");
  return payload;
}

type Me = { user: PublicUser; church: PublicChurch | null };
type Screen =
  | { name: "list" }
  | { name: "detail"; id: string }
  | { name: "signin"; joining: boolean; eventId?: string }
  | { name: "church" }
  | { name: "pins" }
  | { name: "edit" }
  | { name: "venue" };

function blankDraft(): ViewingDraft {
  return {
    id: null,
    title: "The Chosen",
    durationMinutes: "60",
    videoUrl: "",
    verses: [],
    when: nextSaturdayEveningValue(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    capacity: "80",
    visibility: "open",
    bookingStatus: "tbd",
    cinema: null,
  };
}

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function draftFromEvent(event: EventView): ViewingDraft {
  return {
    id: event.id,
    title: event.title,
    durationMinutes: event.durationMinutes ? String(event.durationMinutes) : "",
    videoUrl: event.videoUrl,
    verses: event.verses.map((verse) => ({ ...verse })),
    when: toLocalInput(event.startsAt),
    timeZone: event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    capacity: String(event.capacity),
    visibility: event.visibility,
    bookingStatus: event.bookingStatus,
    cinema: event.cinema
      ? {
          placeId: event.cinema.placeId,
          name: event.cinema.name,
          lat: event.cinema.lat,
          lng: event.cinema.lng,
          address: event.cinema.address,
        }
      : null,
  };
}

export function GatherApp({ config, joinToken }: { config: PublicConfig; joinToken?: string }) {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [events, setEvents] = useState<EventView[]>([]);
  const [linked, setLinked] = useState<EventView | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: "list" });
  const [draft, setDraft] = useState<ViewingDraft>(blankDraft);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [device, setDevice] = useState<{ lat: number; lng: number } | null>(null);
  const [query, setQuery] = useState("");
  const [churchFilter, setChurchFilter] = useState("");
  const [stageFilter, setStageFilter] = useState<"" | BookingStatus>("");
  const [ownedOnly, setOwnedOnly] = useState(false);

  const refresh = useCallback(async () => {
    const [sessionRes, eventsRes] = await Promise.all([
      fetch("/api/session", { cache: "no-store" }),
      fetch("/api/events", { cache: "no-store" }),
    ]);
    const session = (await sessionRes.json()) as { user: PublicUser | null; church: PublicChurch | null };
    setMe(session.user ? { user: session.user, church: session.church } : null);
    const body = (await eventsRes.json()) as { events?: EventView[]; error?: string };
    if (!eventsRes.ok) {
      setError(body.error || "Could not load viewings.");
      return;
    }
    setEvents(body.events ?? []);
  }, []);

  useEffect(() => {
    void refresh().finally(() => setReady(true));
  }, [refresh]);

  useEffect(() => {
    if (!ready) return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId) return;
    const event = events.find((item) => item.id === editId);
    if (!event?.viewerIsHost) return;
    setDraft(draftFromEvent(event));
    setNote("");
    setScreen({ name: "edit" });
    window.history.replaceState(null, "", "/");
  }, [ready, events]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setDevice({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const userId = me?.user.id;
  useEffect(() => {
    if (!joinToken || !userId) return;
    let cancel = false;
    void send(`/api/join/${encodeURIComponent(joinToken)}`)
      .then((payload) => {
        if (cancel || !payload.event) return;
        setLinked(payload.event);
        setScreen({ name: "detail", id: payload.event.id });
        setError("");
      })
      .catch((loadError: unknown) => {
        if (!cancel) setError(loadError instanceof Error ? loadError.message : "That link does not match a viewing.");
      });
    return () => {
      cancel = true;
    };
  }, [joinToken, userId]);

  useEffect(() => {
    if (screen.name !== "detail") return;
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [screen.name, refresh]);

  const church = me?.church ?? null;
  const isOwner = Boolean(church?.isOwner);
  const detailId = screen.name === "detail" ? screen.id : "";
  const openEvent = events.find((event) => event.id === detailId) ?? (linked?.id === detailId ? linked : null);

  function openDetail(id: string) {
    setError("");
    setScreen({ name: "detail", id });
  }

  async function saveDraft() {
    const seats = Number(draft.capacity);
    const minutes = Number(draft.durationMinutes);
    const starts = new Date(draft.when);
    const verses: Array<{ bibleId: number; passageId: string } | { reference: string; text: string; translation?: string; copyright?: string }> =
      [];
    for (const verse of draft.verses) {
      if (verse.bibleId && verse.passageId) verses.push({ bibleId: verse.bibleId, passageId: verse.passageId });
      else if (verse.reference.trim()) {
        verses.push({
          reference: verse.reference.trim(),
          text: verse.text.trim(),
          ...(verse.translation ? { translation: verse.translation } : {}),
          ...(verse.copyright ? { copyright: verse.copyright } : {}),
        });
      }
    }
    if (!draft.title.trim() || !Number.isInteger(minutes) || minutes < 1 || Number.isNaN(starts.getTime()) || !Number.isInteger(seats) || seats < 1) {
      setNote("Enter a title, a duration, a date, and the number of seats.");
      return;
    }
    if ((draft.bookingStatus === "pending" || draft.bookingStatus === "booked") && !draft.cinema) {
      setNote("Choose a cinema before you mark this as pending or booked.");
      return;
    }
    const body = {
      title: draft.title.trim(),
      durationMinutes: minutes,
      videoUrl: draft.videoUrl.trim(),
      verses,
      bookingStatus: draft.bookingStatus,
      startsAt: starts.toISOString(),
      timeZone: draft.timeZone,
      capacity: seats,
      visibility: draft.visibility,
      cinema: draft.cinema,
    };
    setPending(true);
    setNote("");
    try {
      const payload = draft.id ? await send(`/api/events/${draft.id}`, "PATCH", body) : await send("/api/events", "POST", body);
      setError("");
      await refresh();
      if (payload.event) {
        setDraft(draftFromEvent(payload.event));
        setNote("Saved.");
      } else {
        setNote("Saved, but the viewing did not come back.");
      }
    } catch (saveError) {
      setNote(saveError instanceof Error ? saveError.message : "Could not save this viewing.");
    } finally {
      setPending(false);
    }
  }

  function openVenue() {
    const starts = new Date(draft.when);
    if (Number.isNaN(starts.getTime())) {
      setNote("Set the date before you choose a cinema.");
      return;
    }
    if (!church) {
      setNote("Claim your church before you set a venue.");
      return;
    }
    setNote("");
    setScreen({ name: "venue" });
  }

  if (screen.name === "venue" && church && !config.mapsKey) {
    return (
      <main className="mx-auto min-h-dvh max-w-lg px-4 pt-6">
        <Button type="button" tone="plain" onClick={() => setScreen({ name: "edit" })}>
          Back
        </Button>
        <p className="mt-3 text-sm">A Google Maps key is needed to choose a cinema.</p>
      </main>
    );
  }

  if (screen.name === "venue" && church) {
    return (
      <VenuePicker
        mapsKey={config.mapsKey}
        church={church}
        startsAt={new Date(draft.when).toISOString()}
        timeZone={draft.timeZone}
        exceptId={draft.id}
        selectedPlaceId={draft.cinema?.placeId ?? null}
        onBack={() => setScreen({ name: "edit" })}
        onChoose={(cinema) => {
          setDraft({ ...draft, cinema });
          setScreen({ name: "edit" });
        }}
      />
    );
  }

  if (screen.name === "pins" && church && config.mapsKey) {
    const pins: MapPin[] = [
      { id: "church", lat: church.lat, lng: church.lng, label: church.name, color: "#f4efe6", kind: "church", selected: true },
      ...church.catchment.map((pin, index) => ({
        id: `catchment:${index}`,
        lat: pin.lat,
        lng: pin.lng,
        label: pin.label,
        color: "#f4efe6",
      })),
    ];
    return (
      <div className="flex h-dvh flex-col">
        <div className="relative min-h-0 flex-1">
          <ScreeningMap
            mapsKey={config.mapsKey}
            center={{ lat: church.lat, lng: church.lng }}
            zoom={13}
            pins={pins}
            onPick={() => undefined}
            onMapClick={(point) => {
              if (church.catchment.length >= 4) return;
              void send("/api/churches", "PATCH", {
                catchment: [...church.catchment, { ...point, label: "Members" }],
              })
                .then(() => refresh())
                .catch((mapError: unknown) => setError(mapError instanceof Error ? mapError.message : "Could not save that pin."));
            }}
            onStatus={() => undefined}
          />
        </div>
        <div className="sheet sheet-panel py-4">
          <Button type="button" tone="plain" onClick={() => setScreen({ name: "church" })}>
            Back to church
          </Button>
          <p className="muted mt-2 text-sm">Tap the map to drop a pin where members live. Up to four.</p>
          {error ? <p className="alert mt-2 text-sm">{error}</p> : null}
        </div>
      </div>
    );
  }

  const now = Date.now();
  const isUpcoming = (event: EventView) => Date.parse(event.startsAt) >= now - 2 * 60 * 60 * 1000;
  const filters = { query, churchId: churchFilter, stage: stageFilter, ownedOnly };
  const filtering = Boolean(query.trim() || churchFilter || stageFilter || ownedOnly);
  const filtered = events.filter((event) => matchesViewing(event, filters));
  const yours = filtered.filter((event) => event.viewerIsHost);
  const rest = filtered.filter((event) => !event.viewerIsHost);
  const upcoming = rest.filter(isUpcoming);
  const earlier = rest.filter((event) => !isUpcoming(event)).reverse();
  const churches = hostChurchOptions(events);

  function editEvent(event: EventView) {
    setDraft(draftFromEvent(event));
    setNote("");
    setScreen({ name: "edit" });
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {screen.name === "list" ? (
        <header className="mb-6 flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Gather</p>
            <h1 className="display mt-2 text-5xl">Viewings</h1>
            <span className="rule" />
          </div>
          <div className="flex shrink-0 gap-2">
            {me ? (
              <Button type="button" tone="plain" onClick={() => setScreen({ name: "church" })}>
                Church
              </Button>
            ) : (
              <Button type="button" onClick={() => setScreen({ name: "signin", joining: false })}>
                Sign in
              </Button>
            )}
            {me ? (
              <Button
                type="button"
                tone="plain"
                onClick={() => {
                  void send("/api/session", "DELETE").then(() => {
                    setMe(null);
                    setLinked(null);
                    setScreen({ name: "list" });
                    void refresh();
                  });
                }}
              >
                Sign out
              </Button>
            ) : null}
          </div>
        </header>
      ) : null}

      {!ready ? <p className="muted text-sm">Loading viewings…</p> : null}
      {error ? (
        <p role="alert" className="alert mb-3 text-sm">
          {error}
        </p>
      ) : null}

      {ready && screen.name === "list" ? (
        <div className="space-y-4">
          {joinToken && !me ? (
            <div className="card">
              <p className="display text-2xl">You have a link to a viewing.</p>
              <p className="muted mt-2 text-sm">Sign in to open it and take seats.</p>
              <Button type="button" className="mt-3" onClick={() => setScreen({ name: "signin", joining: true })}>
                Sign in to join
              </Button>
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="block">
              <span className="sr-only">Search viewings</span>
              <input
                className="field-input"
                name="viewingSearch"
                placeholder="Search by church, title, or verse"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="flex gap-2">
              <select
                className="field-input min-w-0 flex-1"
                aria-label="Church"
                value={churchFilter}
                onChange={(event) => setChurchFilter(event.target.value)}
              >
                <option value="">All churches</option>
                {churches.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              <select
                className="field-input min-w-0 flex-1"
                aria-label="Booking stage"
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value as "" | BookingStatus)}
              >
                <option value="">All stages</option>
                <option value="tbd">TBD</option>
                <option value="pending">Pending booking</option>
                <option value="booked">Booked</option>
              </select>
            </div>
            {isOwner || church ? (
              <div className="flex gap-2">
                {isOwner ? (
                  <button type="button" className="chip" aria-pressed={ownedOnly} onClick={() => setOwnedOnly((value) => !value)}>
                    Yours
                  </button>
                ) : null}
                {church ? (
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={churchFilter === church.id}
                    onClick={() => setChurchFilter((value) => (value === church.id ? "" : church.id))}
                  >
                    {church.name}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <p className="muted text-sm">
            {filtering ? `${filtered.length} matching` : "Screenings you can attend. Sign in when you want to take seats."}
          </p>
          {isOwner ? (
            <Button
              type="button"
              onClick={() => {
                setDraft(blankDraft());
                setNote("");
                setScreen({ name: "edit" });
              }}
            >
              Add a viewing
            </Button>
          ) : null}
          {events.length === 0 ? <p className="card muted text-sm">No viewings are listed yet.</p> : null}
          {events.length > 0 && filtered.length === 0 ? <p className="card muted text-sm">Nothing matches that search.</p> : null}
          {yours.length > 0 ? <h2 className="eyebrow pt-2">Your viewings</h2> : null}
          {yours.map((event) => (
            <ViewingCard key={event.id} event={event} onEdit={() => editEvent(event)} />
          ))}
          {upcoming.length > 0 && yours.length > 0 ? <h2 className="eyebrow pt-4">Other viewings</h2> : null}
          {upcoming.map((event) => (
            <ViewingCard key={event.id} event={event} />
          ))}
          {earlier.length > 0 ? <h2 className="eyebrow pt-4">Earlier</h2> : null}
          {earlier.map((event) => (
            <ViewingCard key={event.id} event={event} />
          ))}
        </div>
      ) : null}

      {ready && screen.name === "signin" ? (
        <SignInPanel
          config={config}
          joining={screen.joining || Boolean(joinToken)}
          error={error}
          onError={setError}
          onSignedIn={() => {
            setError("");
            const returnId = screen.name === "signin" ? screen.eventId : undefined;
            if (returnId) {
              window.location.assign(`/v/${returnId}`);
              return;
            }
            void refresh().then(() => {
              if (joinToken) return;
              setScreen({ name: "list" });
            });
          }}
        />
      ) : null}

      {ready && screen.name === "detail" && openEvent ? (
        <ViewingDetail
          key={openEvent.id}
          event={openEvent}
          signedIn={Boolean(me)}
          mapsKey={config.mapsKey}
          onBack={() => setScreen({ name: "list" })}
          onSignIn={() => setScreen({ name: "signin", joining: true, eventId: openEvent.id })}
          onEdit={() => {
            setDraft(draftFromEvent(openEvent));
            setNote("");
            setScreen({ name: "edit" });
          }}
          onJoin={async (members, guests) => {
            const viaLink = Boolean(joinToken && linked?.id === openEvent.id);
            const payload = viaLink
              ? await send(`/api/join/${joinToken}/parties`, "POST", { members, guests })
              : await send(`/api/events/${openEvent.id}/parties`, "POST", { members, guests });
            if (payload.event) setLinked(payload.event);
            await refresh();
          }}
          onRemove={async (partyId) => {
            const viaLink = Boolean(joinToken && linked?.id === openEvent.id);
            const payload = viaLink
              ? await send(`/api/join/${joinToken}/parties/${partyId}`, "DELETE")
              : await send(`/api/events/${openEvent.id}/parties/${partyId}`, "DELETE");
            if (payload.event) setLinked(payload.event);
            await refresh();
          }}
        />
      ) : null}
      {ready && screen.name === "detail" && !openEvent ? (
        <div className="space-y-3">
          <p>This viewing is no longer available.</p>
          <Button type="button" tone="plain" onClick={() => setScreen({ name: "list" })}>
            Back
          </Button>
        </div>
      ) : null}

      {ready && screen.name === "edit" ? (
        <ViewingForm
          draft={draft}
          pending={pending}
          note={note}
          onChange={setDraft}
          onBack={() => setScreen(draft.id ? { name: "detail", id: draft.id } : { name: "list" })}
          onVenue={openVenue}
          onSave={() => void saveDraft()}
        />
      ) : null}

      {ready && screen.name === "church" && me ? (
        <ChurchSheet
          church={church}
          isOwner={isOwner}
          mapsKey={config.mapsKey}
          onBack={() => setScreen({ name: "list" })}
          onSearch={(query) => searchChurches(config.mapsKey, query, device ?? (church ? { lat: church.lat, lng: church.lng } : undefined))}
          onPreview={() => undefined}
          onLookup={async (placeId) => {
            const payload = await send(`/api/churches/lookup?placeId=${encodeURIComponent(placeId)}`);
            return payload.status ?? "unclaimed";
          }}
          onShowMap={church && config.mapsKey ? () => setScreen({ name: "pins" }) : undefined}
          onCreate={async (input) => {
            await send("/api/churches", "POST", input);
            setError("");
            setScreen({ name: "list" });
            await refresh();
          }}
          onJoin={async (code) => {
            await send("/api/churches/join", "POST", { code });
            setError("");
            setScreen({ name: "list" });
            await refresh();
          }}
          onCatchment={async (catchment) => {
            await send("/api/churches", "PATCH", { catchment });
            await refresh();
          }}
        />
      ) : null}
    </main>
  );
}
