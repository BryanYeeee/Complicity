# THE WORLD BEYOND — COMPLETE IMPLEMENTATION BRIEF

You are a senior gameplay developer, narrative designer, and art director. Implement **The World Beyond**, a complete, silent, browser-based interactive art experience about moral disengagement, psychological distance, and the hidden costs of progress.

Work in the current repository. Inspect the existing implementation and preserve useful code, but replace systems that prevent these requirements from working. Implement, run, inspect, and fix the game. Do not stop at a plan, scaffolding, a title screen, or a technically working but visually unexamined prototype.

This brief replaces the previous specification. If existing code or earlier instructions conflict with it, follow this brief.

## 1. What success means

The player spends approximately 3–6 minutes developing an attractive settlement through CIVIC AI, a helpful local assistant. Each decision produces an immediate improvement, changes the wider landscape, and creates the circumstances of the next event. At the end, a continuous camera pullback reveals the same settlement inside the world that supported it.

The emotional sequence is: **care → satisfaction → curiosity → unease → recognition**.

The concluding text is:

**“Your civilization is thriving.”**

Then:

**“At what cost?”**

The image must communicate the contradiction before the final question explains it.

Five release blockers take precedence over secondary features:

1. **The interface fits.** No clipped controls, unreadable miniature text, distorted canvas, or page scrolling at supported sizes.
2. **The decisions change.** Every event has contextual choices whose availability, consequences, and later references depend on the current state. A permanent set of three generic buttons is a failed implementation.
3. **The story connects.** The next event follows from the previous decision. A sequence of unrelated alerts at progress thresholds is a failed implementation.
4. **The reveal contrasts.** The final composition clearly shows the prosperous centre, affected outer regions, and physical connections between them. Zooming out to tiny buildings in an empty field is a failed implementation.
5. **This feels like an art experience.** Composition, colour, silence, pacing, and human detail are core gameplay requirements. A generic management dashboard is a failed implementation.

## 2. Technical boundaries

- Use JavaScript ES modules, Phaser 3, Vite, HTML, and CSS. No TypeScript or React.
- Support `npm install`, `npm run dev`, and `npm run build`.
- Target current desktop Chrome and Firefox. Do not require a backend, account, API key, AI service, or network connection during play.
- Use procedural geometry and locally generated textures. No external image URLs, remote fonts, or asset downloads at runtime.
- **Remove audio completely:** no AudioDirector, audio assets, sound effects, music, Web Audio synthesis, mute button, or audio-loading requests. Configure Phaser with audio disabled. Silence is intentional.
- Preserve natural-language input through a deterministic local interpreter. Do not pretend it is an unrestricted language model.
- Keep dependencies minimal. A development-only browser-testing dependency is acceptable if needed for verification.
- No fake interactions, unimplemented scenes, placeholder dialogue such as “event text here,” TODO mechanics, or `alert()` interactions.
- Keep graphics replaceable through a semantic asset registry, but do not spend time making empty folders or unnecessary abstractions.

## 3. Art direction: make the placeholder version worth looking at

Build a restrained, illustrated landscape using a consistent geometric vocabulary. Think of a small moving diorama: deliberate silhouettes, layers of terrain, narrow roads, winding water, sparse inhabitants, and quiet changes. Placeholder geometry is the finished visual language for this version, not an excuse to postpone art direction.

Use this starting palette, adjusting only to improve readability:

| Element | Colour | Purpose |
| --- | --- | --- |
| Paper / sky | `#EEE8D8` | Warm, open atmosphere |
| Settlement vegetation | `#839A70` | Local care and prosperity |
| Settlement buildings | `#D8BC89` | Warmth and habitation |
| Clean water | `#76A7AD` | A clear continuous river |
| Healthy outer forest | `#496C59` | Dense vegetation with a readable silhouette |
| Exposed soil / quarry | `#AC7358` | Land visibly consumed by development |
| Polluted water | `#666B4B` | Contrast with the protected local water |
| Industry / dead vegetation | `#414846` | Angular, depleted forms |
| Windows / local lights | `#F1CF85` | A town that remains inviting |
| Text | `#262D29` | High contrast on light surfaces |

