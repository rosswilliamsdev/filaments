# Filaments — Project Requirements Document

> **Type:** Personal  
> **Status:** Draft  
> **Last Updated:** 2026-05-30

---

## Problem Statement

There's no frictionless way to capture thoughts by voice, upload documents, and have AI automatically transcribe, summarize, connect, and organize everything into a searchable personal knowledge graph. Plaud requires dedicated hardware. Obsidian requires manual linking. Voice memos apps don't process or connect anything. Filaments combines the best of all three: hands-free voice capture via Siri → AI processing pipeline → interconnected knowledge graph. **v1 ships on iOS only**; a web companion that reads the same backend is planned for v1.1.

---

## Goals & Non-Goals

### Success Criteria
v1 is done when I can say "Hey Siri, new filament," speak a thought, and have it transcribed, summarized, tagged, and auto-linked to related past filaments hands-free — then find it later by full-text search or a natural-language question, on my phone. Capability checkpoints, not metrics (personal tool).

> Note: the original criterion read "from either my phone or my laptop." Laptop/web access moves to v1.1 with the web client; the core capture-and-find loop is fully satisfiable on iOS alone.

### Goals
- Frictionless voice capture from iPhone, including Siri-triggered hands-free recording
- AI pipeline that transcribes, summarizes, extracts key ideas/action items, auto-tags, and auto-links every input
- Document upload (PDF, plain text, URLs) processed through the same pipeline as voice
- Cross-modal auto-linking — voice notes connect to documents connect to text notes by theme/concept
- "Ask AI" — natural language queries across the entire knowledge base
- Single iOS client against one backend (the backend is designed so a web client can be added in v1.1 with no schema or API change)
- Full data ownership and export

### Non-Goals
- Multi-user / collaboration (future)
- Phone call or meeting recording
- Real-time transcription / live captioning
- Building custom AI models — use managed APIs
- Web app (v1 — deferred to v1.1)
- Desktop app (v2)
- Public sharing or social features

---

## Feature List & Scope

### In Scope

**Input Layer**
- One-tap voice recording from iOS app
- Siri Shortcut / App Intent integration ("Hey Siri, new filament")
- Background audio recording (screen off)
- Pause/resume within a recording
- Bookmark/highlight moments during recording
- Document upload: PDF, plain text, markdown, web URLs (article extraction)
- Quick typed text notes with markdown support

**AI Processing Pipeline**
- Speech-to-text transcription with timestamps (single-speaker; speaker diarization deferred to v2 — see Non-Goals)
- Key idea extraction (bullet points)
- Configurable summary (one-liner, paragraph, detailed)
- Action item detection
- Open questions / unresolved thoughts extraction
- AI-generated tags
- Embedding generation for semantic search
- Auto-linking: scan existing filaments for thematic overlap, create bidirectional links with relevance scoring

**Knowledge Graph Layer**
- Timeline view (chronological feed, filterable by type/tag/topic)
- Individual filament view (transcript, summary, key ideas, action items, tags, linked filaments, audio playback, source document viewer)
- Full-text search across all filaments
- "Ask AI" — natural language questions across entire knowledge base
- Editable tags and annotations

**Organization**
- Pinned filaments
- Archive (hide without deleting)

**Client & Backend**

One backend, one client (iOS) reading/writing through a REST API. The server is the single source of truth — no peer-to-peer sync or offline-first reconciliation. The API is client-agnostic so the v1.1 web client is purely additive.
- iOS app (voice capture + Siri + browse/search/Ask AI)
- The client fetches current state on load/refresh; no real-time push required
- While a filament is processing, the client polls for status until it flips to `done`
- Offline capture on mobile: recordings queue locally and upload when connectivity returns (server assigns the canonical ID on upload)

**Auth**
- Sign in with Google. The iOS app obtains a Google ID token; the backend verifies it, checks the email against an allowlist, and issues its own SimpleJWT pair. See `backend-planning-doc.md` → Auth & Authorization.

**Export**
- Export as markdown, plain text, JSON (with links preserved), original audio
- Obsidian-compatible export (markdown + `[[wikilinks]]` + YAML frontmatter)

### Out of Scope
- Web app (v1.1 — responsive port of the iOS UI against the same backend)
- Graph view visualization (v1.1)
- Custom AI processing templates (v1.1)
- Folders / Spaces (v1.1)
- Custom vocabulary / glossary (v1.1)
- Bulk operations (v1.1)
- Desktop app (v2)
- API for third-party integrations (v2)
- Browser extension (v2)
- Spaced repetition (v2)
- Daily/weekly AI digest (v2)

---

## v1 Scope / Phasing

