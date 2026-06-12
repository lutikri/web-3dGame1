# OperatorGame

Main page:

- `index.html`

Run locally with live reload:

- `npm run dev`
- Open `http://localhost:5173/`

Main runtime files:

- `index.html`
- `src/OperatorGame.js`
- `src/OperatorGameConfig.js`
- `styles/operator-game.css`
- `assets/Panel1.glb`
- `assets/runtime-textures/T_Panel1_*_Preview_1024_ETC1S.ktx2`
- `assets/runtime-textures/T_Panel1_*_Full_ETC1S.ktx2`

Runtime folders should stay small and browser-facing:

- `src/`: game code
- `styles/`: browser styling
- `assets/`: compressed runtime assets loaded by the game

Development/support material is kept outside the runtime path:

- `3dGameAssetsDev/`: ignored source art, Blender/Substance files, and original texture PNGs
- `tools/`: tracked helper scripts
- `recordings/`: generated gameplay captures
- `screenshots/`: generated visual checks
- `logs/`: local dev-server output

Legacy prototype:

- `legacy/refinery/index.html`

Generated artifacts:

- `recordings/`
- `screenshots/`

## Texture Compression

Runtime texture PNG sources live in `assets/`.

Run this after changing those source textures:

- `generate-runtime-textures.bat`

The script uses `basisu` to write preview and full KTX2 textures into `assets/runtime-textures/`.

## Scene Knobs

Panel placement, room size, player height, colors, and lighting live in `src/OperatorGameConfig.js`.

Useful entries:

- `CONFIG.panel.position`
- `CONFIG.panel.rotation`
- `CONFIG.panel.width`
- `CONFIG.lighting.sunPosition`
- `CONFIG.lighting.sunIntensity`
- `CONFIG.lighting.panelFillPosition`
- `CONFIG.lighting.panelFillIntensity`

## Three.js Lighting Notes

Common light types:

- `AmbientLight`: flat global light. Easy, but no direction or shape.
- `HemisphereLight`: sky/ground ambient. Good baseline for rooms.
- `DirectionalLight`: sun-like light. Best general shadow caster.
- `PointLight`: bulb-like local light.
- `SpotLight`: cone light, useful for lamps and focused fixtures.
- `RectAreaLight`: soft rectangular panel light. Good for screens/ceiling panels, but does not cast shadows in the usual realtime shadow-map path.

Shadows:

- Enable with `renderer.shadowMap.enabled = true`.
- Set `light.castShadow = true`.
- Set meshes with `mesh.castShadow = true` and/or `mesh.receiveShadow = true`.
- Directional and spot lights are the most common shadow lights.

Ambient occlusion:

- Baked AO: put an AO map in the GLB material, usually the best hard-surface option.
- SSAO/GTAO: post-processing pass, useful later but heavier and more setup.
- Geometry/light placement: bevels plus shadowed creases often do more than screen AO early on.
