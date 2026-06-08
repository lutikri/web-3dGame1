# Agent Instructions

This is a static Three.js browser project. The main entry point is `index.html`, which imports `src/OperatorGame.js` as an ES module through the import map.

## Local Server

- Use `npm run dev` from the repo root for local development.
- The dev server is `dev-server.cjs`; it serves static files on `http://localhost:5173/` and live-reloads browsers when files in `src/`, `styles/`, `assets/`, `index.html`, `README.md`, or `AGENTS.md` change.
- If port `5173` is busy, run with another port: `PORT=5174 npm run dev` on macOS/Linux or `$env:PORT=5174; npm run dev` in PowerShell.

## Project Layout

- `src/OperatorGame.js`: Three.js scene setup, panel loading, interaction, animation, post-processing, debug API.
- `src/OperatorGameConfig.js`: primary tuning surface for panel placement, lights, shadows, needle animation, and post-processing effects.
- `src/FusionCoreSimulation.js`: core gameplay loop, phases, warning flags, and derived gauge values.
- `src/StatusScreen.js`: canvas-driven material for the small status display.
- `assets/`: runtime GLB and baked PBR textures.
- `styles/operator-game.css`: HUD/canvas styling.
- `legacy/`, `recordings/`, and `screenshots/` are supporting/generated material; avoid changing them unless the task calls for it.

## Scene Rules

- Keep general knobs in `src/OperatorGameConfig.js` rather than hardcoding tunable values in `OperatorGame.js`.
- `Panel1.glb` uses baked texture maps:
  - `T_Panel1_BaseColor.png`
  - `T_Panel1_Normal.png`
  - `T_Panel1_OcclusionRoughnessMetallic.png`
- Ordinary Panel1 meshes, buttons, and arrows should use the atlas-backed `Panel1_PBR` material path.
- Lamp lens meshes named like `LightCase1_Light_*` intentionally use runtime emissive materials so the test-button animation can switch them on/off.
- If AO maps are applied to GLB meshes, make sure `uv2` exists; copying `uv` to `uv2` is acceptable for this asset.

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

- After scene changes, reload `http://localhost:5173/` and check the browser console.
- The debug API is available as `window.operatorGameDebug`.
- Useful checks:
  - `window.operatorGameDebug.getState()`
  - `window.operatorGameDebug.startGame()`
  - `window.operatorGameDebug.resetGame()`