Colour must be reinforced by shape: dense tree canopies versus stumps, flowing blue water versus oily patches, inhabited homes versus empty foundations, warm windows versus smokestacks. Do not rely on red/green differences alone.

Use a small number of consistent visual treatments. Avoid neon, floating resource counters, oversized rounded cards, decorative badges, excessive gradients, screen shake, confetti, and dense particle effects. The world should command attention; the interface should frame it.

Give the scene a few quiet motions: water highlights, drifting clouds, occasional walking residents, smoke only where a source actually exists. Use short construction animations and gentle colour transitions. The experience must still communicate its meaning in a screenshot.

Introduce two recurring people through concise messages: **Mara**, the settlement coordinator, and **Ivo**, a resident of downstream Reedbank. They remember what happened. They are people with practical concerns, not moral verdicts or counters.

## 4. Responsive layout and camera contracts

### Page and interface

Use a viewport-sized HTML shell with three regions: compact progress HUD, flexible world stage, and compact assistant composer. Use DOM text, input, and buttons for readable, accessible controls. Phaser renders the world inside the stage.

- Treat 1280 × 720 as a design reference, **not a fixed-size interface to shrink indiscriminately**.
- Use `100dvh` with a fallback, border-box sizing, zero body margin, and no document overflow. Apply `min-width: 0` and `min-height: 0` where grid/flex children need to shrink.
- Resize Phaser to the stage's measured CSS dimensions with `ResizeObserver` or an equivalent reliable mechanism. Do not stretch a fixed canvas with unrelated CSS dimensions.
- Keep DOM UI outside the world camera. Zooming or panning the world must never scale the UI.
- At desktop sizes of at least 1024 × 600, allocate at least 55% of viewport height to the unobstructed world stage. Aim for 60–70% at 1280 × 720 and larger.
- Use roughly 44–56 px for the HUD and 180–240 px for the normal assistant area, adapting to actual height. These are layout budgets, not dimensions to enforce when they cause overflow.
- Show the current event, its choices, and the prompt input. Put older conversation in a collapsed history drawer with its own bounded scroll area. Do not let an ever-growing chat transcript push the world offscreen.
- At smaller or short windows, reflow choices and allow internal event/history scrolling. Keep the input and submit button visible. The page itself must not scroll.
- Target 16 px body text and at least 14 px secondary text in CSS pixels; do not obtain fit by shrinking everything to illegibility. Buttons should have approximately 40 px minimum hit height.
- Long text wraps. Controls remain reachable with keyboard and mouse. Focus and disabled states are visible.

Verify at 1920 × 1080, 1366 × 768, 1280 × 720, 1024 × 600, 800 × 600, and 2560 × 1080. The smaller layout may be more compact, but it must remain fully playable. Resize during an event, construction, and the reveal.

### World and camera

Use one continuous world coordinate system. Start with a roughly 3200 × 1200 landscape and a central settlement roughly 900–1100 units wide. Adjust these dimensions as a coherent composition, not as scattered constants.

Define separate bounds for:

- The settlement composition used for the opening camera.
- The complete landscape artwork used for the ending camera.
- Decorative overscan such as clouds, which must not distort the framing calculation.

The opening view must keep the main outer consequence regions offscreen while keeping the settlement readable. Compose the settlement in a relatively shallow band so the initial camera also works on wide screens.

Compute the final camera fit from measured world-stage dimensions and the actual landscape bounds. For stage size `W × H`, artwork size `Bw × Bh`, and margins `px`, `py` in stage pixels:

```js
const zoom = Math.min((W - 2 * px) / Bw, (H - 2 * py) / Bh);
const centreX = bounds.x + Bw / 2;
const centreY = bounds.y + Bh / 2;
```

Use the same coordinate units throughout. If the camera requires scroll values, derive them from this centre and the visible size at the computed zoom. Do not assign the world centre directly as the top-left scroll. Account for camera bounds/clamping so they do not defeat centring or letterboxing.

Start with 6–8% frame padding. The final landscape should occupy at least 85% of frame width at the desktop test sizes; the central settlement should remain approximately 20–35% of frame width. Adjust artwork bounds/composition if fitting produces a tiny scene. Do not stretch it.

