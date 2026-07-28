# OperatorGame Project Structure

This document describes the current browser/Three.js project structure. Older design notes may still be useful for game direction, but this file is the current code-architecture map.

Game design documents are centralized under `docs/game/`. Their source priority is defined in `docs/game/README.md`.

## Core rule

Keep ownership explicit:

- `Registry` owns shared prefab defaults: asset path, material defaults, behavior type, physics defaults, interaction defaults, audio defaults.
- `Level config` owns placed instances: stable name, transform, startup state, and intentional per-instance overrides.
- `Runtime` owns cloned scene objects, active physics bodies, audio nodes, timers, and temporary state.
- `Debug UI` owns temporary edits and save/export commands. It should call runtime/config APIs, not become gameplay logic.

## Current player flow

The current browser flow is:

```text
First site visit:
Setup Wizard
  -> Main Menu
  -> Assigned Shifts
  -> selected shift loading
  -> Entrance Corridor
  -> Entrance Area
  -> Control Booth
  -> physical return to the entrance
  -> Shift Report
  -> Assigned Shifts
```

Repeat visits skip Setup Wizard unless settings are reset.

The personnel elevator is an implied off-screen transition and does not own an active environment. If `intro-elevator` remains registered temporarily, it is deprecated/non-playable and is not part of the canonical route.

Responsibilities:

- `AppShell` composes the application flow and input locking.
- Setup/persistence modules own first-run setup completion, language, graphics, and gamma.
- `AppRouter` owns Main Menu, Assigned Shifts, loading, gameplay, and Shift Report transitions.
- `LevelRegistry` owns shift metadata, assignment state, briefing assets, playability, and environment selection.
- `LevelSession` owns shift objectives and terminal outcome state.
- The active environment owns Entrance Corridor, Entrance Area, Control Booth, interactions, lights, audio, physics, and disposal.
- Successful qualification unlocks the two following assigned shifts.
- Failed qualification returns to the same assigned qualification shift.

## Source layout

```text
src/
  app/                  App composition, routing, persistence, panel modules, briefings, localization, tutorial UI flow
  audio/                WebAudio, scene mix policy, narration, level sound catalog, registry and marker handling
  config/               Global config modules that are not level definitions
  game/                 Shift start/reset lifecycle, report, completion flow and operator-thought policy
  incidents/            Runtime fault/fuel systems
  interactions/         Hover/raycast targeting, door state plus latch/drag handling, and bulkhead exit flow
  levels/               Level registry/configs, active session ownership, objectives and save/override schema
  lighting/             Shared lighting math and lighting runtime
  materials/            Material construction, runtime clone synchronization, texture ownership and mask overlays
  panels/               Operator panel asset lifecycle, binding, simulation and presentation runtime code
  physics/              Rapier/character collision integration
  player/               Movement, input, view transitions, collision resolution and collision-debug presentation
  postprocessing/       Post FX runtimes, quality ownership, live uniform policy and presets
  prefabs/
    PrefabRegistry.js   Shared prefab definitions
    LevelPrefabConfigRuntime.js Applies editable instance transforms, state, physics and light config
    LevelPrefabUpdateRuntime.js  Per-frame light/clock/elevator/placed-behavior updates
    behaviors/          Shared prefab behavior modules
  runtime/              Level lifecycle/route coordination, static-physics composition, animation scheduling, public API and smoke checks
  scene/                Scene builder, texture streaming, material/collision helpers and GLB object-role registration
  ui/
    debug/              Debug-tools composition, hub, panels, snapshots, performance/memory/overlay presentation
    LoadingOverlay.js   Loading DOM presentation
    LoadingCoordinator.js Boot/route loading state and completion events
```

Debug-only performance sampling, runtime memory estimates, scene inspection, and transform-gizmo lifecycle live under `src/ui/debug/`; the game composition root only exposes adapters to them through `window.operatorGameDebug`.

## Composition root boundary

`src/OperatorGame.js` is the browser runtime composition root. It may:

