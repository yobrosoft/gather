"use client";

import { useEffect, useState } from "react";
import { CANDIDATE_STATUS_LABEL } from "@/lib/candidates";
import { cinemaEnquiryMailto, privateCinemaById } from "@/lib/private-cinemas";
import type { CandidateStatus, EnquiryView, PublicChurch } from "@/lib/types";

export function ShortlistScreen({ church }: { church: PublicChurch }) {
  const [enquiries, setEnquiries] = useState<EnquiryView[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancel = false;
    fetch("/api/requests", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { enquiries?: EnquiryView[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load your cinemas.");
        if (!cancel) setEnquiries(body.enquiries ?? []);
      })
      .catch((loadError: unknown) => {
        if (!cancel) setError(loadError instanceof Error ? loadError.message : "Could not load your cinemas.");
      });
    return () => {
      cancel = true;
    };
  }, [church.id]);

  const rows = enquiries.flatMap((enquiry) =>
    enquiry.requests
      .filter((request) => request.churchId === church.id && enquiry.status !== "confirmed")
      .map((request) => ({ enquiry, request })),
  );

  async function save(requestId: string, cinemaId: string, status: CandidateStatus, quote: string) {
    setError("");
    const response = await fetch(`/api/requests/${requestId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cinemaId, status, quote }),
    });
    const payload = (await response.json()) as { enquiry?: EnquiryView; error?: string };
    if (!response.ok || !payload.enquiry) throw new Error(payload.error || "Could not save that cinema.");
    setEnquiries((current) => current.map((enquiry) => (enquiry.id === payload.enquiry?.id ? payload.enquiry : enquiry)));
    const chosen = payload.enquiry.requests
      .flatMap((request) => request.candidates)
      .find((candidate) => candidate.cinemaId === cinemaId && candidate.status === "chosen");
    setNote(chosen ? `${privateCinemaById(cinemaId)?.name ?? "That hall"} is the one you will book.` : "Saved.");
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Your cinemas</p>
        <h1 className="display mt-2 text-4xl">Shortlist</h1>
        <p className="muted mt-2 text-sm">These are the halls you are asking. Update the quote and status here until you book one.</p>
      </div>
      {note ? <p role="status" className="text-sm font-semibold text-[var(--teal)]">{note}</p> : null}
      {error ? <p className="alert text-sm">{error}</p> : null}
      {rows.length === 0 && !error ? (
        <p className="card muted text-sm">No cinemas yet. Add candidates in Arrange, then they stay on this screen.</p>
      ) : null}
      {rows.map(({ enquiry, request }) => {
        const booked = request.candidates.find((candidate) => candidate.status === "chosen");
        const bookedName = booked ? privateCinemaById(booked.cinemaId)?.name : "";
        return (
          <section key={request.id} className="space-y-3">
            <div>
              <h2 className="display text-2xl">{request.expectedHeadcount} guests · {request.preferredDates[0]}</h2>
              <p className="muted text-sm">Reference {request.reference}. {enquiry.reference}</p>
              {bookedName ? <p className="mt-1 text-sm font-semibold">Booking {bookedName}.</p> : null}
            </div>
            {request.candidates.map((candidate) => {
              const cinema = privateCinemaById(candidate.cinemaId);
              if (!cinema) return null;
              const mailto = cinemaEnquiryMailto(cinema, {
                church: church.name,
                when: `${request.preferredDates.join(", ")} ${request.preferredTime}`,
                people: String(request.expectedHeadcount),
                mode: enquiry.mode === "shared" ? "open to sharing" : "a private auditorium",
              });
              return (
                <article key={candidate.cinemaId} className="card space-y-2 text-sm">
                  <p className="font-semibold">{cinema.name}</p>
                  <p className="muted">{cinema.operator} · {cinema.address}</p>
                  <p>{cinema.seatsLabel}. Unverified.</p>
                  <p className="muted">{cinema.availability}</p>
                  <p className="flex flex-wrap gap-3">
                    <a className="link" href={cinema.enquiryUrl} target="_blank" rel="noreferrer">Booking page</a>
                    <a className="link" href={mailto}>Email {cinema.operator}</a>
                  </p>
                  <label className="block">
                    <span className="text-[var(--muted)]">Booking status</span>
                    <select
                      className="field-input mt-1"
                      aria-label={`Status for ${cinema.name}`}
                      value={candidate.status}
                      onChange={(event) => {
                        const status = event.target.value as CandidateStatus;
                        void save(request.id, candidate.cinemaId, status, candidate.quote).catch((saveError: unknown) => {
                          setError(saveError instanceof Error ? saveError.message : "Could not save that cinema.");
                        });
                      }}
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
                      defaultValue={candidate.quote}
                      key={`${candidate.cinemaId}-${candidate.quote}`}
                      onBlur={(event) => {
                        if (event.target.value === candidate.quote) return;
                        void save(request.id, candidate.cinemaId, candidate.status, event.target.value).catch((saveError: unknown) => {
                          setError(saveError instanceof Error ? saveError.message : "Could not save that quote.");
                        });
                      }}
                    />
                  </label>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
