"use client";

import Link from "next/link";
import { useState } from "react";

import { Button, EmptyState, ErrorNote, TypeBadge } from "@/components/ui";
import { useAsk } from "@/lib/hooks";
import type { AskResponse } from "@/lib/types";

// Perplexity-style cited answers (design-system → Design Language): numbered
// citations in the prose link down to source cards, which link to filaments.

export default function AskPage() {
  const ask = useAsk();
  const [question, setQuestion] = useState("");

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || ask.isPending) return;
    setQuestion(trimmed);
    ask.mutate(trimmed);
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask your archive anything…"
          autoComplete="off"
          autoFocus
          aria-label="Question"
          className="h-12 min-w-0 flex-1 rounded-md border border-neutral-200 bg-surface-input px-4 text-base placeholder:text-neutral-400 focus:border-brand-500"
        />
        <Button type="submit" size="lg" busy={ask.isPending}>
          Ask
        </Button>
      </form>

      {ask.isError && <ErrorNote message={ask.error.message} />}

      {ask.isIdle && (
        <EmptyState
          title="Ask across everything you’ve captured"
          hint="Answers cite the filaments they came from, so you can follow any claim back to its source."
        />
      )}

      {ask.isSuccess && <Answer response={ask.data} onFollowUp={submit} />}
    </div>
  );
}

function Answer({
  response,
  onFollowUp,
}: {
  response: AskResponse;
  onFollowUp: (q: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6" aria-live="polite">
      <p className="text-base leading-relaxed text-neutral-700">
        {response.answer.map((segment, i) => (
          <span key={i}>
            {segment.text}
            {segment.citation !== null && (
              <a
                href={`#source-${segment.citation}`}
                aria-label={`Source ${segment.citation}`}
                className="ml-0.5 align-super text-xs font-medium text-brand-600"
              >
                [{segment.citation}]
              </a>
            )}{" "}
          </span>
        ))}
      </p>

      {response.sources.length > 0 && (
        <section aria-label="Sources">
          <h2 className="mb-2 font-serif text-xl font-semibold text-brand-800">Sources</h2>
          <div className="flex flex-col gap-2">
            {response.sources.map((source) => (
              <Link
                key={source.citation}
                id={`source-${source.citation}`}
                href={`/filament/${source.filament_id}`}
                className="flex items-start gap-3 rounded-md border border-neutral-200 bg-surface-raised p-3 shadow-sm transition-shadow duration-150 ease-in-out hover:shadow-md"
              >
                <span className="font-mono text-xs leading-6 text-brand-500">
                  [{source.citation}]
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <TypeBadge type={source.type} />
                    <span className="truncate font-serif text-base font-semibold text-brand-900">
                      {source.title || "Untitled"}
                    </span>
                  </span>
                  {source.snippet && (
                    <span className="mt-1 line-clamp-2 break-words text-sm text-neutral-600">
                      {source.snippet}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {response.follow_ups.length > 0 && (
        <section aria-label="Follow-up questions" className="flex flex-wrap gap-2">
          {response.follow_ups.map((q) => (
            <button
              key={q}
              onClick={() => onFollowUp(q)}
              className="rounded-full border border-neutral-200 bg-surface-raised px-3 py-1.5 text-sm text-neutral-600 transition-colors duration-150 ease-in-out hover:bg-brand-50 hover:text-brand-700"
            >
              {q}
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
