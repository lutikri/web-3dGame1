# OperatorGame

Browser-based first-person operator game about running an old industrial fusion-core installation from a physical control room.

The player is not a builder, factory manager, or omniscient engineer. They are a shift operator: reading analog gauges, warning lamps, screen fragments, sound, light, and room behavior while trying to keep the core inside a working range under rising grid demand.

![Shift briefing and operator UI](assets/repo/showcase-game3.webp)

## Design direction

Canonical game documents now live in [`docs/game/`](docs/game/README.md). This README is an onboarding and development overview; it is not a second design authority.

OperatorGame is about causal, physical-feeling control.

The main panel exposes a small set of powerful inputs:

- `Fuel Injection` raises heat and output, consumes fuel, and can hurt stability if the field is weak.
- `Magnetic Field` improves containment, but costs energy and can reduce useful output when overused.
- `Coolant Flow` removes heat, but too much cooling can quench the plasma and collapse output.
- `Emergency Vent / Purge` is a held emergency action. It can save the shift, but it interrupts production and carries a cost.

The player follows changing `Grid Demand` while watching `Plasma Temp`, `Containment / Stability`, `Power Output`, `Core Stress`, warning lamps, sound, flicker, blackout behavior, and post-processing feedback.

High temperature is not automatically failure. Late burn phases are meant to push the operator near the dangerous band. The interesting play is not “keep everything low”; it is deciding how much risk the machinery can survive.

## First Qualification flow

The first playthrough is no longer just a menu into a tutorial room. It is the player's first arrival at the Terragen Systems facility.

### 0. Elevator Arrival

The first press of `PLAY` loads a separate old freight-elevator scene.

The elevator is already moving downward. The player can look around and learn basic movement, but cannot stop the descent. Outside the elevator, passing technical floors, cable runs, emergency lamps, bare rock, and sealed service platforms should sell the scale of the underground complex.

During the descent, the General Announcement System introduces Terragen Systems, implies that the player is a live-in operator candidate, and hints that automation and staffing have failed badly enough for this job to exist.

Tutorial beats:

1. `W A S D` — move.
2. `SPACE` — “say apple”.
3. After the elevator stops: `LMB` on the door handle.

After the handle interaction, the screen fades to black and the main facility loads behind the fade.

### 1. Facility Entrance

Repeat shifts start here; the elevator arrival is only for the first new game.

The player appears in a small entrance room in front of the closed elevator. The room contains a desk, the first qualification `Shift Brief`, a General Announcement System radio with a red signal lamp, Control Booth wayfinding, locked doors to restricted sectors, and a clearance sign.

The narrator asks the player to:

1. read the brief;
2. proceed to the Control Booth;
3. avoid areas outside the current qualification.

The brief and environment should point the player toward the Control Booth without a floating quest marker.

### 2. Control Booth Tutorial

The player enters the Control Booth and sees the FCU-16 operator panel.

Tutorial sequence:

1. Hover the panel.
2. Hold `RMB` to lean toward it.
3. Hover a control.
4. Use the mouse wheel to adjust it.
5. After the first adjustment, the operator thinks: “I think I need to start it.”
6. The player finds and presses `IGNITE` on their own.

The narrator explains the facility and the assignment, not exact reactor solutions.

The operator's thoughts describe observed symptoms:

- temperature too high;
- output too low;
- plasma extinguished;
- reaction recovered;
- shift complete;
- time to leave the booth.

### 3. Shift Outcomes

Success:

- the reactor enters a safe mode;
- the narrator confirms qualification;
- the exit door unlocks;
- the player turns the door handle;
- fade to `Shift Report`.

Emergency shutdown:

- total reactor destruction becomes an automatic safety trip;
- power output stops, the installation remains repairable;
- the narrator marks the qualification as failed, but allows a retry because there are not enough candidates;
- the player still exits through the same door.

Insufficient output:

- if the installation survives but the player consistently misses `Grid Demand`, the shift technically ends but qualification is not granted;
- the narrator says the equipment survived, but the required power was not produced.

### 4. Exit and Shift Menu

After the exit door interaction, the game shows:

1. `Shift Report`;
2. `Operator Profile`;
3. assigned shifts.

At first the shift list contains one available qualification shift and several empty slots. Later shifts begin from the Facility Entrance, not the elevator.

## Tutorial UX channels

- Subtitles are the operator’s thoughts and reactions. They should describe memory, symptoms, uncertainty, or stress, not give exact instructions.
- Tutorial hints are short system prompts. They appear as non-blocking bottom flyouts with keycaps and mouse icons.

