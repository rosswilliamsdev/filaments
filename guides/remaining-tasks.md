# Filaments — Remaining Tasks (v1)

_Created 2026-06-10. Companion to `scaffolding-guide.md`, `.claude/docs/backend-planning-doc.md`, and `.claude/docs/tradeoffs-discussed.md` (decision log)._

Snapshot of what's left between the current state and the v1 finish line: "say 'Hey Siri, new filament,' speak a thought, have it transcribed, summarized, tagged, and auto-linked hands-free — then find it later by search or natural-language question."

---

## Where things stand

| Area | Status |
|---|---|
| Scaffolding (Parts A–C) | ✅ Backend, mobile app, Google OAuth client IDs |
| Part D wiring | ✅ Smoke test passed 2026-06-10 — Google sign-in round-trips from the Simulator dev build |
| Mobile prototype | ✅ Sign-in gate, Timeline, Detail, Capture (text), Search — running against seeded backend data |
| Auth (`/auth/google` + JWT) | ✅ Implemented per spec |
| Data model (full spec) | ✅ Filament, ActionItem, Tag, FilamentTag, FilamentLink; `search_vector` generated column; canonical link ordering (`create_link()` + check constraint) |
| API layer | ✅ `/filaments` CRUD + `/process` handshake, `/tags`, `/search` — 16 integration tests passing |
| AI pipeline | ❌ `core/tasks.py` is a logging stub — enqueued rows stay in `processing` |
| `/ask` (RAG) | ❌ Not started (depends on pipeline/embeddings) |
| Periodic sweeps | ❌ Not started (scheduling decision still open) |
| Deployment (Railway) | ❌ Not started |
| Mobile voice capture | ❌ Record screen, upload handshake, audio player — needs expo-audio + S3 |

---

## 1. Unblockers (config, no code)

- [x] **Run the Part D smoke test** — ✅ 2026-06-10: signed in from the Simulator dev build, tokens round-tripped, timeline loaded. (Untested edge: non-allowlisted account → `403` — verify whenever a second Google account is handy.)
- [ ] **Set up the dev S3 bucket** — create the bucket, fill `AWS_*` vars in `.env`, set `USE_S3=True`. Until then, `POST /filaments` for voice/document returns a deliberate `503` ("file uploads not configured"); text notes already work end-to-end.
- [ ] **Fill `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`** in `.env` — required before any pipeline work can be tested.

## 2. AI pipeline (the big one)

Celery chain in `core/tasks.py`, replacing the stub. Spec: backend-planning-doc → Business Logic & Edge Cases.

- [ ] **Transcribe** (voice → Whisper) / **extract** (PDF → PyMuPDF; URL → trafilatura) → populate `body` (+ `transcript` JSONB for voice). *Critical path.*
- [ ] **Summarize + key ideas + action items** (Claude) → `summary`, `key_ideas`, `ActionItem` rows
- [ ] **Tags** (Claude) → get-or-create `Tag` rows, set M2M
- [ ] **Embedding** (OpenAI text-embedding-3-small) → `embedding`
- [ ] **Auto-link** — pgvector cosine similarity against existing filaments; create links **only through `FilamentLink.create_link()`** (canonical ordering)
- [ ] Failure policy: persist-and-resume (each step idempotent, persists on completion), ~3 retries with backoff for transient errors, **critical vs. enrichment split** (enrichment failure → still `done`, degraded), URL-no-extractable-text is **non-retryable**
- [ ] Mark `done` / `failed` + surface in API (already exposed via `status`)

