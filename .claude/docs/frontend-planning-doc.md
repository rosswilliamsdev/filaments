# Frontend Planning Doc: Filaments

_Generated 2026-05-29 · Revised 2026-05-30 (web cut to v1.1; single-app architecture)_

> Companion to `PRD.md`, `filaments-v1-spec.md`, `design-system.md`, `design-references.md`, and `backend-planning-doc.md`. This doc covers only what those don't: the **frontend architecture and quality decisions**. Aesthetic, tokens, and product scope are owned by the design system and PRD respectively and are not re-litigated here.
>
> **v1 is iOS-only.** The web client moves to v1.1. The monorepo / universal-component architecture in the original draft existed solely to share screens between iOS and web; with web deferred, it's removed — v1 is a single Expo app. The notes on a responsive web port are retained at the end as v1.1 guidance, not v1 scope.

## Project Context

Filaments is a capture-first personal knowledge graph: speak a thought (Siri-triggered) or upload a document, an AI pipeline processes it, and everything auto-links into a searchable archive. **One client, one backend** — iOS (the primary and only v1 capture device) hitting the DRF API. Solo developer, no deadline, build incrementally. Light-mode-only, calm/editorial feel.

Core job-to-be-done: capture a thought hands-free and trust it'll be transcribed, summarized, tagged, and linked — then find it later by search or natural-language question, on the phone.

## Tech Stack

| Concern           | Decision                                                                                                                          |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| App               | React Native + Expo (EAS builds)                                                                                                  |
| Styling           | NativeWind (Tailwind for RN), tokens in `tailwind.config.js`, consumed via `className`                                            |
| Component library | None — custom, minimal, composable (per design system)                                                                            |
| **Repo shape**    | **Single Expo app.** No monorepo, no workspaces, no shared packages — web is deferred, so there's no second target to share with. |
| **Server state**  | **TanStack Query** — client-side data fetching throughout                                                                         |
| Auth              | Sign in with Google → backend SimpleJWT; tokens stored in **Expo SecureStore**                                                    |
| Forms             | Controlled inputs + Query mutations — **no form library** (inputs are too trivial to justify one)                                 |

### Architecture decisions (the load-bearing ones)

**Single Expo app — no monorepo.** This is the key change from the original plan. The monorepo + universal-component design ("share screens, fork only routing") only earned its keep when iOS and web both needed the same screens. With web in v1.1, that complexity buys nothing in v1, so it's cut: a plain Expo app with Expo Router, ordinary `src/` structure, components and hooks living in the app rather than in shared packages.

**Adding web later is additive, not a refactor.** When the v1.1 web client arrives, the backend (a client-agnostic REST API) doesn't change at all. If sharing UI between iOS and web is worth it then, the app can be lifted into a monorepo at that point — but that's a v1.1 decision made with v1.1 information, not a cost paid now. See "v1.1 Web Notes" below.

**App structure (suggested):**

```
src/
  app/                # Expo Router routes (tabs: timeline, record, detail, ask, search) + auth gate
  components/         # Button, Badge, Card, AudioPlayer, filament card, tag chip, source card, Ask-AI renderer
  hooks/              # server-state hooks (below)
  lib/                # api client, auth/token storage, query client
  styles/             # tailwind.config.js, tokens
```

**Server-state hooks.** All data access lives in `hooks/`: `useFilaments` (`useInfiniteQuery`, cursor pagination), `useFilament(id)`, `useProcessingStatus(id)` (polling), `useSearch`, `useAskAI`, plus mutations (`useToggleActionItem`, `useEditTags`, `useDeleteFilament`). One definition of server state for the app.

- Polling: `refetchInterval` on the filament/status query while `status !== 'done'`; ~2–3s interval, stop on `done` or `failed`. Matches backend's poll-until-done handshake (single user, polling confirmed sufficient).
- Cache invalidation: mutations `invalidateQueries` the affected filament + timeline list (optimistic update for tag edits and action-item toggles, roll back on error).

## Auth (iOS)

Sign in with Google is the only login method. Flow and backend contract live in `backend-planning-doc.md` → Auth & Authorization. Frontend responsibilities:

- Run Google Sign-In (EAS dev build required — native sign-in doesn't work in Expo Go; pin the current recommended Expo Google Sign-In library at scaffold time).
- POST the Google ID token to `/api/v1/auth/google`, receive `{ access, refresh }`.
- Store both tokens in **Expo SecureStore** (Keychain-backed).
- Attach `Authorization: Bearer <access>` to every request; on 401, refresh via `/api/v1/auth/token/refresh`; on refresh failure, route to the login screen.
- **Auth gate:** a root layout that shows the login screen when no valid token exists, otherwise the tab navigator.

## Aesthetic Direction

Owned entirely by `design-system.md` — not duplicated here. One word: **calm.** Light mode only, warm editorial palette, Lora (headings) / Inter (body) / JetBrains Mono (timestamps, metadata), spacious 4px grid, minimal shadows. AI features must read as quiet background work, never "techy." No gradients, glassmorphism, dark mode, or dashboard density.

## Interaction Philosophy

Owned by `design-system.md` Motion section. **Subtle polish only** — transitions, no entrance/exit animation, no bouncing. `duration-fast` 100ms (hover/toggle), `duration-default` 150ms, `duration-slow` 250ms (panel/modal), `ease-in-out` throughout.

- Input modality: **touch-first.**
- Capture-specific motion (recording waveform, processing→done transition) leans toward the Plaud reference but stays within the motion budget — the waveform is the one live/ambient element; everything else is static-until-interacted.

## UX Flows

### Login

First launch (or after token expiry with no valid refresh): a single screen — **Filaments** wordmark + "Sign in with Google." On success, route to Timeline. Not present in the original 8 mockups; needs design (it's minimal — wordmark + one button on the `brand-50` background).

### Primary Flow — Capture

1. Trigger: "Hey Siri, new filament" (App Intent) **or** tap **Record** tab.
2. Recording screen: live waveform, mono-spaced timer, pause/resume, bookmark-moment, stop (per mockup 1). Screen can be off / hands-free.
3. On stop: `POST /filaments` → presigned S3 URL → client PUTs bytes directly to S3 → `POST /filaments/{id}/process`.
4. Status flips to `processing`; client polls. Toast on completion: "Filament ready."
5. Result lands in Timeline at top (cursor pagination keeps it stable, no scroll jump).

### Secondary Flows

- **Browse:** Timeline (mockup 3) — date-grouped feed, type filter pills (All/Voice/Docs/Text), infinite scroll. Tap card → Detail.
- **Read:** Detail (mockups 2, 4, 7) — type badge, audio player (voice), transcript/body, collapsible Key Ideas + Action Items, editable tags, Linked Filaments with match score + "linked N ago."
- **Ask AI:** (mockups 5, 6) — single query field → segmented answer with superscript citations → horizontally-scrolling source cards (DOCUMENT/PDF/AUDIO badges) → tappable follow-ups. Renderer maps the `/ask` segmented-JSON shape directly; a citation segment becomes a superscript linking to its source card.
- **Search:** (mockup 8) — query field + type/date filters; empty state with illustration and prompt. Results render as timeline-style cards.

### Edge States

- **Empty:** Timeline first-run and Search-no-query both get a calm illustration + one line (search empty state already designed in mockup 8). Build the equivalent for an empty timeline.
- **Loading:** processing **status badge** on the card (warning-light), not skeleton loaders — busy skeletons are an explicit anti-pattern. Detail view of a still-processing filament shows the badge + whatever's already persisted (persist-and-resume means partial content may exist).
- **Error:** `failed` badge (error-light) + manual **Retry** action. URL-extraction failures (paywall/JS-rendered) are non-retryable — show a clear terminal message instead of a retry button.
- **Dense:** long transcripts and many links scroll within the 720px reading max-width; timeline uses cursor infinite scroll, never load-all.
- **Offline:** recording queues locally with a "queued — uploads when online" indicator; flushes on reconnect (server assigns canonical ID on upload).

### Forms & Validation

Three trivial inputs — tag add/edit (inline chips, "+ Add Tag"), quick text note (markdown), Ask AI query. Controlled state + Query mutations, optimistic where safe. No `react-hook-form` — it's weight for nothing at this surface area.

### Navigation State

Expo Router navigation params carry filament IDs, search query/filters, and timeline filters. (URL-addressable state was a web concern — it returns with the v1.1 web client.) Ask AI sessions are ephemeral.

## Responsive & Accessibility

**Layout:** single-column, phone-native. The 720px reading cap for Detail / Ask AI still applies as a max line length for comfortable reading on larger iPhones / iPad. No multi-pane or sidebar.

**Accessibility — minimal, with two cheap exceptions** (deliberate scope for a solo personal tool):

- ✅ `accessibilityLabel` on all icon-only controls — record/stop button, tab bar icons, share/star/back. Required for the eyes-free capture flow to function.
- ✅ Don't hardcode font sizes — allow Dynamic Type scaling on reading views.
- ⛔ Skipping: full WCAG AA audit, screen-reader flows beyond capture, contrast formalization (palette is already warm/legible).

## Performance & Quality Targets

Personal scale — hundreds to low-thousands of filaments. No frontend caching beyond Query's defaults.

- **Timeline:** cursor `useInfiniteQuery`, never fetch-all. Tags and links arrive prefetched on the list payload (backend `prefetch_related`) — client must not re-fetch per card (no client-side N+1).
- **Audio:** stream from the S3 presigned URL; don't download the whole file to play. Compact player variant on cards = play button + duration only.
- **Source viewer:** lazy-load PDF/image source on demand in Detail, not on list render.
- **Polling:** stop intervals on `done`/`failed`; don't leave a `refetchInterval` running on a settled query.

**Priority quality areas (in order):** mobile capture polish → reading experience → perf (timeline + audio) → forms. Animation polish is intentionally low (minimal-motion design). a11y is intentionally minimal per above.

## Deferred Decisions

- **Expo Google Sign-In library:** pin the current recommended library at scaffold time; requires an EAS dev build.
- **Graph View (v1.1):** out of v1 scope; library choice (D3 vs Cytoscape) deferred per PRD open Q #8. Detail screen already shows a "Graph View" affordance — keep it as a disabled/coming-soon entry point or hide until v1.1.
- **Ask AI streaming:** v1 renders the full segmented answer on completion; token streaming is later polish, not decided.
- **Offline queue UI detail:** the queued-recording indicator's exact treatment isn't designed yet.

## v1.1 Web Notes (deferred — not v1 scope)

Retained from the original plan for when the web client returns. **Web should be a responsive port of the iOS app, not a separate desktop layout** — same screens, same single-column structure, no sidebar or multi-pane. "Responsive" means a centered max-width column (≈480–600px app body, 720px reading cap), not full-bleed. At that point, decide whether to lift the app into a monorepo to share screens (forking only the routing wiring: Expo Router vs Next App Router), and resolve web token storage (httpOnly cookie vs secure storage + refresh). None of this is v1 work.

## References

- Vercel Web Interface Guidelines (v1.1 web): https://vercel.com/design/guidelines
- `design-system.md` — tokens, components, motion, status badges
- `design-references.md` — Day One (language), Plaud (capture), Obsidian (linking), Perplexity (Ask AI)
- `backend-planning-doc.md` — API shapes (`/ask`, `/search`), pagination, upload→pipeline handshake, status enum, auth flow