The first qualification uses this split across elevator, entrance, and Control Booth:

1. `W A S D` to move.
2. `SPACE` to “say apple” / jump, followed by a short operator reaction.
3. `LMB` for handles / brief interaction.
4. `RMB` to lean toward the panel.
5. `Mouse Wheel` to adjust a highlighted control.
6. One short operator thought after the control lesson: “I think I need to start it.”

Localization rule: subtitles live under `subtitles.*`, tutorial hints live under `hints.*`, and every new key should exist in both English and Russian.

![Operator console and fusion core room](assets/repo/showcase-game1.webp)

## Shift route

The project should read as assigned shifts inside one facility, not disconnected arcade levels.

- `first-qualification` / `intro-shift` — first qualification run: arrival, entrance, brief, Control Booth tutorial, first shift.
- `unexpected-stuff` — instrument failure route: same panel, unreliable readings and symptoms.
- `cost-of-running` — fuel economy route: different blend behavior, efficiency/cost tradeoffs, unstable fuel delivery.
- `shift-coordination` — same console, clock-start shift and qualification as a panel operator.
- `exploring-around` — facility access opens: entrance, Control Booth, service corridor, staff room/locked sectors as walkaround content.
- Additional tests — optional panel-focused challenge shifts: broken lamp, low fuel, low heat sink, max load, emergency light, etc.
- Power Bus training — future switchgear / routing shift.
- Longer shifts — future 8–10 minute shifts with operator-condition effects.

After `shift-coordination`, the player is fictionally qualified as a panel operator. From there the game can either continue in the web prototype with facility rooms and effects, or keep the route as a design skeleton for a later Unreal version.

![Service corridor exploration](assets/repo/showcase-game2.webp)

## Current architecture

Current code structure is tracked in [docs/project-structure.md](docs/project-structure.md). Older design documents are treated as direction notes, not as exact implementation architecture.

### Level lifecycle

Levels are loaded exclusively. The runtime must not load every registered level and hide inactive ones.

On a major route change, the current level owns and then disposes:

- scene objects;
- lights;
- interactions;
- collision;
- Rapier bodies;
- level-specific runtime state.

### Runtime ownership

- `PrefabRegistry` owns reusable defaults.
- Level configs own instance placement and per-instance tuning.
- Runtime systems own cloned objects, physics bodies, audio nodes, timers, and temporary state.
- Debug UI goes through `src/ui/debug/DebugHub.js`; new debug tools should not be bolted directly onto gameplay code.

Shared source GLBs and textures may remain cached through `AssetCache`, but cloned instances and physics state belong to the active level only.

Relevant modules:

- `src/levels/LevelRegistry.js` — level metadata and runtime environment registration.
- `src/runtime/LevelRuntimeManager.js` — atomic level transitions; latest request wins.
- `src/runtime/LevelRuntime.js` — idempotent disposal of level-owned resources.
- `src/runtime/AssetCache.js` — cached source assets and isolated cloned instances.
- `src/runtime/RuntimeSmoke.js` — automated lifecycle smoke test.
- `src/scene/LevelSceneBuilder.js` — architecture, collision, prefab markers, and prefab instances.

### Prefabs and marker placement

Reusable objects such as lamps, doors, panels, pumps, and control cabinets are prefabs. Shared behavior belongs in `src/prefabs/PrefabRegistry.js`, not in individual level configs.

A level may place a prefab manually in config:

```js
createPrefabInstance("fluorescentLamp", {
  name: "Lamp1_TutorialCabin",
  position: [3.6861, 1.49811, 2.39028],
});
```

Or with an Empty marker inside a Blender environment GLB:

```text
PF_fluorescentLamp_PowerHall1
PF_redBulkLamp_PowerHall1
PF_bulkheadDoor_C
```

Marker format:

```text
PF_<prefabType>_<instanceName>
```

Rules:

- `prefabType` must exist in `PrefabRegistry`.
- The marker must be an Empty object, not a render mesh.
- The runtime instance name becomes `<prefabType>_<instanceName>`.
- Manual prefabs with the same stable name override marker placement.
- Saved level overrides merge by stable prefab `name`.
- Registry-owned fields such as asset paths, material algorithms, physics algorithms, flicker behavior, and interaction logic must not be saved into level overrides.

### Level sessions

