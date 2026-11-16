"use client";

import { useState } from "react";
import type { PublicChurch } from "@/lib/types";
import type { PlacePin } from "@/lib/places";
import { BackButton, Button, Field, inputClass } from "@/components/ui";

export function ChurchSheet({
  church,
  isOwner,
  mapsKey,
  onBack,
  onCreate,
  onJoin,
  onCatchment,
  onSearch,
  onPreview,
  onLookup,
  onShowMap,
}: {
  church: PublicChurch | null;
  isOwner: boolean;
  mapsKey: string;
  onBack: () => void;
  onCreate: (input: { name: string; placeId: string; lat: number; lng: number; address: string }) => Promise<void>;
  onJoin: (code: string) => Promise<void>;
  onCatchment: (catchment: PublicChurch["catchment"]) => Promise<void>;
  onSearch: (query: string) => Promise<PlacePin[]>;
  onPreview: (place: PlacePin) => void;
  onLookup: (placeId: string) => Promise<"unclaimed" | "claimed" | "yours">;
  onShowMap?: () => void;
}) {
  const [name, setName] = useState(church?.name ?? "");
  const [chosen, setChosen] = useState<PlacePin | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlacePin[]>([]);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [claim, setClaim] = useState<"unclaimed" | "claimed" | "yours" | null>(null);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!chosen || !name.trim()) {
      setNote("Search for your church and choose it from the list.");
      return;
    }
    setPending(true);
    setNote("");
    try {
      await onCreate({
        name: name.trim(),
        placeId: chosen.placeId,
        lat: chosen.lat,
        lng: chosen.lng,
        address: chosen.address,
      });
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Could not save the church.");
    } finally {
      setPending(false);
    }
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setPending(true);
    setNote("");
    try {
      const found = await onSearch(query.trim());
      setResults(found);
      if (found.length === 0) setNote("No places matched that search.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Church search failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} />
      <h1 className="display text-4xl">{church ? church.name : "Your church"}</h1>
      {isOwner && church ? (
        <div className="space-y-3">
          <div className="panel text-sm">
            <p className="font-semibold">You own {church.name}</p>
            <p className="mt-2 muted">People use this code to join the church.</p>
            <p className="display mt-1 text-3xl tracking-[0.18em]">{church.inviteCode}</p>
            <button
              type="button"
              className="mt-1 font-semibold text-[var(--teal)]"
              onClick={() => void navigator.clipboard?.writeText(church.inviteCode)}
            >
              Copy join code
            </button>
          </div>
          <div className="panel text-sm">
            <p className="muted">Another Google account uses this code to become an owner.</p>
            <p className="display mt-1 text-3xl tracking-[0.18em]">{church.ownerInviteCode}</p>
            <button
              type="button"
              className="mt-1 font-semibold text-[var(--teal)]"
              onClick={() => void navigator.clipboard?.writeText(church.ownerInviteCode)}
            >
              Copy owner invite
            </button>
          </div>
        </div>
      ) : null}
      {church && !isOwner ? <p className="text-sm muted">You are part of {church.name}.</p> : null}

      {!church ? (
        <div className="space-y-3">
          {mapsKey ? (
            <form className="space-y-2" onSubmit={search}>
              <Field label="Search for your church">
                <input
                  className={inputClass}
                  name="churchSearch"
                  placeholder="Name or address"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </Field>
              <Button type="submit" tone="plain" disabled={pending}>
                Search Google Maps
              </Button>
            </form>
          ) : (
            <p className="text-sm muted">Google Maps is not set up, so church search is unavailable.</p>
          )}
          {results.map((place) => (
            <button
              type="button"
              key={place.placeId}
              className="panel block w-full text-left text-sm"
              style={{ outline: chosen?.placeId === place.placeId ? "2px solid #12c4b6" : undefined }}
              onClick={() => {
                setChosen(place);
                setName(place.name);
                setClaim(null);
                onPreview(place);
                void onLookup(place.placeId)
                  .then(setClaim)
                  .catch((lookupError: unknown) => {
                    setNote(lookupError instanceof Error ? lookupError.message : "Could not check that church.");
                  });
              }}
            >
              {place.name}
              <span className="block muted">{place.address}</span>
            </button>
          ))}
          {chosen ? <p className="text-sm muted">{chosen.address}</p> : null}
          {claim === "claimed" ? (
            <p className="text-sm">This church is already claimed. Ask an owner for a join code.</p>
          ) : null}
          {claim === "yours" ? <p className="text-sm">You already own this church.</p> : null}
          {claim === "unclaimed" ? (
            <p className="text-sm muted">Nobody owns this church yet. Claiming it makes you the owner.</p>
          ) : null}
          <form className="space-y-3" onSubmit={create}>
            <Field label="Church name">
              <input className={inputClass} name="churchName" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Button type="submit" disabled={pending || !chosen || claim === "claimed" || claim === "yours"}>
              Claim church
            </Button>
          </form>
        </div>
      ) : null}

      {isOwner && church && onShowMap ? (
        <Button type="button" tone="plain" onClick={onShowMap}>
          Member pins on the map
        </Button>
      ) : null}
      {isOwner && church && mapsKey ? (
        <div className="space-y-2 text-sm">
          <p>Drop up to four pins where members live. Venue drive times use the longest of those drives.</p>
          <ul className="space-y-1">
            {church.catchment.map((pin, index) => (
              <li key={`${pin.lat}-${pin.lng}-${index}`} className="flex items-center justify-between panel px-3 py-2">
                <span>
                  {pin.label} · {pin.lat.toFixed(3)}, {pin.lng.toFixed(3)}
                </span>
                <button
                  type="button"
                  className="font-semibold text-[var(--danger)]"
                  onClick={() => void onCatchment(church.catchment.filter((_, pinIndex) => pinIndex !== index))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!isOwner ? (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setNote("");
            try {
              await onJoin(code);
            } catch (error) {
              setNote(error instanceof Error ? error.message : "Could not join that church.");
            } finally {
              setPending(false);
            }
          }}
        >
          <Field label={church ? "Owner or church invite" : "Invite code"}>
            <input className={inputClass} name="invite" value={code} onChange={(event) => setCode(event.target.value)} />
          </Field>
          <p className="text-sm muted">
            {church
              ? "An owner invite makes you an owner of that church."
              : "Use a join code to associate this account with a church, or an owner invite to own it with them."}
          </p>
          <Button type="submit" tone="plain" disabled={pending}>
            {church ? "Use invite" : "Join church"}
          </Button>
        </form>
      ) : null}
      {note ? (
        <p role="alert" className="alert text-sm">
          {note}
        </p>
      ) : null}
    </div>
  );
}
