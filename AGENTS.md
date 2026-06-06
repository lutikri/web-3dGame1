# Agent Instructions

This is a static Three.js browser project. The main entry point is `index.html`, which imports `src/OperatorGame.js` as an ES module through the import map.

## Local Server

- Use `npm run dev` from the repo root for local development.
- The dev server is `dev-server.cjs`; it serves static files on `http://localhost:5173/` and live-reloads browsers when files in `src/`, `styles/`, `assets/`, `index.html`, `README.md`, or `AGENTS.md` change.
- If port `5173` is busy, run with another port: `PORT=5174 npm run dev` on macOS/Linux or `$env:PORT=5174; npm run dev` in PowerShell.

## Project Layout

- `src/OperatorGame.js`: Three.js scene setup, panel loading, interaction, animation, post-processing, debug API.
- `src/OperatorGameConfig.js`: primary tuning surface for panel placement, lights, shadows, needle animation, and post-processing effects.
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

- `PLASMA TEMP`: large gauge, unit `MK`, range about `0-180 MK`. Normal burn should often live around `85-125 MK`, with quench risk below roughly `55 MK`, warning high around `140+ MK`, and critical around `160+ MK`.
- `CONTAINMENT` / `STABILITY`: large gauge, unit `%`, range `0-100%`. Higher is safer, but excessive magnetic field should reduce useful output efficiency.
- `POWER OUTPUT`: large gauge, unit `MW`, range about `0-1200 MW`. The ideal band should follow current grid demand, so max output is not always the best answer.

Player controls should stay limited and cause-based:

- `Fuel Injection`: increases power and heat, consumes fuel faster, and tends to reduce stability when field strength is insufficient.
- `Magnetic Field`: improves containment/stability, but consumes energy and can reduce net output efficiency when overused.
- `Coolant Flow`: lowers plasma temperature and slows heat-related stress, but too much cooling can quench the plasma and drop output.
- `Emergency Vent` / `Purge`: hold-style emergency action that quickly reduces temperature/pressure-like stress, pauses or heavily reduces production, and costs stability/resources. It should not become a periodic optimal button press.

Secondary meters and screen values should use engineering language:

- Prefer `CORE STRESS` over `Reactor Damage`. Treat it as accumulated thermal, vessel, and coil stress; failure occurs at the stress limit.
- Other useful secondary values: `Fuel Reserve`, `Heat Sink Capacity`, `Reaction Efficiency`, and `Grid Demand` / `Target Output`.
- Warning lamps: `TEMP HIGH`, `FIELD WEAK`, `OUTPUT LOW`, `INSTABILITY`, `QUENCH RISK`, `CORE STRESS`.

Operation phases should be called phases or burn phases, not batches:

- `FIELD PRECHARGE`: low power setup; raise field and avoid overfeeding fuel.
- `PLASMA IGNITION`: bring temp and output into working range without quenching.
- `STABLE BURN`: readable middle phase where the core feels controllable.
- `DEMAND SURGE`: grid asks for more output; fuel/cooling/field balance becomes tighter.
- `SUSTAINED HIGH LOAD`: final high-stress phase with heat sink and core stress pressure.

Small screens may show exact target bands, such as target plasma temp and grid demand, while warning/status text should describe symptoms rather than direct instructions.

## Verification

- After scene changes, reload `http://localhost:5173/` and check the browser console.
- The debug API is available as `window.operatorGameDebug`.
- Useful checks:
  - `window.operatorGameDebug.getState()`
  - `window.operatorGameDebug.setTestActive(true)`
  - `window.operatorGameDebug.setTestActive(false)`
