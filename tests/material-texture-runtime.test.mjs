import test from "node:test";
import assert from "node:assert/strict";
import { MaterialTextureRuntime } from "../src/materials/MaterialTextureRuntime.js";

test("material texture runtime loads initial maps and schedules full upgrades", async () => {
  const loadedPaths = [];
  const scheduled = [];
  const textureSets = new Map();
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
      loadTextureMaps: async (paths) => {
        loadedPaths.push(paths.baseColor);
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
});
