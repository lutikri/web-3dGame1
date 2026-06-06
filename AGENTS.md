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

## Verification

- After scene changes, reload `http://localhost:5173/` and check the browser console.
- The debug API is available as `window.operatorGameDebug`.
- Useful checks:
  - `window.operatorGameDebug.getState()`
  - `window.operatorGameDebug.setTestActive(true)`
  - `window.operatorGameDebug.setTestActive(false)`
