import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { createItemInteractionRuntime } from "../src/interactions/ItemInteractionRuntime.js";

function createFixture({ activationType = "none", rigidPosition = new THREE.Vector3(0, 1.6, -0.48) } = {}) {
  const calls = [];
  const root = new THREE.Group();
  const target = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
  root.add(target);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.6, 0);
  camera.updateMatrixWorld(true);
  const interactive = [];
  const runtime = createItemInteractionRuntime({
    interactive,
    camera,
    physics: {
      setRigidPrefabMode: (...args) => calls.push(["mode", ...args]),
      driveRigidPrefab: (...args) => calls.push(["drive", ...args]),
      setRigidPrefabPose: (...args) => calls.push(["pose", ...args]),
      getRigidPrefabPosition: (_key, target) => target.copy(rigidPosition),
      dropRigidPrefab: (...args) => calls.push(["drop", ...args]),
      releaseRigidPrefab: (...args) => calls.push(["release", ...args]),
    },
  });
  runtime.register("level", {
    name: "Item1",
    item: { enabled: true, portable: true, targetName: "Target", activationType },
  }, {
    root,
    parts: new Map([["Target", target]]),
    rigidPrefabKey: "level:Item1",
  });
  return { runtime, root, target, calls, interactive };
}

test("physical grab drives a dynamic body and releases it without setting its pose", () => {
  const { runtime, target, calls } = createFixture();

  runtime.beginPrimary(target);
  runtime.releasePrimary();
  runtime.update(1 / 60);
  runtime.beginPrimary(target);
  runtime.releasePrimary();

  assert.ok(calls.some(([type, , mode]) => type === "mode" && mode === "grabbed"));
  assert.ok(calls.some(([type]) => type === "drive"));
  assert.ok(calls.some(([type, , , , options]) => type === "drive" && options.dt === 1 / 60));
  assert.ok(calls.some(([type]) => type === "release"));
  assert.equal(calls.some(([type]) => type === "pose"), false);
  assert.equal(calls.some(([type]) => type === "drop"), false);
});

test("portable spotlight target remains parented to the moving flashlight", () => {
  const { root } = createFixture({ activationType: "toggleLight" });
  const spot = new THREE.SpotLight();
  spot.remove(spot.target);
  root.add(spot);

  const detachedTarget = spot.target;
  const runtime = createItemInteractionRuntime({
    interactive: [],
    camera: new THREE.PerspectiveCamera(),
    physics: {},
  });
  const target = root.children[0];
  runtime.register("level", {
    name: "FlashLight1",
    item: { enabled: true, portable: true, targetName: target.name, activationType: "toggleLight" },
  }, { root, parts: new Map([[target.name, target]]) });

  assert.equal(detachedTarget.parent, spot);
});

test("item-controlled spotlight toggles intensity while retaining the light layout", () => {
  const { runtime, interactive } = createFixture();
  const root = new THREE.Group();
  const spot = new THREE.SpotLight(0xffffff, 6);
  spot.userData.itemControlled = true;
  root.add(spot);
  runtime.register("room", {
    name: "FlashLight",
    item: {
      enabled: true,
      activationMode: "equipment",
      activationType: "toggleLight",
      defaultOn: false,
    },
  }, { root, parts: new Map(), light: spot });

  assert.equal(spot.visible, true);
  assert.equal(spot.intensity, 0);
  assert.equal(runtime.activateRelevant(root), true);
  assert.equal(spot.visible, true);
  assert.equal(spot.intensity, 6);
});

test("equipped items request a swept kinematic pose", () => {
  const { runtime, target, calls } = createFixture();

  runtime.beginPrimary(target);
  runtime.update(0.6);
  runtime.releasePrimary();
  runtime.beginSelection();
  runtime.moveSelection(1);
  runtime.commitSelection();

  const poseCall = calls.find(([type]) => type === "pose");
  assert.ok(poseCall);
  assert.equal(poseCall[4], true);
  assert.equal(poseCall[5].sweep, true);
  assert.ok(poseCall[5].sweepOrigin?.isVector3);
});

test("equipment separated from its carry pose drops from inventory in place", () => {
  const { runtime, target, calls } = createFixture({
    rigidPosition: new THREE.Vector3(0, 1.6, 3),
  });

  runtime.beginPrimary(target);
  runtime.update(0.6);
  runtime.releasePrimary();
  runtime.beginSelection();
  runtime.moveSelection(1);
  runtime.commitSelection();
  runtime.update(0.1);
  runtime.update(0.1);

  const snapshot = runtime.getSnapshot();
  assert.equal(snapshot.activeItemId, null);
  assert.equal(snapshot.slots[0], null);
  assert.ok(calls.some(([type]) => type === "release"));
  assert.equal(calls.some(([type]) => type === "drop"), false);
});
