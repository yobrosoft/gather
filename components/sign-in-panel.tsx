"use client";

import { useState } from "react";
import { GoogleSignIn } from "@/components/google-sign-in";
import { Button, Field, inputClass } from "@/components/ui";
import type { PublicConfig } from "@/lib/types";

export function SignInPanel({
  config,
  joining,
  error,
  onError,
  onSignedIn,
}: {
  config: PublicConfig;
  joining: boolean;
  error: string;
  onError: (message: string) => void;
  onSignedIn: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Gather</p>
        <h1 className="display mt-2 text-4xl">{joining ? "Sign in to join" : "Sign in"}</h1>
        <p className="muted text-sm">
          {joining
            ? "Sign in with Google to take seats. The cinema still handles tickets."
            : "Sign in with Google to join a viewing, or claim a church that nobody owns yet."}
        </p>
      </div>
      {config.googleClientId ? (
        <GoogleSignIn
          clientId={config.googleClientId}
          onError={onError}
          onCredential={(credential) => {
            setPending(true);
            void fetch("/api/session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ credential }),
            })
              .then(async (response) => {
                const body = (await response.json()) as { error?: string };
                if (!response.ok) throw new Error(body.error || "Google sign-in did not complete.");
                onSignedIn();
              })
              .catch((signInError: unknown) => onError(signInError instanceof Error ? signInError.message : "Google sign-in did not complete."))
              .finally(() => setPending(false));
          }}
        />
      ) : null}
      {config.devAuth && !config.googleClientId ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            onError("");
            void fetch("/api/session", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ devName: name, devEmail: email }),
            })
              .then(async (response) => {
                const body = (await response.json()) as { error?: string };
                if (!response.ok) throw new Error(body.error || "Could not sign in.");
                onSignedIn();
              })
              .catch((signInError: unknown) => onError(signInError instanceof Error ? signInError.message : "Could not sign in."))
              .finally(() => setPending(false));
          }}
        >
          <Field label="Your name">
            <input className={inputClass} name="name" value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Email">
            <input className={inputClass} name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Button type="submit" disabled={pending}>
            Continue
          </Button>
        </form>
      ) : null}
      {!config.googleClientId && !config.devAuth ? <p className="muted text-sm">Add GOOGLE_CLIENT_ID to sign in.</p> : null}
      {pending ? <p className="muted text-sm">Signing in…</p> : null}
      {error ? (
        <p role="alert" className="alert text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
