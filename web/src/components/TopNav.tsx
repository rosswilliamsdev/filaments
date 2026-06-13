"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Timeline" },
  { href: "/capture", label: "Capture" },
  { href: "/search", label: "Search" },
  { href: "/ask", label: "Ask" },
] as const;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
}

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  // Global accelerators: "/" → search, "n" → capture. Never while typing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "/") {
        event.preventDefault();
        router.push("/search");
      } else if (event.key === "n") {
        event.preventDefault();
        router.push("/capture");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-200 bg-surface-page">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-14 max-w-[720px] items-center gap-1 px-4"
      >
        <Link
          href="/"
          className="mr-4 font-serif text-lg font-bold text-brand-900"
          translate="no"
        >
          Filaments
        </Link>
        {NAV_ITEMS.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-in-out ${
                active
                  ? "bg-brand-100 text-brand-600"
                  : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <button
          onClick={signOut}
          className="ml-auto rounded-full px-3 py-1.5 text-sm font-medium text-neutral-400 transition-colors duration-150 ease-in-out hover:text-neutral-600"
        >
          Sign out
        </button>
      </nav>
    </header>
  );
}
