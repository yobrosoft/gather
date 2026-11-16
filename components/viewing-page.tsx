"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ViewingDetail } from "@/components/viewing-detail";
import { Button } from "@/components/ui";
import type { EventView, PublicConfig, PublicUser } from "@/lib/types";

async function send(url: string, method = "GET", body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string; event?: EventView };
  if (!response.ok) throw new Error(payload.error || "That did not work.");
  return payload;
}

export function ViewingPage({ config, id }: { config: PublicConfig; id: string }) {
  const router = useRouter();
  const [event, setEvent] = useState<EventView | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const [sessionRes, eventRes] = await Promise.all([
      fetch("/api/session", { cache: "no-store" }),
      fetch(`/api/events/${id}`, { cache: "no-store" }),
    ]);
    const session = (await sessionRes.json()) as { user: PublicUser | null };
    setSignedIn(Boolean(session.user));
    const body = (await eventRes.json()) as { event?: EventView; error?: string };
    if (!eventRes.ok || !body.event) {
      setError(body.error || "This viewing is no longer available.");
      setEvent(null);
      return;
    }
    setEvent(body.event);
    setError("");
  }, [id]);

  useEffect(() => {
    void load().finally(() => setReady(true));
  }, [load]);

  useEffect(() => {
    if (!event) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [event, load]);

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))]">
      {!ready ? <p className="muted text-sm">Loading the viewing…</p> : null}
      {error ? <p className="alert text-sm">{error}</p> : null}
      {event ? (
        <ViewingDetail
          key={event.id}
          event={event}
          signedIn={signedIn}
          mapsKey={config.mapsKey}
          onBack={() => router.push("/")}
          onSignIn={() => router.push(`/?join=${event.id}`)}
          onEdit={() => router.push(`/?edit=${event.id}`)}
          onJoin={async (members, guests) => {
            const payload = await send(`/api/events/${event.id}/parties`, "POST", { members, guests });
            if (payload.event) setEvent(payload.event);
          }}
          onRemove={async (partyId) => {
            const payload = await send(`/api/events/${event.id}/parties/${partyId}`, "DELETE");
            if (payload.event) setEvent(payload.event);
          }}
        />
      ) : ready && !error ? (
        <Button type="button" tone="plain" onClick={() => router.push("/")}>
          Back
        </Button>
      ) : null}
    </main>
  );
}
