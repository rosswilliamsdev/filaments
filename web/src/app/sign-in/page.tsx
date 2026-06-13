import type { Metadata } from "next";

import { GoogleSignIn } from "./GoogleSignIn";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="font-serif text-3xl font-bold text-brand-900" translate="no">
          Filaments
        </h1>
        <p className="mt-2 text-base text-neutral-500">
          A personal knowledge archive.
        </p>
      </div>
      <GoogleSignIn />
    </main>
  );
}
