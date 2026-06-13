# Filaments — Web Client Planning Doc (v1.1)

_Created 2026-06-11. Companion to `backend-planning-doc.md` and `frontend-planning-doc.md`. Decisions settled 2026-06-11: Next.js (App Router), sibling `web/` directory, httpOnly-cookie auth via a BFF layer._

## Goal

A web companion to the iOS app that reads and writes the same backend. Capture on web is **text notes and bulk document uploads only — no voice recording** (URL capture is deferred until its backend API lands). Voice filaments captured on mobile still render fully on web (transcript, summary, audio playback from the presigned S3 URL); only the *recording* affordance is absent.

"Sync" requires no new backend machinery: both clients are stateless consumers of `/api/v1` against the same Postgres. Freshness comes from TanStack Query's `refetchOnWindowFocus` plus the existing status polling.

## Non-goals (v1.1 web)

- Voice recording, waveforms, Siri integration
- Offline queue (web is assumed online; mobile keeps that job)
- A desktop-style multi-pane layout — per `frontend-planning-doc.md`, web is a responsive port: same screens, single centered column (~720px reading width), no sidebar
- Dark mode (design system is light-only)

---

## Architecture

```
Browser ── (httpOnly cookies) ──> Next.js (Vercel)
                                    ├─ /auth/* route handlers   ← BFF: Google token ↔ Django JWT ↔ cookies
                                    └─ /api/proxy/[...path]     ← attaches Authorization: Bearer, forwards to Django
                                                  │
                                                  ▼
                                          Django /api/v1 (Railway)

Browser ────────── presigned PUT ──────────> S3 (direct, no proxy; needs bucket CORS)
```

- **Framework:** Next.js App Router, deployed to Vercel.
- **Location:** `web/` directory in this repo, sibling to `mobile/`. No monorepo tooling; copy `types.ts` and the API-hook shapes from `mobile/src/lib/` and let them drift independently until a third consumer justifies extraction.
- **Styling:** Tailwind with the exact token set from `.claude/context/design-system.md` (brand/neutral/semantic/type-* colors, 4px spacing grid). Fonts via `next/font`: Lora (headings), Inter (body), JetBrains Mono (timestamps/transcripts).
- **Server state:** TanStack Query, mirroring mobile's hooks (`useFilaments`, `useFilament`, `useSearch`, mutations). Keep hook names and query keys identical to mobile so the two codebases stay mentally interchangeable.

### Why a BFF proxy is mandatory, not optional

JWTs live in httpOnly cookies, which JavaScript cannot read — so the browser cannot set `Authorization: Bearer` itself. A catch-all route handler (`app/api/proxy/[...path]/route.ts`) reads the cookie, attaches the header, and forwards to Django. Consequences:

- Django needs **no CORS changes** for web: all Django traffic originates server-side from Vercel. (Keep prod CORS locked down as planned.)
- Token refresh lives in one place: the proxy retries once on 401 via `/auth/token/refresh`, re-sets cookies, replays the request.
- The **one exception** is the S3 presigned PUT, which goes browser → S3 directly (the URL is self-authorizing; proxying file bytes through Vercel would be slow and hit body-size limits).

### Auth flow (web)

1. Sign-in page renders Google Identity Services (the web counterpart of the native Google Sign-In). Requires a **Web application OAuth client ID** in the existing Google Cloud project, with the Vercel + localhost origins registered.
2. Browser gets a Google ID token → `POST /auth/google` **on the Next server**, which forwards `{id_token}` to Django's existing endpoint (unchanged — it already verifies signature + `ALLOWED_GOOGLE_EMAILS`).
3. Route handler sets `access` and `refresh` as `httpOnly; Secure; SameSite=Lax` cookies. Nothing token-shaped is ever exposed to client JS.
4. Sign-out: route handler clears cookies (and can hit the blacklist endpoint once the `token_blacklist` app cleanup chore from `remaining-tasks.md` §8 is done).

---

## Screens

Same five surfaces as mobile, adapted for web idioms. Per `.claude/rules/frontend-rules.md`: full keyboard support, visible focus rings, URL-reflected state, real `<a>` links throughout.

| Screen | Route | Mobile parity + web-specific notes |
|---|---|---|
| Sign-in | `/sign-in` | Google button; redirect target preserved in `?next=` |
| Timeline | `/` | Cursor-paginated cards, date groups. Filters (type/tag/pinned/archived) live in **query params** so filtered views deep-link and survive refresh. Infinite scroll with a "Load more" fallback button. |
| Detail | `/filament/[id]` | Summary, key ideas, action-item toggles, editable tags, linked filaments, transcript. Voice filaments get the audio player (`<audio>` streaming the presigned URL). |
| Capture | `/capture` | **The web-divergent screen.** Two modes in one surface: text note (textarea, ⌘/Ctrl+Enter submits) and documents (**bulk** multi-file picker **plus drag-and-drop onto the page** — PDF, Word `.docx`, and Markdown). No record tab; URL field deferred until the backend URL-capture API lands. |
| Search | `/search` | Query + filters in the URL (`?q=…&type=…`); results as cards. |
| Ask | `/ask` | Same placeholder as mobile until `/ask` ships (backend §3 of `remaining-tasks.md`); then the segmented-answer renderer with source cards. |

