import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  applyPrefabSpotTarget,
  applySpotCookieRotation,
  createPrefabRuntimeFactory,
} from "../src/prefabs/PrefabRuntimeFactory.js";

test("prefab runtime factory owns mesh material clones and collision classification", () => {
  const root = new THREE.Group();
  const visible = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  visible.name = "VisiblePart";
  const collider = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  collider.name = "UBX_Collider";
  root.add(visible, collider);
  const source = new THREE.MeshStandardMaterial();
  source.userData.baseEmissiveIntensity = 0;
  const factory = createPrefabRuntimeFactory({
    config: { player: { collision: { show: false } }, interior: { specialMaterials: { metal: {} } } },
    materials: { interiorCustom: { metal: source }, interior: source },
    collisionDebugMaterial: new THREE.MeshBasicMaterial(),
    photometricLights: { resetClonedMaterial: () => {}, patchMaterial: () => {}, register: () => null },
    isCollisionHelper: (name) => name.startsWith("UBX_"),
    ensureSecondUvSet: () => {},
    getObjectMatchNames: () => ["VisiblePart"],
    getCustomMaterialKey: () => "metal",
    createStartupPattern: () => [],
    createFixtureFlickerState: () => ({}),
    applyShadowSettings: () => {},
  });
  const runtime = factory.create(root, { name: "Test", materialKey: "base", light: { enabled: false, color: 0xffffff, intensity: 1, distance: 2, decay: 2 } });
  assert.equal(runtime.collisionMeshes.length, 1);
  assert.equal(collider.visible, false);
  assert.equal(runtime.materialClones.length, 1);
  assert.notEqual(visible.material, source);
  assert.ok(runtime.light?.isPointLight);
});

test("prefab spotlight target follows authored marker direction", () => {
  const light = new THREE.SpotLight();
  light.position.set(1, 2, 3);
  light.target = new THREE.Object3D();
  const marker = new THREE.Object3D();
  marker.quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  applyPrefabSpotTarget(light, { distance: 2 }, marker);
  assert.ok(Math.abs(light.target.position.x + 1) < 1e-9);
  assert.ok(Math.abs(light.target.position.y - 2) < 1e-9);
  assert.ok(Math.abs(light.target.position.z - 3) < 1e-9);
});

test("prefab spotlight loads its cookie before the runtime is ready", async () => {
  const root = new THREE.Group();
  const marker = new THREE.SpotLight();
  marker.name = "Spot";
  root.add(marker);
  const cookie = new THREE.Texture();
  const source = new THREE.MeshStandardMaterial();
  const factory = createPrefabRuntimeFactory({
    config: { player: { collision: { show: false } }, interior: { specialMaterials: {} } },
    materials: { interiorCustom: {}, interior: source },
    collisionDebugMaterial: new THREE.MeshBasicMaterial(),
    photometricLights: { resetClonedMaterial: () => {}, patchMaterial: () => {}, register: () => null },
    isCollisionHelper: () => false,
    ensureSecondUvSet: () => {},
    getObjectMatchNames: () => [],
    getCustomMaterialKey: () => null,
    createStartupPattern: () => [],
    createFixtureFlickerState: () => ({}),
    applyShadowSettings: () => {},
    loadRuntimeTexture: async () => cookie,
  });
  const runtime = factory.create(root, {
    name: "FlashLight",
    light: {
      type: "spot", markerName: "Spot", color: 0xffffff, intensity: 5, distance: 10, decay: 2,
      cookiePath: "cookie.ktx2", itemControlled: true,
    },
  });

  assert.equal(runtime.light.map, null);
  await runtime.ready;
  assert.equal(runtime.light.map, cookie);
  assert.equal(runtime.light.userData.itemControlled, true);
  assert.equal(marker.userData.prefabLightMarker, true);
  assert.equal(marker.intensity, 0);
});

test("spot cookie rotation updates projection camera up without changing light layout", () => {
  const light = new THREE.SpotLight();
  light.position.set(0, 0, 0);
  light.target.position.set(0, 0, -1);
  applySpotCookieRotation(light, 90);
  assert.ok(Math.abs(light.shadow.camera.up.x - 1) < 1e-9);
  assert.ok(Math.abs(light.shadow.camera.up.y) < 1e-9);
});
