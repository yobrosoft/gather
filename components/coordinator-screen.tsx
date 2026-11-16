"use client";

import { useEffect, useState } from "react";
import { ScreeningMap, type MapPin } from "@/components/screening-map";
import { Button } from "@/components/ui";
import { CANDIDATE_STATUS_LABEL } from "@/lib/candidates";
import { CRUCIFIXION_TITLE } from "@/lib/chosen";
import { worstDriveMinutes } from "@/lib/drive-times";
import { fitRank, nextSaturdayISO, seatFit } from "@/lib/enquiries";
import { PRIVATE_CINEMAS, type PrivateCinema } from "@/lib/private-cinemas";
import { TRAVEL_BUDGET_MINUTES } from "@/lib/rank";
import type { CandidateStatus, EnquiryView, EventView, PublicChurch, RequestMode } from "@/lib/types";

type CinemaRow = PrivateCinema & { worstTravelMinutes: number | null };
type Step = "screening" | "cinema" | "requests";
type CandidateDraft = { status: CandidateStatus; quote: string; note: string };

export function CoordinatorScreen({
  mapsKey,
  church,
  coordinatorName,
  coordinatorEmail,
}: {
  mapsKey: string;
  church: PublicChurch | null;
  coordinatorName: string;
  coordinatorEmail: string;
}) {
  const [step, setStep] = useState<Step>("screening");
  const [reached, setReached] = useState<Step>("screening");
  const [dates, setDates] = useState<string[]>([]);
  const [time, setTime] = useState("19:00");
  const [mode, setMode] = useState<RequestMode>("private");
  const [headcount, setHeadcount] = useState("");
  const [accessibility, setAccessibility] = useState("");
  const [hostedBy, setHostedBy] = useState(church?.name ?? "");
  const [name, setName] = useState(coordinatorName);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(coordinatorEmail);
  const [cinemaQuery, setCinemaQuery] = useState("");
  const [cinemas, setCinemas] = useState<CinemaRow[]>(PRIVATE_CINEMAS.map((cinema) => ({ ...cinema, worstTravelMinutes: null })));
  const [selected, setSelected] = useState<PrivateCinema[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CandidateDraft>>({});
  const [savedRequestId, setSavedRequestId] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [receipt, setReceipt] = useState<EnquiryView | null>(null);
  const [attendance, setAttendance] = useState<EventView | null>(null);

  const [hydrated, setHydrated] = useState(false);
  const [autosaved, setAutosaved] = useState(false);

  useEffect(() => {
    let cancel = false;
    const churchId = church?.id ?? "";
    const storageKey = `gather-arrange:${church?.id ?? "me"}`;
    (async () => {
      type LocalDraft = {
        step?: string;
        dates?: string[];
        time?: string;
        mode?: RequestMode;
        headcount?: string;
        accessibility?: string;
        name?: string;
        phone?: string;
        email?: string;
        hostedBy?: string;
        selectedIds?: string[];
        drafts?: Record<string, CandidateDraft>;
        savedRequestId?: string;
      };
      let saved: LocalDraft | null = null;
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        try {
          saved = JSON.parse(raw) as LocalDraft;
        } catch {
          saved = null;
        }
      }
      const response = await fetch("/api/requests", { cache: "no-store" });
      const body = (await response.json()) as { enquiries?: EnquiryView[] };
      if (cancel) return;
      const mine = churchId
        ? (body.enquiries ?? [])
            .flatMap((enquiry) => enquiry.requests.filter((request) => request.churchId === churchId).map((request) => ({ enquiry, request })))
            .sort((a, b) => b.request.createdAt.localeCompare(a.request.createdAt))
        : [];
      const latest = mine[0];
      if (latest) {
        const { enquiry, request } = latest;
        setHeadcount(String(request.expectedHeadcount || ""));
        setDates(request.preferredDates.length ? request.preferredDates : [nextSaturdayISO()]);
        setTime(request.preferredTime.slice(0, 5) || "19:00");
        setMode(enquiry.mode);
        setAccessibility(request.accessibilityNeeds);
        if (request.coordinatorName) setName(request.coordinatorName);
        setPhone(request.coordinatorPhone);
        if (request.coordinatorEmail) setEmail(request.coordinatorEmail);
        setHostedBy(request.hostedBy || "");
        setSelected(
          request.candidates
            .map((candidate) => PRIVATE_CINEMAS.find((cinema) => cinema.id === candidate.cinemaId))
            .filter((cinema): cinema is PrivateCinema => Boolean(cinema)),
        );
        setDrafts(
          Object.fromEntries(
            request.candidates.map((candidate) => [
              candidate.cinemaId,
              { status: candidate.status, quote: candidate.quote, note: candidate.note ?? "" },
            ]),
          ),
        );
        setSavedRequestId(request.id);
        setReceipt(enquiry);
        const storedStep = saved?.savedRequestId === request.id ? saved.step : enquiry.published ? "requests" : request.candidates.length ? "cinema" : "screening";
        const stepName = storedStep === "compare" ? "cinema" : storedStep;
        if (stepName === "screening" || stepName === "cinema" || stepName === "requests") setStep(stepName);
      } else if (saved) {
        const storedStep = saved.step === "compare" ? "cinema" : saved.step;
        if (storedStep === "screening" || storedStep === "cinema" || storedStep === "requests") setStep(storedStep);
        setDates(saved.dates?.length ? saved.dates : [nextSaturdayISO()]);
        if (saved.time) setTime(saved.time);
        if (saved.mode) setMode(saved.mode);
        if (saved.headcount) setHeadcount(saved.headcount);
        if (saved.accessibility) setAccessibility(saved.accessibility);
        if (saved.name) setName(saved.name);
        if (saved.phone) setPhone(saved.phone);
        if (saved.email) setEmail(saved.email);
        if (saved.hostedBy) setHostedBy(saved.hostedBy);
        setSelected(PRIVATE_CINEMAS.filter((cinema) => saved?.selectedIds?.includes(cinema.id)));
        setDrafts(saved.drafts ?? {});
        setSavedRequestId(saved.savedRequestId ?? "");
      } else {
        setDates([nextSaturdayISO()]);
      }
      setHydrated(true);
    })().catch(() => {
      if (!cancel) {
        setDates([nextSaturdayISO()]);
        setHydrated(true);
      }
    });
    return () => {
      cancel = true;
    };
  }, [church?.id]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      `gather-arrange:${church?.id ?? "me"}`,
      JSON.stringify({
        step,
        reached,
        dates,
        time,
        mode,
        headcount,
        accessibility,
        name,
        phone,
        email,
        hostedBy,
        selectedIds: selected.map((cinema) => cinema.id),
        drafts,
        savedRequestId,
      }),
    );
    const guests = Number(headcount);
    const chosenDates = dates.map((date) => date.trim()).filter(Boolean);
    if (!Number.isInteger(guests) || guests < 1 || chosenDates.length < 1 || !email.trim() || !name.trim()) return;
    const handle = window.setTimeout(() => {
      void fetch("/api/requests/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: savedRequestId || undefined,
          mode,
          expectedHeadcount: guests,
          preferredDates: chosenDates,
          preferredTime: time,
          cinemas: selected.map((cinema) => ({ placeId: cinema.id, name: cinema.name, lat: cinema.lat, lng: cinema.lng, address: cinema.address })),
          candidates: selected.map((cinema) => ({
            cinemaId: cinema.id,
            status: drafts[cinema.id]?.status ?? "considering",
            quote: drafts[cinema.id]?.quote ?? "",
            note: drafts[cinema.id]?.note ?? "",
          })),
          accessibilityNeeds: accessibility,
          coordinatorName: name.trim(),
          coordinatorPhone: phone.trim(),
          coordinatorEmail: email.trim(),
          hostedBy: hostedBy.trim(),
        }),
      })
        .then(async (response) => {
          const payload = (await response.json()) as { enquiry?: EnquiryView; error?: string };
          if (!response.ok || !payload.enquiry) return;
          const own = payload.enquiry.requests.find((request) => !church || request.churchId === church.id) ?? payload.enquiry.requests[0];
          if (own) setSavedRequestId(own.id);
          setReceipt(payload.enquiry);
          setAutosaved(true);
        })
        .catch(() => undefined);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [hydrated, church, step, reached, dates, time, mode, headcount, accessibility, name, phone, email, hostedBy, selected, drafts, savedRequestId]);

  useEffect(() => {
    if (step !== "cinema") return;
    const from = church ? { lat: church.lat, lng: church.lng } : null;
    if (!mapsKey || !from) {
      setCinemas(PRIVATE_CINEMAS.map((cinema) => ({ ...cinema, worstTravelMinutes: null })));
      return;
    }
    let cancel = false;
    worstDriveMinutes(
      mapsKey,
      [from],
      PRIVATE_CINEMAS.map((cinema) => ({ id: cinema.id, lat: cinema.lat, lng: cinema.lng })),
    )
      .then((times) => {
        if (cancel) return;
        setCinemas(PRIVATE_CINEMAS.map((cinema) => ({ ...cinema, worstTravelMinutes: times[cinema.id] ?? null })));
      })
      .catch((loadError: unknown) => {
        if (!cancel) setError(loadError instanceof Error ? loadError.message : "Could not load cinemas.");
      });
    return () => {
      cancel = true;
    };
  }, [mapsKey, church, step]);

  const people = Number(headcount);
  const range = (cinema: PrivateCinema) => ({ min: cinema.seatsMin, max: cinema.seatsMax });
  const rows = cinemas.slice().sort((a, b) => {
    const aFit = fitRank(seatFit(range(a), people));
    const bFit = fitRank(seatFit(range(b), people));
    const aFar = a.worstTravelMinutes != null && a.worstTravelMinutes > TRAVEL_BUDGET_MINUTES ? 1 : 0;
    const bFar = b.worstTravelMinutes != null && b.worstTravelMinutes > TRAVEL_BUDGET_MINUTES ? 1 : 0;
    return aFit - bFit || aFar - bFar || (a.worstTravelMinutes ?? 9999) - (b.worstTravelMinutes ?? 9999) || a.name.localeCompare(b.name);
  });
  const cinemaQueryText = cinemaQuery.trim().toLowerCase();
  const searchMatches = cinemaQueryText
    ? rows.filter((cinema) => `${cinema.name} ${cinema.operator} ${cinema.address}`.toLowerCase().includes(cinemaQueryText)).slice(0, 6)
    : [];
  const mapCenter = church?.placeId ? { lat: church.lat, lng: church.lng } : { lat: 1.3521, lng: 103.8198 };
  const whenLabel = dates[0]
    ? new Date(`${dates[0]}T${time || "19:00"}`).toLocaleString("en-SG", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "date not set";
  const planLine = `${CRUCIFIXION_TITLE} · ${hostedBy.trim() || "Host"} · ${Number.isInteger(people) && people > 0 ? people : "?"} guests · ${mode === "shared" ? "open to sharing" : "private"} · ${whenLabel}`;
  const picked = new Set(selected.map((cinema) => cinema.id));
  const pins: MapPin[] = [
    ...(church?.placeId
      ? [{ id: "origin", lat: church.lat, lng: church.lng, label: hostedBy.trim() || church.name, color: "#f4efe6", kind: "church" as const }]
      : []),
    ...rows.map((cinema) => ({
      id: cinema.id,
      lat: cinema.lat,
      lng: cinema.lng,
      label: cinema.name,
      color: picked.has(cinema.id) ? "#12c4b6" : "#f4efe6",
      kind: "theatre" as const,
      selected: picked.has(cinema.id),
      dimmed: seatFit(range(cinema), people) === "too_small",
    })),
  ];
  const stepNumber = step === "screening" ? "1" : step === "cinema" ? "2" : "3";

  function writeDraft(patch: { step?: Step; reached?: Step; selectedIds?: string[] } = {}) {
    window.localStorage.setItem(
      `gather-arrange:${church?.id ?? "me"}`,
      JSON.stringify({
        step,
        reached,
        dates,
        time,
        mode,
        headcount,
        accessibility,
        name,
        phone,
        email,
        hostedBy,
        selectedIds: selected.map((cinema) => cinema.id),
        drafts,
        savedRequestId,
        ...patch,
      }),
    );
  }

  function toggleCinema(cinema: PrivateCinema) {
    if (seatFit(range(cinema), people) === "too_small") {
      setError(`${cinema.name} is too small for ${people} guests.`);
      return;
    }
    setError("");
    setSelected((current) => {
      if (current.some((item) => item.id === cinema.id)) return current.filter((item) => item.id !== cinema.id);
      if (current.length >= 6) {
        setError("Compare at most six cinemas.");
        return current;
      }
      return [...current, cinema];
    });
    setDrafts((current) => current[cinema.id] ? current : { ...current, [cinema.id]: { status: "considering", quote: "", note: "" } });
  }

  async function saveShortlist() {
    if (selected.length < 1) {
      setError("Add at least one cinema.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/requests/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: savedRequestId || undefined,
          mode,
          expectedHeadcount: people,
          preferredDates: dates.map((date) => date.trim()).filter(Boolean),
          preferredTime: time,
          cinemas: selected.map((cinema) => ({ placeId: cinema.id, name: cinema.name, lat: cinema.lat, lng: cinema.lng, address: cinema.address })),
          candidates: selected.map((cinema) => ({
            cinemaId: cinema.id,
            status: drafts[cinema.id]?.status ?? "considering",
            quote: drafts[cinema.id]?.quote ?? "",
            note: drafts[cinema.id]?.note ?? "",
          })),
          accessibilityNeeds: accessibility,
          coordinatorName: name.trim(),
          coordinatorPhone: phone.trim(),
          coordinatorEmail: email.trim(),
          hostedBy: hostedBy.trim(),
        }),
      });
      const payload = (await response.json()) as { enquiry?: EnquiryView; error?: string };
      if (!response.ok || !payload.enquiry) throw new Error(payload.error || "Could not save these cinemas.");
      const own = payload.enquiry.requests.find((request) => !church || request.churchId === church.id) ?? payload.enquiry.requests[0];
      setReceipt(payload.enquiry);
      setSavedRequestId(own?.id ?? "");
      if (own) {
        for (const cinema of selected) {
          const draft = drafts[cinema.id];
          if (!draft || (draft.status === "considering" && !draft.quote.trim())) continue;
          const update = await fetch(`/api/requests/${own.id}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ cinemaId: cinema.id, status: draft.status, quote: draft.quote, note: draft.note }),
          });
          const updated = (await update.json()) as { enquiry?: EnquiryView; error?: string };
          if (!update.ok || !updated.enquiry) throw new Error(updated.error || "Could not save a quote.");
          setReceipt(updated.enquiry);
        }
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not save these cinemas.");
    } finally {
      setPending(false);
    }
  }

  async function updateCandidate(cinemaId: string, patch: Partial<CandidateDraft>) {
    const current = drafts[cinemaId] ?? { status: "considering" as const, quote: "", note: "" };
    const next = { ...current, ...patch };
    setDrafts((state) => ({ ...state, [cinemaId]: next }));
    if (!savedRequestId) return;
    setError("");
    try {
      const response = await fetch(`/api/requests/${savedRequestId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cinemaId, status: next.status, quote: next.quote, note: next.note }),
      });
      const payload = (await response.json()) as { enquiry?: EnquiryView; error?: string };
      if (!response.ok || !payload.enquiry) throw new Error(payload.error || "Could not save that update.");
      setReceipt(payload.enquiry);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not save that update.");
    }
  }

  if (!hydrated) return <p className="muted text-sm">Loading your screening…</p>;

  const canPost = Number.isInteger(people) && people > 0 && Boolean(dates[0]) && Boolean(email.trim()) && Boolean(name.trim()) && Boolean(hostedBy.trim());
  const posted = Boolean(receipt?.published);

  async function postScreening() {
    if (!canPost) return;
    setPending(true);
    setError("");
    try {
      let requestId = savedRequestId;
      if (!requestId) {
        const draft = await fetch("/api/requests/draft", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            mode,
            expectedHeadcount: people,
            preferredDates: dates.map((date) => date.trim()).filter(Boolean),
            preferredTime: time,
            cinemas: selected.map((cinema) => ({ placeId: cinema.id, name: cinema.name, lat: cinema.lat, lng: cinema.lng, address: cinema.address })),
            accessibilityNeeds: accessibility,
            coordinatorName: name.trim(),
            coordinatorPhone: phone.trim(),
            coordinatorEmail: email.trim(),
            hostedBy: hostedBy.trim(),
          }),
        });
        const saved = (await draft.json()) as { enquiry?: EnquiryView; error?: string };
        if (!draft.ok || !saved.enquiry) throw new Error(saved.error || "Could not save the screening.");
        requestId = saved.enquiry.requests.find((request) => !church || request.churchId === church.id)?.id ?? saved.enquiry.requests[0]?.id ?? "";
        setSavedRequestId(requestId);
        setReceipt(saved.enquiry);
      }
      const response = await fetch(`/api/requests/${requestId}/post`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ publish: !posted }),
      });
      const payload = (await response.json()) as { enquiry?: EnquiryView; error?: string };
      if (!response.ok || !payload.enquiry) throw new Error(payload.error || "Could not post the screening.");
      setReceipt(payload.enquiry);
      setAutosaved(true);
    } catch (postError) {
      setError(postError instanceof Error ? postError.message : "Could not post the screening.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Arrange" className="flex flex-wrap gap-2">
        {(
          [
            ["screening", "Details"],
            ["cinema", "Booking"],
            ["requests", "Requests"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className="chip"
            aria-selected={step === id}
            onClick={() => {
              writeDraft({ step: id });
              setError("");
              setStep(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <Button type="button" className="btn-block" disabled={pending || (posted ? false : !canPost)} onClick={() => void postScreening()}>
        {pending ? (posted ? "Unpublishing…" : "Publishing…") : posted ? "Unpublish" : "Publish"}
      </Button>
      <div>
        <h1 className="display text-4xl">
          {step === "screening" ? "Details" : step === "cinema" ? "Booking" : "Requests"}
        </h1>
        {autosaved ? <p className="mt-2 text-sm font-semibold text-[var(--teal)]">Saved.</p> : null}
        <p className="muted mt-2 text-sm">
          {step === "screening"
            ? "Who is coming, and when. You can publish this screening from any step once these details are in."
            : step === "cinema"
              ? "Add halls, open their booking pages, and keep the quote and status until one is booked."
              : "People who ask to attend show up here. Accept the ones you can host."}
        </p>
      </div>
      {step === "requests" ? <p className="panel text-sm font-semibold">{planLine}</p> : null}
      {error ? <p className="alert text-sm">{error}</p> : null}

      {step === "screening" ? (
        <div className="space-y-4">
          <p className="display text-2xl">{CRUCIFIXION_TITLE}</p>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Hosted by</span>
            <input className="field-input mt-1" aria-label="Hosted by" placeholder="Tampines Outreach" value={hostedBy} onChange={(event) => setHostedBy(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Guests you expect</span>
            <input className="field-input mt-1" inputMode="numeric" aria-label="Expected guests" placeholder="150" value={headcount} onChange={(event) => setHeadcount(event.target.value)} />
          </label>
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium">This screening</legend>
            <label className="flex gap-2">
              <input type="radio" name="mode" checked={mode === "private"} onChange={() => setMode("private")} />
              Private — one host takes the whole auditorium
            </label>
            <label className="flex gap-2">
              <input type="radio" name="mode" checked={mode === "shared"} onChange={() => setMode("shared")} />
              Open to sharing — another host can join this request
            </label>
          </fieldset>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">
              <span className="text-[var(--muted)]">Preferred date</span>
              <input className="field-input mt-1" type="date" aria-label="Preferred date" value={dates[0] ?? ""} onChange={(event) => setDates((current) => [event.target.value, ...current.slice(1)])} />
            </label>
            <label className="text-sm">
              <span className="text-[var(--muted)]">Time</span>
              <input className="field-input mt-1" type="time" aria-label="Preferred time" value={time} onChange={(event) => setTime(event.target.value)} />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Accessibility needs</span>
            <textarea className="field-input mt-1 min-h-20" aria-label="Accessibility needs" value={accessibility} onChange={(event) => setAccessibility(event.target.value)} placeholder="Step-free access, hearing support, prams" />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Your name</span>
            <input className="field-input mt-1" aria-label="Coordinator name" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Phone</span>
            <input className="field-input mt-1" inputMode="tel" aria-label="Coordinator phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Email</span>
            <input className="field-input mt-1" type="email" aria-label="Coordinator email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
        </div>
      ) : null}

      {step === "cinema" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="card">
              <p className="eyebrow">Seats</p>
              <p className="display mt-1 text-3xl">{Number.isInteger(people) && people > 0 ? people : "—"}</p>
            </div>
            <div className="card">
              <p className="eyebrow">Time</p>
              <p className="display mt-1 text-3xl">{time || "—"}</p>
              <p className="mt-1 text-xs">{dates[0] ? new Date(`${dates[0]}T12:00:00`).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" }) : "No date"}</p>
            </div>
            <div className="card">
              <p className="eyebrow">Hall</p>
              <p className="display mt-1 text-3xl">{mode === "shared" ? "Shared" : "Private"}</p>
            </div>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--muted)]">Search for a theatre</span>
            <input className="field-input mt-1" aria-label="Find a hall" placeholder="Tampines, Shaw, Bedok" value={cinemaQuery} onChange={(event) => setCinemaQuery(event.target.value)} />
          </label>
          {searchMatches.length > 0 ? (
            <ul className="card space-y-1 text-sm">
              {searchMatches.map((cinema) => {
                const fit = seatFit(range(cinema), people);
                return (
                  <li key={cinema.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-2 text-left"
                      disabled={fit === "too_small"}
                      onClick={() => {
                        if (!picked.has(cinema.id)) toggleCinema(cinema);
                        setCinemaQuery("");
                      }}
                    >
                      {cinema.name}
                      <span className="muted"> · {fit === "too_small" ? "Too small" : picked.has(cinema.id) ? "Added" : "Add"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {mapsKey ? (
            <div className="h-64 overflow-hidden rounded-2xl">
              <ScreeningMap
                mapsKey={mapsKey}
                center={mapCenter}
                zoom={12}
                pins={pins}
                onPick={(id) => {
                  const cinema = rows.find((item) => item.id === id);
                  if (cinema) toggleCinema(cinema);
                }}
                onMapClick={() => undefined}
                onStatus={(_ready, message) => {
                  if (message) setError(message);
                }}
              />
            </div>
          ) : (
            <p className="muted text-sm">A Google Maps key is needed to show the map.</p>
          )}
          <p className="muted text-sm">Tap a theatre on the map, or search, to add it.</p>
          {selected.length === 0 ? <p className="card muted text-sm">No theatres chosen yet.</p> : null}
        </div>
      ) : null}

      {step === "cinema" && selected.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold">Chosen theatres</p>
          {selected.map((cinema) => {
            const draft = drafts[cinema.id] ?? { status: "considering" as const, quote: "", note: "" };
            return (
              <article key={cinema.id} className="card space-y-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">{cinema.name}</p>
                  <a className="link shrink-0" href={cinema.enquiryUrl} target="_blank" rel="noreferrer">Booking page</a>
                </div>
                <label className="block">
                  <span className="text-[var(--muted)]">Booking status</span>
                  <select
                    className="field-input mt-1"
                    aria-label={`Status for ${cinema.name}`}
                    value={draft.status}
                    onChange={(event) => void updateCandidate(cinema.id, { status: event.target.value as CandidateStatus })}
                  >
                    {Object.entries(CANDIDATE_STATUS_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[var(--muted)]">Quote</span>
                  <input
                    className="field-input mt-1"
                    aria-label={`Quote for ${cinema.name}`}
                    placeholder="S$1,200 for the hall"
                    value={draft.quote}
                    onChange={(event) => setDrafts((current) => ({ ...current, [cinema.id]: { ...draft, quote: event.target.value } }))}
                    onBlur={(event) => void updateCandidate(cinema.id, { quote: event.target.value })}
                  />
                </label>
                <label className="block">
                  <span className="text-[var(--muted)]">Notes</span>
                  <textarea
                    className="field-input mt-1 min-h-20"
                    aria-label={`Notes for ${cinema.name}`}
                    placeholder="Hall size, who you spoke to, what they need"
                    value={draft.note}
                    onChange={(event) => setDrafts((current) => ({ ...current, [cinema.id]: { ...draft, note: event.target.value } }))}
                    onBlur={(event) => void updateCandidate(cinema.id, { note: event.target.value })}
                  />
                </label>
              </article>
            );
          })}
        </div>
      ) : null}

      {step === "requests" ? (
        <RequestsStep screeningId={receipt?.published ? receipt.screeningId : null} attendance={attendance} onChange={setAttendance} />
      ) : null}
    </div>
  );
}

function RequestsStep({
  screeningId,
  attendance,
  onChange,
}: {
  screeningId: string | null;
  attendance: EventView | null;
  onChange: (event: EventView | null) => void;
}) {
  const [error, setError] = useState("");

  useEffect(() => {
    if (!screeningId) {
      onChange(null);
      return;
    }
    let cancel = false;
    fetch(`/api/events/${screeningId}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { event?: EventView };
        if (!cancel && response.ok) onChange(body.event ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [screeningId, onChange]);

  async function decide(partyId: string, action: "accept" | "declineUpdate" | "revoke") {
    if (!screeningId) return;
    setError("");
    const response = await fetch(`/api/events/${screeningId}/parties/${partyId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const payload = (await response.json()) as { event?: EventView; error?: string };
    if (!response.ok || !payload.event) {
      setError(payload.error || "Could not update that request.");
      return;
    }
    onChange(payload.event);
  }

  if (!screeningId) {
    return <p className="card muted text-sm">Publish the screening first. Then people can ask to attend, and you accept them here.</p>;
  }
  const items = attendance?.parties.filter((party) => party.status !== "declined") ?? [];
  return (
    <div className="space-y-3">
      {error ? <p className="alert text-sm">{error}</p> : null}
      {items.length === 0 ? <p className="card muted text-sm">No attendance requests yet.</p> : null}
      <ul className="space-y-2">
        {items.map((party) => {
          const reserved = party.members + party.guests;
          const proposed = party.proposedMembers != null && party.proposedGuests != null ? party.proposedMembers + party.proposedGuests : null;
          return (
            <li key={party.id} className="card space-y-2 text-sm">
              <p className="font-semibold">{party.personName}</p>
              {party.status === "accepted" ? (
                <p>{reserved} seats reserved</p>
              ) : (
                <p>Asking for {reserved} seats</p>
              )}
              {proposed != null ? <p>Wants to change to {proposed} seats. The reserved seats stay until you accept.</p> : null}
              <div className="flex flex-wrap gap-2">
                {party.status === "requested" ? (
                  <Button type="button" onClick={() => void decide(party.id, "accept")}>Accept</Button>
                ) : null}
                {proposed != null ? (
                  <>
                    <Button type="button" onClick={() => void decide(party.id, "accept")}>Accept update</Button>
                    <Button type="button" tone="plain" onClick={() => void decide(party.id, "declineUpdate")}>Keep reserved seats</Button>
                  </>
                ) : null}
                <Button type="button" tone="plain" onClick={() => void decide(party.id, "revoke")}>Revoke</Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
