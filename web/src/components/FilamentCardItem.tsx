import Link from "next/link";

import { formatTime } from "@/lib/format";
import type { FilamentCard } from "@/lib/types";

import { StatusBadge, TagPill, TypeBadge } from "./ui";

export function FilamentCardItem({ filament }: { filament: FilamentCard }) {
  return (
    <Link
      href={`/filament/${filament.id}`}
      className="block rounded-md border border-neutral-200 bg-surface-raised p-4 shadow-sm transition-shadow duration-150 ease-in-out hover:shadow-md"
    >
      <div className="flex items-center gap-2">
        <TypeBadge type={filament.type} />
        <StatusBadge status={filament.status} />
        {filament.pinned && (
          <span className="text-xs font-medium text-brand-500">Pinned</span>
        )}
        <time
          dateTime={filament.created_at}
          className="ml-auto font-mono text-xs text-neutral-400"
        >
          {formatTime(filament.created_at)}
        </time>
      </div>
      <h3 className="mt-2 font-serif text-xl font-semibold text-brand-900">
        {filament.title || "Untitled"}
      </h3>
      {filament.snippet && (
        <p className="mt-1 line-clamp-2 break-words text-sm text-neutral-600">
          {filament.snippet}
        </p>
      )}
      {filament.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filament.tags.map((tag) => (
            <TagPill key={tag} name={tag} />
          ))}
        </div>
      )}
    </Link>
  );
}
