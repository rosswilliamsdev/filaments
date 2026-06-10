# Tradeoffs Discussed — Filaments Backend
_Decision log from the backend planning + audit session, 2026-05-29_

This captures the decision points worked through in the planning interview and the SWE audit: what was on the table, what was chosen, and why. The settled outcomes live in `backend-planning-doc.md` and `PRD.md`; this doc preserves the *reasoning* and the alternatives that were rejected, so future changes can revisit them with the original context intact.

---

## Planning Session

### Single polymorphic `Filament` vs. three models
**Options:** one `Filament` model with a `type` enum; or separate Voice/Document/Text models; or Django multi-table inheritance (MTI).
**Chosen:** single model with a `type` enum.
**Why:** the three input types share ~90% of their lifecycle (same pipeline, summary, tags, links, search, timeline). Three models triplicate every query and serializer; only the *source* differs. MTI was rejected because it adds a JOIN per query for no benefit at this scale.

### AI outputs — columns/JSONB vs. dedicated tables
**Decision rule used:** does the output have its own state or get queried independently?
- **Summary →** plain column (one-to-one, never queried alone).
- **Key ideas →** JSONB (display-only blob; a table buys nothing).
- **Action items →** dedicated table. They have a `done` state (mutation/lifecycle), and "all open action items across filaments" is a likely future query that JSONB would force a full scan for.
- **Tags →** M2M (`Tag` + `FilamentTag`); shared, editable, filterable vocabulary.

### `FilamentLink` — one row per pair vs. two
**Chosen:** one row per pair (`source`, `target`, `score`), queried undirected via `Q(source=f) | Q(target=f)`.
**Why:** auto-linking is directional at creation (new → existing) but the UI treats links as undirected. Two rows per pair risks desyncing the score and doubles write load. A `unique(source_id, target_id)` constraint is added from day one so re-processing can't create duplicate links.

### Primary key — UUID vs. auto-increment
**Chosen:** leaning UUID, not finalized (recorded as a deferred decision).
**Why / how it shifted:** initially argued as *forced* by offline capture (clients minting IDs before reaching the server). That premise weakened once "sync" was clarified to mean server-as-hub with the server assigning IDs on upload — at which point auto-increment became viable too. UUID retained as a soft preference for non-enumerable IDs in a personal data store.

### "Sync" → server-as-hub (the big simplification)
**Reframe:** what was written as "real-time sync between surfaces" was clarified to mean "one backend, two clients (iOS + web) reading the same data."
**Consequence:** no offline-first engine, no conflict resolution, no real-time push. Killed PRD open question #2 (conflict resolution) outright and downgraded #7 (real-time mechanism) to a low-priority polling check. Offline capture survives as a simple queue-and-upload, not an architectural pillar.

### Upload → pipeline handshake
**Chosen:** `POST /filaments` (creates `pending_upload` row + returns pre-signed S3 URL) → client PUTs to S3 → `POST /filaments/{id}/process` (explicit confirm) → client polls.
**Why the explicit confirm step:** the server can't otherwise tell when the S3 PUT finished. S3 event notifications (S3 → SQS → backend) would do it but are unnecessary infrastructure for a solo app; client-confirms is simpler and correct.

### Pipeline failure handling
**Chosen:** persist-and-resume (idempotent steps persist output as they complete) + auto-retry transient errors ~3x with backoff + a **critical-path vs. enrichment** split.
**Why the split:** transcribe/extract are critical (no readable filament without them); tags/embedding/auto-linking are best-effort enrichment. A filament is marked `done` with degraded enrichment rather than hidden behind a flaky embedding call — one bad enrichment call should never make a readable note disappear.

---

## Audit Findings

### #1 — Delete model: hard delete + cron vs. soft-delete tombstone + sweep
**Chosen:** soft-delete tombstone (`deleted_at`) + daily cron sweep that hard-deletes past a ~30-day grace window.
**Key insight:** a *true* immediate hard delete destroys the `source_key` the cron would need to clean up the S3 object — so "hard delete + cron" has an ordering bug. Keeping the row alive until sweep time is what makes S3 cleanup possible, and it hands you a recoverable trash window for free (matches the Day One reference). Honors the "user can purge all data" goal while protecting irreplaceable captures from a fat-finger delete. Cascades (`ActionItem`, `FilamentTag`, both `FilamentLink` FKs) fire at sweep time.