For the ending, fade the composer and expand the world stage into the freed space, retaining a small 100% HUD. Re-measure the stage before calculating the final fit. Reserve clear space for ending text without obscuring the central contrast.

On resize, recompute the camera targets. During the reveal, continue from the current framing or preserve normalized cinematic progress; do not jump back, restart the story, or tween to stale screen dimensions.

## 5. Build the whole landscape before the first decision

The ending reveals geography that already exists. It must not load a disaster illustration, generate a random wasteland at completion, or apply a uniform grey overlay to fake consequences.

Create these connected regions from the start:

1. **Central settlement:** approximately 16 predefined plots, paths, homes, a small existing service building, warm windows, and a protected stretch of river.
2. **Pinebank, to the left:** forest, a small inhabited edge, and land that can become a timber site, quarry, or modest reclamation yard.
3. **Reedbank, downstream to the right:** wetlands, a few homes, and a riverbank that can show reduced flow, polluted water, relocation, or recovery.
4. **Outer service corridor:** existing supply routes and space for power, workshops, pipes, and industrial expansion. This supports the town even when the player never requests a factory.

Connect these regions visibly with the same winding river, a road, and appropriate pipes or power lines. At least one permanent landmark, such as a bridge and a forked tree, must be identifiable in both the opening and final views.

Use stable IDs for plots, river segments, forest patches, infrastructure, and households. Buildings occupy valid predefined positions. Never place them randomly over roads, water, people, or other buildings.

Represent impact with large readable areas as well as details: a forest section visibly thins, a quarry has a rust-coloured footprint, a downstream river segment changes, and a vacated house leaves a recognisable foundation. A few tiny smoke particles are insufficient.

The outer world changes **when actions happen**, including while offscreen. The final reveal changes framing, not history. Initially obscure consequences through distance and composition, not by postponing their creation.

The town remains comparatively warm, inhabited, and orderly at the end. Outer regions should have different colours, textures, and silhouettes according to their actual state. Preserve healthy and restored patches where the player earned them.

## 6. Narrative structure: ten connected decisions

This is a directed narrative with branching methods, not an endless building sandbox. Implement ten authored decision beats. Each resolves through a contextual button or a supported natural-language request.

Every beat must have:

- A specific situation caused by earlier state or decisions.
- A short event description, usually 20–45 words.
- Two to four concrete, relevant choices. Vary the number where eligibility changes; do not pad every scene to three.
- A visible local result and an attributable wider-world result.
- An assistant acknowledgement that names what was done.
- A later callback or consequence. The tenth beat pays off in the final view.

Use this story as the required foundation. Write all event text, branch variants, and responses; do not leave narrative generation for later.

