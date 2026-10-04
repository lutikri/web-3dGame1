import test from "node:test";
import assert from "node:assert/strict";
import { MaterialTextureRuntime } from "../src/materials/MaterialTextureRuntime.js";

test("material texture runtime loads initial maps and schedules full upgrades", async () => {
  const loadedPaths = [];
  const scheduled = [];
  const textureSets = new Map();
  const timingLabels = [];
  const materials = {
    panel: { userData: {} },
    interiorCustom: { wall: { userData: {} } },
  };
  const runtime = new MaterialTextureRuntime({
    config: {
      panel: { maps: { preview: { baseColor: "panel-preview" }, full: { baseColor: "panel-full" } } },
      interior: { specialMaterials: { wall: { maps: { baseColor: "wall" }, roomLightControlled: true } } },
    },
    textureStreaming: {
      loadTextureMaps: async (paths, options) => {
        loadedPaths.push(paths.baseColor);
        options.onBatchTiming?.({
          wallMs: 1,
          textureCount: 1,
          failedCount: 0,
          sumTextureMs: 1,
          slowestTextureMs: 1,
        });
        return { map: { source: { data: { src: paths.baseColor } } } };
      },
      disposeTextureMaps: () => {},
    },
    upgradeQueue: { schedule: (task) => scheduled.push(task) },
    loadingIndicator: { start: () => {}, complete: () => {} },
    textureSets,
    getMaterials: () => materials,
    applyCustomMaps: () => {},
    applyPanelMaps: () => {},
    syncMaterialClones: () => {},
    updateRoomLightMaterials: () => {},
    createFixtureFlickerState: () => ({ phase: "steady" }),
    setLoadingStatus: () => {},
    reportTextureTiming: (label) => timingLabels.push(label),
  });
  runtime.start();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(loadedPaths.sort(), ["panel-preview", "wall"]);
  assert.equal(runtime.panelMaps.map.source.data.src, "panel-preview");
  assert.equal(textureSets.get("panel:Panel1_PBR").tier, "preview");
  assert.equal(materials.interiorCustom.wall.userData.fixtureFlicker.phase, "steady");
  assert.equal(scheduled.length, 1);
  assert.deepEqual(timingLabels.sort(), ["material:wall:initial", "panel:initial"]);
});

test("full texture requests bypass a disabled queue and share upgrades with concurrent and queued requests", async () => {
  const loadedPaths = [];
  const disposed = [];
  const scheduled = [];
  const materials = { panel: { userData: {} }, interiorCustom: { wall: { userData: {} } } };
  const runtime = new MaterialTextureRuntime({
    config: {
      panel: { maps: { preview: { baseColor: "panel-preview" }, full: { baseColor: "panel-full" } } },
      interior: { specialMaterials: { wall: { maps: { preview: { baseColor: "wall-preview" }, full: { baseColor: "wall-full" } } } } },
    },
    textureStreaming: {
      loadTextureMaps: async (paths) => {
        loadedPaths.push(paths.baseColor);
        return { map: { source: { data: { src: paths.baseColor } } } };
      },
      disposeTextureMaps: (maps) => disposed.push(maps.map.source.data.src),
    },
    upgradeQueue: { schedule: (task) => scheduled.push(task) },
    loadingIndicator: { start() {}, complete() {} },
    textureSets: new Map(),
    getMaterials: () => materials,
    applyCustomMaps: (material, maps) => { material.map = maps.map; },
    applyPanelMaps: (material, maps) => { material.map = maps.map; },
    syncMaterialClones() {}, updateRoomLightMaterials() {}, setLoadingStatus() {},
  });
  runtime.start();
  await Promise.all([runtime.ensureFullResolution(), runtime.ensureFullResolution()]);
  assert.deepEqual(loadedPaths.sort(), ["panel-full", "panel-preview", "wall-full", "wall-preview"]);
  assert.deepEqual(disposed.sort(), ["panel-preview", "wall-preview"]);
  assert.equal(materials.panel.userData.textureTier, "full");
  assert.equal(materials.interiorCustom.wall.userData.textureTier, "full");
  for (const task of scheduled) await task();
  await runtime.ensureFullResolution();
  assert.equal(loadedPaths.length, 4);
  assert.equal(disposed.length, 2);
});
