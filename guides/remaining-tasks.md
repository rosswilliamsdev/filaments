# Filaments — Remaining Tasks (v1)

_Created 2026-06-10. Companion to `scaffolding-guide.md`, `.claude/docs/backend-planning-doc.md`, and `.claude/docs/tradeoffs-discussed.md` (decision log)._

Snapshot of what's left between the current state and the v1 finish line: "say 'Hey Siri, new filament,' speak a thought, have it transcribed, summarized, tagged, and auto-linked hands-free — then find it later by search or natural-language question."

---

## Where things stand

| Area                        | Status                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scaffolding (Parts A–C)     | ✅ Backend, mobile app, Google OAuth client IDs                                                                                                         |
| Part D wiring               | ✅ Smoke test passed 2026-06-10 — Google sign-in round-trips from the Simulator dev build                                                               |
| Mobile prototype            | ✅ Sign-in gate, Timeline, Detail, Capture (text), Search — running against seeded backend data                                                         |
| Auth (`/auth/google` + JWT) | ✅ Implemented per spec                                                                                                                                 |
| Data model (full spec)      | ✅ Filament, ActionItem, Tag, FilamentTag, FilamentLink; `search_vector` generated column; canonical link ordering (`create_link()` + check constraint) |
| API layer                   | ✅ `/filaments` CRUD + `/process` handshake, `/tags`, `/search` — 16 integration tests passing                                                          |
| AI pipeline                 | ✅ Celery chain in `core/tasks.py`: transcribe/extract → Claude extraction → embedding → auto-link (0.75 / top 5) → done; 4 integration tests           |
| `/ask` (RAG)                | ✅ `POST /ask` — embed → pgvector retrieve → Claude structured segments + sources + follow-ups; malformed → uncited fallback                            |
| Export                      | ✅ `GET /filaments/{id}/export?format=markdown\|text\|json\|audio`                                                                                      |
| Periodic sweeps             | ✅ Three management commands implemented; Railway cron expressions below                                                                                |
| Deployment (Railway)        | ❌ Not started                                                                                                                                          |
| Mobile voice capture        | ✅ Record screen + S3 upload handshake (expo-audio). Audio is transcribe-then-discard — no playback/audio player (decision 2026-06-13)                    |

---

## 1. Unblockers (config, no code)

- [x] **Run the Part D smoke test** — ✅ 2026-06-10: signed in from the Simulator dev build, tokens round-tripped, timeline loaded. (Untested edge: non-allowlisted account → `403` — verify whenever a second Google account is handy.)
- [x] **Set up the dev S3 bucket** — create the bucket, fill `AWS_*` vars in `.env`, set `USE_S3=True`. Until then, `POST /filaments` for voice/document returns a deliberate `503` ("file uploads not configured"); text notes already work end-to-end.
- [x] **Fill `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`** in `.env` — required before any pipeline work can be tested.

## 2. AI pipeline (the big one)

Celery chain in `core/tasks.py`, replacing the stub. Spec: backend-planning-doc → Business Logic & Edge Cases.

- [x] **Transcribe** (voice → Whisper) / **extract** (PDF → PyMuPDF; URL → trafilatura) → populate `body` (+ `transcript` JSONB for voice). _Critical path._
- [x] **Summarize + key ideas + action items + tags** (Claude, single structured-output call) → `summary`, `key_ideas`, `ActionItem` rows, `Tag` M2M
- [x] **Embedding** (OpenAI text-embedding-3-small) → `embedding` (from `body` only)
- [x] **Auto-link** — pgvector cosine ≥ 0.75, top 5, via `FilamentLink.create_link()` only
- [x] Failure policy: persist-and-resume, 3 retries with backoff for transient errors, critical vs. enrichment split, URL-no-extractable-text non-retryable; `CELERY_TASK_ACKS_LATE` + `REJECT_ON_WORKER_LOST` set
- [x] Mark `done` / `failed` (finalize only flips `processing` → `done`)