| Beat | Situation and causal connection | Candidate responses and consequences |
| --- | --- | --- |
| 1. Room to live | Mara asks for homes for four households. Begin with an ordinary act of care. | Build meadow cottages using new timber, or convert the existing depot using reclaimed materials. Both visibly house people; they create different material and utility needs. |
| 2. Water at the door | Name the cottages or converted depot from beat 1. Their occupants need reliable water. | Extend the river intake, or repair the existing loop and add conservation equipment. Both improve service; they create different downstream flow and power demand. |
| 3. Lights after dusk | The actual water system and homes need dependable energy. | Extend the outer power connection; install rooftop generation and storage; offer demand-reducing upgrades when existing capacity makes that viable. Connect the chosen infrastructure visibly. |
| 4. Materials from somewhere | The assistant reports the specific material need created by the player's housing and energy methods. The first subtle outer-world clue appears. | Expand Pinebank extraction and processing; reclaim materials through a workshop; use a smaller managed timber allocation where forest remains. The processing method supports a factory request. New extraction removes identifiable vegetation. Reuse reduces that footprint but still has transport and processing needs. |
| 5. The connecting road | Refer to the actual supply site: timber deliveries, quarry trucks, or repair crews now need access. | Widen the riverbank road; strengthen the existing bridge; offer a lighter service route when demand permits. A wider road has a larger land footprint and may affect a predefined household. |
| 6. People from beyond | If previous actions displaced households, Ivo introduces those households and names their origin. If no households were displaced, Ivo arrives with a repair delegation and describes the actual flow or land-use change instead. | Allocate spare housing if available; adapt a community space; build compact accommodation when needed. In the delegation variant, offer shared facilities or a service connection. Choices and text must differ between these variants. Helping people is a real benefit, not a punishment. |
| 7. The same river | Ivo follows up on the water/road decision. Use pollution, reduced flow, damaged banks, or a shared maintenance need according to the actual river state. | Protect the town intake only; restore the affected downstream segment; reduce a real upstream discharge or diversion where eligible. If there is no polluted source, never claim to clean one. A protected intake may leave the outer problem unresolved. |
| 8. A place to gather | Mara requests a shared public service for the population actually present. Mention whether arrivals were housed or a regional partnership was established. | Build a clinic/community building; expand an existing service; adapt a suitable unused structure. Availability depends on occupancy. Show residents using it and apply the chosen construction footprint. |
| 9. Almost enough | The latest service creates a final capacity gap. Derive the gap from existing power, water, or material demand, and refer to the earlier repair/restoration choice. | Expand the relevant supply source; retrofit the relevant infrastructure; introduce a shared-capacity arrangement. Each must actually satisfy the gap through different physical changes. Do not invent a factory on a run without one. |
| 10. The completed picture | CIVIC AI identifies the final unfinished local objective and recalls at least one earlier decision. This is the final ordinary act before certification. | Finish the current expansion, or complete a lower-impact upgrade/reuse solution. Where relevant, include an option combining local completion with repair of an affected outer site. All available methods complete the target, but leave different landscapes. |

For beats 2–10, implement at least two materially distinct state-dependent variants. A variant changes the situation, an available action, the target region/building, or a later consequence—not just an adjective. Variants may reconverge at the next beat; a combinatorial branching novel is unnecessary.

Make causality legible through concrete references: “The new cottages need water,” “The riverbank road has reached Reedbank,” or “The wetland you restored is holding water again.” At least beats 6, 7, 9, and 10 must recall a specific earlier decision beyond merely mentioning the current progress number.

Reveal the connection gradually. Early language emphasizes practical needs. Middle events introduce named places and people. Late language exposes the narrowness of the progress metric. Do not announce the entire moral in the introduction.

Never display moral scores, “good/evil” labels, or a consequence spreadsheet. CIVIC AI is helpful and narrowly focused, not sarcastic or malicious.

## 7. Dynamic choices must be implemented as stateful actions

Use an event registry and a deterministic story state machine. Event order supplies pacing; state supplies the current variant and legal methods.

An event should expose a contract equivalent to:

```js
{
  id: 'river_followup',
  requires: ['arrivals_resolved'],
  getVariant(state) { /* polluted / low flow / damaged bank / maintenance */ },
  getText(state, variant) { /* authored text with truthful callbacks */ },
  getChoices(state, variant) { /* two to four eligible action descriptors */ },
  resolve(state, actionId) { /* validated state transition + effect records */ },
  getResponse(previousState, nextState, actionId) { /* authored acknowledgement */ }
}
```

The comments above describe responsibilities; the delivered game must contain complete implementations.

Each choice has a stable action ID, concise label, eligibility rule, interpreter aliases, local effects, outer effects, and narrative flags. Resolve buttons and typed input through the **same** validation/action pipeline.

- Changing a label while calling the same generic action is not branching.
- Selecting a restoration method must change the affected region and subsequent text.
- Housing people in existing space must differ from building new accommodation.
- A choice requiring spare housing, a workshop, pollution, or an unused depot is offered only when that condition is true.
- Every reachable event state must have at least two valid methods. Author fallbacks such as upgrading an existing service; do not rely on an unavailable plot.
- Resolve an event once. Retire its choice IDs. Reject stale clicks and old submissions.
- Do not choose story events randomly. Randomness may only add seeded visual variation.

Keep a causal ledger for implementation and testing:

```js
{
  eventId,
  actionId,
  affectedEntityIds,
  localEffects,
  outerEffects,
  narrativeFlags
}
```

