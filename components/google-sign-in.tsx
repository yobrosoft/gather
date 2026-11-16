"use client";

import { useEffect, useRef } from "react";

type CredentialResponse = { credential?: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: CredentialResponse) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme: string; size: string; text: string; shape: string; width: number },
          ) => void;
        };
      };
    };
  }
}

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  const found = document.querySelector<HTMLScriptElement>("script[data-gather-google]");
  if (found) {
    return new Promise((resolve, reject) => {
      found.addEventListener("load", () => resolve(), { once: true });
      found.addEventListener("error", () => reject(new Error("Google sign-in did not load.")), { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.dataset.gatherGoogle = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in did not load."));
    document.head.appendChild(script);
  });
}

export function GoogleSignIn({
  clientId,
  onCredential,
  onError,
}: {
  clientId: string;
  onCredential: (credential: string) => void;
  onError: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  onCredentialRef.current = onCredential;
  onErrorRef.current = onError;

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        await loadScript();
        if (cancel || !host.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          auto_select: false,
          callback: (response) => {
            if (response.credential) onCredentialRef.current(response.credential);
            else onErrorRef.current("Google sign-in did not complete.");
          },
        });
        host.current.replaceChildren();
        window.google.accounts.id.renderButton(host.current, {
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "pill",
          width: Math.max(200, Math.min(280, host.current.parentElement?.clientWidth || 260)),
        });
      } catch (error) {
        if (!cancel) onErrorRef.current(error instanceof Error ? error.message : "Google sign-in did not load.");
      }
    })();
    return () => {
      cancel = true;
    };
  }, [clientId]);

  return <div ref={host} />;
}
