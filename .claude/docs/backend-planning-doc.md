# Backend Planning Doc: Filaments
_Generated 2026-05-29 · Revised 2026-05-30 (single client; Google Sign-In auth; env/local-dev folded in)_

## Project Context

Filaments is a personal knowledge graph fed by voice and documents. The user speaks thoughts or uploads files; an AI pipeline transcribes, summarizes, tags, embeds, and auto-links every input into a searchable, interconnected archive.

- **Consumers:** One first-party client for v1 — an iOS app (primary capture, Siri-triggered voice). A web client is planned for v1.1; the API is kept client-agnostic so adding it is additive (no schema or contract change). No third-party API consumers in v1.
- **Architecture shape:** One backend, one client, reading/writing through a REST API. The server is the single source of truth — no peer-to-peer sync, no offline-first reconciliation.
- **Team:** Solo developer.
- **Timeline:** No deadline; built incrementally.
- **Constraints:** Minimize ongoing cost and vendor count. Managed AI APIs are pay-per-use and negligible at personal scale; backend on free/hobby tiers to start.
- **Success criteria (v1 done when):** I can say "Hey Siri, new filament," speak a thought, and have it transcribed, summarized, tagged, and auto-linked to related past filaments hands-free — then find it later by full-text search or a natural-language question, on my phone. Capability checkpoints, not metrics (this is a personal tool).

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Django + Django REST Framework |
| ORM | Django ORM |
| Database | PostgreSQL + pgvector |
| Task Queue | Celery + Redis |
| Auth | Sign in with Google → SimpleJWT (Google ID token verified server-side, then app-issued JWT) |
| File Storage | AWS S3 (direct client upload via pre-signed URLs) |
| Backend Hosting | Railway |
| iOS App | React Native + Expo (EAS builds) |
| Transcription | OpenAI Whisper API |
| LLM (summary/tags/extraction) | Claude API (Sonnet) |
| Embeddings | OpenAI text-embedding-3-small (1536-dim) |

## Data Model

### Entities

**Filament** — single polymorphic model for all input types. Voice, document, and text share ~90% of their lifecycle (same pipeline, summary, tags, links, search, timeline behavior); only the source differs. One model with a `type` enum beats three models that triplicate every query and serializer. Avoid Django multi-table inheritance here — it adds a JOIN per query for no benefit at this scale.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID (pk) | See Deferred Decisions — leaning UUID, not finalized |
| `type` | enum | `voice` \| `document` \| `text` |
| `title` | text | |
| `body` | text | Canonical searchable field: transcript OR extracted doc text OR note text. Every type must populate it. |
| `summary` | text | One-to-one, stored directly |
| `key_ideas` | jsonb | `list[str]`, display-only, never queried alone |
| `transcript` | jsonb | Voice only: `[{start, end, speaker, text}]`. `speaker` reserved for forward-compat but unused in v1 (always null/constant — see Business Logic) |
| `source_key` | text | S3 key for audio/PDF; null for text notes |
| `embedding` | vector(1536) | Nullable (null during processing; may stay null permanently if the embed step degrades). Locked to text-embedding-3-small |
| `status` | enum | `pending_upload` \| `processing` \| `done` \| `failed` |
| `pipeline_attempts` | int | Default 0; incremented on each enqueue. Stuck-sweep requeues once, then marks `failed` (see Business Logic) |
| `search_vector` | tsvector | Postgres `GENERATED ALWAYS AS STORED` from title + body + summary (Django 5.0+ `GeneratedField`); GIN-indexed. DB-computed on every write — cannot desync |
| `created_at` / `updated_at` | timestamp | |
| `pinned` / `archived` | bool | `archived` = everyday hide; distinct from deletion |
| `deleted_at` | timestamp (nullable) | Soft-delete tombstone; null = live. Swept to hard delete after grace window |

**ActionItem** — its own table, not JSONB. Action items have state (`done` checkbox in the UI) and "all open action items across filaments" is a likely future query that JSONB would force a full scan for.

