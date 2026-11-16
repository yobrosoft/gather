"use client";

import { VersePicker } from "@/components/verse-picker";
import { bookingLabel } from "@/lib/format";
import type { BookingStatus, Verse, Visibility } from "@/lib/types";
import { BackButton, Button, Field, inputClass } from "@/components/ui";

export type CinemaDraft = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
};

export type ViewingDraft = {
  id: string | null;
  title: string;
  durationMinutes: string;
  videoUrl: string;
  verses: Verse[];
  when: string;
  timeZone: string;
  capacity: string;
  visibility: Visibility;
  bookingStatus: BookingStatus;
  cinema: CinemaDraft | null;
};

function datePart(when: string): string {
  return when.split("T")[0] ?? "";
}

function timePart(when: string): string {
  return (when.split("T")[1] ?? "").slice(0, 5);
}

function joinWhen(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "19:00"}`;
}

export function ViewingForm({
  draft,
  pending,
  note,
  onChange,
  onBack,
  onVenue,
  onSave,
}: {
  draft: ViewingDraft;
  pending: boolean;
  note: string;
  onChange: (next: ViewingDraft) => void;
  onBack: () => void;
  onVenue: () => void;
  onSave: () => void;
}) {
  function patch(partial: Partial<ViewingDraft>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <BackButton onClick={onBack} />
      <h1 className="display text-4xl">{draft.id ? "Edit viewing" : "Add a viewing"}</h1>
      <p className="muted text-sm">
        Set what is showing, then choose a cinema and how far the booking has got.
      </p>
      <Field label="What's showing">
        <input className={inputClass} value={draft.title} onChange={(event) => patch({ title: event.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Date">
          <input
            className={inputClass}
            type="date"
            name="date"
            aria-label="Date"
            value={datePart(draft.when)}
            onChange={(event) => patch({ when: joinWhen(event.target.value, timePart(draft.when) || "19:00") })}
          />
        </Field>
        <Field label="Time">
          <input
            className={inputClass}
            type="time"
            name="time"
            aria-label="Time"
            value={timePart(draft.when)}
            onChange={(event) => patch({ when: joinWhen(datePart(draft.when), event.target.value) })}
          />
        </Field>
      </div>
      <Field label="Duration (minutes)">
        <input
          className={inputClass}
          inputMode="numeric"
          value={draft.durationMinutes}
          onChange={(event) => patch({ durationMinutes: event.target.value })}
        />
      </Field>
      <Field label="YouTube preview, optional">
        <input
          className={inputClass}
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={draft.videoUrl}
          onChange={(event) => patch({ videoUrl: event.target.value })}
        />
      </Field>
      <VersePicker verses={draft.verses} onChange={(verses) => patch({ verses })} />
      <Field label="Seats in the theatre">
        <input
          className={inputClass}
          inputMode="numeric"
          value={draft.capacity}
          onChange={(event) => patch({ capacity: event.target.value })}
        />
      </Field>
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">Booking stage</legend>
        {(["tbd", "pending", "booked"] as const).map((status) => (
          <label key={status} className="flex gap-2">
            <input type="radio" name="booking" checked={draft.bookingStatus === status} onChange={() => patch({ bookingStatus: status })} />
            {bookingLabel(status)}
          </label>
        ))}
      </fieldset>
      <div className="panel text-sm">
        <p className="font-semibold">{draft.cinema ? draft.cinema.name : "Venue TBD"}</p>
        {draft.cinema?.address ? <p className="muted">{draft.cinema.address}</p> : null}
        <p className="muted mt-1">Pending and booked viewings need a cinema, and that cinema is held for this date.</p>
        <div className="mt-2 flex gap-2">
          <Button type="button" tone="plain" onClick={onVenue}>
            Set venue
          </Button>
          {draft.cinema ? (
            <Button type="button" tone="plain" onClick={() => patch({ cinema: null, bookingStatus: "tbd" })}>
              Clear venue
            </Button>
          ) : null}
        </div>
      </div>
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">Who can see it</legend>
        <label className="flex gap-2">
          <input type="radio" name="visibility" checked={draft.visibility === "open"} onChange={() => patch({ visibility: "open" })} />
          Open — listed for people who want to attend
        </label>
        <label className="flex gap-2">
          <input type="radio" name="visibility" checked={draft.visibility === "private"} onChange={() => patch({ visibility: "private" })} />
          Private — only people with the Gather link
        </label>
      </fieldset>
      <Button type="button" disabled={pending} onClick={onSave}>
        {pending ? "Saving…" : draft.id ? "Update" : "Save"}
      </Button>
      {note ? (
        <p role={note === "Saved." ? "status" : "alert"} className={note === "Saved." ? "text-sm font-semibold text-[var(--teal)]" : "alert text-sm"}>
          {note}
        </p>
      ) : null}
    </form>
  );
}