**Decisions reserved for Ross (not pre-decidable):**
- **Claude extraction prompt design** (PRD open Q #4) — what makes a good summary/tag/action-item set for your thinking style; needs consistent output across voice/document/text
- **Auto-link relevance threshold** (PRD open Q #3) — minimum cosine similarity to create a link; needs experimentation against real captures

## 3. `/ask` endpoint (RAG)

- [ ] Embed the question → pgvector retrieve top filaments → Claude answer with **structured segments** (`[{text, citation?}]` + `sources` + `follow_ups`; see backend-planning-doc → API Design)
- [ ] Strict response schema / tool use; on malformed model output fall back to a single uncited segment — never parse inline markers, never 500

## 4. Export (PRD v1 #12 — caught late, was missing from this list)

- [ ] Export endpoints/flow: markdown, plain text, JSON (links preserved), original audio
- [ ] (Obsidian-compatible export with `[[wikilinks]]` + YAML frontmatter is v1.1)

## 5. Periodic sweeps (failure-recovery backstop)

- [ ] **Decide scheduling first**: Celery Beat (4th always-on service) vs. Railway cron + management commands (PRD open Q #9 — still open)
- [ ] **Stuck-`processing` sweep** — `updated_at` stale ~30 min → requeue once (via the same status-gated path as `/process`), then mark `failed` (`pipeline_attempts`)
- [ ] **Orphaned-upload sweep** — `pending_upload` rows + S3 objects older than ~24 h → delete
- [ ] **Soft-delete sweep** — `deleted_at` older than ~30 days → hard-delete row (cascades) + S3 object

## 6. Deployment (Railway)

- [ ] Provision the **pgvector template** Postgres (not base Postgres) from day one
- [ ] Three explicit services: Django web (gunicorn), Celery worker, Redis — plus the sweep scheduler per the decision above
- [ ] Env vars on the platform (secret list: backend-planning-doc → Config & Environment)
- [ ] Lock down prod CORS origins; optional `/health` endpoint for Railway

## 7. Mobile — finish the capture loop

The prototype (2026-06-10) already covers: auth gate + Google sign-in, Timeline (date groups, filters, infinite scroll), Detail (summary/key ideas/action-item toggles/transcript/links), text-note Capture, Search, and status polling. Remaining per `frontend-planning-doc.md`:

- [ ] **Record screen** — real voice capture (`npx expo install expo-audio`), waveform, pause/resume, bookmark (mockup: recording.png)
- [ ] **Upload handshake** — recorded file → pre-signed S3 PUT → `POST /filaments/{id}/process` (text notes already use the create→process path)
- [ ] **Audio player** on voice detail (stream from S3 presigned URL; compact variant on cards)
- [ ] **Ask AI screen** — replace placeholder with the segmented-answer renderer + source cards + follow-ups (mockups: askai1–2.png), once `/ask` exists
- [ ] **Document/URL capture UI** (file picker + URL field)
- [ ] **Offline queue** — record while offline, upload on reconnect
- [ ] **Siri App Intent spike** (PRD open Q #1) — the hands-free trigger; needs a small Swift module

## 8. Cleanup chores (small, anytime)

- [ ] Delete the stray `venv/` at the repo root (`.venv` is the real environment; `venv/` only has Django and breaks `manage.py`)
- [ ] `SIMPLE_JWT` refresh lifetime is 7 days; planning doc suggests 30–90 for a personal tool (re-auth rarely)
- [ ] `BLACKLIST_AFTER_ROTATION=True` but `rest_framework_simplejwt.token_blacklist` isn't in `INSTALLED_APPS` — either add the app or drop the setting (currently a silent no-op)
- [ ] `requirements.txt` ships `gunicorn` — add a `Procfile`/start command when deploying

---

## Open decisions index

| Decision | Owner | Blocks |
|---|---|---|
| Claude extraction prompt design | Ross | Pipeline summarize/tags steps |
| Auto-link similarity threshold | Ross (experiment) | Pipeline auto-link step |
| Sweep scheduling (Beat vs. Railway cron) | Ross | All three sweeps |
| Audio size/compression/chunking (PRD #5) | Ross | Mobile record/upload polish |
| Siri App Intent spike (PRD #1) | Ross | Hands-free capture |
| Mockups vs. design-system tokens (page surface, tag style, date headers) | Ross | Cosmetic only — prototype follows the token spec; mockups differ (see `.claude/screenshots/`) |

Everything else deferred (Sentry, custom error handler, HNSW tuning, graph view) is logged in backend-planning-doc → Deferred Decisions.
