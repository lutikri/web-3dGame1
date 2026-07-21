import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { InteriorMaterialRuntime } from "../src/materials/InteriorMaterialRuntime.js";

test("interior material runtime synchronizes registered prefab material clones", () => {
  const material = new THREE.MeshStandardMaterial();
  const calls = [];
  const runtime = new InteriorMaterialRuntime({
    configs: { lens: { emissiveIntensity: 2 } }, textureMaps: { lens: { map: {} } }, materials: {},
    prefabInstances: new Map([["room:lamp", { materialCloneEntries: [{ materialKey: "lens", material }] }]]),
    applyTextureMaps: (...args) => calls.push(args),
  });
  assert.equal(runtime.syncPrefabClones("lens"), 1);
  assert.equal(calls.length, 1);
  assert.equal(material.userData.baseEmissiveIntensity, 2);
});

test("interior material runtime exposes stable debug material state", () => {
  const material = new THREE.MeshStandardMaterial({ name: "Lens", color: "#ffffff", emissive: "#101010" });
  material.userData.textureTier = "full";
  const runtime = new InteriorMaterialRuntime({
    configs: { lens: { meshNames: ["LensMesh"], textureRepeat: 2 } }, materials: { lens: material },
    textureMaps: { lens: { maskMap: {} } }, prefabInstances: new Map(), applyTextureMaps() {},
  });
  const state = runtime.getDebugSnapshot().lens;
  assert.deepEqual(state.assignedTo, ["LensMesh"]);
  assert.equal(state.maskLoaded, true);
  assert.equal(state.textureTier, "full");
});