**Decisions (settled 2026-06-11):**

- **Claude extraction prompt** (PRD open Q #4) — single prompt for all three types, parameterized by `filament.type` (framing only); schema enforced via structured output; malformed → retry once → degraded. Prompt prose lives in `EXTRACTION_PROMPT` / `EXTRACTION_FRAMING` in `core/tasks.py` — tune wording there against real captures.
- **Auto-link threshold** (PRD open Q #3) — cosine ≥ **0.75**, cap **top 5** (`AUTO_LINK_THRESHOLD` / `AUTO_LINK_LIMIT` in `core/tasks.py`); revisit after real-capture experimentation.

## 3. `/ask` endpoint (RAG) — ✅ done 2026-06-11

- [x] Embed the question → pgvector retrieve top 6 → Claude answer with **structured segments** (`[{text, citation?}]` + `sources` + `follow_ups`) — logic in `core/rag.py`, view `AskView`
- [x] Strict response schema (structured outputs); malformed output → single uncited segment; out-of-range citations degrade to prose; upstream AI failure → 503, never 500; empty archive answers gracefully without calling Claude

## 4. Export (PRD v1 #12) — ✅ done 2026-06-11

- [x] `GET /filaments/{id}/export?format=markdown|text|json` (rendered file download, `core/exports.py`); `?format=audio` → pre-signed S3 GET URL (voice only)
- [ ] (Obsidian-compatible export with `[[wikilinks]]` + YAML frontmatter is v1.1)

## 5. Periodic sweeps (failure-recovery backstop) — ✅ done 2026-06-11

**Decision (settled 2026-06-11):** Railway cron + management commands (no Celery Beat; see tradeoffs-discussed.md). Three cron jobs share the `web` service image and exit cleanly — no 4th always-on process.

**Railway cron expressions** (set in the Railway dashboard on a dedicated cron service):

| Command                                   | Schedule       | Notes                                                            |
| ----------------------------------------- | -------------- | ---------------------------------------------------------------- |
| `python manage.py sweep_stuck`            | `*/30 * * * *` | Every 30 min; re-enqueues up to 3 attempts then marks `failed`   |
| `python manage.py sweep_orphaned_uploads` | `0 3 * * *`    | Nightly 03:00 UTC; cleans `pending_upload` rows older than 24 h  |
| `python manage.py sweep_soft_deletes`     | `0 3 * * *`    | Nightly 03:00 UTC; hard-deletes rows with `deleted_at` > 30 days |

- [x] **Scheduling decision**: Railway cron + management commands (not Celery Beat)
- [x] **Stuck-`processing` sweep** — `updated_at` stale > 30 min → requeue (up to `MAX_ATTEMPTS=3`), then `failed`; in `core/management/commands/sweep_stuck.py`
- [x] **Orphaned-upload sweep** — `pending_upload` rows older than 24 h → S3 delete + hard-delete; in `core/management/commands/sweep_orphaned_uploads.py`
- [x] **Soft-delete sweep** — `deleted_at` older than 30 days → S3 delete + hard-delete (CASCADE); in `core/management/commands/sweep_soft_deletes.py`

## 6. Deployment (Railway)

- [ ] Provision the **pgvector template** Postgres (not base Postgres) from day one
- [ ] Four Railway services: Django web (gunicorn), Celery worker, Redis, and a cron service (same image; three cron jobs per the schedule in §5 above)
- [ ] Env vars on the platform (secret list: backend-planning-doc → Config & Environment)
- [ ] Lock down prod CORS origins
- [x] `/health` endpoint (public, `{"status": "ok"}`) and `Procfile` (web + worker) — added 2026-06-11

## 7. Mobile — finish the capture loop

The prototype (2026-06-10) already covers: auth gate + Google sign-in, Timeline (date groups, filters, infinite scroll), Detail (summary/key ideas/action-item toggles/transcript/links), text-note Capture, Search, and status polling. Remaining per `frontend-planning-doc.md`:

- [x] **Record screen** — real voice capture (expo-audio), live metering waveform, pause/resume, bookmark (mockup: recording.png) — 2026-06-13
- [x] **Upload handshake** — recorded `.m4a` → pre-signed S3 PUT → `POST /filaments/{id}/process` (`useVoiceUpload`) — 2026-06-13
- [x] ~~**Audio player** on voice detail~~ **Cut (2026-06-13):** voice is capture-only. The pipeline transcribes then deletes the S3 object (`tasks._discard_audio`), so there's no audio to play back. The `?format=audio` export endpoint and `generate_download_url` were removed.
- [ ] **Ask AI screen** — replace placeholder with the segmented-answer renderer + source cards + follow-ups (mockups: askai1–2.png) — `/ask` is live now, so this is unblocked
- [ ] **Document/URL capture UI** (file picker + URL field)
- [ ] **Offline queue** — record while offline, upload on reconnect
- [ ] **Siri App Intent spike** (PRD open Q #1) — the hands-free trigger; needs a small Swift module

## 8. Web client (v1.1 — pulled forward, built 2026-06-11)

Next.js app in `web/` per `.claude/docs/web-planning-doc.md`: BFF auth (httpOnly cookies + `/api/backend` proxy), Timeline, Detail (incl. export), Capture (text + PDF drag-and-drop), Search, Ask. `npm run dev` in `web/` (expects backend on `DJANGO_API_URL`, default `localhost:8000`).

> ✅ **Web audio player removed** (2026-06-13). The `<audio>` element and `useAudioUrl` hook (`web/src/app/(app)/filament/[id]/page.tsx`, `web/src/lib/hooks.ts`) called the now-removed `?format=audio` endpoint; deleted to match transcribe-then-discard.

Remaining (config, no code):

- [x] **S3 bucket CORS** — allow `PUT` from `http://localhost:3000` + the deployed domain; browser uploads fail preflight without it (mobile never needed this)
- [x] **Google OAuth origins** — add `http://localhost:3000` (and the prod domain) to Authorized JavaScript origins on the existing web client ID
- [ ] **Deploy** — Vercel project; env vars `DJANGO_API_URL` + `NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- [ ] **URL capture** — blocked on the backend URL-capture API (`core/tasks.py` dispatch is forward-compatible; `POST /filaments` doesn't accept a URL yet)

## 9. Cleanup chores — ✅ done 2026-06-11

- [x] Deleted the stray `venv/` at the repo root (`.venv` is the real environment)
- [x] `SIMPLE_JWT` refresh lifetime 7 → 60 days (planning doc suggests 30–90 for a personal tool)
- [x] Dropped the no-op `BLACKLIST_AFTER_ROTATION` (token_blacklist app never installed; blacklisting optional at single-user scale per planning doc)
- [x] Added `Procfile` (gunicorn web + celery worker)

---

## Open decisions index

| Decision                                                                 | Owner                 | Blocks                                                                                        |
| ------------------------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------- |
| Claude extraction prompt design                                          | ✅ Settled 2026-06-11 | Implemented; prompt prose tunable in `core/tasks.py`                                          |
| Auto-link similarity threshold                                           | ✅ Settled 2026-06-11 | Implemented at 0.75 / top 5; revisit against real captures                                    |
| Sweep scheduling (Beat vs. Railway cron)                                 | ✅ Settled 2026-06-11 | Railway cron; three management commands implemented                                           |
| Audio size/compression/chunking (PRD #5)                                 | Ross                  | Mobile record/upload polish                                                                   |
| Siri App Intent spike (PRD #1)                                           | Ross                  | Hands-free capture                                                                            |
| Mockups vs. design-system tokens (page surface, tag style, date headers) | Ross                  | Cosmetic only — prototype follows the token spec; mockups differ (see `.claude/screenshots/`) |

Everything else deferred (Sentry, custom error handler, HNSW tuning, graph view) is logged in backend-planning-doc → Deferred Decisions.