### v1 (MVP) — iOS only
1. Sign in with Google (Google ID token → backend → SimpleJWT)
2. iOS voice capture with Siri Shortcut trigger
3. Transcription pipeline (Whisper API)
4. AI summarization + key idea + action item extraction (Claude API)
5. Auto-tagging (Claude API)
6. Embedding generation + auto-linking (OpenAI embeddings + pgvector)
7. Document upload (PDF + plain text + URL extraction)
8. Individual filament view with transcript, summary, links, playback
9. Timeline view with filters
10. Full-text search
11. Basic "Ask AI" (query your knowledge base)
12. Export (markdown, plain text, JSON, audio)

### v1.1
- **Web app** — responsive port of the iOS UI (Next.js, Vercel), same single-column layout, same backend
- Graph view visualization
- Custom AI processing templates
- Obsidian-compatible export
- Folders / Spaces
- Custom vocabulary for transcription
- Bulk operations (tag, move, delete)

### v2+
- Desktop app with meeting capture
- Public API
- Shared filaments / collaboration
- Browser extension (clip articles)
- Spaced repetition ("revisit this thought")
- Daily/weekly AI digest

---

## Tech Stack

| Layer | Technology |
|---|---|
| iOS App | React Native + Expo (single app — not a monorepo for v1) |
| Backend API | Django + Django REST Framework |
| Auth | Sign in with Google → SimpleJWT (see backend doc) |
| Task Queue | Celery + Redis |
| Database | PostgreSQL + pgvector |
| File Storage | AWS S3 |
| Backend Hosting | Railway |
| Mobile Builds | EAS (Expo Application Services) |
| Transcription | OpenAI Whisper API |
| LLM | Claude API (Sonnet) |
| Embeddings | OpenAI text-embedding-3-small |
| _Web App (v1.1)_ | _Next.js (App Router), Vercel — deferred_ |

### Architecture Notes

**AI Processing Pipeline (Celery task chain):**
```
Input received
  → [voice] Transcribe via Whisper API
  → [document] Extract text (PyMuPDF for PDF, trafilatura for URLs)
  → Summarize + extract key ideas + action items (Claude API)
  → Generate tags (Claude API)
  → Generate embedding (OpenAI)
  → Auto-link: vector similarity search against existing filaments (pgvector)
  → Store results in Postgres
  → Client polls for status until complete
```

**Key architectural decisions:**
- **Single iOS app, not a monorepo.** With web deferred, the universal-component / shared-package architecture is gone for v1 — it's a plain Expo app. Adding the web client in v1.1 is additive (new client, same API), not a refactor.
- **Single Postgres DB** handles relational data, full-text search, and vector search (pgvector). No separate vector DB at personal scale.
- **Sign in with Google → SimpleJWT.** Google replaces the login step only; every protected endpoint is guarded by the backend's own JWT. The one public route is `/api/v1/auth/google`, gated by Google signature verification + an email allowlist.
- **Celery + Redis** for async pipeline processing. Client uploads, gets immediate "processing" status, and polls for completion.
- **Siri integration** requires a small native Swift module (~100 lines) exposed via Expo config plugin. Only piece of non-JS code in the mobile app.
- **S3 pre-signed URLs** for direct upload from the client — audio and documents go straight to S3, backend processes from there.

---

## Constraints

- **Timeline:** No deadline. Building incrementally when available.
- **Team:** Solo developer.
- **Budget:** Personal project — minimize ongoing costs. Managed APIs (Whisper, Claude, OpenAI embeddings) are pay-per-use and negligible at personal scale. Railway free/hobby tier to start.
- **Platform priority:** iOS only for v1. Web companion is v1.1.

---

## Open Questions & Risks

| # | Question / Risk | Status |
|---|---|---|
| 1 | Siri App Intent integration from React Native — how much native Swift is needed? Needs a spike. | Open |
| 2 | ~~Offline sync strategy / conflict resolution~~ — Resolved: server is single source of truth, single user, last-write-wins. No sync engine needed. | Resolved |
| 3 | Auto-linking relevance threshold — how similar do embeddings need to be to create a link? Needs experimentation. | Open |
| 4 | Claude API prompt design for extraction — how to structure prompts for consistent summary/tag/action-item output across input types. | Open |
| 5 | Audio file size limits — long recordings could be large. Compression strategy and upload chunking TBD. | Open |
| 6 | pgvector performance at scale — fine for hundreds/low thousands of filaments, but worth monitoring. | Open |
| 7 | Processing-status updates — short-interval polling confirmed sufficient for a single user. | Resolved |
| 8 | Web app graph view (v1.1) — D3.js vs Cytoscape.js vs other. Decision deferred. | Open (v1.1) |
| 9 | Periodic-sweep scheduling in prod — Celery Beat (4th service) vs Railway cron invoking management commands. Must land before wiring the failure-recovery sweeps. | Open |
| 10 | ~~Web token storage~~ — Resolved by cutting web: iOS uses Expo SecureStore. Revisit (httpOnly cookie vs secure storage) when the v1.1 web client is built. | Resolved (v1) |
