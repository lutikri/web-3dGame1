# Agent Instructions

This is a static Three.js browser project. The main entry point is `index.html`, which imports `src/OperatorGame.js` as an ES module through the import map.

## Project Layout

- `docs/project-structure.md`: current code-architecture map. Prefer this over older broad design drafts when deciding where code belongs.
- `src/OperatorGame.js`: Three.js runtime orchestration, scene setup glue, animation loop, debug API. Keep moving reusable systems out of this file.
- `src/OperatorGameConfig.js`: primary tuning surface for panel placement, lights, shadows, needle animation, and post-processing effects.
- `src/FusionCoreSimulation.js`: core gameplay loop, phases, warning flags, and derived gauge values.
- `src/StatusScreen.js`: canvas-driven material for the small status display.
- `src/app/AppShell.js`: app/menu shell, route transitions, settings, progress routing, and level briefing overlay behavior.
- `src/audio/AudioRuntime.js` and `src/audio/SoundRegistry.js`: WebAudio runtime and runtime sound registry. Runtime audio is `.ogg` under `assets/sounds/<category>/`.
- `src/levels/LevelRegistry.js`: single registration point for level metadata, briefing sheets, playability, and runtime environment.
- `src/prefabs/PrefabRegistry.js`: shared prefab asset, material, interaction, physics, light, and behavior defaults.
- `src/prefabs/behaviors/`: shared prefab behavior modules. Add reusable object behavior here before adding local level/game code.
- `src/levels/LevelExploringAroundConfig.js`: instance layout and intentional per-level overrides for the Exploring Around environment.
- `src/levels/LevelIntroShiftConfig.js`: tutorial environment layout, collision filtering, fog, lights, fan behavior, and prefab instances.
- `src/app/BriefingUiConfig.js`: small UI-only tuning surface for level briefing sheet zoom, pan, and vignette behavior.
- `src/ui/debug/DebugHub.js`: single entry point for debug panels. Do not add new always-visible debug GUI directly from gameplay code.
- `src/ui/debug/panels/`: existing lil-gui debug panels, gradually moving toward workspace-style tools.
- `assets/`: runtime GLB and baked PBR textures.
- `source-assets/`: ignored editable source assets and tool exports. Runtime code must not load from this directory.
- `styles/operator-game.css`: HUD/canvas styling.
- `legacy/`, `recordings/`, and `screenshots/` are supporting/generated material; avoid changing them unless the task calls for it.

## App Shell / Loading Flow

- Keep boot asset loading and route transitions logically separate. The user may see the same loading visual language, but boot loading should not become the menu/router state machine.
- `AppShell` owns high-level app panels: main menu, level select, profile, settings, pause, route loading, and briefing sheets.
- Internal menu navigation, such as settings/back/profile/level-select, should switch panels directly without route loading.
- Use route loading only for major context changes, such as menu to level, pause/results to main menu, or restart. Route transitions should hide UI changes behind a black/loading sequence so loading panels and target menus are not visible at the same time.
- The main menu uses `gameApi.resetForMenu()` and the menu camera view configured in `CONFIG.camera.menuView`; level sessions use `gameApi.startLevel()` / `restartGame()`.
- First-time players should eventually enter the one-time `Elevator Arrival` scene, then `Facility Entrance`, then the first qualification shift. Returning players start from the main menu / Facility Entrance route depending on progress. Until the elevator scene exists in code, `intro-shift` remains the practical first qualification route. `CONFIG.app.firstVisitEmulation` should usually stay `false` except for testing.

## Level Briefings

- Level briefing sheets are level-driven. Add or change `briefingImage` on the level definition in `src/levels/LevelRegistry.js`, for example `assets/ui/briefings/Intro1-us.png`.
- Briefing sheets are shown by `AppShell` after level start, before player control is released.
- While a briefing is visible, gameplay input is locked through `gameApi.setInputLocked(true)`: no pointer lock, WASD, pause, panel clicks, zoom, or held controls should pass through.
- Pressing `Enter` dismisses the sheet. The sheet animates downward and then hides; after dismissal, input unlocks.
- The briefing inspect/reading behavior is tuned in `src/app/BriefingUiConfig.js`, not in `OperatorGameConfig.js`.
- The briefing vignette should be a fullscreen UI overlay in front of the scene, not a 3D/post-process effect and not a blend-mode artifact.

