"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button, ErrorNote, Spinner } from "@/components/ui";
import { useCreateFilament, useProcessFilament } from "@/lib/hooks";

// Web capture is text + document upload only (web-planning-doc → non-goals): no
// voice recording, and URL capture waits on its backend API (core/tasks.py).
// Documents can be uploaded in bulk and may be PDF, Word (.docx), or markdown.

const MAX_DOC_BYTES = 25 * 1024 * 1024;

// How many uploads run at once. Browsers cap concurrent connections per origin
// (~6), and each file is an independent create → PUT → process chain, so a
// small pool keeps things fast without saturating the connection pool or the
// create endpoint. Mirrors the bounded-concurrency runBatch below.
const UPLOAD_CONCURRENCY = 3;

// Extension → Content-Type, mirroring core/s3.py ACCEPTED_DOCUMENT_TYPES (the
// backend rejects anything outside this set, so keep the two in sync by hand).
const ACCEPTED_DOCUMENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
};

type Mode = "text" | "document";

export default function CapturePage() {
  const [mode, setMode] = useState<Mode>("text");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif text-2xl font-semibold text-brand-900">New filament</h1>
      <div role="tablist" aria-label="Capture type" className="flex gap-2">
        {(["text", "document"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 ease-in-out ${
              mode === m
                ? "bg-brand-100 text-brand-600"
                : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {m === "text" ? "Text note" : "Documents"}
          </button>
        ))}
      </div>
      {mode === "text" ? <TextCapture /> : <DocumentCapture />}
    </div>
  );
}

