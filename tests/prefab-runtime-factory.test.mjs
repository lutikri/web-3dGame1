import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { applyPrefabSpotTarget, createPrefabRuntimeFactory } from "../src/prefabs/PrefabRuntimeFactory.js";

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