Navigation: mobile's bottom tab bar becomes a slim top nav (Timeline · Capture · Search · Ask). Add the keyboard accelerators web users expect: `/` focuses search, `n` opens capture.

### Capture flow (documents)

Each file runs mobile's text handshake plus an upload leg. **Bulk** = run that handshake per file through a bounded-concurrency pool (3 in flight) so a slow or failed file never stalls the others; the UI reports per-file status (queued → uploading → processing → done/failed) with inline retry.

1. `POST /filaments` `{type: "document", title?, filename}` → `{filament_id, upload_url}`. `filename` is required for documents: the backend derives the format from its extension, validates it against the accepted-types allowlist, and bakes the extension into the S3 key so the pipeline can dispatch extraction (PDF → PyMuPDF, `.docx` → python-docx, `.md`/`.markdown`/`.txt` → text passthrough). An unsupported type 400s **before** an upload URL is minted, so no orphan row is stranded.
2. Browser `PUT`s the file to S3 directly with its real Content-Type. Requires a bucket CORS rule allowing `PUT` from the web origins (**done** — see infra §1). (Mobile never hit this; native HTTP has no CORS.)
3. `POST /filaments/{id}/process` → poll `GET /filaments/{id}` until `done`/`failed`, same `refetchInterval` pattern as mobile.
4. URL captures (deferred): will skip S3 entirely — `POST /filaments` with the URL straight to `/process` (trafilatura extraction is server-side already).

Client-side guards before step 1: file-type allowlist (mirrors `core/s3.py` `ACCEPTED_DOCUMENT_TYPES`) and a 25 MB ceiling, both surfaced inline per file — fail before creating an orphan row, since the orphaned-upload sweep isn't built yet.

---

## Backend / infra changes required (small)

The read path needs **zero API changes**. The write path took a small, additive one: document create accepts a `filename` and the pipeline learned two new extractors (`.docx` via python-docx, Markdown/text passthrough) — see `core/s3.py`, `core/views.py`, `core/tasks.py`. The full list of real work outside `web/`:

1. ~~**S3 bucket CORS rule** — allow `PUT` (+ `GET` for audio playback) from `http://localhost:3000` and the Vercel domain.~~ **Done** — `PUT` and `GET` are configured for the web origins.
2. **Google OAuth web client ID** — new credential in the existing GCP project; add its client ID to the audience list Django's verifier accepts (it currently expects the iOS/dev client IDs).
3. **Vercel env vars** — `DJANGO_API_URL`, `GOOGLE_WEB_CLIENT_ID`, cookie-signing secret if sessions are wrapped.
4. Nothing else until `/ask` and Export land — those are backend roadmap items that unblock screens on *both* clients.

## Build order

| Phase | Scope | Done when |
|---|---|---|
| 1. Skeleton + auth | Next.js scaffold in `web/`, tokens/fonts, BFF auth + proxy routes, sign-in/out | Google sign-in round-trips locally against the dev backend; protected routes redirect |
| 2. Read path | Timeline, Detail (incl. audio playback of mobile-captured voice), Search | A filament captured on the phone appears and plays on web |
| 3. Write path | Text capture, tag/action-item/pin/archive/delete mutations | Text note created on web shows enriched on mobile |
| 4. Document upload | S3 CORS, bulk drag-and-drop + multi-file picker (PDF/Word/Markdown), per-file status polling | A batch of mixed-format docs dragged onto web is processed and auto-linked, each reporting its own status |
| 5. Polish | Keyboard shortcuts, empty/error states, reduced-motion, APCA contrast pass per `frontend-rules.md` | Audit checklist clean |

Phase 2's exit test is the whole product promise of this doc: capture on one device, find it on the other.

## Open decisions (Ross)

| Decision | Notes | Blocks |
|---|---|---|
| ~~Max upload size for browser PUTs~~ | **Settled: 25 MB per file**, surfaced inline per file in the bulk picker. (Still pairs with PRD open Q #5 for audio.) | ~~Phase 4 guard rails~~ |
| Vercel project / domain | Plain `*.vercel.app` is fine for v1.1 | Phase 1 deploy, OAuth origins |
| ~~Accepted document types beyond PDF~~ | **Settled: PDF, Word `.docx`, and Markdown/`.txt`**, all via the uniform document → S3 → pipeline path. `.doc` (legacy binary) excluded — python-docx reads only Open-XML. URL capture deferred to its backend API. | ~~Phase 4 file-picker allowlist~~ |