- create Three.js primitives and long-lived runtime services;
- pass collections, state getters, commands, and event callbacks between services;
- declare the ordered frame phases consumed by `AnimationLoop`;
- install the validated public API and start the application.

It must not own reusable update algorithms, UI state machines, gameplay classification, prefab behavior, audio mixing policy, loading lifecycle, or debug formatting. Those belong to their target modules. Small adapters that translate one runtime contract into another are expected in the root.

`AppShell` follows the same rule at the application layer:

- `AppRouter` owns major route transitions and the opaque route curtain;
- `AppPersistence` owns settings/progress storage and normalization;
- `AppPanelController` owns panel visibility and internal menu navigation;
- modules under `src/app/panels/` own panel-specific rendering and actions;
- `AppShell` composes these pieces and coordinates gameplay input locking.

## Prefab behavior modules

Reusable prefab behavior belongs under `src/prefabs/behaviors/`.

Current examples:

- `AnalogClockBehavior.js` — clock hand runtime.
- `NarratorRadioBehavior.js` — radio lamp blinking / speech state.
- `DoorLatchBehavior.js` — latch-handle motion math.

If a new level needs the same behavior as an existing object, extract or reuse a behavior module before adding another local implementation.

## Debug UI direction

Debug UI is routed through `src/ui/debug/DebugHub.js`.

The hub is the only thing `OperatorGame.js` should talk to for debug panels. Existing lil-gui panels live under `src/ui/debug/panels/` and should gradually become workspaces:

- Game / player
- Level / prefabs
- Materials
- Lighting
- Audio
- Post FX

Avoid adding another always-visible floating panel directly from gameplay code.

## Source assets vs runtime assets

- `source-assets/` contains editable or heavy source material: Blender, FBX, Substance, PSD, source textures, raw audio, bake files, and references.
- `assets/` contains runtime assets shipped to the browser.
- Use `generate-runtime-textures.bat` for texture compression.
- Use `convert-runtime-audio.bat` for WAV to Ogg conversion.

Do not reference `source-assets/` from game runtime code.

Recommended asset flow:

```text
source-assets/scenes/blender/    Blender source scenes
source-assets/models/fbx/        source mesh exports
source-assets/substance/         Substance Painter projects
source-assets/textures/*.png     exported source texture sets
source-assets/audio/*.wav        exported source voice/sfx
assets/mesh/environment/*.glb    runtime level architecture
assets/mesh/panel/*.glb          runtime operator panels
assets/mesh/prefabs/*.glb        runtime reusable prefabs
assets/runtime-textures/*.ktx2   runtime compressed textures
assets/sounds/<category>/*.ogg   runtime audio
```

Runtime audio categories:

```text
assets/sounds/ambience/
assets/sounds/interaction/
assets/sounds/machinery/
assets/sounds/narration/
assets/sounds/player/
assets/sounds/ui/
```

Original imported MP3 files should live under `source-assets/audio/imported-mp3/`, not in runtime `assets/sounds/`.

## Blender marker conventions

Prefab Empty markers:

```text
PF_<prefabType>_<instanceName>
```

Examples:

```text
PF_radio_ControlBooth1
PF_fluorescentLamp_PowerHall1
PF_serviceDoor_Exit2
```

Sound volume markers:

```text
SNDVOL_<soundKey>_<instanceName>
```

Lighting zone volume meshes:

```text
LZONE_<stableZoneName>
```

Export each zone as a closed mesh covering one authored lighting area. The runtime hides these meshes, selects the smallest zone containing the player, keeps fixture lights in the active zone, and prelights directly adjacent zones with simple point lights. Zone names must be unique and must not rely on Blender numeric suffixes such as `.001`.

Malformed markers, unknown prefab types, and duplicate stable names should fail loudly.

## Verification

Use this order for code changes:

```bash
npm run check
npm run stamp-modules -- <short-revision-name>
npm run check
```

For lifecycle changes, also run the browser smoke route:

```text
http://localhost:5173/?runtimeSmoke=1
```
