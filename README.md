# The World Beyond

A silent, browser-based interactive art experience about development, psychological distance, and the world that supports a thriving settlement.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal. Use the contextual buttons or type a request into the CIVIC AI composer. The story contains ten decisions and takes roughly 3–6 minutes. The game is intentionally silent.

## Checks

```bash
npm test
npm run build
```

## Architecture

- `src/game/GameState.js` creates the authoritative fresh-run state.
- `src/data/actions.js` contains stable action IDs, eligibility, state transitions, visible effect records, and acknowledgements.
- `src/data/storyEvents.js` contains the ten events, state-dependent variants, and causal callbacks.
- `src/game/ActionResolver.js` validates and atomically commits one action to the causal ledger.
- `src/game/PromptInterpreter.js` maps deterministic local language aliases to the same action pipeline used by buttons.
- `src/game/WorldRenderer.js` draws the complete connected landscape and reflects state without inventing consequences.
- `src/game/CameraDirector.js` computes close and final framing from the measured stage.
- `src/ui/GameUI.js` owns accessible DOM controls, history, progress, and the screen-space ending.

In development, `window.__WORLD_BEYOND__` exposes read-only state/ledger inspection, action selection, and final camera framing. It is excluded from production builds.

## Semantic asset replacement

The current geometry is the finished visual language, but `src/game/AssetRegistry.js` keeps replacement proportions explicit.

| Key | Recommended source size | Anchor |
| --- | ---: | --- |
| `home` | 136 × 104 px | 0.5, 1 |
| `apartments` | 176 × 156 px | 0.5, 1 |
| `service` | 224 × 128 px | 0.5, 1 |
| `factory` | 300 × 184 px | 0.5, 1 |
| `workshop` | 216 × 120 px | 0.5, 1 |
| `utility` | 152 × 136 px | 0.5, 1 |
| `tree` | 68 × 124 px | 0.5, 1 |
| `resident` | 20 × 48 px | 0.5, 1 |

Use transparent PNG or WebP files at 2× the logical dimensions shown in the registry. Preserve the bottom-centre anchor so replacements stay aligned with roads and plots.

