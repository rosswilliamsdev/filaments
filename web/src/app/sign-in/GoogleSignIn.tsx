"use client";

import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useRef, useState } from "react";

import { ErrorNote } from "@/components/ui";

// Google Identity Services — the web counterpart of mobile's native
// Google Sign-In. Renders Google's own button; on success we hand the ID
// token to the BFF, which sets httpOnly session cookies.

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: object) => void;
        };
      };
    };
  }
}

function GoogleSignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const buttonRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const onCredential = useCallback(
    async ({ credential }: { credential: string }) => {
      setError(null);
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_token: credential }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(
          body.error === "email not permitted"
            ? "This Google account isn’t on the allowlist."
            : (body.error ?? "Sign-in failed — try again."),
        );
        return;
      }
      router.replace(searchParams.get("next") ?? "/");
      router.refresh();
    },
    [router, searchParams],
  );

  const initGoogle = useCallback(() => {
    if (!window.google || !buttonRef.current || !clientId) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: onCredential,
    });
    window.google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
    });
  }, [clientId, onCredential]);

  if (!clientId) {
    return (
      <ErrorNote message="NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set — add it to web/.env.local." />
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={initGoogle}
      />
      <div ref={buttonRef} className="min-h-11" />
      {error && <ErrorNote message={error} />}
    </div>
  );
}

export function GoogleSignIn() {
  return (
    // useSearchParams requires a Suspense boundary during prerender.
    <Suspense fallback={<div className="min-h-11" />}>
      <GoogleSignInInner />
    </Suspense>
  );
}
