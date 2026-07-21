import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";
import {
  InteriorObjectRegistry,
  getInteriorObjectMatchNames,
  interiorMaterialMatches,
  isCollisionHelperMesh,
  normalizeObjectName,
} from "../src/scene/InteriorObjectRegistry.js";

function createRegistry(overrides = {}) {
  const collections = {
    interiorFans: [], needles: [], gaugeNeedles: new Map(), lamps: [],
    controlKnobs: [], controlButtons: [], roomLightButtons: [], interactive: [],
  };
  const registry = new InteriorObjectRegistry({
    config: {
      shadows: { castNeedleShadows: false },
      needleAnimation: { inactiveDegrees: -45, jitterRetargetInterval: 1, speedDegreesPerSecond: { min: 1, max: 2 } },
      controls: { knobs: {}, buttons: {} },
      interior: { fans: {}, specialMaterials: {}, bulkheadExit: null },
      interaction: { panelMaxDistance: 1.5 },
      ...overrides.config,
    },
    materials: {
      panel: new THREE.MeshStandardMaterial(),
      interior: new THREE.MeshStandardMaterial(),
      interiorCustom: {},
      lampOff: new THREE.MeshStandardMaterial(),
    },
    audio: { registerAmbienceVolume() {} },
    statusScreen: { attachToMesh() {} },
    registerBulkheadHandle() {},
    applyControlKnobRotation() {},
    collections,
  });
  return { registry, collections };
}

test("interior object registry classifies panel controls and gauge needles", () => {
  const { registry, collections } = createRegistry({
    config: {
      shadows: { castNeedleShadows: false },
      needleAnimation: { inactiveDegrees: -45, jitterRetargetInterval: 1, speedDegreesPerSecond: { min: 1, max: 2 } },
      controls: {
        knobs: { Control_Knob_Fuel: { label: "FUEL", initialPercent: 30 } },
        buttons: {},
      },
      interior: { fans: {}, specialMaterials: {}, bulkheadExit: null },
      interaction: { panelMaxDistance: 1.5 },
    },
  });
  const needle = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  needle.name = "Gauge_PlasmaTemp_Arrow_1";
  registry.registerPanelObject(needle);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  knob.name = "Control_Knob_Fuel";
  registry.registerPanelObject(knob);

  assert.equal(collections.needles[0], needle);
  assert.equal(collections.gaugeNeedles.get("plasmaTemp"), needle);
  assert.equal(collections.controlKnobs[0], knob);
  assert.equal(knob.userData.controlPercent, 30);
  assert.ok(collections.interactive.includes(knob));
});

test("interior material matching uses mesh, parent, geometry and material names", () => {
  const parent = new THREE.Group();
  parent.name = "Fixture.Frame";
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  mesh.name = "Lens_01";
  mesh.geometry.name = "AuthoredLens";
  mesh.material.name = "GlassMaterial";
  parent.add(mesh);

  assert.equal(normalizeObjectName("Fixture.Frame-01"), "fixtureframe01");
  assert.deepEqual(getInteriorObjectMatchNames(mesh), ["Lens_01", "Fixture.Frame", "AuthoredLens"]);
  assert.equal(interiorMaterialMatches(mesh, { namePrefixes: ["fixtureframe"] }), true);
  assert.equal(interiorMaterialMatches(mesh, { materialNames: ["Glass_Material"] }), true);
  assert.equal(isCollisionHelperMesh("UBX_Door_01"), true);
  assert.equal(isCollisionHelperMesh("Door_Collider.001"), true);
  assert.equal(isCollisionHelperMesh("DoorVisible"), false);
});

test("interior object registry owns configured fan animation", () => {
  const { registry, collections } = createRegistry({
    config: {
      shadows: { castNeedleShadows: false }, needleAnimation: { inactiveDegrees: 0, jitterRetargetInterval: 1, speedDegreesPerSecond: { min: 1, max: 2 } },
      controls: { knobs: {}, buttons: {} }, interaction: { panelMaxDistance: 1.5 },
      interior: { fans: { VentFan: { enabled: true, axis: "x", speedDegreesPerSecond: 90 } }, specialMaterials: {}, bulkheadExit: null },
    },
  });
  const fan = new THREE.Group();
  fan.name = "VentFan";
  registry.registerEnvironmentObject(fan);
  registry.updateFans(1);
  assert.equal(collections.interiorFans[0], fan);
  assert.ok(Math.abs(fan.rotation.x - Math.PI / 2) < 1e-9);
});
