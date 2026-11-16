"use client";

import Link from "next/link";
import { bookingLabel, formatDuration, formatWhen } from "@/lib/format";
import type { BookingStatus, EventView } from "@/lib/types";

const stageClass: Record<BookingStatus, string> = {
  tbd: "stage-tbd",
  pending: "stage-pending",
  booked: "stage-booked",
};

export function StageBadge({ status }: { status: BookingStatus }) {
  return <span className={`stage ${stageClass[status]}`}>{bookingLabel(status)}</span>;
}

export function VideoPreview({ embedUrl, title }: { embedUrl: string | null; title: string }) {
  if (!embedUrl) {
    return <p className="muted text-sm">No Preview</p>;
  }
  return (
    <div className="film aspect-video">
      <iframe
        title={`${title} preview`}
        src={embedUrl}
        className="h-full w-full"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}

export function ViewingCard({ event, onEdit }: { event: EventView; onEdit?: () => void }) {
  const duration = formatDuration(event.durationMinutes);
  const venue = event.cinema?.name ?? "Venue TBD";
  return (
    <article className="card space-y-4">
      <Link href={`/v/${event.id}`} className="block space-y-4 text-inherit no-underline">
      {event.viewerIsHost ? <p className="eyebrow">Your viewing</p> : null}
      <div className="flex items-start justify-between gap-3">
        <h2 className="display text-[1.7rem]">{event.title}</h2>
        <StageBadge status={event.bookingStatus} />
      </div>
      {event.verses.length > 0 ? (
        <ul className="space-y-2">
          {event.verses.map((verse) => (
            <li key={`${verse.passageId ?? verse.reference}-${verse.translation ?? ""}`} className="verse">
              <p className="verse-ref">
                {verse.reference}
                {verse.translation ? ` · ${verse.translation}` : ""}
              </p>
              {verse.text ? <p className="verse-text whitespace-pre-wrap">{verse.text}</p> : null}
              {verse.copyright ? <p className="mt-2 text-xs text-[var(--muted)]">{verse.copyright}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <VideoPreview embedUrl={event.embedUrl} title={event.title} />
      <p className="text-sm">
        {[duration, formatWhen(event.startsAt, event.timeZone)].filter(Boolean).join(" · ")}
      </p>
      <p className="muted text-sm">
        {venue}
        {event.cinema?.address ? ` · ${event.cinema.address}` : ""}
        <br />
        Hosted by {event.hostChurchName}
        {event.remaining > 0 ? ` · ${event.remaining} seats left` : " · Full"}
      </p>
      <span className="link text-sm">{event.viewerPartyId ? "You're going" : "View details"}</span>
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        {event.viewerIsHost && onEdit ? (
          <button type="button" className="btn btn-plain" onClick={onEdit}>
            Edit
          </button>
        ) : null}
      </div>
    </article>
  );
}