## Scene Rules

- Keep general knobs in `src/OperatorGameConfig.js` rather than hardcoding tunable values in `OperatorGame.js`.
- Keep reusable behavior in the appropriate runtime module instead of expanding `OperatorGame.js`: prefab behavior in `src/prefabs/behaviors/`, audio in `src/audio/`, lighting math in `src/lighting/`, debug UI in `src/ui/debug/`.
- `assets/mesh/panel/SM_Panel1.glb` uses baked texture maps:
  - `T_Panel1_BaseColor.png`
  - `T_Panel1_Normal.png`
  - `T_Panel1_OcclusionRoughnessMetallic.png`
- Ordinary Panel1 meshes, buttons, and arrows should use the atlas-backed `Panel1_PBR` material path.
- Lamp lens meshes named like `LightCase1_Light_*` intentionally use runtime emissive materials so the test-button animation can switch them on/off.
- If AO maps are applied to GLB meshes, make sure `uv2` exists; copying `uv` to `uv2` is acceptable for this asset.

## Prefabs And Level Instances

- Level runtime loading must be exclusive, not eager: only the menu-preview/active environment may own scene objects, lights, interactions, collision, and Rapier bodies. Never load every registered level and hide inactive ones.
- On a major route change, await unloading the previous environment and loading the target environment while the route curtain is opaque. Shared source GLBs/textures may remain cached, but cloned level instances and physics state must be destroyed.
- If a proposed shortcut contradicts stated loading, memory, scaling, or level-isolation goals, explicitly surface the compromise to the user before implementing it. Do not silently preserve an incompatible legacy lifecycle.
- Register a level once in `src/levels/LevelRegistry.js`. The same definition supplies AppShell metadata and the runtime environment.
- A level environment owns architecture/collision assets, player spawn, ambient lighting, panel placement, and named prefab instances.
- Define reusable prefab defaults once in `src/prefabs/PrefabRegistry.js`. Instantiate them in a level with `createPrefabInstance(type, { name, position, rotation, overrides })`.
- Blender environment GLBs may place prefab instances with Empty markers named `PF_<prefabType>_<instanceName>`. The type must exist in `PrefabRegistry`; the runtime instance name becomes `<prefabType>_<instanceName>`. Marker transforms come from the GLB, while manually configured prefabs remain supported and take precedence when they use the same stable name.
- Prefab markers must be Empty objects, not render meshes. Unknown types, malformed names, and duplicate stable names are load errors rather than silently ignored content.
- Reusable objects such as lamps, doors, pumps, and control cabinets are prefabs. Their behavior must have one shared implementation, not separate approximations per level.
- Level configs describe prefab instances: stable name, transform, startup state, and intentional per-instance overrides. They must not duplicate assets, materials, animation, flicker, interaction, collision, or physics algorithms.
- Every prefab instance name must be unique within its level. Registry validation should fail immediately for malformed instances; AppShell validation should report levels missing from the menu.
- Levels that reuse an environment, such as `freeplay`, must use `environmentId` aliases so assets, physics, lights, and debug controls are not loaded twice.
- Embedded environment behaviors such as fans belong under `environment.behaviors`; shared placed objects such as panels, doors, and lamps belong in `PrefabRegistry`.
- When a new level needs behavior already present elsewhere, extract or reuse the existing behavior before adding level-specific code. A similarly looking second implementation is not acceptable.
- Fluorescent startup, normal fixture flicker, and faulty-starter behavior are shared lighting behaviors. Prefab options select those behaviors; they do not reimplement them.
- Narrator radios use the shared `radio` prefab and `NarratorRadioBehavior`. Blender Empty markers should be named like `PF_radio_ControlBooth1`.
- Fluorescent prefab lights must also participate in global startup/terminal blackout factors and own their configurable phosphor afterglow; migrating a lamp to a prefab must not bypass scene feedback.
- Prefer adding reusable prefab capabilities first, then expose instance parameters in the level config and `LEVEL PREFABS` debug panel.
- Saved level overrides must merge prefab arrays by stable prefab `name`, preserving newly added default fields and allowing old saved configs to migrate safely.
- Saved prefab instances must not override registry-owned asset, material, behavior, type, or interaction defaults. Level saves may override placement, light tuning, startup state, and other explicitly instance-owned values.
- The debug `SAVE LEVEL` action saves the active environment together with global material tuning. Editable positions and prefab light offsets should provide an `EDIT` viewport transform gizmo and stay synchronized with their numeric controls.
- The current tutorial room predates the prefab-instance pipeline. Migrate it to the shared prefab system when that scene is next reworked; do not use its legacy structure as justification for duplicating behavior in new levels.