`src/levels/LevelSession.js` owns level objectives, bindings, events, and checkpoint data for the current shift.

Level-specific behavior should be expressed through session config and events where possible. For example:

- tutorial completion can require time survived plus opening a door;
- a room button can target a specific prefab lamp;
- future service-room tasks can listen for power, breaker, pump, or door events.

A level is allowed to have no `Panel1`; if no prefab with `behavior: "operatorPanel"` exists, the shared panel is hidden.

### UI and tutorial modules

- `src/app/AppShell.js` — high-level app shell: menu, settings, route transitions, briefings, pause, and progress.
- `src/app/BriefingUiConfig.js` — briefing zoom / inspect / vignette tuning.
- `src/app/SubtitleQueue.js` — operator thought subtitle queue.
- `src/app/TutorialHintQueue.js` — visual hint rendering with keycaps and mouse icons.
- `src/app/IntroTutorialFlow.js` — intro tutorial step machine and tutorial subtitle timing.
- `src/app/Localization.js` — English/Russian UI strings, control labels, subtitles, and hints.

Briefings are level-driven through `src/levels/LevelRegistry.js`. While a briefing is visible, gameplay input is locked. After the final sheet is dismissed, tutorial hints become non-blocking.

## Runtime modules

- `src/lighting/LightingRuntime.js` — level-owned ambient and point lights.
- `src/interactions/DoorInteractionSystem.js` — shared physical door interaction.
- `src/player/PlayerController.js` — movement, collision, step handling, jump, and debug collision display.
- `src/postprocessing/PostProcessingRuntime.js` — post-processing lifecycle.
- `src/panels/OperatorPanelRuntime.js` — operator panel lifecycle and visibility.
- `src/physics/PhysicsSystem.js` — Rapier physics, static collision, character controller, and physical doors.
- `src/scene/TextureStreaming.js` — staged texture loading to reduce first-load stalls.

## Development

Install dependencies:

```text
npm install
```

Run the local server:

```text
npm run dev
```

Open:

```text
http://localhost:5173/
```

If port `5173` is busy:

```powershell
$env:PORT=5174; npm run dev
```

Fast validation:

```text
npm run check
```

### Dev console commands

The app installs a small browser-console helper for route/progress testing:

```js
og("complete intro-shift")
og("complete unexpected-stuff")
og("complete fuel-problems")
og("goto intro-shift")
og("goto fuel-problems")
og("reset progress")
og("progress")
og("levels")
```

Equivalent method form:

```js
og.complete("intro-shift")
og.goto("unexpected-stuff")
og.resetProgress()
```

Direct aliases are also available:

```js
completeLevel("intro-shift")
attemptLevel("shift-coordination")
clearLevelProgress("fuel-problems")
gotoLevel("exploring-around")
resetProgress()
```

`goto` / `gotoLevel` bypass route unlocks, but still require the target level to be playable.

Runtime lifecycle smoke test:

```text
http://localhost:5173/?runtimeSmoke=1
```

Expected browser console result:

```text
[RuntimeSmoke] PASS
```

Manual playtesting is still needed for subjective behavior: door feel, lamp flicker, lighting mood, collision comfort, tutorial pacing, and presentation timing.

## Assets

- `assets/` contains runtime assets only: GLB, compressed textures, briefings, UI images, and lightweight README showcase WebP files.
- `source-assets/` contains source art, editable production files, and original heavy files. It is gitignored except for its README.
- `assets/repo/*.webp` are compressed showcase images for this README.
- Original showcase PNGs live in `source-assets/reference/showcase/`.

After changing runtime texture sources, run:

```text
generate-runtime-textures.bat
```

Generated preview and full KTX2 textures are written to:

```text
assets/runtime-textures/
```

## Deployment notes

This project is currently a static ES-module app. GitHub Pages can cache individual modules aggressively, so after JavaScript module changes run:

```text
npm run stamp-modules -- <revision>
```

Then run:

```text
npm run check
```

The stamp step updates relative module URLs such as `?v=<revision>` to avoid mixed old/new module graphs on Pages.

The Pages artifact should stay lean. Keep source PNGs, PSDs, recordings, screenshots, and deprecated content outside runtime `assets/` or under ignored source directories.

## Design document

See [`docs/game/README.md`](docs/game/README.md) for the current design index, canonical fusion-core rules, future-system integration audit, and the archived Unreal-oriented architecture draft.

The living Russian design document is [`docs/game/game-design-ru.md`](docs/game/game-design-ru.md).