`id, filament_id (fk), text, done (bool), created_at`

**Tag + FilamentTag** — many-to-many. Tags are a shared, editable, filterable vocabulary.

**FilamentLink** — the core feature. One row per pair (not two). Auto-linking is directional at creation (new filament → existing), but the UI treats links as undirected; query both directions with `Q(source=f) | Q(target=f)`. Storing two rows risks desyncing the score and doubles write load.

`id, source_id (fk), target_id (fk), score (float), created_at` — with `unique(source_id, target_id)`.

### Relationships

- Filament 1—N ActionItem
- Filament N—N Tag (via FilamentTag)
- Filament N—N Filament (via FilamentLink, undirected at query layer)

### Notes

- `body` is the single source of truth for both full-text search and embedding generation. Consistency across types depends on it.
- Embedding dimension is a one-way door: changing embedding models later requires a schema migration + re-embedding every filament.
- `unique(source_id, target_id)` on FilamentLink from day one — re-processing a filament will otherwise create duplicate links.
- **Cascade rules:** `on_delete=CASCADE` on `ActionItem`, `FilamentTag`, and **both** FKs of `FilamentLink` (filament can be `source` or `target`). The two FilamentLink FKs need distinct `related_name`s or the migration will be rejected. `Tag` rows themselves are never cascaded (shared vocabulary). Cascades fire at sweep time, not at the soft-delete request (see Business Logic).
- **Reverse accessors & ordering:** FilamentLink's two FKs to Filament **require** explicit `related_name`s (`links_as_source`, `links_as_target`) — Django won't migrate otherwise. `ActionItem.filament` → `action_items` for ergonomic reverse access. `Filament` gets `Meta.ordering = ["-created_at"]` (model-level default; matches the timeline).

## API Design

REST via DRF. All routes namespaced under `/api/v1/` (prefix omitted below for brevity).

```
/auth/google                        POST (verify Google ID token → issue SimpleJWT; the one public route)
/auth/token/refresh                 POST (SimpleJWT refresh)
/filaments                          GET (list, filtered)   POST (create)
/filaments/{id}                     GET   PATCH (edit tags/title/annotations)   DELETE (soft — sets deleted_at)
/filaments/{id}/process            POST (confirm upload, enqueue pipeline)
/filaments/{id}/action-items/{id}  PATCH (toggle done)
/tags                               GET
/search                             GET ?q=&type=&tag=&from=&to=   (read-only FTS)
/ask                                POST (RAG query — returns answer + source filaments)
```

`/search` and `/ask` are intentionally non-resourceful (FTS and RAG respectively).