## Fusion Core Scene Direction

This scene is moving toward a first-person Fusion Core operator game, not a refinery sim or literal nuclear reactor sim. Keep the player-facing language industrial, believable, and instrument-like rather than arcade.

Main panel gauges:

- `PLASMA TEMP`: large gauge, unit `MK`, range about `0-180 MK`. Early phases can run safely lower, but late high-output play should deliberately push hotter. Warning high starts around `140+ MK`, critical behavior starts around `155+ MK`, and deep red/near-end gauge readings should feel dangerous.
- `CONTAINMENT` / `STABILITY`: large gauge, unit `%`, range `0-100%`. Higher is safer, but excessive magnetic field should reduce useful output efficiency.
- `POWER OUTPUT`: large gauge, unit `MW`, range about `0-1200 MW`. The ideal band should follow current grid demand, so max output is not always the best answer.

Player controls should stay limited and cause-based:

- `Fuel Injection`: increases power and heat, consumes fuel faster, and tends to reduce stability when field strength is insufficient.
- `Magnetic Field`: improves containment/stability, but consumes energy and can reduce net output efficiency when overused.
- `Coolant Flow`: lowers plasma temperature and slows heat-related stress, but too much cooling can quench the plasma and drop output. It should not instantly erase a hot core state.
- `Emergency Vent` / `Purge`: hold-style emergency action that quickly reduces temperature/pressure-like stress, pauses or heavily reduces production, and costs stability/resources. It should be useful as short emergency pulses, not a periodic optimal button press.

Thermal/gameplay behavior:

- Hot late-game operation is intentional: safe low temperatures should be stable but often unable to meet final demand. The high-output sweet spot should sit closer to roughly `150-170 MK`, with meaningful risk.
- `thermalSoak` represents accumulated heat in the core/structure. It should make cooling less instant, feed `CORE STRESS`, and create a sense that overheated machinery stays dangerous for a while.
- Turning fuel down should reduce heating, but should not immediately drop plasma temperature. Cooling rate should depend on coolant, vent, heat sink capacity, and thermal soak.
- `outputSurge` represents unstable bus output when temperature is deep in the red or containment is weak. In that state output may fluctuate, warning lamps may blink, and post-processing/camera feedback can intensify.
- `CORE STRESS` should build non-linearly: mild high temperature can be survivable, while deep red temperature, heat soak, poor containment, and emergency vent stress should escalate quickly.

Secondary meters and screen values should use engineering language:

- Prefer `CORE STRESS` over `Reactor Damage`. Treat it as accumulated thermal, vessel, and coil stress; failure occurs at the stress limit.
- Other useful secondary values: `Fuel Reserve`, `Heat Sink Capacity`, `Reaction Efficiency`, and `Grid Demand` / `Target Output`.
- Warning lamps: `TEMP HIGH`, `FIELD WEAK`, `OUTPUT LOW`, `INSTABILITY`, `QUENCH RISK`, `CORE STRESS`.
- Current Panel1 warning/indicator lamp mesh names include:
  - `LightCase1_Light_UnderDemand`: yellow when output is slightly below demand, red when far below demand.
  - `LightCase1_Light_OverDemand`: yellow when output is slightly above demand, red when far above demand. Over-demand should add thermal load so max output is not free.
  - `LightCase1_Light_ReactionEfficiency`: green for good efficiency, yellow for mediocre, red for bad, blinking red for very bad.
  - `LightCase1_Light_FuelQuality`: green for now; future fuel quality mechanic can drive it.
  - `LightCase1_Light_COREDAMAGE`, `LightCase1_Light_QUENCHRISK`, `LightCase1_Light_INSTABILITY`, `LightCase1_Light_FIELDWEAK`, `LightCase1_Light_TEMPHIGH`: keep as direct warning lamps.
