"""
/ask — RAG over the filament archive (backend-planning-doc.md → API Design).

Embed the question → pgvector cosine retrieval → Claude answers with
structured segments. The client never parses model output: a segment either
is or isn't a citation. Malformed model output falls back to a single
uncited segment — never a 500.
"""

import json
import logging

from pgvector.django import CosineDistance

from .models import Filament
from .tasks import (
    CLAUDE_MODEL,
    EMBEDDING_MODEL,
    EMBED_MAX_CHARS,
    get_anthropic_client,
    get_openai_client,
)

logger = logging.getLogger(__name__)

RETRIEVAL_LIMIT = 6
SOURCE_EXCERPT_CHARS = 4000  # per-source body excerpt passed to Claude
SNIPPET_LENGTH = 200  # matches the card snippet length in serializers.py

ANSWER_SCHEMA = {
    "type": "object",
    "properties": {
        "answer": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "citation": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                },
                "required": ["text", "citation"],
                "additionalProperties": False,
            },
        },
        "follow_ups": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answer", "follow_ups"],
    "additionalProperties": False,
}

ASK_PROMPT = """\
You are the Ask feature of Filaments, a personal knowledge graph. Answer the
user's question using only the numbered sources below — captured thoughts,
documents, and notes from their own archive.

<question>{question}</question>

{sources}

Rules:
- `answer` is an ordered list of segments that read as one continuous reply.
  When a span of text is supported by a source, put that span in its own
  segment with `citation` set to the source number; connective prose gets
  `citation: null`.
- Only cite source numbers that appear above. Never invent information that
  isn't in the sources; if they don't answer the question, say so plainly in
  an uncited segment and summarize what related material does exist.
- `follow_ups`: 2-3 short questions the user might naturally ask next, based
  on what the sources contain.
"""

SOURCE_BLOCK = """\
<source number="{number}" title="{title}" type="{type}">
{body}
</source>"""

EMPTY_ARCHIVE_ANSWER = (
    "I couldn't find anything in your filaments related to that yet — "
    "once you've captured some thoughts on it, ask me again."
)


def answer_question(question: str) -> dict:
    filaments = _retrieve(question)
    if not filaments:
        return {
            "answer": [{"text": EMPTY_ARCHIVE_ANSWER, "citation": None}],
            "sources": [],
            "follow_ups": [],
        }

    numbered = list(enumerate(filaments, start=1))
    response = get_anthropic_client().messages.create(
        model=CLAUDE_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": _build_prompt(question, numbered)}],
        output_config={"format": {"type": "json_schema", "schema": ANSWER_SCHEMA}},
    )

    raw_text = next(
        (block.text for block in response.content if block.type == "text"), ""
    )
    segments, follow_ups = _validate(raw_text, valid_citations=len(numbered))

    cited = {s["citation"] for s in segments if s["citation"] is not None}
    sources = [
        {
            "citation": number,
            "filament_id": str(filament.id),
            "title": filament.title,
            "type": filament.type,
            "snippet": (filament.summary or filament.body)[:SNIPPET_LENGTH],
        }
        for number, filament in numbered
        if number in cited
    ]
    return {"answer": segments, "sources": sources, "follow_ups": follow_ups}


def _retrieve(question: str):
    embedding = (
        get_openai_client()
        .embeddings.create(model=EMBEDDING_MODEL, input=question[:EMBED_MAX_CHARS])
        .data[0]
        .embedding
    )
    return list(
        Filament.objects.filter(deleted_at__isnull=True, embedding__isnull=False)
        .annotate(distance=CosineDistance("embedding", embedding))
        .order_by("distance")[:RETRIEVAL_LIMIT]
    )


def _build_prompt(question: str, numbered) -> str:
    sources = "\n".join(
        SOURCE_BLOCK.format(
            number=number,
            title=filament.title or "(untitled)",
            type=filament.type,
            body=filament.body[:SOURCE_EXCERPT_CHARS],
        )
        for number, filament in numbered
    )
    return ASK_PROMPT.format(question=question, sources=sources)


def _validate(raw_text: str, valid_citations: int):
    """
    Strict-parse the model output; on any shape problem fall back to one
    uncited segment carrying whatever text we got (never 500, never parse
    inline markers client-side).
    """
    try:
        data = json.loads(raw_text)
        segments = []
        for item in data["answer"]:
            text = item["text"]
            citation = item["citation"]
            if not isinstance(text, str):
                raise ValueError("segment text must be a string")
            if not isinstance(citation, int) or not 1 <= citation <= valid_citations:
                citation = None  # out-of-range citation degrades to plain prose
            segments.append({"text": text, "citation": citation})
        if not segments:
            raise ValueError("empty answer")
        follow_ups = [f for f in data["follow_ups"] if isinstance(f, str) and f.strip()]
        return segments, follow_ups
    except (ValueError, KeyError, TypeError) as exc:
        logger.warning("/ask: malformed model output (%s) — falling back to uncited segment", exc)
        fallback = raw_text.strip() or "Something went wrong generating an answer — try asking again."
        return [{"text": fallback, "citation": None}], []
