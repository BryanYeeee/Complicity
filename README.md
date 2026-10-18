# The World Beyond

A silent, conversation-first civilization-building experience about local development, psychological distance, and the regions that support a thriving settlement.

## Gameplay

The world begins as undeveloped land. CIVIC guides the player through broad, authoritative objectives: house the first residents, supply clean water, establish a local economy, and grow toward a thriving society. Every construction choice is made through two or three contextual buttons inside the conversation, or by writing a natural request such as “build apartments beside the river.” There is no separate build toolbar.

Proposals are visible in the world and can be confirmed, cancelled, moved to another site, or adjusted conversationally. Confirmed buildings persist with their coordinates; player-built structures can be selected, moved without paying twice, and upgraded. A bottom dashboard reports population, housing, economy, water, energy, and local air directly from committed state.

Housing, water, energy, work, and public life each have multiple viable approaches. Their material costs progressively alter Pinebank, Reedbank, and the service corridor: forests recede, quarries widen, freight routes appear, water degrades, and industrial haze accumulates. Different choices therefore create different towns and different outer damage before the shared final reveal.

## Run locally

The full stack uses a small Node server for CIVIC sessions and a Vite development client:

```bash
npm install
copy .env.example .env
# Put GEMINI_API_KEY in .env for live AI, or set CIVIC_DEMO_MODE=1 explicitly.
npm run dev:full
```

Open the Vite URL printed by the terminal (normally `http://127.0.0.1:5173`). `npm run dev` runs only the browser client and therefore falls back to the clearly labelled local demo interpreter.

The default live model is `gemini-3.5-flash-lite`, configurable through `GEMINI_MODEL`. It is the low-latency model used for CIVIC's short intent decisions; its thinking level defaults to `low` and can be set with `GEMINI_THINKING_LEVEL`. The server uses the Gemini `generateContent` API with a strict JSON schema. The API key is read only from `GEMINI_API_KEY` by `server/civic-server.mjs`; no secret is accepted by the UI, placed in `VITE_*`, committed, or bundled. Create a key in Google AI Studio and place it only in the local `.env` file.

If a live request fails, the API response distinguishes temporary rate limiting (`provider_rate_limit`), model overload (`provider_overloaded`), and daily quota or billing limits (`provider_quota`). Temporary failures honor `Retry-After` or Gemini `RetryInfo` when the delay is short enough for an interactive retry. Quota and billing failures are not retried because they require waiting for reset or changing the Google project. To work locally without provider calls, set `CIVIC_DEMO_MODE=1` in `.env` and restart `npm run dev:full`.

## Production

```bash
npm test
npm run build
npm start
```

`npm start` serves both the built files and `/api/civic/*` from one Node process. Production therefore requires a server/worker environment with `GEMINI_API_KEY`; the static directory alone can provide only demo mode and cannot securely host a provider secret.

## Interaction and authority

The existing ten causal milestones remain available as a deeper narrative path, but the core settlement objective is condition-driven rather than prompt-count-driven. Players may build directly, ask questions, request directions, compare or revise a proposal, authorize a clear instruction, cancel uncommitted work, move or upgrade a previous project, and ask about consequences. A pending proposal is visible and requires explicit confirmation.

The trust boundary is:

`player text → structured CIVIC intent → legal capability lookup → deterministic resolver → revisioned ledger → targeted transition → persistent world`

Server sessions own the live state, run ID, monotonic revision, pending proposal, idempotency cache, and one-request-at-a-time lock. The model never supplies run identity, geometry, resources, progress, or arbitrary patches. Questions and hypotheticals are read-only; every commit is revalidated.

The inspectable prompt and schema are in `server/civic-prompt.js` and `server/civic-schema.js`. Provider failures preserve the input and world. A successful commit is never retried merely to recover narration.

## Architecture

- `src/game/GameState.js` creates clean revisioned runs.
- `src/game/CapabilityRegistry.js` exposes bounded, state-derived capability descriptors and read-only previews.
- `src/game/ActionResolver.js` validates milestone and optional work, then writes causal effect records exactly once.
- `src/game/EffectCatalog.js` binds actions to typed targets, regions, paths, timings, and labels.
- `src/game/CivicCore.js` provides grounded facts and the explicitly labelled deterministic demo interpreter.
- `server/civic-server.mjs` owns live/demo server sessions and the Gemini adapter.
- `src/game/WorldRenderer.js` renders the previous state, animates the actual target, then reveals the committed state.
- `src/game/AssetRegistry.js` is the semantic rendering dependency for structures, vegetation, and residents.
- `src/game/CameraDirector.js` recomputes close/final framing throughout resize and reveal.
- `src/ui/GameUI.js` owns accessible conversation, pending state, controls, and the screen-space ending.

## Visual and human-art handoff

The current procedural art is an interim fallback. It uses a shallow elevated-plan projection, a 32 px ground unit, upper-left light, and ground-contact-Y depth. Future human-made PNG/WebP or atlas frames can be assigned in the semantic registry without changing simulation rules or hunting through renderer calls.

- Contact sheet: `/asset-preview.html` in development or production.
- Exact exports and states: `docs/ARTIST_HANDOFF.md`.
- All play assets remain local; there are no runtime image or font downloads.

## Verification

```bash
npm test
npm run build
npm run dev:full
node scripts/visual-check.mjs
```

The deterministic suites cover ten-beat completion, exact-once milestone awards, authoritative objective derivation, dashboard values, placement costs and collisions, moving without double charging, upgrades, route divergence, capability previews, optional no-progress repair, permission boundaries, constraints and negation, stale revisions, old-run rejection, and idempotent duplicate requests. `scripts/visual-check.mjs` drives three full chat/button-only playthroughs, including cancellation, invalid placement, conversational adjustment, relocation, double-confirm protection, and responsive drawer checks, then captures evidence in `screenshots/`.

Live-model wording is intentionally separate from deterministic tests. If no `GEMINI_API_KEY` is configured, provider evaluation is unverified and the interface says `DEMO MODE`; fixture results are not reported as live-AI evidence.