- Current Panel1 control button mesh names are `Control_Btn_Start`, `Control_Btn_Reset`, `Control_Btn_Test`, and `Control_Btn_Vent`. `Control_Btn_Test` is an indicator test, not the gameplay start button.
- Startup feedback should feel like a diagnostic sequence, not random noise: lamps show red, then yellow, then green, then two short green blinks before returning to real status.
- In thermal emergency states, fast-blink relevant warning lamps (`TEMP HIGH`, `INSTABILITY`, `CORE STRESS`), add stronger needle jitter, and allow subtle camera shake plus bloom/chromatic aberration boost. Avoid making normal under-demand shake the camera.

Operation phases should be called phases or burn phases, not batches:

- `FIELD PRECHARGE`: low power setup; raise field and avoid overfeeding fuel.
- `PLASMA IGNITION`: bring temp and output into working range without quenching.
- `STABLE BURN`: readable middle phase where the core feels controllable.
- `DEMAND SURGE`: grid asks for more output; fuel/cooling/field balance becomes tighter.
- `SUSTAINED HIGH LOAD`: final high-stress phase with heat sink and core stress pressure.

Small screens may show exact target bands, such as target plasma temp and grid demand, while warning/status text should describe symptoms rather than direct instructions.

Shift result/operator profile behavior:

- The shift recorder should classify behavior from current mechanics, not obsolete refinery-style metrics.
- Do not classify normal late-game hot operation as `REDLINE PHILOSOPHER` merely because temperature was above `140 MK`; reserve it for real heat soak, very high temperatures, or repeated dangerous redline behavior.
- `NERVOUS PURGE TECH` should be reachable through multiple short vent pulses, not only by holding vent for a large percentage of the shift.
- Useful behavior metrics include average demand error, average efficiency, average output/temp, over/under-demand time, critical-temperature time, thermal-soak time, output-surge time, core-stress time, quench time, instability time, vent hold time, vent activations, knob movement, and average fuel/field/coolant settings.
- Current operator profile names include `CONTAINMENT POSTMORTEM`, `NERVOUS PURGE TECH`, `FIELD PHYSICIST`, `HIGH LOAD SPECIALIST`, `REDLINE PHILOSOPHER`, `BUS SURGE CONDUCTOR`, `GRID OVERFEEDER`, `FUEL INTO NOISE`, `MAGNETIC ACCOUNTANT`, `HEAT SINK GAMBLER`, `COOLANT INTERN`, `UNDERPOWERED OPTIMIST`, `WHY IS THIS LAMP BLINKING`, `CONTROL ROOM STATUE`, `EDGE WALKER`, `UNSCHEDULED EXPERIMENT`, `SHIFT OPERATOR`, `PEAK OUTPUT TOURIST`, `REACTION POET`, and `PANEL APPRENTICE`.

## Verification

- Run `npm run check` first. It performs syntax validation and fast unit/contract tests without opening a browser.
- After JavaScript/module path changes, run `npm run stamp-modules -- <short-revision-name>` and then `npm run check` again so browser/GitHub Pages cache does not serve stale modules.
- For level lifecycle changes, open `http://localhost:5173/?runtimeSmoke=1`. The page automatically runs `intro-shift -> exploring-around -> menu preview` and logs `[RuntimeSmoke] PASS` or a precise ownership failure; do not manually click through menus for this check.
- Reserve manual playtesting for visual and subjective behavior such as door feel, lamp flicker quality, lighting, collision comfort, and presentation timing.
- After scene changes, reload `http://localhost:5173/` and check the browser console.
- The debug API is available as `window.operatorGameDebug`.
- Useful checks:
  - `window.operatorGameDebug.getState()`
  - `window.operatorGameDebug.startGame()`
  - `window.operatorGameDebug.resetGame()`
  - `og("complete intro-shift")`
  - `og("goto fuel-problems")`
  - `og("reset progress")`
