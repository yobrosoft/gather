"use client";

import type { EventView } from "@/lib/types";
import { formatWhen } from "@/lib/format";
import { FillBar } from "@/components/ui";

export type CinemaChoice = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  detail: string;
  dimmed: boolean;
};

export function HomeSheet({
  isOwner,
  churchName,
  inviteCode,
  cinemas,
  ownEvents,
  openedEvents,
  dimmedEvents,
  samples,
  onSetup,
  onBook,
  onOpen,
}: {
  isOwner: boolean;
  churchName: string | null;
  inviteCode: string;
  cinemas: CinemaChoice[];
  ownEvents: EventView[];
  openedEvents: EventView[];
  dimmedEvents: EventView[];
  samples: boolean;
  onSetup: () => void;
  onBook: (cinema: CinemaChoice) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">{churchName ?? "Find a viewing"}</h1>
          <p className="text-sm text-[#8e8e93]">
            {isOwner ? "Book a whole theatre for your church." : "Join a viewing your church can see."}
          </p>
        </div>
        <button type="button" onClick={onSetup} className="text-sm font-semibold text-[#007aff]">
          {churchName ? "Church" : "Set up your church"}
        </button>
      </div>

      {inviteCode ? (
        <p className="text-sm">
          Invite code <span className="font-semibold tracking-wide">{inviteCode}</span>
        </p>
      ) : null}

      {isOwner ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Book a theatre</h2>
          {samples ? (
            <p className="text-sm text-[#8e8e93]">
              Sample cinemas stand in until a Maps key is set. Drive times come from Google.
            </p>
          ) : null}
          {cinemas.length === 0 ? <p className="text-sm text-[#8e8e93]">No cinemas in range yet.</p> : null}
          <ul className="space-y-2">
            {cinemas.map((cinema) => (
              <li key={cinema.placeId}>
                <button
                  type="button"
                  onClick={() => onBook(cinema)}
                  className="w-full rounded-2xl bg-[#f2f2f7] px-3 py-3 text-left"
                  style={{ opacity: cinema.dimmed ? 0.55 : 1 }}
                >
                  <span className="block font-semibold">Book {cinema.name}</span>
                  <span className="block text-sm text-[#8e8e93]">
                    {cinema.detail}
                    {cinema.address ? ` · ${cinema.address}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <EventList title={isOwner ? "Your viewings" : "Your church"} events={ownEvents} onOpen={onOpen} />
      <EventList title="Opened by other churches" events={openedEvents} onOpen={onOpen} />
      <EventList title="Farther than 35 minutes" events={dimmedEvents} onOpen={onOpen} />
      {!isOwner && ownEvents.length + openedEvents.length + dimmedEvents.length === 0 ? (
        <p className="text-sm text-[#8e8e93]">No viewings are open for you yet.</p>
      ) : null}
    </div>
  );
}

function EventList({ title, events, onOpen }: { title: string; events: EventView[]; onOpen: (id: string) => void }) {
  if (events.length === 0) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="space-y-2">
        {events.map((event) => (
          <li key={event.id}>
            <button type="button" onClick={() => onOpen(event.id)} className="w-full rounded-2xl bg-[#f2f2f7] px-3 py-3 text-left">
              <span className="block font-semibold">{event.title}</span>
              <span className="block text-sm text-[#8e8e93]">
                Hosted by {event.hostChurchName} · {formatWhen(event.startsAt, event.timeZone)} · {event.cinema?.name ?? "Venue TBD"}
              </span>
              <span className="mt-2 block">
                <FillBar taken={event.taken} capacity={event.capacity} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
