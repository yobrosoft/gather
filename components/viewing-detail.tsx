"use client";

import { useEffect, useState } from "react";
import { DirectionsMap } from "@/components/directions-map";
import { StageBadge, VideoPreview } from "@/components/viewing-card";
import { BackButton, Button, Field, FillBar, inputClass } from "@/components/ui";
import { formatDuration, formatWhen, peopleLabel, requestStatusLabel } from "@/lib/format";
import type { EventView, FollowUpKind, FollowUpView } from "@/lib/types";

export function ViewingDetail({
  event,
  signedIn,
  mapsKey,
  onBack,
  onSignIn,
  onEdit,
  onDelete,
  onJoin,
  onRemove,
}: {
  event: EventView;
  signedIn: boolean;
  mapsKey?: string;
  onBack: () => void;
  onSignIn: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onJoin: (members: number, guests: number) => Promise<void>;
  onRemove: (partyId: string) => Promise<void>;
}) {
  const mine = event.parties.find((party) => party.id === event.viewerPartyId);
  const [members, setMembers] = useState(String(mine?.members ?? 1));
  const [guests, setGuests] = useState(String(mine?.guests ?? 0));
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [kind, setKind] = useState<FollowUpKind>("discussion");
  const [shareContact, setShareContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [followUps, setFollowUps] = useState<FollowUpView[]>([]);
  const [followNote, setFollowNote] = useState("");
  const duration = formatDuration(event.durationMinutes);

  useEffect(() => {
    if (!signedIn) return;
    let cancel = false;
    fetch(`/api/events/${event.id}/follow-up`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { followUps?: FollowUpView[] };
        if (!response.ok || cancel) return;
        const rows = body.followUps ?? [];
        setFollowUps(rows);
        const mine = rows.find((row) => row.mine);
        if (!mine) return;
        setKind(mine.kind);
        setShareContact(mine.shareContact);
        setContactName(mine.name);
        setContactEmail(mine.email);
        setContactPhone(mine.phone);
      })
      .catch(() => undefined);
    return () => {
      cancel = true;
    };
  }, [event.id, signedIn]);

  async function saveFollowUp() {
    setPending(true);
    setFollowNote("");
    try {
      const response = await fetch(`/api/events/${event.id}/follow-up`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          shareContact: kind !== "none" && shareContact,
          name: contactName,
          email: contactEmail,
          phone: contactPhone,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not save that choice.");
      setFollowNote(kind === "none" ? "Saved. You can leave it there." : "Saved. The host can see your choice.");
      const again = await fetch(`/api/events/${event.id}/follow-up`, { cache: "no-store" });
      const listed = (await again.json()) as { followUps?: FollowUpView[] };
      if (again.ok) setFollowUps(listed.followUps ?? []);
    } catch (followError) {
      setFollowNote(followError instanceof Error ? followError.message : "Could not save that choice.");
    } finally {
      setPending(false);
    }
  }

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
      <p className="text-sm">
        {event.screeningMode === "shared" ? "Shared screening" : "Private screening"} · {requestStatusLabel(event.requestStatus)}
        {event.expectedHeadcount ? ` · ${event.expectedHeadcount} expected` : ""}
      </p>
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
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onEdit}>
            Edit
          </Button>
          {confirmDelete ? (
            <>
              <Button
                type="button"
                tone="plain"
                disabled={pending}
                onClick={() => {
                  setPending(true);
                  void onDelete()
                    .catch((deleteError: unknown) => setNote(deleteError instanceof Error ? deleteError.message : "Could not delete this viewing."))
                    .finally(() => setPending(false));
                }}
              >
                Delete this viewing
              </Button>
              <button type="button" className="link text-sm" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            </>
          ) : (
            <Button type="button" tone="plain" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      ) : null}
      {confirmDelete ? <p className="text-sm">This removes the viewing, the invite link, and the seats people have taken.</p> : null}
      {!signedIn ? (
        <Button type="button" onClick={onSignIn}>
          Sign in to join
        </Button>
      ) : (
        <form
          className="card space-y-3"
          aria-label="How many attending"
          onSubmit={(formEvent) => {
            formEvent.preventDefault();
            void submit(false);
          }}
        >
          <h2 className="eyebrow">How many attending</h2>
          <Field label="Members">
            <input className={inputClass} inputMode="numeric" value={members} onChange={(event) => setMembers(event.target.value)} />
          </Field>
          <Field label="Guests">
            <input className={inputClass} inputMode="numeric" value={guests} onChange={(event) => setGuests(event.target.value)} />
          </Field>
          <Button type="submit" disabled={pending}>
            {mine?.status === "accepted" ? "Request update" : mine?.status === "requested" ? "Update request" : "Request to attend"}
          </Button>
          {mine?.status === "accepted" ? (
            <p className="muted text-sm">Your {mine.members + mine.guests} seats stay reserved until the host accepts a change.</p>
          ) : null}
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
              {party.personName} · {peopleLabel(party.members, party.guests)}
            </li>
          ))}
        </ul>
      ) : null}
      <section className="card space-y-2" aria-label="After the film">
        <h2 className="eyebrow">After the film</h2>
        <p className="text-sm">Invite friends with the Gather link. After the film, a guest can ask to keep talking. That step is theirs, and sharing contact details is optional.</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>What surprised you about Jesus in this story?</li>
          <li>Who in the film did you most relate to, and why?</li>
          <li>If Jesus were sitting here, what would you ask him?</li>
        </ol>
        {signedIn ? (
          <fieldset className="space-y-2 text-sm">
            <legend className="font-medium">Your next step</legend>
            <label className="flex gap-2">
              <input type="radio" name="follow-up" checked={kind === "discussion"} onChange={() => setKind("discussion")} />
              Join a discussion
            </label>
            <label className="flex gap-2">
              <input type="radio" name="follow-up" checked={kind === "introduction"} onChange={() => setKind("introduction")} />
              Ask for an introduction to {event.hostChurchName}
            </label>
            <label className="flex gap-2">
              <input type="radio" name="follow-up" checked={kind === "none"} onChange={() => setKind("none")} />
              Not this time
            </label>
            {kind !== "none" ? (
              <label className="flex gap-2">
                <input type="checkbox" checked={shareContact} onChange={(change) => setShareContact(change.target.checked)} />
                Share my contact details
              </label>
            ) : null}
            {kind !== "none" && shareContact ? (
              <div className="space-y-2">
                <input className={inputClass} aria-label="Your name" placeholder="Name" value={contactName} onChange={(change) => setContactName(change.target.value)} />
                <input className={inputClass} aria-label="Your email" placeholder="Email" value={contactEmail} onChange={(change) => setContactEmail(change.target.value)} />
                <input className={inputClass} aria-label="Your phone" placeholder="Phone" value={contactPhone} onChange={(change) => setContactPhone(change.target.value)} />
              </div>
            ) : null}
            <Button type="button" disabled={pending} onClick={() => void saveFollowUp()}>
              Save my choice
            </Button>
            {followNote ? <p role="status">{followNote}</p> : null}
          </fieldset>
        ) : (
          <p className="text-sm">Sign in if you want a conversation or an introduction after the film.</p>
        )}
        {event.viewerIsHost && followUps.length > 0 ? (
          <ul className="space-y-1">
            {followUps.map((followUp) => (
              <li key={followUp.id}>
                {followUp.personName}: {followUp.kind === "discussion" ? "discussion" : followUp.kind === "introduction" ? "introduction" : "no next step"}
                {followUp.shareContact ? ` · ${followUp.name} ${followUp.email} ${followUp.phone}`.trim() : ""}
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          className="link text-sm"
          onClick={() => {
            const url = `${window.location.origin}${event.joinPath}`;
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? "Link copied" : "Copy invite link"}
        </button>
      </section>
      {note ? (
        <p role="alert" className="alert text-sm">
          {note}
        </p>
      ) : null}
    </div>
  );
}
