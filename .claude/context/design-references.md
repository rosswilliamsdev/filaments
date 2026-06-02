# Filaments — Design References

> **Status:** Draft
> **Last Updated:** 2026-05-30
>
> **v1 is iOS-only.** The design references below are unchanged. The web-as-responsive-port guidance is retained as v1.1 direction and marked as such.

---

## Design Principle

A calm, readable personal archive that gets smarter quietly in the background. Nothing flashy, nothing dense — just your thoughts, well-organized, with AI doing the work behind the scenes.

---

## Unifying Reference: Day One

Day One sets the overall design language — clean, spacious, content-forward, editorial feel.

Draws from Day One:
- Overall layout, typography, and spacing
- Timeline structure and date grouping
- Mixed-media content feed without clutter
- The "journal of your thinking" vibe
- Filtering and type indicators in the timeline

---

## Feature-Specific References

### Capture & Processing Flow → Plaud
- Clean recording UI — minimal chrome, one-tap start
- Processing status indicators (recording → processing → done)
- Designed to record and walk away — results ready when you come back
- Maps directly to the Celery pipeline UX

### Knowledge Graph & Linking → Obsidian
- Backlinks panel on each filament detail view
- Lightweight linked-reference list with surrounding context
- Not a heavy graph on every page — just a clear list of connections
- Graph view (v1.1) will draw more heavily from Obsidian

### Ask AI / Query → Perplexity
- Cited answers with numbered source references
- Each citation links back to the specific filament
- "Here are the 4 filaments that answer your question" pattern
- Source cards alongside the AI-generated answer

---

## Platform Notes

v1 is the iOS app. iOS leans slightly toward Plaud for capture-specific moments (recording screen, processing states); everything else follows Day One.

**Web (v1.1) will be a responsive port of the iOS app, not a separate desktop layout.** The goal is "the same app wherever I am" — web reuses the iOS screens and the same single-column structure. On wider screens, content is constrained to a centered max-width column with generous side margins rather than spreading into a multi-pane or sidebar layout. No desktop-only surfaces. Same calm, readable feel everywhere — differences are screen-size adaptations, not design dialect shifts. This is v1.1 scope, not v1.