### #6 — Speaker labels vs. the transcription tool
**Options:** (A) drop diarization, keep the `speaker` field unused; (B) swap to `gpt-4o-transcribe-diarize`; (C) add a separate diarization step (pyannote/AssemblyAI/Deepgram).
**Chosen:** A.
**Why:** `whisper-1` produces a flat transcript with no diarization, and multi-speaker capture (meetings/calls) is an explicit non-goal. For solo dictation the `speaker` field would be a constant. The JSONB shape is retained so real diarization can be added in v2 with no schema change.

### #7 — pgvector on Railway
**Chosen:** provision Railway's pgvector template at project setup (recorded as a setup note).
**Why:** Railway's *base* Postgres image lacks the extension at the system level, so `CREATE EXTENSION vector` fails on it. Standing up the base Postgres first means a `pg_dump` migration later. Since `embedding vector(1536)` is a core column, there's nothing to defer.

### #8 / #10 — Stuck `processing` + Redis durability
**Options for stuck rows:** auto-requeue; mark `failed`; or middle path.
**Chosen:** auto-requeue-once-then-fail (tracked via a new `pipeline_attempts` counter), plus Redis AOF persistence and Celery `task_acks_late` / `task_reject_on_worker_lost`.
**Why:** per-step retries rescue failures *within* a running chain but not a chain that vanished entirely (worker death, Redis eviction, deploy mid-pipeline). A stale-row sweep is the real backstop — it catches every stall cause regardless of source. Auto-requeue is safe *because* of persist-and-resume (it resumes rather than re-paying for Whisper).

### #9 — `/process` idempotency
**Chosen:** atomic conditional update — `filter(id=x, status="pending_upload").update(status="processing")`, enqueue only if it affects 1 row.
**Why:** a duplicate call (retry, double-tap, offline replay) would otherwise start a second chain — double-spend on paid APIs and a duplicate-link race against the `unique` constraint. The conditional update is atomic at the DB level (no lock held) and the same status gate is what the stuck-sweep requeues through, so the two can't double-enqueue each other.

### #2 — Pagination
**Chosen:** `CursorPagination` for `/filaments` (timeline), `LimitOffsetPagination` for `/search`.
**Why:** the timeline is chronological infinite-scroll; cursor pagination orders by `-created_at` and stays stable under inserts (a new capture appears at the top without shifting/skipping items mid-scroll). Search is relevance-ranked (no stable cursor key), sets are small, and deep pagination is rare — offset is simpler and fine. The rejected alternative (offset everywhere) trades mild timeline drift for uniformity.

### #3 — API versioning
**Discussion:** versioning exists to protect *deployed clients you can't update in lockstep with the server* — Git versions source, not the binary already on someone's phone. The web app redeploys atomically; the iOS app can't be force-updated, which is the only real wrinkle, and it's negligible at single-user scale. (Real-world grounding: Stripe `/v1/`, GitHub `/v3/`, DRF `URLPathVersioning`.)
**Chosen:** adopt URL-path versioning under `/api/v1/`.
**Why / how it shifted:** initially leaned toward skipping it as ceremony for two first-party clients, then reversed — the prefix is near-free at setup and slots a future `/api/v2/` public API (on the v2 roadmap) cleanly beside it.

