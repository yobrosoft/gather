"use client";

import { CANDIDATE_STATUS_LABEL } from "@/lib/candidates";
import { CRUCIFIXION_TITLE } from "@/lib/chosen";
import { privateCinemaById } from "@/lib/private-cinemas";
import type { EnquiryView } from "@/lib/types";

export function EnquiryCard({
  enquiry,
  partner,
  pending,
  onSimulate,
  onCheck,
}: {
  enquiry: EnquiryView;
  partner: boolean;
  pending?: boolean;
  onSimulate?: () => void;
  onCheck?: (field: "verifiedAvailability" | "verifiedRights" | "verifiedTerms", value: boolean) => void;
}) {
  const proposed = Boolean(enquiry.proposedHall && enquiry.proposedTerms && enquiry.proposedWhen);
  return (
    <article className="card space-y-3 text-sm">
      <div>
        <p className="eyebrow">{CRUCIFIXION_TITLE}</p>
        <h2 className="display mt-1 text-2xl">{enquiry.cinemaName || "Cinema"}</h2>
        <p className="mt-1 text-sm">
          {enquiry.status === "confirmed"
            ? "Your screening of The Chosen Crucifixion is confirmed. Friends can be invited."
            : "Your request for The Chosen Crucifixion. It stays pending until availability, screening rights, and terms are checked."}
        </p>
        <p className="mt-1">
          {enquiry.reference} · {enquiry.expectedTotal} guests · weekend of {enquiry.weekendKey}
        </p>
        <p className="muted">{enquiry.cinemaAddress}</p>
        <p className="mt-2">{enquiry.mode === "private" ? "This request stays separate from churches that want to share." : "Private requests stay on their own enquiry."}</p>
        <p className="mt-2 font-semibold">{enquiry.next}</p>
      </div>
      <ul className="space-y-2">
        {enquiry.requests.map((request) => (
          <li key={request.id}>
            <p className="font-semibold">
              {request.churchName}
              {request.fictional ? " · Fictional church" : ""} · {request.reference}
            </p>
            <p>
              {request.expectedHeadcount} guests · {request.preferredDates.join(", ")} at {request.preferredTime}
            </p>
            <p className="muted">Accessibility: {request.accessibilityNeeds || "None stated"}</p>
            {request.candidates.length > 1 || request.candidates.some((candidate) => candidate.status !== "considering" || candidate.quote) ? (
              <ul className="mt-1 space-y-1">
                {request.candidates.map((candidate) => {
                  const hall = privateCinemaById(candidate.cinemaId);
                  return (
                    <li key={candidate.cinemaId}>
                      {hall?.name ?? "Cinema"}: {CANDIDATE_STATUS_LABEL[candidate.status]}
                      {candidate.quote ? ` · ${candidate.quote}` : ""}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {request.coordinatorName ? (
              <p className="muted">
                Coordinator {request.coordinatorName}
                {request.coordinatorPhone ? ` · ${request.coordinatorPhone}` : ""}
                {request.coordinatorEmail ? ` · ${request.coordinatorEmail}` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {proposed ? (
        <div className="panel">
          <p className="font-semibold">Proposed terms</p>
          <p className="mt-1">{enquiry.proposedHall}</p>
          <p>{enquiry.proposedWhen}</p>
          <p className="mt-1">{enquiry.proposedTerms}</p>
        </div>
      ) : (
        <p className="muted">No cinema reply yet. The request stays pending.</p>
      )}
      {partner && enquiry.status !== "confirmed" ? (
        <div className="space-y-2">
          {onSimulate ? (
            <button type="button" className="btn" disabled={pending} onClick={onSimulate}>
              {pending ? "Saving…" : "Record a simulated cinema reply"}
            </button>
          ) : null}
          <fieldset className="space-y-2" disabled={!proposed || pending}>
            <legend className="font-medium">Coordinator verification</legend>
            <p className="muted">The enquiry stays pending until all three are checked.</p>
            <label className="flex gap-2">
              <input type="checkbox" checked={enquiry.verifiedAvailability} onChange={(event) => onCheck?.("verifiedAvailability", event.target.checked)} />
              Availability checked
            </label>
            <label className="flex gap-2">
              <input type="checkbox" checked={enquiry.verifiedRights} onChange={(event) => onCheck?.("verifiedRights", event.target.checked)} />
              Screening rights checked
            </label>
            <label className="flex gap-2">
              <input type="checkbox" checked={enquiry.verifiedTerms} onChange={(event) => onCheck?.("verifiedTerms", event.target.checked)} />
              Terms checked
            </label>
          </fieldset>
          {enquiry.mailto ? (
            <a className="btn btn-plain" href={enquiry.mailto}>
              Email this enquiry to the cinema
            </a>
          ) : null}
        </div>
      ) : null}
      {enquiry.joinPath ? (
        <p>
          Invite link: <a className="link" href={enquiry.joinPath}>{enquiry.joinPath}</a>
        </p>
      ) : null}
    </article>
  );
}
