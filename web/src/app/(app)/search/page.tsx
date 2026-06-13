"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { FilamentCardItem } from "@/components/FilamentCardItem";
import { EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { useSearch } from "@/lib/hooks";
import type { FilamentType } from "@/lib/types";

const TYPE_OPTIONS: { value: FilamentType | ""; label: string }[] = [
  { value: "", label: "All types" },
  { value: "voice", label: "Voice" },
  { value: "document", label: "Documents" },
  { value: "text", label: "Notes" },
];

function Search() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const type = (params.get("type") as FilamentType | null) ?? "";

  const [draft, setDraft] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  // Keep the box in sync when q changes via back/forward navigation.
  useEffect(() => setDraft(q), [q]);

  const query = useSearch(q, type || undefined);

  function applySearch(nextQ: string, nextType: FilamentType | "") {
    const sp = new URLSearchParams();
    if (nextQ.trim()) sp.set("q", nextQ.trim());
    if (nextType) sp.set("type", nextType);
    router.replace(`/search${sp.size ? `?${sp}` : ""}`);
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          applySearch(draft, type);
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          type="search"
          name="q"
          placeholder="Search your archive…"
          autoComplete="off"
          spellCheck={false}
          aria-label="Search filaments"
          className="h-10 min-w-0 flex-1 rounded-md border border-neutral-200 bg-surface-input px-3 text-base placeholder:text-neutral-400 focus:border-brand-500"
        />
        <select
          value={type}
          onChange={(e) => applySearch(draft, e.target.value as FilamentType | "")}
          aria-label="Filter by type"
          className="h-10 rounded-md border border-neutral-200 bg-surface-input px-2 text-sm text-neutral-700"
        >
          {TYPE_OPTIONS.map(({ value, label }) => (
            <option key={label} value={value}>
              {label}
            </option>
          ))}
        </select>
      </form>

      {query.isFetching && (
        <div className="flex justify-center py-10 text-brand-500">
          <Spinner />
        </div>
      )}
      {query.isError && <ErrorNote message={query.error.message} />}

      {!q && !query.isFetching && (
        <EmptyState
          title="Search your archive"
          hint="Full-text search across everything you’ve captured. For questions, try Ask instead."
        />
      )}

      {query.isSuccess && !query.isFetching && (
        <>
          {query.data.results.length === 0 ? (
            <EmptyState
              title={`Nothing found for “${q}”`}
              hint="Try different words — search matches exact terms; Ask can answer looser questions."
            />
          ) : (
            <div className="flex flex-col gap-3" aria-live="polite">
              <p className="text-sm text-neutral-500">
                {query.data.count} result{query.data.count === 1 ? "" : "s"}
              </p>
              {query.data.results.map((card) => (
                <FilamentCardItem key={card.id} filament={card} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-10 text-brand-500">
          <Spinner />
        </div>
      }
    >
      <Search />
    </Suspense>
  );
}
