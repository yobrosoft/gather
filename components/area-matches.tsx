"use client";

import { useEffect, useState } from "react";
import { EnquiryCard } from "@/components/enquiry-card";
import type { EnquiryView } from "@/lib/types";

export function AreaMatches() {
  const [enquiries, setEnquiries] = useState<EnquiryView[]>([]);
  const [error, setError] = useState("");
  const [pendingId, setPendingId] = useState("");
  const [saved, setSaved] = useState("");

  async function load() {
    const response = await fetch("/api/enquiries", { cache: "no-store" });
    const body = (await response.json()) as { enquiries?: EnquiryView[]; error?: string };
    if (!response.ok) throw new Error(body.error || "Could not load enquiries.");
    setEnquiries(body.enquiries ?? []);
  }

  useEffect(() => {
    let cancel = false;
    load().catch((loadError: unknown) => {
      if (!cancel) setError(loadError instanceof Error ? loadError.message : "Could not load enquiries.");
    });
    return () => {
      cancel = true;
    };
  }, []);

  async function send(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { enquiry?: EnquiryView; enquiries?: EnquiryView[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "That did not work.");
    return payload;
  }

  async function loadDemo() {
    setPendingId("demo");
    setError("");
    setSaved("");
    try {
      const payload = await send("/api/demo/tampines", {});
      setEnquiries(payload.enquiries ?? []);
      setSaved("Tampines demo loaded. The private request for 150 stays separate. The shared requests are one enquiry for 120.");
    } catch (demoError) {
      setError(demoError instanceof Error ? demoError.message : "Could not load the demo.");
    } finally {
      setPendingId("");
    }
  }

  async function patch(enquiry: EnquiryView, body: Record<string, unknown>, note: string) {
    setPendingId(enquiry.id);
    setError("");
    setSaved("");
    try {
      const payload = await send(`/api/enquiries/${enquiry.id}`, body);
      if (payload.enquiry) {
        setEnquiries((current) => current.map((item) => (item.id === payload.enquiry?.id ? payload.enquiry : item)));
      }
      setSaved(note);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Could not save the enquiry.");
    } finally {
      setPendingId("");
    }
  }

  const privateOnes = enquiries.filter((enquiry) => enquiry.mode === "private");
  const sharedOnes = enquiries.filter((enquiry) => enquiry.mode === "shared");

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">The Chosen Singapore</p>
        <h1 className="display mt-2 text-4xl">Enquiries for the cinema</h1>
        <p className="muted mt-2 text-sm">
          Each church sends its own request for The Chosen Crucifixion. A private request stays separate. Churches that choose to share the same cinema on the same weekend become one enquiry. Nothing is confirmed until you verify availability, screening rights, and terms.
        </p>
      </div>
      <button type="button" className="btn" disabled={pendingId === "demo"} onClick={() => void loadDemo()}>
        {pendingId === "demo" ? "Loading…" : "Load the Tampines demo"}
      </button>
      {saved ? <p role="status" className="text-sm font-semibold text-[var(--teal)]">{saved}</p> : null}
      {error ? <p className="alert text-sm">{error}</p> : null}
      {enquiries.length === 0 && !error ? <p className="card muted text-sm">No enquiries yet.</p> : null}
      {privateOnes.length > 0 ? <h2 className="display text-2xl">Private</h2> : null}
      {privateOnes.map((enquiry) => (
        <EnquiryCard
          key={enquiry.id}
          enquiry={enquiry}
          partner
          pending={pendingId === enquiry.id}
          onSimulate={() => void patch(enquiry, { simulate: true }, `Saved a simulated reply on ${enquiry.reference}.`)}
          onCheck={(field, value) => void patch(enquiry, { [field]: value }, `Saved ${enquiry.reference}.`)}
        />
      ))}
      {sharedOnes.length > 0 ? <h2 className="display text-2xl">Shared</h2> : null}
      {sharedOnes.map((enquiry) => (
        <EnquiryCard
          key={enquiry.id}
          enquiry={enquiry}
          partner
          pending={pendingId === enquiry.id}
          onSimulate={() => void patch(enquiry, { simulate: true }, `Saved a simulated reply on ${enquiry.reference}. The churches can review the terms.`)}
          onCheck={(field, value) => void patch(enquiry, { [field]: value }, `Saved ${enquiry.reference}.`)}
        />
      ))}
    </div>
  );
}