Every visible human displacement, felled patch, new industrial structure, and restored segment must be traceable to initial world state or a ledger entry. Progress thresholds alone must not manufacture damage.

## 8. Natural-language input and progression

Keep one clear prompt input with Enter-to-submit and a submit button. Suggested choices are convenient expressions of the current decision; they do not replace typing.

Support aliases for housing, water, energy, industry/materials, services, roads, helping arrivals, restoration, and upgrades. Match specific intent before broad words. For example:

- “Build homes” can select cottages during the housing beat.
- “Use the empty depot” can select conversion when that depot is eligible.
- “Give everyone clean water” can select the current water-service method.
- “Build a factory” can select an eligible material-processing expansion; it must not magically create an unrelated structure during the river event.
- “House the newcomers” must consider available accommodation.
- “Clean the polluted river” must select restoration, not construction merely because “river” is mentioned.
- “Improve the existing plant” must select an upgrade, not a new plant.

Normalize case, whitespace, and punctuation. Handle basic negation so “do not build a factory” never builds one. If a request contains competing actions or is ambiguous, ask a short contextual clarification using the current valid methods. Do not partially apply it.

Resolve requests in the context of the active event. For a supported but unrelated request, honestly explain the current need and offer relevant methods. Do not pretend to queue work that will never happen. For unsupported input, respond helpfully without advancing the story or changing the world.

Use explicit input states: ready, resolving, transitioning, ending. Disable submissions while an action is resolving; prevent duplicate commits even if Enter and a button are activated together. Preserve invalid input so it can be edited. Clear input after an accepted action.

Use milestone completion for a predictable short story:

```js
const startingProgress = 5;
const beatAwards = [8, 9, 9, 10, 10, 10, 10, 10, 9, 10];
// Ten resolved beats produce exactly 100%.
```

Award progress once per resolved beat. Different methods fulfil the same local milestone while producing different world effects. This is deliberately an incomplete measure of local development, not a morality score.

Do not award progress for unsupported text, no-op restoration, repeated resolution, or extra clicks. Ordinary actions take roughly 0.5–1.5 seconds to animate. Allow a brief moment to notice the result before presenting the next event, without padding the game with long forced waits.

Progress cannot reach 100% before the final event has resolved. Repeated housing commands cannot skip the human consequence, river follow-up, or final capacity decision.

## 9. Consequences and genuine agency

Track only the simulation values needed by the story and visuals: local capacity/demand, plot occupancy, buildings/upgrades, regional vegetation, extraction footprint, river flow/contamination, household locations, restoration, and narrative flags.

Keep those values hidden from the normal player UI. Render them through actual entities and regional appearance. Prefer a small, understandable set of per-action effects over an elaborate resource economy.

Define effect magnitudes centrally and tune them for visible differences. Expanding extraction must remove more vegetation than reclaiming material. Repairing a pipe must not create the same footprint as building a power plant. Restoration must repair the targeted river segment or forest patch, not just reduce a hidden global number.

Do not make every benevolent act secretly equally destructive. Local services have real value. Helping displaced people does not itself cause a special environmental penalty; any cost comes from the chosen construction method, as with other construction.

The existing settlement and its service network may have a small, explicitly initialized outer footprint. Additional damage must come from actual actions. Do not retroactively add factories, displaced households, or dead forests because the ending “needs” them.

Make the two broad approaches visibly distinct:

- **Expansion-heavy:** larger extraction footprints, more industrial silhouettes, greater river/land damage, and displacement only where a chosen development affects households.
- **Careful development:** smaller footprints, retained vegetation, visible reuse, and meaningful repaired areas. There are still physical supply connections and costs, but not an identical catastrophe imposed by the script.

Both routes must finish. Both should reveal how the town depends on the surrounding world. The force of the contrast should reflect what happened; do not punish careful play by secretly overwriting it.

When plots fill, offer an eligible upgrade, shared service, or conversion. When restoration is already complete, do not promise another improvement or award progress for an unchanged region. Ensure every authored event still has valid resolutions.

## 10. Opening, ending, and replay

### Opening