### #4 — `/ask` response shape: citation handling
**Options:** Level 0 (plain answer text + a list of source cards, no inline anchoring); Level 1 (inline `[1]` markers the client parses); Level 2 (structured segments — answer as an ordered array of `{text, citation?}` chunks).
**Chosen:** Level 2.
**Why:** the Ask AI mockup shows superscript citations anchored to specific phrases (the Perplexity pattern), so per-phrase anchoring is wanted. Structured segments give that without the client parsing raw model output (Level 1's fragility). Cost: the burden moves to prompt design — Claude must reliably emit valid segmented JSON (validate, fall back to a single uncited segment on malformed output). Ties into the deferred prompt-design question.

### #5 — Success criteria
**Chosen:** a one-line capability checkpoint ("say 'Hey Siri, new filament,' speak a thought, have it transcribed/summarized/tagged/auto-linked hands-free, then find it later by search or NL question, from phone or laptop").
**Why:** capability checkpoints over metrics for a personal tool — costs one sentence, gives a testable finish line, keeps scope from creeping.

### #11 — `search_vector` maintenance
**Options:** (A) Postgres stored generated column (`GeneratedField`, Django 5.0+); (B) DB trigger; (C) Django `save()`/signal.
**Chosen:** A.
**Why:** the generated column is the only option where staleness is structurally impossible — the DB recomputes it on every write, including bulk `update()`, migrations, and direct `psql` edits that would bypass a signal (C's failure mode). On Django 5.0+ it's a field declaration, not infrastructure (B's downside).

### #12 — `related_name` & default ordering
**Hard requirement:** `FilamentLink`'s two FKs to the same `Filament` model need explicit, distinct `related_name`s (`links_as_source`, `links_as_target`) or Django won't migrate.
**Chosen:** model-level `Meta.ordering = ["-created_at"]` on `Filament` (matches the timeline), plus ergonomic reverse accessors (`action_items`).
**Note:** the rejected alternative (ordering explicitly per-query) avoids adding an `ORDER BY` to every query — a minor perf nit at this scale, judged not worth the repetition.

### #13 — Auto-link quality validation
**Options:** (A) manual spot-check folded into threshold tuning; (B) a lightweight labeled set for precision/recall; (C) defer entirely.
**Chosen:** C — deliberately deferred.
**Acknowledged risk:** spurious links can accumulate and quietly erode trust in the core feature, with no analytics to catch it at personal scale. Documented so it reads as a conscious skip; revisit by spot-checking ~20 filaments' top links if connections start feeling off.

### #14 / #15 / #16 — Minor refinements
- **#14 (Railway services):** three services off one codebase — Django web, Celery worker (separate long-running process), and Redis. The worker is provisioned explicitly, not bundled with web.
- **#15 (URL extraction):** treat "fetched but no extractable text" (paywall, login wall, JS-rendered page) as a *non-retryable* failure — retrying it 3x just wastes time. Only retry genuine network/timeout errors.
- **#16 (embedding nullability):** `embedding` is `null=True` — null during processing and possibly permanently under the degraded-enrichment policy.

---

## Implementation Phase

### FilamentLink reversed-duplicate guard — canonical ordering vs. lookup-then-create _(2026-06-10)_
**Context:** surfaced while sanity-testing the implemented schema. `unique(source_id, target_id)` stops `(A, B)` from being inserted twice but does **not** stop `(B, A)` after `(A, B)` — and re-processing a filament is exactly the scenario that produces a reversed insert. The planning doc asserts "one row per pair" but nothing enforced it.
**Options:** (a) **canonical ordering** — always store the pair sorted (lower UUID as `source`), backed by a `CheckConstraint(source_id < target_id)` so the database itself makes reversed rows impossible; (b) **lookup-then-create** — query both directions in application code before creating, preserving the "new → existing" direction semantics.
**Chosen:** (a) canonical ordering — judged the safest: the invariant lives in the schema, not in call-site discipline, so it survives any future code path (bulk ops, admin edits, a second linker implementation). The strict `<` also rules out self-links for free.
**Cost accepted:** `source` no longer records which filament initiated the link. Acceptable because the UI treats links as undirected and creation direction was never surfaced. All link creation must go through `FilamentLink.create_link(a, b, score)`, which sorts the pair and `update_or_create`s — so re-processing refreshes the score on the existing row instead of erroring.

---

## Decisions That Shifted During the Session

Worth flagging, since these reversed on new information:

- **PK strategy** — argued as *forced* by offline capture, then downgraded to a soft preference once "sync" was clarified as server-as-hub.
- **"Sync"** — started as "real-time sync between surfaces," reframed to one-backend-two-clients, which eliminated two open questions.
- **API versioning** — initially leaned skip, then adopted `/api/v1/` as cheap insurance for a future public API.

## Still Open (see `backend-planning-doc.md` → Deferred Decisions)

UUID vs. auto-increment PK · custom API error handler vs. DRF default · error tracking (Sentry) · `/health` endpoint · auto-linking relevance threshold · auto-link quality validation · Claude extraction prompt design · audio file size/compression/chunking · pgvector index tuning (HNSW threshold) · Siri native module spike · graph view library (v1.1).
