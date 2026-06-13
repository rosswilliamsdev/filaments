"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  Button,
  ErrorNote,
  Spinner,
  StatusBadge,
  TypeBadge,
} from "@/components/ui";
import {
  useAudioUrl,
  useDeleteFilament,
  useFilament,
  usePatchFilament,
  useToggleActionItem,
} from "@/lib/hooks";
import { formatDateTime, formatOffset } from "@/lib/format";
import type { FilamentDetail } from "@/lib/types";

export default function FilamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useFilament(id);

  if (query.isPending) {
    return (
      <div className="flex justify-center py-16 text-brand-500">
        <Spinner />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorNote message={query.error.message} />
        <Link href="/" className="text-sm font-medium text-brand-600">
          ← Back to timeline
        </Link>
      </div>
    );
  }
  return <Detail filament={query.data} />;
}

function Detail({ filament }: { filament: FilamentDetail }) {
  const router = useRouter();
  const patch = usePatchFilament(filament.id);
  const remove = useDeleteFilament();
  const toggleItem = useToggleActionItem(filament.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const audio = useAudioUrl(
    filament.id,
    filament.type === "voice" && filament.status === "done",
  );

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <TypeBadge type={filament.type} />
          <StatusBadge status={filament.status} />
          <time
            dateTime={filament.created_at}
            className="ml-auto font-mono text-xs text-neutral-400"
          >
            {formatDateTime(filament.created_at)}
          </time>
        </div>
        <h1 className="font-serif text-2xl font-semibold text-brand-900">
          {filament.title || "Untitled"}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            busy={patch.isPending}
            onClick={() => patch.mutate({ pinned: !filament.pinned })}
          >
            {filament.pinned ? "Unpin" : "Pin"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            busy={patch.isPending}
            onClick={() => patch.mutate({ archived: !filament.archived })}
          >
            {filament.archived ? "Unarchive" : "Archive"}
          </Button>
          <ExportMenu id={filament.id} />
          {confirmingDelete ? (
            <span className="ml-auto flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                busy={remove.isPending}
                onClick={() =>
                  remove.mutate(filament.id, { onSuccess: () => router.push("/") })
                }
              >
                Delete filament
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto !text-error"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete…
            </Button>
          )}
        </div>
        {(patch.isError || remove.isError) && (
          <ErrorNote
            message={patch.error?.message ?? remove.error?.message ?? "Update failed"}
          />
        )}
      </header>

      {filament.status === "failed" && (
        <ErrorNote message="Processing failed for this filament. Retry from the mobile app, or check the worker logs." />
      )}

      {audio.data?.url && (
        <div className="rounded-md bg-brand-50 p-3">
          <audio controls preload="metadata" src={audio.data.url} className="w-full">
            Your browser can’t play this recording.
          </audio>
        </div>
      )}

      {filament.summary && (
        <section aria-label="Summary">
          <h2 className="mb-2 font-serif text-xl font-semibold text-brand-800">Summary</h2>
          <p className="text-base leading-relaxed text-neutral-700">{filament.summary}</p>
        </section>
      )}

      {filament.key_ideas.length > 0 && (
        <section aria-label="Key ideas">
          <h2 className="mb-2 font-serif text-xl font-semibold text-brand-800">Key ideas</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base text-neutral-700">
            {filament.key_ideas.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>
        </section>
      )}

      {filament.action_items.length > 0 && (
        <section aria-label="Action items">
          <h2 className="mb-2 font-serif text-xl font-semibold text-brand-800">
            Action items
          </h2>
          <ul className="flex flex-col gap-1">
            {filament.action_items.map((item) => (
              <li key={item.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 transition-colors duration-150 ease-in-out hover:bg-brand-50">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) =>
                      toggleItem.mutate({ itemId: item.id, done: e.target.checked })
                    }
                    className="size-4 accent-brand-600"
                  />
                  <span
                    className={`text-base ${
                      item.done ? "text-neutral-400 line-through" : "text-neutral-700"
                    }`}
                  >
                    {item.text}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <TagEditor filament={filament} />

      {filament.links.length > 0 && (
        <section aria-label="Linked filaments">
          <h2 className="mb-2 font-serif text-xl font-semibold text-brand-800">Linked</h2>
          <div className="flex flex-col gap-2">
            {filament.links.map((link) => (
              <Link
                key={link.filament_id}
                href={`/filament/${link.filament_id}`}
                className="flex items-center gap-2 rounded-md border border-neutral-200 bg-surface-raised p-3 shadow-sm transition-shadow duration-150 ease-in-out hover:shadow-md"
              >
                <TypeBadge type={link.type} />
                <span className="min-w-0 truncate font-serif text-base font-semibold text-brand-900">
                  {link.title || "Untitled"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {filament.transcript && filament.transcript.length > 0 ? (
        <section aria-label="Transcript">
          <h2 className="mb-2 font-serif text-xl font-semibold text-brand-800">Transcript</h2>
          <div className="flex flex-col gap-3">
            {filament.transcript.map((segment) => (
              <p key={segment.start} className="flex gap-3">
                <span className="shrink-0 font-mono text-xs leading-6 text-neutral-400">
                  {formatOffset(segment.start)}
                </span>
                <span className="text-base leading-relaxed text-neutral-700">
                  {segment.text}
                </span>
              </p>
            ))}
          </div>
        </section>
      ) : (
        filament.body && (
          <section aria-label={filament.type === "text" ? "Note" : "Extracted text"}>
            <h2 className="mb-2 font-serif text-xl font-semibold text-brand-800">
              {filament.type === "text" ? "Note" : "Extracted text"}
            </h2>
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-neutral-700">
              {filament.body}
            </p>
          </section>
        )
      )}
    </article>
  );
}

function ExportMenu({ id }: { id: string }) {
  // Plain links through the BFF proxy: the browser follows them with session
  // cookies and Django's Content-Disposition triggers the download.
  return (
    <span className="flex items-center gap-1 text-sm text-neutral-500">
      Export:
      {(["markdown", "text", "json"] as const).map((fmt) => (
        <a
          key={fmt}
          href={`/api/backend/filaments/${id}/export?format=${fmt}`}
          className="rounded px-1.5 py-1 font-medium text-brand-600 hover:bg-brand-50"
        >
          {fmt === "markdown" ? "Markdown" : fmt === "text" ? "Text" : "JSON"}
        </a>
      ))}
    </span>
  );
}

function TagEditor({ filament }: { filament: FilamentDetail }) {
  const patch = usePatchFilament(filament.id);
  const [draft, setDraft] = useState("");

  function addTag() {
    const name = draft.trim();
    if (!name) return;
    patch.mutate(
      { tags: [...filament.tags, name] },
      { onSuccess: () => setDraft("") },
    );
  }

  return (
    <section aria-label="Tags">
      <h2 className="mb-2 font-serif text-xl font-semibold text-brand-800">Tags</h2>
      <div className="flex flex-wrap items-center gap-1.5">
        {filament.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-brand-100 py-1 pl-2 pr-1 text-xs font-medium text-brand-700"
          >
            {tag}
            <button
              aria-label={`Remove tag ${tag}`}
              disabled={patch.isPending}
              onClick={() =>
                patch.mutate({ tags: filament.tags.filter((t) => t !== tag) })
              }
              className="flex size-5 items-center justify-center rounded-full hover:bg-brand-200"
            >
              ✕
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addTag();
          }}
          className="flex items-center gap-1"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add tag…"
            aria-label="Add tag"
            autoComplete="off"
            spellCheck={false}
            className="h-8 w-28 rounded-md border border-neutral-200 bg-surface-input px-2 text-sm placeholder:text-neutral-400 focus:border-brand-500"
          />
        </form>
      </div>
      {patch.isError && <ErrorNote message={patch.error.message} />}
    </section>
  );
}