**Versioning:** URL-path versioning — all routes namespaced under `/api/v1/` (the convention used by Stripe, GitHub, and DRF's `URLPathVersioning`). Not strictly needed at single-user scale, but the prefix is near-free at setup and slots a future `/api/v2/` cleanly beside it. Routes below shown without the prefix for brevity; all live under `/api/v1/`.

**Pagination:** `CursorPagination` (DRF) on `/filaments` — orders by `-created_at` to match the chronological timeline and stays stable under inserts (a new capture appears at the top without shifting/skipping items mid-scroll). `LimitOffsetPagination` on `/search` — results are relevance-ranked (no stable cursor key), sets are small, and deep pagination is rare. Default page size ~25–50.

**Response shapes — `/ask` and `/search`:**

`/ask` returns a structured-segment answer (chosen over inline `[1]` markers so the client never parses model output — a segment either is or isn't a citation):

```json
{
  "answer": [
    { "text": "A primary recurring theme is ", "citation": null },
    { "text": "the intersection of digital minimalism and cognitive endurance", "citation": 1 },
    { "text": ". You've also returned to ", "citation": null },
    { "text": "tactile information systems", "citation": 2 }
  ],
  "sources": [
    { "citation": 1, "filament_id": "uuid", "title": "Deep Work Refined", "type": "document", "snippet": "..." },
    { "citation": 2, "filament_id": "uuid", "title": "The Revenge of Analog", "type": "document", "snippet": "..." }
  ],
  "follow_ups": ["How can I implement these analog constraints digitally?", "..."]
}
```
- `answer` is an ordered list of segments; a non-null `citation` renders as a superscript linking to the matching `sources` entry (the numbered-source pattern from the Perplexity reference). `type` drives the source-card badge (DOCUMENT / PDF / AUDIO).
- **Cost of this choice:** the burden moves to prompt design — Claude must reliably emit valid segmented JSON. Use a strict response schema (structured output / tool use) and validate before returning; a malformed response falls back to a single uncited segment rather than erroring. Ties into deferred Open Q #4 (extraction prompt design).

`/search` returns a paginated list of filament card summaries — just enough to render a timeline-style card:

```json
{ "id": "uuid", "title": "...", "type": "voice", "snippet": "...", "created_at": "...", "tags": ["..."] }
```

**Upload → pipeline handshake (pre-signed S3 URL flow):**

1. `POST /filaments` with `{type, title?}` → server creates row (`status: pending_upload`), returns `{filament_id, upload_url}` (pre-signed S3 PUT scoped to one key).
2. Client PUTs the file directly to S3 — bytes never pass through Django.
3. `POST /filaments/{id}/process` → client confirms upload complete; server enqueues the Celery chain, flips to `processing`. **Idempotent via conditional update:** `Filament.objects.filter(id=x, status="pending_upload").update(status="processing")` and only enqueue if it returns `1` row. A duplicate call (network retry, double-tap, offline replay) sees a non-`pending_upload` status, affects 0 rows, and returns a no-op success — no second chain, no double-spend, no duplicate-link race against the `unique(source_id, target_id)` constraint. The same status-gated path is what the stuck-sweep (#8) requeues through, so the two can't double-enqueue each other.
4. Client polls `GET /filaments/{id}` until `status: done`.

The explicit confirm step (3) exists because the server can't otherwise tell when the S3 PUT finished. S3 event notifications would do it but are unnecessary infrastructure for a solo app; client-confirms is simpler and correct.

## Auth & Authorization

**Sign in with Google, layered on top of SimpleJWT** — Google replaces the *login step* only; every protected endpoint is guarded by the backend's own JWT, exactly as a username/password flow would be. One token authority (the backend).

**Flow:**
1. iOS app runs Google Sign-In, obtains a Google **ID token**.
2. App `POST`s `{ id_token }` to `/api/v1/auth/google`.
3. Backend verifies the ID token via the `google-auth` library (`verify_oauth2_token`): signature against Google's public keys, `aud == GOOGLE_WEB_CLIENT_ID`, issuer is Google, `email_verified == true`.
4. Backend checks `email ∈ ALLOWED_GOOGLE_EMAILS` — **before** `get_or_create`, so a rejected email never creates a User row. Reject with `403` otherwise.
5. `get_or_create` the User, issue SimpleJWT `{ access, refresh }`.
6. Client stores both in Expo SecureStore; sends `Authorization: Bearer <access>`; refreshes via `/api/v1/auth/token/refresh`.

**Endpoint contracts:**
```
POST /api/v1/auth/google           (public)
  body:  { "id_token": "<google id token>" }
  200:   { "access": "...", "refresh": "...", "user": { "id": "...", "email": "..." } }
  401:   { "error": "invalid google token" }
  403:   { "error": "email not permitted" }

POST /api/v1/auth/token/refresh    (SimpleJWT default)
  body:  { "refresh": "..." }   200: { "access": "..." }
```

**The email allowlist is the critical control.** A Google login flow is effectively open to anyone with a Google account; without the allowlist, any Google user could authenticate and write into the personal store. `ALLOWED_GOOGLE_EMAILS` is a list (holds one address today) so adding a device/test account later is config, not code.

- **One public endpoint:** `/auth/google` (it must be — you can't be authenticated before logging in). It's protected by Google signature verification + allowlist rather than by a token. This amends the earlier "no public/unauthenticated endpoints" stance.
- Single user — no role-based access control, no permission tiers, no multi-tenancy.
- **Library:** `google-auth` for verification; **no `django-allauth` / `dj-rest-auth`** (the verify-and-issue handler is ~30 lines). Default `auth.User` is fine (`username=email`); a custom user model is optional — decide before the first `migrate` if at all.
- **Token lifetimes:** short access (~30–60 min), generous refresh (~30–90 days for a personal tool, so re-auth is rare). `ROTATE_REFRESH_TOKENS=True`; token blacklisting optional at single-user scale.
- **Google Cloud Console:** two OAuth client IDs — an **iOS client** (bundle ID, for the native flow) and a **web/server client** whose ID is the token audience the backend verifies against. Consent screen can stay in "testing" mode with your email as a test user.

## Error Handling

- **API error shape:** DRF's default exception handler returns sane JSON and is defensible as-is since the same developer owns both ends of the API. Optional upgrade: a thin custom handler (~20 lines) normalizing all errors to `{"error": {"code", "message", "fields"}}` for consistency. See Deferred Decisions.
- **Validation errors:** field-level detail (DRF default behavior).

## Business Logic & Edge Cases

**AI processing pipeline (Celery task chain):** transcribe (voice) / extract text (document) → summarize + key ideas + action items (Claude) → generate tags (Claude) → generate embedding (OpenAI) → auto-link via pgvector similarity → store.

**Failure handling — the riskiest part of the system:**

- **Persist-and-resume:** each step is idempotent and persists its output as it completes, so a retry resumes rather than restarting (never re-pay for Whisper because the embedding step failed).
- **Retry policy:** most failures are transient (rate limits, timeouts). Auto-retry transient errors ~3x with exponential backoff (Celery built-in), then mark `failed`. Surface the `failed` status badge and offer a manual retry. No silent failures. **Non-retryable exception — URL extraction:** a paywall, login wall, or JS-rendered page (trafilatura returns no usable text) fails identically on every retry, so retrying just wastes time. Treat "fetched but no extractable text" as non-retryable: fail fast with a clear message; only retry genuine network/timeout errors.
- **Critical path vs enrichment:** transcribe + extract are critical (no readable filament without them). Tags, embedding, and auto-linking are best-effort enrichment. If enrichment fails, mark the filament `done` with degraded enrichment (links/tags can backfill on a later retry) rather than hiding a perfectly readable transcript behind a flaky embedding call.
- **Stuck-in-`processing` recovery:** the per-step retries above rescue failures *within* a running chain, but not a chain that vanished entirely (worker death, Redis eviction, deploy mid-pipeline). A periodic sweep flags `processing` rows whose `updated_at` is stale (~30 min — comfortably past the longest legit step) and **auto-requeues once, then marks `failed`** (tracked via `pipeline_attempts`). Safe to requeue because persist-and-resume picks up from the last completed step rather than re-paying for Whisper. This sweep is the real safety net — it catches every stall cause regardless of source.
- **Redis durability:** enable AOF persistence so a broker restart replays the queue, and set Celery `task_acks_late=True` + `task_reject_on_worker_lost=True` so a task killed mid-execution is redelivered rather than lost. These reduce stalls; the stuck-sweep above is the backstop that makes them non-critical.

**Other edge cases:**

- **Orphaned uploads:** if a client uploads to S3 then dies before calling `/process`, a nightly sweep deletes `pending_upload` rows (and their S3 objects) older than ~24h.
- **Deletion (soft-delete tombstone + sweep):** `DELETE /filaments/{id}` sets `deleted_at` rather than removing the row — the row and `source_key` survive so the record is recoverable (trash / recently-deleted, per the Day One reference). A daily cron sweep hard-deletes anything past a ~30-day grace window: cascade the DB rows (action items, links both directions, filament-tags) and delete the S3 object. Keeping the row alive until sweep time is what makes S3 cleanup possible — a true immediate hard delete would destroy the `source_key` the cleanup needs. Honors the "user owns/can purge all data" goal while protecting irreplaceable captures from a fat-finger delete.
- **Offline capture (mobile):** recordings queue locally and upload when connectivity returns; the server assigns the canonical ID on upload.
- **External dependencies:** Whisper, Claude, OpenAI embeddings — all handled by the retry/degradation policy above.
- **Speaker labels deferred (v1):** `whisper-1` produces a flat transcript with no diarization, and multi-speaker capture (meetings/calls) is an explicit non-goal. v1 transcribes single-speaker dictation; the `transcript.speaker` field stays in the JSONB shape but is written null/constant. Real diarization (e.g. `gpt-4o-transcribe-diarize` or a pyannote step) is a v2 concern if meeting capture returns to scope — no schema change required to add it.

**Sweep scheduling (open decision):** the three periodic jobs above (stuck-`processing`, orphaned-upload, soft-delete hard-delete) need a scheduler. Two options: **Celery Beat as a 4th Railway service** (keeps scheduling in the Celery system) or **Railway cron** invoking management commands (no extra always-on process, sweep logic lives in commands). Railway cron is leaner on always-on cost; Beat keeps everything in one task system. Must be decided before wiring the sweeps — the stuck-sweep is load-bearing for failure recovery. See Deferred Decisions / PRD Open Q #9.

## Performance & Scalability

- Personal scale (hundreds to low thousands of filaments). No caching layer needed.
- **N+1 watch:** the timeline list endpoint must `prefetch_related` tags and links, or it will N+1.
- **Full-text search:** GIN index over the `search_vector` tsvector column, which is a Postgres stored generated column (`GeneratedField`) computed from title + body + summary — no triggers or save-time hooks to maintain, and impossible to leave stale.
- **Vector search:** pgvector is fine at this scale; move the index to HNSW once past a few thousand filaments (monitor).
- **File handling:** audio and documents upload directly to S3 via pre-signed URLs; the backend processes from S3 and never proxies file bytes.

## Config & Environment

- **Secrets:** `django-environ` locally; Railway platform env vars in production. No secrets manager at this scale.
- **Environments:** local + prod only. No staging for a solo build.
- **Secret list:** `SECRET_KEY`, `DATABASE_URL`, `REDIS_URL`, `JWT_SIGNING_KEY` (optional — falls back to `SECRET_KEY`), `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_IOS_CLIENT_ID`, `ALLOWED_GOOGLE_EMAILS`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, AWS credentials / S3 bucket + region.

### Local dev (Postgres.app + Docker Redis; Django + Celery on host)

**Database:** Use local **Postgres.app** (PG 17+, pgvector 0.8.2+) instead of Docker — better performance, newer versions, simpler for solo dev. Create `filaments_db` database with `filaments_user` role, enable pgvector extension via migration (see below).

**Redis:** Runs in Docker with AOF to mirror prod durability decision.

**Django + Celery:** Run on host for fast reload.

```yaml
# docker-compose.yml (Redis only)
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes   # AOF — mirrors prod broker durability
    ports: ["6379:6379"]
    volumes: ["redisdata:/data"]
volumes: { redisdata: {} }
```

**Postgres.app setup** (one-time):
```bash
# Using psql from Postgres.app (replace path/version as needed)
/Applications/Postgres.app/Contents/Versions/17/bin/psql -p 5432 -c "CREATE USER filaments_user WITH PASSWORD 'filaments_pass';"
/Applications/Postgres.app/Contents/Versions/17/bin/psql -p 5432 -c "CREATE DATABASE filaments_db OWNER filaments_user;"
/Applications/Postgres.app/Contents/Versions/17/bin/psql -p 5432 -d filaments_db -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Enable pgvector in Django migrations (runs automatically on `migrate`):
```python
# core/migrations/0001_enable_pgvector.py
from pgvector.django import VectorExtension
class Migration(migrations.Migration):
    operations = [VectorExtension()]   # CREATE EXTENSION IF NOT EXISTS vector
```

A full local run is three processes (four when testing sweeps):
```bash
docker compose up -d                       # Redis only
python manage.py runserver                 # Django API
celery -A filaments worker -l info         # pipeline worker
# celery -A filaments beat -l info         # periodic sweeps (only when testing them; see scheduling decision)
```

Commit a `.env.example` template (never real values) covering the secret list above. **S3 in dev:** a dedicated dev bucket is the lower-friction choice (the presigned-upload handshake behaves identically to prod, which matters because it's easy to get subtly wrong); MinIO in compose is the alternative if you'd rather not touch AWS locally.

### Prod (Railway)

- **Services:** Django web, Celery worker, Redis — each provisioned **explicitly** (the worker does not ride along with the web process; different start command). A 4th process/cron is needed for the sweeps (see scheduling decision).
- **pgvector provisioning:** Provision Railway's **pgvector template** (not base Postgres) at project setup, then the `CREATE EXTENSION` migration runs. Railway's default Postgres lacks the extension at the system level, so switching after the fact means `pg_dump` → restore into a fresh pgvector instance. Since `embedding vector(1536)` is a core column, do this from day one.

## Observability & Quality

- **Logging:** structured logs to stdout (Railway captures them). Logs-only for v1.
- **Error tracking:** none in v1 — Sentry explicitly skipped to limit vendors. Conscious trade-off: debugging a failed filament means grepping worker logs rather than receiving a stack trace. Easy to add later. (See Deferred Decisions.)
- **Testing:** integration-test the pipeline (riskiest code) and the auth boundary. Skip exhaustive unit coverage.
- **Health check:** a `/health` endpoint for Railway is worth adding (optional).

## Deferred Decisions

- **UUID vs auto-increment PK** — leaning UUID (non-enumerable IDs for a personal data store), but with the server assigning IDs on upload, auto-increment is also viable. Not finalized.
- **Sweep scheduling** — Celery Beat (4th service) vs Railway cron (management commands). Must land before wiring the failure-recovery sweeps. (PRD Open Q #9.)
- **Custom API error handler vs DRF default** — DRF default is fine to ship; thin custom handler is an optional consistency upgrade.
- **Custom user model vs default `auth.User`** — default fine; switch only to make email the true PK, and only before the first migration.
- **Token blacklisting** — optional; add `token_blacklist` only if hard logout/revocation is wanted.
- **Error tracking (Sentry, etc.)** — skipped for v1, revisit if log-grepping becomes painful.
- **`/health` endpoint** — recommended, not committed.
- **Auto-linking relevance threshold** (PRD open Q #3) — how similar embeddings must be to create a link. Needs experimentation.
- **Auto-link quality validation** — deliberately deferred (no spot-check or labeled set in v1; trust the cosine score, fix if it feels wrong). Known risk: spurious links can accumulate and quietly erode trust in the core feature with no analytics to catch it. Revisit by spot-checking ~20 filaments' top links if connections start feeling off.
- **Claude extraction prompt design** (PRD open Q #4) — consistent summary/tag/action-item output across input types.
- **Audio file size / compression / upload chunking** (PRD open Q #5).
- **pgvector index tuning at scale** (PRD open Q #6) — HNSW switch threshold.
- **Siri App Intent native module** (PRD open Q #1) — needs a spike to size the Swift work.
- **Graph view library** (v1.1, PRD open Q #8) — D3 vs Cytoscape, deferred.

## References

- `PRD.md` — Filaments Project Requirements Document
- `filaments-v1-spec.md` — v1 product spec
- `frontend-planning-doc.md` — single Expo app, server-state hooks, auth (client side)
- `design-system.md` — design tokens, components, status badges (`processing` / `done` / `failed`)
- `design-references.md` — Day One (overall language), Plaud (capture/processing), Obsidian (linking), Perplexity (Ask AI / cited sources)
