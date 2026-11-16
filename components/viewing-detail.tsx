"use client";

import { useState } from "react";
import { DirectionsMap } from "@/components/directions-map";
import { StageBadge, VideoPreview } from "@/components/viewing-card";
import { BackButton, Button, Field, FillBar, inputClass } from "@/components/ui";
import { formatDuration, formatWhen, peopleLabel } from "@/lib/format";
import type { EventView } from "@/lib/types";

export function ViewingDetail({
  event,
  signedIn,
  mapsKey,
  onBack,
  onSignIn,
  onEdit,
  onJoin,
  onRemove,
}: {
  event: EventView;
  signedIn: boolean;
  mapsKey?: string;
  onBack: () => void;
  onSignIn: () => void;
  onEdit: () => void;
  onJoin: (members: number, guests: number) => Promise<void>;
  onRemove: (partyId: string) => Promise<void>;
}) {
  const mine = event.parties.find((party) => party.id === event.viewerPartyId);
  const [members, setMembers] = useState(String(mine?.members ?? 1));
  const [guests, setGuests] = useState(String(mine?.guests ?? 0));
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const duration = formatDuration(event.durationMinutes);

  async function submit(remove: boolean) {
    setPending(true);
    setNote("");
    try {
      if (remove && mine) await onRemove(mine.id);
      else {
        const memberCount = Number(members);
        const guestCount = Number(guests);
        if (!Number.isInteger(memberCount) || !Number.isInteger(guestCount) || memberCount + guestCount < 1) {
          setNote("Enter how many members and guests are coming.");
          return;
        }
        await onJoin(memberCount, guestCount);
      }
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not update your seats.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <VideoPreview embedUrl={event.embedUrl} title={event.title} />
      <div className="flex items-start justify-between gap-3">
        <h1 className="display text-4xl">{event.title}</h1>
        <StageBadge status={event.bookingStatus} />
      </div>
      <p className="text-sm">
        {[duration, formatWhen(event.startsAt, event.timeZone)].filter(Boolean).join(" · ")}
      </p>
      <p className="muted text-sm">
        {event.cinema ? event.cinema.name : "Venue TBD"}
        {event.cinema?.address ? ` · ${event.cinema.address}` : ""}
        <br />
        Hosted by {event.hostChurchName}
      </p>
      <DirectionsMap mapsKey={mapsKey ?? ""} destination={event.cinema} />
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
      <FillBar taken={event.taken} capacity={event.capacity} />
      {event.viewerIsHost ? (
        <Button type="button" onClick={onEdit}>
          Edit
        </Button>
      ) : null}
      {!signedIn ? (
        <Button type="button" onClick={onSignIn}>
          Sign in to join
        </Button>
      ) : (
        <form
          className="card space-y-3"
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            void submit(false);
          }}
        >
          <Field label="Members">
            <input className={inputClass} inputMode="numeric" value={members} onChange={(event) => setMembers(event.target.value)} />
          </Field>
          <Field label="Guests">
            <input className={inputClass} inputMode="numeric" value={guests} onChange={(event) => setGuests(event.target.value)} />
          </Field>
          <Button type="submit" disabled={pending}>
            {mine ? "Update seats" : "Join"}
          </Button>
          {mine ? (
            <Button type="button" tone="danger" disabled={pending} onClick={() => void submit(true)}>
              Leave this viewing
            </Button>
          ) : null}
        </form>
      )}
      {signedIn ? (
        <button
          type="button"
          className="link text-sm"
          onClick={() => {
            const url = `${window.location.origin}${event.joinPath}`;
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? "Link copied" : "Copy Gather link"}
        </button>
      ) : null}
      {event.parties.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {event.parties.map((party) => (
            <li key={party.id}>
              {party.personName}
              {party.churchName ? ` · ${party.churchName}` : ""} · {peopleLabel(party.members, party.guests)}
            </li>
          ))}
        </ul>
      ) : null}
      {note ? (
        <p role="alert" className="alert text-sm">
          {note}
        </p>
      ) : null}
    </div>
  );
}
