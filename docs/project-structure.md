# OperatorGame Project Structure

This document describes the current browser/Three.js project structure. Older design notes may still be useful for game direction, but this file is the current code-architecture map.

## Core rule

Keep ownership explicit:

- `Registry` owns shared prefab defaults: asset path, material defaults, behavior type, physics defaults, interaction defaults, audio defaults.
- `Level config` owns placed instances: stable name, transform, startup state, and intentional per-instance overrides.
- `Runtime` owns cloned scene objects, active physics bodies, audio nodes, timers, and temporary state.
- `Debug UI` owns temporary edits and save/export commands. It should call runtime/config APIs, not become gameplay logic.

## Current player flow

The current design direction treats the game as assigned shifts inside one Terragen Systems facility.

First new-game flow:

```text
Elevator Arrival
  -> Facility Entrance
  -> Control Booth Tutorial / first qualification shift
  -> Shift Report + Operator Profile
  -> assigned shift route
```

Repeat shifts should start from the Facility Entrance or the selected shift start context, not replay the elevator every time.

Keep this as app/session flow:

- `AppShell` owns high-level routing, first-visit state, menus, route curtains, and briefings.
- `LevelRegistry` owns shift metadata, briefing sheets, playable state, and environment definitions.
- `LevelSession` owns objectives and shift outcome state.
- Level scripts/configs may describe local bindings and objectives, but should not become a one-off story monolith.

## Source layout

```text
src/
  app/                  App shell, menus, routing, briefings, localization, tutorial UI flow
  audio/                WebAudio runtime, sound registry, sound marker handling
  config/               Global config modules that are not level definitions
  game/                 Shift report / game-session support
  incidents/            Runtime fault/fuel systems
  interactions/         Reusable interaction systems such as physics doors
  levels/               Level registry, level configs, save/override schema
  lighting/             Shared lighting math and lighting runtime
  panels/               Operator panel binding/runtime code
  physics/              Rapier/character collision integration
  player/               Player controller
  postprocessing/       Post FX runtime wrapper
  prefabs/
    PrefabRegistry.js   Shared prefab definitions
    behaviors/          Shared prefab behavior modules
  runtime/              Level lifecycle, asset cache, smoke checks
  scene/                Scene builder, texture streaming, material/collision helpers
  ui/
    debug/              Debug hub and debug panels
    LoadingOverlay.js   Loading UI
```

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
