import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { OperatorPanelAssetRuntime } from "../src/panels/OperatorPanelAssetRuntime.js";

test("operator panel asset runtime classifies collision meshes without owning boot completion", () => {
  const calls = [];
  const scene = new THREE.Scene();
  const model = new THREE.Group();
  model.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  model.children[0].name = "Panel_Coll_Main";
  const collisionMeshes = [];
  const runtime = new OperatorPanelAssetRuntime({
    scene, collisionDebugMaterial: new THREE.MeshBasicMaterial(), panelCollisionMeshes: collisionMeshes,
    getCollisionVisible: () => true, registerPanelObject: () => calls.push("register"),
    onModelLoaded: () => calls.push("loaded"), applyActiveLevel: () => calls.push("level"),
    getCollisionLevelIds: () => ["room"], rebuildLevelStaticPhysics: (id) => calls.push(id),
    logLoaded: () => calls.push("log"),
  });
  runtime.handleLoaded(model);
  assert.equal(collisionMeshes.length, 1);
  assert.equal(collisionMeshes[0].visible, true);
  assert.equal(scene.children.includes(model), true);
  assert.deepEqual(calls, ["register", "loaded", "level", "room", "log"]);
});

test("operator panel asset load resolves after the model is registered", async () => {
  const model = new THREE.Group();
  const calls = [];
  const runtime = new OperatorPanelAssetRuntime({
    assetPath: "panel.glb",
    loader: { load: (_path, onLoad) => onLoad({ scene: model }) },
    scene: new THREE.Scene(),
    collisionDebugMaterial: new THREE.MeshBasicMaterial(),
    panelCollisionMeshes: [],
    getCollisionVisible: () => false,
    registerPanelObject: () => {},
    onModelLoaded: () => calls.push("loaded"),
    applyActiveLevel: () => calls.push("level"),
    getCollisionLevelIds: () => [],
    rebuildLevelStaticPhysics: () => {},
    logLoaded: () => calls.push("log"),
  });
  assert.equal(await runtime.load(), model);
  assert.deepEqual(calls, ["loaded", "level", "log"]);
});

test("operator panel asset runtime maps loader progress to the boot range", () => {
  const values = [];
  const runtime = new OperatorPanelAssetRuntime({ setLoadingProgress: (value) => values.push(value) });
  runtime.handleProgress({ lengthComputable: false });
  runtime.handleProgress({ lengthComputable: true, loaded: 1, total: 2 });
  assert.deepEqual(values, [62, 57]);
});

test("operator panel asset runtime applies the active authored transform", () => {
  const model = new THREE.Group();
  const collider = new THREE.Mesh(new THREE.BoxGeometry());
  const runtime = new OperatorPanelAssetRuntime({
    config: { panel: { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: new THREE.Vector3(1, 1, 1) }, levelEnvironments: { room: { prefabs: [{ behavior: "operatorPanel", position: new THREE.Vector3(4, 5, 6) }] } } },
    panelCollisionMeshes: [collider], getCollisionVisible: () => true, getLevelEnvironmentId: (id) => id,
  });
  runtime.model = model;
  assert.equal(runtime.applyActiveTransform("room", "level"), true);
  assert.deepEqual(model.position.toArray(), [4, 5, 6]);
  assert.equal(collider.visible, true);
});
