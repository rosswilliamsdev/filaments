"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { FilamentCardItem } from "@/components/FilamentCardItem";
import { Button, EmptyState, ErrorNote, Spinner } from "@/components/ui";
import { useTimeline } from "@/lib/hooks";
import { formatDayHeading } from "@/lib/format";
import type { FilamentCard, FilamentType } from "@/lib/types";

const TYPE_FILTERS: { value: FilamentType | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "voice", label: "Voice" },
  { value: "document", label: "Documents" },
  { value: "text", label: "Notes" },
];

function buildFilterHref(params: URLSearchParams, patch: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `/?${qs}` : "/";
}

function groupByDay(cards: FilamentCard[]): [string, FilamentCard[]][] {
  const groups = new Map<string, FilamentCard[]>();
  for (const card of cards) {
    const heading = formatDayHeading(card.created_at);
    const group = groups.get(heading);
    if (group) group.push(card);
    else groups.set(heading, [card]);
  }
  return [...groups.entries()];
}

function Timeline() {
  const params = useSearchParams();
  const type = (params.get("type") as FilamentType | null) ?? undefined;
  const tag = params.get("tag") ?? undefined;
  const pinned = params.get("pinned") === "true";
  const archived = params.get("archived") === "true";

  const query = useTimeline({ type, tag, pinned, archived });
  const cards = query.data?.pages.flatMap((page) => page.results) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
        {TYPE_FILTERS.map(({ value, label }) => {
          const active = (type ?? null) === value;
          return (
            <Link
              key={label}
              href={buildFilterHref(params, { type: value })}
              aria-current={active ? "true" : undefined}
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
        <span className="mx-1 h-4 w-px bg-neutral-200" aria-hidden />
        <Link
          href={buildFilterHref(params, { pinned: pinned ? null : "true" })}
          aria-current={pinned ? "true" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-in-out ${
            pinned ? "bg-brand-100 text-brand-600" : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          Pinned
        </Link>
        <Link
          href={buildFilterHref(params, { archived: archived ? null : "true" })}
          aria-current={archived ? "true" : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-150 ease-in-out ${
            archived ? "bg-brand-100 text-brand-600" : "text-neutral-500 hover:text-neutral-700"
          }`}
        >
          Archived
        </Link>
        {tag && (
          <Link
            href={buildFilterHref(params, { tag: null })}
            className="rounded-full bg-brand-100 px-3 py-1.5 text-sm font-medium text-brand-700"
          >
            #{tag} ✕
          </Link>
        )}
      </div>

      {query.isPending && (
        <div className="flex justify-center py-16 text-brand-500">
          <Spinner />
        </div>
      )}
      {query.isError && <ErrorNote message={query.error.message} />}

      {query.isSuccess && cards.length === 0 && (
        <EmptyState
          title={archived ? "Nothing archived" : "No filaments yet"}
          hint={
            archived
              ? "Archived filaments will collect here."
              : "Capture a thought on your phone, or start with a note or document here."
          }
          action={
            !archived && (
              <Link
                href="/capture"
                className="rounded-md bg-brand-600 px-4 py-2 text-base font-medium text-white transition-colors duration-150 ease-in-out hover:bg-brand-700"
              >
                New filament
              </Link>
            )
          }
        />
      )}

      {groupByDay(cards).map(([heading, group]) => (
        <section key={heading} aria-label={heading}>
          <h2 className="mb-3 font-serif text-base font-semibold text-brand-500">
            {heading}
          </h2>
          <div className="flex flex-col gap-3">
            {group.map((card) => (
              <FilamentCardItem key={card.id} filament={card} />
            ))}
          </div>
        </section>
      ))}

      {query.hasNextPage && (
        <Button
          variant="secondary"
          busy={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
          className="self-center"
        >
          Load more
        </Button>
      )}
    </div>
  );
}

export default function TimelinePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16 text-brand-500">
          <Spinner />
        </div>
      }
    >
      <Timeline />
    </Suspense>
  );
}