Show the close settlement view with a little ambient motion, the title **THE WORLD BEYOND**, the line **“A better world is just one prompt away.”**, and **BEGIN DEVELOPMENT**.

Keep this brief. Do not reveal the moral or show a tutorial wall. Begin with Mara's housing request and usable input.

### Final sequence

Use an explicit, one-time sequence:

1. Commit the final action and finish its animation.
2. Disable normal input and show **CIVILIZATION COMPLETE — 100%**.
3. CIVIC AI says, “Congratulations. Your civilization has reached its development target.” Hold the prosperous close view for about 1.5–2 seconds.
4. Fade the composer, expand/re-measure the world stage, and begin a continuous camera pullback lasting approximately 7 seconds.
5. Reveal the town boundary, supply connections, river, and outer regions as parts of the same landscape. Use a restrained pan only if it improves comprehension; finish with the full connected world in frame.
6. Hold the wide view without explanatory text for approximately 3 seconds. Let the player read the image.
7. Display **“Your civilization is thriving.”** in the reserved text space. Pause approximately 2 seconds, then add **“At what cost?”**.
8. Keep the world visible. After a short hold, expose **VIEW THE WORLD** and **PLAY AGAIN**. Do not automatically replace the landscape with an opaque black end card.

Keep the small progress indicator at 100%; its continued optimism is part of the juxtaposition. Ending text must be screen-space DOM or a separate UI layer, never world-space text that shrinks during the pullback.

The final image must simultaneously contain:

- An intact, inhabited, visually warm settlement.
- Clearly distinguishable outer regions affected during this run.
- The river and at least one visible supply connection into the town.
- Enough scale for land footprints and human settlement traces to be legible.
- Any restoration or preserved areas earned by the player's decisions.

For expansion-heavy play, at least three substantial consequence features must be immediately readable, such as a quarry scar, altered downstream river, industrial zone, or vacated settlement edge. For careful play, show the corresponding smaller footprints and restored/preserved regions faithfully.

**VIEW THE WORLD** hides ending text and leaves the final panorama accessible, with a small accessible way to restore the ending controls. No additional simulation or damage runs while the player looks. **PLAY AGAIN** returns to the fresh opening world.

Replay must reset simulation, plot occupancy, households, action ledger, event flags, text/history, progress, camera, UI state, listeners, timers, tweens, and any seeded visual state. Replaying repeatedly must not duplicate events or preserve old damage.

Respect reduced-motion preferences: replace the long camera movement with a brief transition to the correctly fitted full-world view, while retaining the narrative holds and text order. Do not use flashing effects.

## 11. Implementation boundaries

Keep modules small and responsibility clear. A suitable structure is:

```text
src/
  main.js
  styles.css
  game/
    GameState.js
    ActionResolver.js
    StoryDirector.js
    PromptInterpreter.js
    WorldRenderer.js
    CameraDirector.js
    AssetRegistry.js
  data/
    storyEvents.js
    actions.js
    worldLayout.js
    palette.js
  ui/
    GameUI.js
```

Adapt this to useful existing code. Do not create files merely to fill this tree.

- `GameState` is authoritative and can produce a clean new-run state.
- `ActionResolver` validates and atomically applies one eligible action, returning effects for the renderer and ledger.
- `StoryDirector` owns event order, variant selection, one-time transitions, and narrative callbacks.
- `PromptInterpreter` returns an action candidate or clarification, and never creates sprites or mutates the world.
- `WorldRenderer` displays state and animates recorded effects; it never invents damage independently.
- `CameraDirector` owns world bounds, fitted framing, cinematic movement, and resize handling.
- DOM UI displays state and sends actions; it does not calculate consequences.
- `AssetRegistry` provides consistent dimensions, anchors, and procedural fallbacks for future local assets.

Use stable semantic assets for homes, apartments, services, factories, power infrastructure, living/dead trees, residents, and displaced households. Distinguish them by silhouette and proportion. If an optional local asset is absent, use the procedural fallback without throwing or repeatedly logging missing-file errors.

Residents follow a few safe authored paths. Arrivals enter from their actual region; housed residents move toward their accommodation. Do not spawn people inside buildings or delete them to improve a metric.

