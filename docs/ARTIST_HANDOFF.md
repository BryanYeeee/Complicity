# The World Beyond — human-made pixel-art handoff

The world uses a shallow elevated-plan projection, a 32 px ground unit, upper-left lighting, bottom-centre structure anchors, and ground-contact-Y depth. Runtime sampling is nearest-neighbour. The procedural artwork is an interim fallback, not final human-made art.

| Semantic key | Exact 2× export | Anchor | Required states / animation |
| --- | ---: | --- | --- |
| `home` | 136 × 140 px | 0.5, 1 | construction, active, upgraded, damaged, abandoned, restored |
| `apartments` | 176 × 156 px | 0.5, 1 | same six states |
| `service` | 224 × 168 px | 0.5, 1 | same six states |
| `depot` | 232 × 148 px | 0.5, 1 | construction, active, conversion, upgraded, abandoned, restored |
| `workshop` | 216 × 148 px | 0.5, 1 | construction, active, upgraded, damaged, restored |
| `factory` | 300 × 250 px | 0.5, 1 | construction, active, damaged; operating loop: 4 frames at 4 fps |
| `utility` | 156 × 224 px | 0.5, 1 | construction, active, upgraded, damaged, restored |
| `tree` | 108 × 144 px | 0.5, 1 | active, stump, young, damaged |
| `resident` | 20 × 48 px | 0.5, 1 | idle; walk: 4 frames at 6 fps; displaced-household palette variant |
| `road` | 64 × 64 px | 0.5, 0.5 | active, upgraded, damaged, restored; straight/corner/bridge approach frames |
| `river` | 64 × 64 px | 0.5, 0.5 | active, damaged, restored; flow: 4 frames at 5 fps; bank-edge frames |

Files may be assigned through `file` and optional atlas `frame` in `src/game/AssetRegistry.js`. Every record keeps a procedural fallback with the same logical footprint and anchor, so an incomplete art drop remains playable. A browser contact sheet is built at `/asset-preview.html`.

