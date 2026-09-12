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

test("interior material runtime applies live scalar config to source and prefab clones", () => {
  const createMaterial = () => ({
    color: { value: null, set(value) { this.value = value; } },
    emissive: { value: null, set(value) { this.value = value; } },
    normalScale: { value: null, set(x, y) { this.value = [x, y]; } },
    userData: {},
    needsUpdate: false,
  });
  const source = createMaterial();
  const clone = createMaterial();
  const overlays = [];
  const runtime = new InteriorMaterialRuntime({
    configs: { bulb: { color: "#fff", emissive: "#f80", emissiveIntensity: 9, normalScale: 1, transparent: true, opacity: 0.25, depthTest: false, depthWrite: false } },
    materials: { bulb: source },
    prefabInstances: new Map([["room:lamp", {
      materialCloneEntries: [{ materialKey: "bulb", material: clone }],
    }]]),
    updateMaskOverlay: (material) => overlays.push(material),
  });

  assert.equal(runtime.applyConfig("bulb"), 2);
  assert.equal(source.emissiveIntensity, 9);
  assert.equal(clone.emissiveIntensity, 9);
  assert.equal(clone.opacity, 0.25);
  assert.equal(clone.transparent, true);
  assert.equal(clone.depthTest, false);
  assert.equal(clone.depthWrite, false);
  assert.equal(clone.userData.baseEmissiveIntensity, 9);
  assert.deepEqual(overlays, [source, clone]);
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

test("interior material runtime clamps opacity to the physical zero-to-one range", () => {
  const material = new THREE.MeshStandardMaterial();
  const runtime = new InteriorMaterialRuntime({
    configs: { glass: { opacity: 2 } },
    materials: { glass: material },
    prefabInstances: new Map(),
  });

  runtime.applyConfig("glass");
  assert.equal(material.opacity, 1);
});
