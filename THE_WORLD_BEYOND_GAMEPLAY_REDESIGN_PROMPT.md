# The World Beyond — Gameplay Redesign Prompt

Improve **The World Beyond** so it feels like a playable civilization-building game, with a clear objective, meaningful placement choices, visible consequences, and a striking contrast between the prosperous settlement and the damaged society beyond it.

Implement these changes in the existing project. Inspect the current code first, preserve the working Gemini integration, and test the finished experience.

## 1. Make the objective clear and separate from chat

Give the player a short, prominent objective panel outside the chat window.

Use concrete language such as:

- **House 4 families**
- **Connect homes to clean water**
- **Power the settlement**

Show progress numerically or visually: `Families housed: 2/4`.

Keep the main objective to one sentence. Put supporting details in optional tooltips or expandable text. Players should immediately understand what they are trying to achieve without reading a conversation.

Add lightweight game systems—resources, construction costs, population needs, and visible progress—where they create meaningful choices. Avoid unnecessary complexity.

## 2. Keep the environment visible

Redesign the layout so chat does not cover the playable environment.

On desktop, reserve a dedicated side panel for chat and resize the game canvas to the remaining space. Make chat collapsible. On smaller screens, use a collapsible drawer and adjust the camera’s usable area accordingly.

Keep objectives, resources, placement controls, and chat visually distinct. Important buildings and selected objects must remain visible while interacting.

## 3. Replace the linear sequence with player-directed building

Move away from a fixed sequence where every successful prompt advances to the next scripted action.

Use a town-building interaction model inspired by games such as Clash of Clans:

- Let players choose what to build and where to place it.
- Show a placement preview with valid and invalid locations.
- Support confirmation, cancellation, selection, and moving eligible buildings.
- Allow multiple ways to satisfy needs and objectives.
- Let players continue improving the settlement between objectives.

Keep conversation central: a prompt can propose a project or select a building type, and the player can choose its location directly in the world. Requests such as “build homes beside the river” should produce a sensible placement proposal that the player can adjust.

Use structured, validated actions and persistent building instances with coordinates. The simulation must enforce costs, collisions, terrain restrictions, and placement rules. Narrative milestones should respond to settlement conditions rather than merely count completed prompts.

## 4. Make every action visibly change the world

The environment must accurately reflect the action performed.

Examples:

- Building places the chosen structure at the confirmed location.
- Chopping removes specific trees and produces wood effects.
- Roads visibly connect the selected locations.
- Water infrastructure changes the relevant pipes, waterways, or service coverage.
- Repairs visibly improve damaged objects.
- Pollution and extraction change the affected landscape.

Use clear construction stages and completion feedback. Changes must persist after later actions, camera movement, and resizing. Avoid generic animations that imply a change without actually updating the environment.

## 5. Add much richer particles and ambient motion

Increase visual activity substantially, with distinct effects suited to each action and environment.

Include:

- Construction dust, debris, sparks, and completion effects.
- Wood chips, falling leaves, and stump debris when trees are cut.
- Water ripples, splashes, foam, and flowing highlights.
- Drifting clouds, mist, pollen, insects, and gentle vegetation movement.
- Industrial smoke, ash, polluted haze, and dirty runoff outside the settlement.

Effects should originate from the actual affected objects. Use layered foreground and background motion to give the world depth.

Pool particles, limit offscreen effects, and scale density to device performance. Respect reduced-motion preferences while preserving essential action feedback.

## 6. Strengthen the utopia-versus-wasteland contrast

Make the visual contrast unmistakable.

The central settlement should become a bright, attractive utopia through the player’s choices: warm sunlight, clean water, lush vegetation, inviting buildings, lively residents, and signs of prosperity.

The surrounding society should feel dark, oppressive, and damaged: deep reds, polluted greens, heavy clouds, industrial haze, scarred terrain, contaminated water, deteriorating homes, and struggling infrastructure.

Do more than apply a color filter. Change lighting, architecture, terrain, vegetation, water, particles, and human activity.

Connect this damage to the settlement’s development through visible causes such as extraction sites, freight routes, waste streams, and displaced resources. Player choices should affect the degree and type of damage. Preserve the reveal, but make its visual meaning immediately understandable without explanatory text.

## 7. Keep conversation brief and useful

CIVIC should normally reply in one or two short sentences.

After an action, explain what changed. When input is unclear, ask one focused question. Keep persistent objectives and progress in the HUD instead of repeating them in chat.

## 8. Give the player freedom within a story that converges to one ending

Use **We Become What We Behold** as a reference for the intended relationship between interaction and narrative: the player should feel actively involved in a game, while the experience ultimately converges to one authored ending.

Give players meaningful freedom over their settlement’s layout, construction order, priorities, and methods. These choices should produce different environments and immediate consequences, but all completed playthroughs must reach the same central reveal: the prosperous settlement exists within a damaged surrounding society, and its prosperity is connected to that damage.

Distinguish **freedom in how the player develops the settlement** from **control over the story’s final destination**.

- Make the journey flexible while keeping the ending fixed.
- Trigger narrative developments through broad settlement conditions, not a rigid sequence of prompts.
- Allow different buildings, layouts, and strategies to satisfy those conditions.
- Let choices affect the severity, location, and visible form of the surrounding damage. The final camera reveal should show the consequences of that particular playthrough.
- Make careful choices matter locally without creating an alternate “perfect” ending that removes the central contradiction.
- Ensure seemingly benign development still depends on understandable systems—materials, energy, transport, labor, or waste—that connect the settlement to the outside world.
- Avoid arbitrary punishment or secretly reversing the player’s achievements to force the ending. Establish the causal relationships throughout play so the reveal feels earned.
- Allow exploration and optional improvements, but provide clear goals that guide every completed run toward the ending.

The ending should deliver the same narrative realization across playthroughs, while the world it reveals is visibly shaped by the player’s decisions.

## Acceptance criteria

Verify that:

- A new player can identify the current goal within five seconds.
- Chat does not obscure playable space.
- Players can choose between multiple useful actions and placement locations.
- Different choices produce visibly different settlements.
- Every committed action changes the correct world objects.
- Invalid or cancelled placements consume no resources.
- Particle effects are varied, abundant, and performant.
- The final reveal clearly contrasts a bright settlement with a damaged surrounding society.
- The experience works across desktop and smaller screens.
- At least three substantially different playthroughs—with different layouts, construction orders, and development priorities—offer meaningful choices and produce distinct settlements while converging to the same final narrative reveal.

Test complete playthroughs through the actual UI, including placement, cancellation, alternate choices, and the final reveal. Fix problems found during testing. Report what changed, what was verified, and any remaining limitations.