function TextCapture() {
  const router = useRouter();
  const create = useCreateFilament();
  const process = useProcessFilament();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || process.isPending;

  // Warn before navigating away from an unsaved draft.
  useEffect(() => {
    if (!body.trim()) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [body]);

  async function submit() {
    setError(null);
    if (!body.trim()) {
      setError("Write something first — text notes need a body.");
      return;
    }
    try {
      const { filament_id } = await create.mutateAsync({
        type: "text",
        title: title.trim(),
        body: body.trim(),
      });
      await process.mutateAsync(filament_id);
      setBody(""); // clear so beforeunload doesn't fire on the redirect
      router.push(`/filament/${filament_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save the note.");
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex flex-col gap-4"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        name="title"
        placeholder="Title (optional)…"
        autoComplete="off"
        className="h-10 rounded-md border border-neutral-200 bg-surface-input px-3 text-base placeholder:text-neutral-400 focus:border-brand-500"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        name="body"
        rows={8}
        placeholder="What’s on your mind…"
        autoFocus
        className="rounded-md border border-neutral-200 bg-surface-input p-3 text-base leading-relaxed placeholder:text-neutral-400 focus:border-brand-500"
      />
      {error && <ErrorNote message={error} />}
      <div className="flex items-center gap-3">
        <Button type="submit" busy={busy}>
          Save note
        </Button>
        <span className="text-xs text-neutral-400">⌘&nbsp;Enter to save</span>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Bulk document upload
// ---------------------------------------------------------------------------

type ItemStatus = "queued" | "uploading" | "processing" | "done" | "failed";

interface UploadItem {
  id: string;
  file: File;
  status: ItemStatus;
  error?: string;
  filamentId?: string;
  // Validation failures (bad type, oversize) can't be retried as-is; runtime
  // failures (network, S3) can. Drives whether the row shows a Retry button.
  retryable: boolean;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

function contentTypeFor(file: File): string {
  return (
    ACCEPTED_DOCUMENT_TYPES[extensionOf(file.name)] ||
    file.type ||
    "application/octet-stream"
  );
}

/** Returns a human-readable reason if the file can't be uploaded, else null. */
function validate(file: File): string | null {
  if (!(extensionOf(file.name) in ACCEPTED_DOCUMENT_TYPES)) {
    return "Unsupported type — use PDF, Word (.docx), or markdown.";
  }
  if (file.size > MAX_DOC_BYTES) {
    return "Over the 25 MB limit.";
  }
  return null;
}

/**
 * Run `worker` over every item, at most `limit` in flight at once, and resolve
 * once all have settled. This is the heart of the "continue, report per-file"
 * behavior: each worker reports its own outcome and a slow/failed file must not
 * stall the others.
 *
 * Contract:
 * - Resolve only after EVERY item has been processed (settled).
 * - Never have more than `limit` workers running concurrently.
 * - NEVER reject. uploadOne already catches its own errors and marks the item
 *   failed, so this runner just needs to await — a throw here would abort the
 *   whole batch and strand the remaining files.
 *
 * TODO(you): implement the bounded-concurrency pool.
 *
 * Hints / trade-offs to consider:
 * - The classic shape: keep a shared cursor into `items`; spawn `limit` async
 *   "lanes" that each loop, pulling the next index until the list is exhausted;
 *   await all lanes. (Promise.all over `limit` worker loops.)
 * - Guard the degenerate cases: an empty `items`, or `limit` larger than
 *   `items.length`, should both still work.
 * - Why not just `Promise.all(items.map(worker))`? That's unbounded — fine for
 *   3 files, rough for 30. Why not a simple `for…of await`? That's `limit = 1`
 *   (sequential) — correct but needlessly slow. The pool is the middle path.
 */
async function runBatch<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  // Worker-pool / fixed-lane pattern: spawn `limit` lanes that share one cursor
  // into `items`. Each lane grabs the next index and works it until the list is
  // drained — no barrier between items, so a slow file never stalls a free lane.
  // `cursor++` is safe without a lock because JS is single-threaded and there's
  // no await between the read and the increment.
  let cursor = 0;
  async function lane() {
    while (cursor < items.length) {
      await worker(items[cursor++]);
    }
  }
  // Math.min guards the small-batch case (2 files, limit 3 → 2 lanes, not 3).
  const lanes = Array.from({ length: Math.min(limit, items.length) }, lane);
  await Promise.all(lanes);
}

function DocumentCapture() {
  const create = useCreateFilament();
  const process = useProcessFilament();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);

  const running = items.some(
    (i) => i.status === "queued" || i.status === "uploading" || i.status === "processing",
  );

  function update(id: string, patch: Partial<UploadItem>) {
    // Functional update so concurrent workers never clobber each other.
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  // The whole per-file handshake. Catches its own errors so a failure marks the
  // row and the batch keeps going (never throws — see runBatch contract).
  async function uploadOne(item: UploadItem) {
    try {
      update(item.id, { status: "uploading", error: undefined });
      const { filament_id, upload_url } = await create.mutateAsync({
        type: "document",
        title: baseName(item.file.name),
        filename: item.file.name,
      });
      if (!upload_url) {
        throw new Error("The backend didn’t return an upload URL — is S3 configured?");
      }

      // Direct browser → S3 PUT; the presigned URL is self-authorizing and
      // requires a bucket CORS rule allowing PUT from this origin.
      const put = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": contentTypeFor(item.file) },
        body: item.file,
      });
      if (!put.ok) {
        throw new Error(
          `Upload to storage failed (${put.status}). If this persists, check the S3 bucket’s CORS configuration.`,
        );
      }

      update(item.id, { status: "processing", filamentId: filament_id });
      await process.mutateAsync(filament_id);
      update(item.id, { status: "done", filamentId: filament_id });
    } catch (err) {
      update(item.id, {
        status: "failed",
        retryable: true,
        error: err instanceof Error ? err.message : "Upload failed — try again.",
      });
    }
  }

  async function addFiles(files: File[]) {
    if (files.length === 0) return;
    const next: UploadItem[] = files.map((file) => {
      const problem = validate(file);
      return {
        id: crypto.randomUUID(),
        file,
        status: problem ? "failed" : "queued",
        error: problem ?? undefined,
        retryable: false, // validation failures aren't retryable as-is
      };
    });
    setItems((prev) => [...prev, ...next]);
    const queued = next.filter((i) => i.status === "queued");
    await runBatch(queued, UPLOAD_CONCURRENCY, uploadOne);
  }

  async function retry(item: UploadItem) {
    await runBatch([item], 1, uploadOne);
  }

  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors duration-150 ease-in-out ${
          dragging ? "border-brand-500 bg-brand-50" : "border-neutral-200 bg-surface-raised"
        }`}
      >
        <p className="text-base text-neutral-600">Drag documents here, or</p>
        <Button variant="secondary" onClick={() => inputRef.current?.click()}>
          Choose files…
        </Button>
        <p className="text-xs text-neutral-400">
          PDF · Word · Markdown — up to 25&nbsp;MB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={[...Object.keys(ACCEPTED_DOCUMENT_TYPES), "application/pdf"].join(",")}
          className="sr-only"
          aria-label="Choose documents to upload"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = ""; // allow re-picking the same file
          }}
        />
      </div>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {items.map((item) => (
            <UploadRow key={item.id} item={item} onRetry={() => retry(item)} />
          ))}
        </ul>
      )}

      {items.length > 0 && !running && (
        <div className="flex items-center justify-between text-sm text-neutral-500">
          <span>
            {doneCount} of {items.length} uploaded
          </span>
          {doneCount > 0 && (
            <Link href="/" className="font-medium text-brand-600 hover:text-brand-700">
              View timeline →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  queued: "Queued",
  uploading: "Uploading…",
  processing: "Processing…",
  done: "Done",
  failed: "Failed",
};

function UploadRow({ item, onRetry }: { item: UploadItem; onRetry: () => void }) {
  const active = item.status === "uploading" || item.status === "processing";
  return (
    <li className="flex items-center gap-3 rounded-md border border-neutral-200 bg-surface-raised px-3 py-2">
      <StatusGlyph status={item.status} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-neutral-700">
          {item.filamentId && item.status === "done" ? (
            <Link
              href={`/filament/${item.filamentId}`}
              className="hover:text-brand-700 hover:underline"
            >
              {item.file.name}
            </Link>
          ) : (
            item.file.name
          )}
        </span>
        {item.error && <span className="text-xs text-error">{item.error}</span>}
      </div>
      <span className="ml-auto flex items-center gap-2">
        {active && <Spinner />}
        <span
          className={`text-xs font-medium ${
            item.status === "failed" ? "text-error" : "text-neutral-400"
          }`}
        >
          {STATUS_LABEL[item.status]}
        </span>
        {item.status === "failed" && item.retryable && (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        )}
      </span>
    </li>
  );
}

function StatusGlyph({ status }: { status: ItemStatus }) {
  if (status === "done") {
    return (
      <span aria-hidden className="text-success">
        ✓
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span aria-hidden className="text-error">
        ✕
      </span>
    );
  }
  return (
    <span aria-hidden className="text-neutral-300">
      •
    </span>
  );
}
