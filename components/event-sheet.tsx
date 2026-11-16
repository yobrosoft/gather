"use client";

import { useState } from "react";
import { formatWhen, peopleLabel } from "@/lib/format";
import type { EventView, PartyView } from "@/lib/types";
import { BackButton, Button, Field, FillBar, inputClass } from "@/components/ui";

export function EventSheet({
  event,
  onBack,
  onVisibility,
  onJoin,
  onRemove,
}: {
  event: EventView;
  onBack: () => void;
  onVisibility: (open: boolean) => Promise<void>;
  onJoin: (members: number, guests: number) => Promise<void>;
  onRemove: (partyId: string) => Promise<void>;
}) {
  const mine = event.parties.find((party) => party.id === event.viewerPartyId);
  const [members, setMembers] = useState(String(mine?.members ?? 1));
  const [guests, setGuests] = useState(String(mine?.guests ?? 0));
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const groups = groupParties(event.parties, event.hostChurchId);

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <div>
        <h1 className="text-lg font-semibold">{event.title}</h1>
        <p className="text-sm text-[#8e8e93]">
          Hosted by {event.hostChurchName}
          <br />
          {formatWhen(event.startsAt, event.timeZone)} · {event.cinema?.name ?? "Venue TBD"}
        </p>
        {event.cinema?.address ? <p className="text-sm text-[#8e8e93]">{event.cinema.address}</p> : null}
      </div>
      <FillBar taken={event.taken} capacity={event.capacity} />
      {event.viewerIsHost ? (
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={event.visibility === "open"}
            disabled={pending}
            onChange={async (change) => {
              setPending(true);
              setNote("");
              try {
                await onVisibility(change.target.checked);
              } catch (error) {
                setNote(error instanceof Error ? error.message : "Could not update this viewing.");
              } finally {
                setPending(false);
              }
            }}
          />
          <span>
            Allow other churches to join
            <span className="block text-[#8e8e93]">
              {event.visibility === "open"
                ? "Other churches can find this on the map. The Gather link still invites people directly. Your church still hosts the theatre."
                : "This stays off the map. People with the Gather link can take seats. Your church still hosts the theatre."}
            </span>
          </span>
        </label>
      ) : (
        <p className="text-sm text-[#8e8e93]">Hosted by {event.hostChurchName}.</p>
      )}
      <div className="rounded-2xl bg-[#f2f2f7] px-3 py-3 text-sm">
        <p className="font-semibold">Invite with a Gather link</p>
        <p className="text-[#8e8e93]">People open this link in Gather to take seats. It is not a cinema ticket.</p>
        <button
          type="button"
          className="mt-2 font-semibold text-[#007aff]"
          onClick={() => {
            const url = `${window.location.origin}${event.joinPath}`;
            void navigator.clipboard.writeText(url).then(
              () => setCopied(true),
              () => setNote(url),
            );
          }}
        >
          {copied ? "Copied join link" : "Copy join link"}
        </button>
      </div>
      <ul className="space-y-3">
        {groups.map((group) => (
          <li key={group.key}>
            <p className="text-sm font-semibold">
              {group.name} · {peopleLabel(group.members, group.guests)}
            </p>
            <ul className="mt-1 space-y-1">
              {group.parties.map((party) => (
                <li key={party.id} className="flex items-center justify-between text-sm">
                  <span>
                    {party.personName} · {peopleLabel(party.members, party.guests)}
                  </span>
                  {event.viewerIsHost || party.id === event.viewerPartyId ? (
                    <button
                      type="button"
                      className="font-semibold text-[#ff3b30]"
                      onClick={() => void onRemove(party.id).catch((error: unknown) => setNote(error instanceof Error ? error.message : "Could not remove that party."))}
                    >
                      {party.id === event.viewerPartyId ? "Leave" : "Remove"}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {note ? (
        <p role="alert" className="text-sm text-[#ff3b30]">
          {note}
        </p>
      ) : null}
      {event.remaining > 0 || mine ? (
        <form
          className="space-y-3"
          onSubmit={async (submit) => {
            submit.preventDefault();
            const memberCount = Number(members);
            const guestCount = Number(guests);
            setPending(true);
            setNote("");
            try {
              await onJoin(memberCount, guestCount);
            } catch (error) {
              setNote(error instanceof Error ? error.message : "Could not join this viewing.");
            } finally {
              setPending(false);
            }
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Members">
              <input className={inputClass} name="members" inputMode="numeric" value={members} onChange={(event) => setMembers(event.target.value)} />
            </Field>
            <Field label="Guests">
              <input className={inputClass} name="guests" inputMode="numeric" value={guests} onChange={(event) => setGuests(event.target.value)} />
            </Field>
          </div>
          <Button type="submit" disabled={pending}>
            {mine ? "Update your party" : "Join this viewing"}
          </Button>
        </form>
      ) : (
        <p className="text-sm">This theatre is full.</p>
      )}
    </div>
  );
}

function groupParties(parties: PartyView[], hostChurchId: string) {
  const rows = new Map<string, { key: string; name: string; members: number; guests: number; parties: PartyView[] }>();
  const ordered = [...parties].sort((a, b) => {
    const rank = (party: PartyView) => (party.churchId === hostChurchId ? 0 : party.churchId ? 1 : 2);
    return rank(a) - rank(b) || (a.churchName ?? "Guests").localeCompare(b.churchName ?? "Guests");
  });
  for (const party of ordered) {
    const key = party.churchId ?? "guests";
    const row = rows.get(key) ?? {
      key,
      name: party.churchId ? party.churchName || "Church" : "Guests",
      members: 0,
      guests: 0,
      parties: [],
    };
    row.members += party.members;
    row.guests += party.guests;
    row.parties.push(party);
    rows.set(key, row);
  }
  return [...rows.values()];
}
