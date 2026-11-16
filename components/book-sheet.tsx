"use client";

import { useState } from "react";
import { nextSaturdayEveningValue } from "@/lib/format";
import type { Visibility } from "@/lib/types";
import { BackButton, Button, Field, inputClass } from "@/components/ui";
import type { CinemaChoice } from "@/components/home-sheet";

export function BookSheet({
  cinema,
  onBack,
  onBook,
}: {
  cinema: CinemaChoice;
  onBack: () => void;
  onBook: (input: {
    title: string;
    startsAt: string;
    timeZone: string;
    capacity: number;
    visibility: Visibility;
    cinema: { placeId: string; name: string; lat: number; lng: number; address: string };
  }) => Promise<void>;
}) {
  const [when, setWhen] = useState(nextSaturdayEveningValue);
  const [capacity, setCapacity] = useState("120");
  const [title, setTitle] = useState("The Chosen");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const seats = Number(capacity);
        const starts = new Date(when);
        if (!title.trim() || Number.isNaN(starts.getTime()) || !Number.isInteger(seats) || seats < 1) {
          setNote("Enter a title, a time, and the number of seats in the theatre.");
          return;
        }
        setPending(true);
        setNote("");
        try {
          await onBook({
            title: title.trim(),
            startsAt: starts.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            capacity: seats,
            visibility,
            cinema: {
              placeId: cinema.placeId,
              name: cinema.name,
              lat: cinema.lat,
              lng: cinema.lng,
              address: cinema.address,
            },
          });
        } catch (error) {
          setNote(error instanceof Error ? error.message : "Could not book this theatre.");
        } finally {
          setPending(false);
        }
      }}
    >
      <BackButton onClick={onBack} />
      <h1 className="text-lg font-semibold">Book {cinema.name}</h1>
      <p className="text-sm text-[#8e8e93]">
        This books the whole theatre for your church. {cinema.detail}
      </p>
      <Field label="Film">
        <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} />
      </Field>
      <Field label="When">
        <input className={inputClass} type="datetime-local" name="when" value={when} onChange={(event) => setWhen(event.target.value)} />
      </Field>
      <Field label="Seats in the theatre">
        <input
          className={inputClass}
          name="capacity"
          inputMode="numeric"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
        />
      </Field>
      <fieldset className="space-y-2 text-sm">
        <legend className="font-medium">Who can see it</legend>
        <label className="flex gap-2">
          <input type="radio" name="visibility" checked={visibility === "private"} onChange={() => setVisibility("private")} />
          Private — off the map. Share a Gather link to invite people.
        </label>
        <label className="flex gap-2">
          <input type="radio" name="visibility" checked={visibility === "open"} onChange={() => setVisibility("open")} />
          Open — also listed for other churches.
        </label>
      </fieldset>
      {note ? (
        <p role="alert" className="text-sm text-[#ff3b30]">
          {note}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        Book this theatre
      </Button>
    </form>
  );
}
