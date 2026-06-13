"""
Per-filament export (PRD v1 #12): markdown, plain text, JSON (links
preserved). Original-audio export is a presigned S3 GET handled in the view.
Obsidian-flavored export ([[wikilinks]] + YAML frontmatter) is v1.1.
"""

import json

from django.db.models import Q

from .models import Filament, FilamentLink


def _link_partners(filament):
    links = (
        FilamentLink.objects.filter(Q(source=filament) | Q(target=filament))
        .filter(source__deleted_at__isnull=True, target__deleted_at__isnull=True)
        .select_related("source", "target")
        .order_by("-score")
    )
    return [
        {
            "filament_id": str(other.id),
            "title": other.title,
            "type": other.type,
            "score": link.score,
        }
        for link in links
        for other in [link.target if link.source_id == filament.id else link.source]
    ]


def as_json(filament) -> str:
    payload = {
        "id": str(filament.id),
        "type": filament.type,
        "title": filament.title,
        "body": filament.body,
        "summary": filament.summary,
        "key_ideas": filament.key_ideas,
        "transcript": filament.transcript,
        "tags": sorted(filament.tags.values_list("name", flat=True)),
        "action_items": [
            {"text": item.text, "done": item.done}
            for item in filament.action_items.order_by("id")
        ],
        "links": _link_partners(filament),
        "created_at": filament.created_at.isoformat(),
        "updated_at": filament.updated_at.isoformat(),
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def as_markdown(filament) -> str:
    lines = [f"# {filament.title or 'Untitled filament'}", ""]
    lines.append(f"- Type: {filament.type}")
    lines.append(f"- Captured: {filament.created_at.date().isoformat()}")
    tags = sorted(filament.tags.values_list("name", flat=True))
    if tags:
        lines.append(f"- Tags: {', '.join(tags)}")
    if filament.summary:
        lines += ["", "## Summary", "", filament.summary]
    if filament.key_ideas:
        lines += ["", "## Key ideas", ""]
        lines += [f"- {idea}" for idea in filament.key_ideas]
    action_items = list(filament.action_items.order_by("id"))
    if action_items:
        lines += ["", "## Action items", ""]
        lines += [f"- [{'x' if item.done else ' '}] {item.text}" for item in action_items]
    if filament.body:
        heading = "Transcript" if filament.type == Filament.Type.VOICE else "Content"
        lines += ["", f"## {heading}", "", filament.body]
    links = _link_partners(filament)
    if links:
        lines += ["", "## Linked filaments", ""]
        lines += [
            f"- {link['title'] or link['filament_id']} (similarity {link['score']:.2f})"
            for link in links
        ]
    return "\n".join(lines) + "\n"


def as_text(filament) -> str:
    lines = [filament.title or "Untitled filament", ""]
    if filament.summary:
        lines += [filament.summary, ""]
    if filament.key_ideas:
        lines += [f"* {idea}" for idea in filament.key_ideas] + [""]
    action_items = list(filament.action_items.order_by("id"))
    if action_items:
        lines += [f"[{'x' if item.done else ' '}] {item.text}" for item in action_items] + [""]
    if filament.body:
        lines += [filament.body]
    return "\n".join(lines).rstrip() + "\n"