Separate the logical state commit from its visual animation. Lock duplicate actions before awaiting animation. Resolve the next story event only after the current result has been displayed. If resizing interrupts a visual effect, the underlying action must remain committed exactly once.

## 12. Implementation order and verification

Work through these steps without stopping for approval of routine choices:

1. Inspect the repository and identify existing layout, story, simulation, and camera problems. Remove the audio implementation and references.
2. Build the responsive shell and the complete connected landscape.
3. Establish the close and final camera compositions immediately. Add a development-only way to inspect initial, expansion-heavy, and careful-run states and jump to the final framing. Do not leave debug controls in the production UI.
4. Inspect both camera views at the required viewport sizes. Fix scale, composition, and available UI space before building more features on top of them.
5. Implement the action/state model, all ten events, their variants, and the causal ledger.
6. Wire both typed requests and contextual choices into the same resolution path.
7. Implement visible effects, people, narrative callbacks, and the complete ending/replay sequence.
8. Add restrained transitions and polish. Keep the game silent.
9. Run logic checks, playthroughs, resize checks, and the production build. Fix observed failures.
10. Write concise setup, architecture, controls, and asset-replacement documentation.

### Required logic checks

Use focused tests for the systems that can silently fake agency or break progression:

- Traverse every reachable authored story state, or all relevant combinations of eligibility flags with documented coverage. Every unresolved event exposes at least two legal actions and has a path to completion.
- Verify prerequisites, once-only event resolution, the ten-beat order, and a final progress total of exactly 100%.
- Verify specific intent priority, basic negation, ambiguity handling, and invalid/stale action rejection.
- Verify that different decisions produce different regional state, follow-up variants, and relevant later dialogue.
- Verify that restoring a damaged segment changes that segment, and that no-op restoration changes nothing.
- Verify a fresh replay state matches the initial state and has no old ledger entries.

Do not write tests that merely check whether a function exists. Exercise outcomes and meaningful invariants.

### Required playthroughs

Complete these through real game interactions, using buttons and typed input:

1. **Expansion-heavy route:** new construction, expanded supply, larger transport footprint, local-only mitigation where offered.
2. **Careful route:** reuse, demand reduction, shared capacity, and restoration where eligible.
3. **Mixed route:** switch methods, use synonyms, and recover from unsupported or ambiguous input.

The first two runs must differ visibly in at least three relevant world features and produce different later narrative references. If both runs deliver the same event text, same actions, and same final panorama, the implementation fails.

Also exercise rapid repeated submission, full plots, resize during construction, resize mid-reveal, clicking during the ending, reduced motion, and two consecutive replays. No event duplication, input deadlock, lost controls, or stale camera framing is acceptable.

### Visual evidence is mandatory

Use browser tools available in the environment to inspect actual rendered gameplay. Capture opening gameplay, a middle consequence event, and the final panorama. Compare final screenshots for the expansion-heavy and careful routes. Inspect layout at all specified sizes; retain representative screenshots at 1280 × 720, 1024 × 600, and 2560 × 1080.

Check for clipped text, overlapping controls, page overflow, excessive empty space, stretched rendering, tiny final-world scale, and ending text obscuring the juxtaposition. Fix these through layout and composition, not by hiding required controls or reducing text below readable sizes.

A successful production build does not prove that the interface fits, the story connects, or the reveal works. If browser inspection is unavailable, report that precise limitation; do not claim visual checks passed or declare visual quality verified.

## 13. Definition of done and final report

The game is complete only when the full ten-decision story is playable, choices respond to earlier actions, the visible world records those actions, both major approaches finish, and the continuous final reveal makes their consequences readable.

Report:

- What was implemented or repaired, with paths to the key files.
- Exact setup and run commands.
- Production build and test results, distinguishing checks actually run from anything unavailable.
- Screenshot paths and what the two compared routes demonstrate.
- Any unresolved defects or verification limits.
- A concise asset replacement table with semantic keys, recommended dimensions, and anchors.

Do not call it complete while one of the five release blockers remains. Prioritize the connected story and final visual composition over additional systems or decorative features. **Implement the whole experience now.**
