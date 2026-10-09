import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPrefabInstance } from "../src/prefabs/PrefabRegistry.js";

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
  return { runtime, root, target, camera, calls, interactive };
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

test("physical grab preserves its authored camera-relative orientation while the player turns", () => {
  const { runtime, root, target, camera, calls } = createFixture();
  root.rotation.set(0.15, 0.4, -0.1);
  root.updateMatrixWorld(true);
  const initialObjectRotation = root.getWorldQuaternion(new THREE.Quaternion());

  runtime.beginPrimary(target);
  runtime.releasePrimary();
  runtime.update(1 / 60);

  const firstDrive = calls.find(([type]) => type === "drive");
  assert.ok(firstDrive);
  assert.ok(firstDrive[3].angleTo(initialObjectRotation) < 1e-8);

  camera.rotation.set(-0.1, 0.65, 0);
  camera.updateMatrixWorld(true);
  runtime.update(1 / 60);

  const cameraRotation = camera.getWorldQuaternion(new THREE.Quaternion());
  const expectedTurnedRotation = cameraRotation.multiply(initialObjectRotation);
  const latestDrive = calls.filter(([type]) => type === "drive").at(-1);
  assert.ok(latestDrive[3].angleTo(expectedTurnedRotation) < 1e-8);
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

test("flashlight toggle requests a randomized positional switch sound", () => {
  const sounds = [];
  const root = new THREE.Group();
  const spot = new THREE.SpotLight(0xffffff, 6);
  spot.userData.itemControlled = true;
  root.add(spot);
  const runtime = createItemInteractionRuntime({
    interactive: [],
    camera: new THREE.PerspectiveCamera(),
    physics: {},
    playSoundGroup: (...args) => sounds.push(args),
  });
  runtime.register("room", {
    name: "FlashLight",
    item: { enabled: true, activationMode: "equipment", activationType: "toggleLight", defaultOn: false },
  }, { root, parts: new Map(), light: spot });

  assert.equal(runtime.activateRelevant(root), true);
  assert.deepEqual(sounds, [[root, "flashlightToggle"]]);
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

test("dropping equipped items releases their last swept pose instead of teleporting through walls", () => {
  const { runtime, target, calls } = createFixture();

  runtime.beginPrimary(target);
  runtime.update(0.6);
  runtime.releasePrimary();
  runtime.beginSelection();
  runtime.moveSelection(1);
  runtime.commitSelection();
  calls.length = 0;
  runtime.dropHandled({ throwStrength: 0.5 });

  assert.ok(calls.some(([type, , velocity]) => type === "release" && velocity?.length() > 0));
  assert.equal(calls.some(([type]) => type === "drop"), false);
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

test("equipped motion applies locomotion sway and rotation lag without changing inventory ownership", () => {
  const calls = [];
  const root = new THREE.Group();
  const target = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
  target.name = "Flashlight";
  root.add(target);
  const runtime = createItemInteractionRuntime({
    interactive: [],
    camera: new THREE.PerspectiveCamera(),
    getLocomotionPresentation: () => ({
      equipmentSide: 0.01,
      equipmentVertical: -0.01,
      equipmentForward: 0.02,
      equipmentRoll: 0.02,
      equipmentYaw: 0.03,
    }),
    physics: {
      setRigidPrefabMode() {},
      setRigidPrefabPose: (...args) => calls.push(args),
      getRigidPrefabPosition: (_key, output) => output.set(0.25, -0.2, -0.48),
    },
  });
  runtime.register("level", {
    name: "Flashlight",
    item: {
      enabled: true,
      portable: true,
      targetName: "Flashlight",
      equippedMotion: { rotationLag: 8, rotationScale: 1.5, swayScale: 2 },
    },
  }, { root, parts: new Map([[target.name, target]]), rigidPrefabKey: "level:flashlight" });
  runtime.beginPrimary(target);
  runtime.update(0.6);
  runtime.releasePrimary();
  runtime.beginSelection();
  runtime.moveSelection(1);
  runtime.commitSelection();
  runtime.update(1 / 60);

  const latestPosition = calls.at(-1)[1];
  assert.ok(latestPosition.x > 0.25);
  assert.ok(latestPosition.y < -0.2);
  assert.ok(latestPosition.z < -0.48);
});

test("equipped flashlight moves back, converges on the cursor hit, and restores its beam on drop", () => {
  const root = new THREE.Group();
  const spot = new THREE.SpotLight();
  spot.position.set(-0.053824, 0, 0);
  spot.target.position.set(-4.053824, 0, 0);
  root.add(spot, spot.target);
  const camera = new THREE.PerspectiveCamera();
  camera.position.y = 1.6;
  const hit = new THREE.Vector3(0, 1.6, -0.55);
  const rays = [];
  const prefab = createPrefabInstance("FlashLight", { name: "flashlight" });
  const runtime = createItemInteractionRuntime({
    interactive: [], camera,
    physics: { raycastWorld: (...args) => { rays.push(args); return hit.clone(); } },
  });
  runtime.register("room", prefab, { root, parts: new Map() });
  runtime.beginPrimary(root);
  runtime.update(0.6);
  runtime.releasePrimary();
  runtime.beginSelection();
  runtime.moveSelection(1);
  runtime.commitSelection();
  runtime.update(0);
  assert.ok(Math.abs(root.position.z + 0.34) < 1e-6);
  assert.deepEqual(rays[0][0].toArray(), [0, 1.6, 0]);
  assert.ok(rays[0][1].distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-6);
  assert.ok(spot.target.getWorldPosition(new THREE.Vector3()).distanceTo(hit) < 1e-6);
  const closePose = root.quaternion.clone();
  hit.set(0, 1.6, -12);
  camera.rotation.y = THREE.MathUtils.degToRad(3);
  const direction = camera.getWorldDirection(new THREE.Vector3());
  hit.copy(camera.position).addScaledVector(direction, 12);
  runtime.update(1 / 60);
  assert.ok(root.quaternion.angleTo(closePose) < THREE.MathUtils.degToRad(1), "depth change must not turn the physical body");
  const aim = spot.target.getWorldPosition(new THREE.Vector3()).sub(camera.position);
  assert.ok(aim.length() > 0.55 && aim.length() < 0.75, "near-to-far convergence changes smoothly");
  assert.ok(aim.clone().normalize().dot(direction) > 0.999999, "camera aim stays immediate");
  for (let frame = 0; frame < 120; frame += 1) runtime.update(1 / 60);
  assert.ok(spot.target.getWorldPosition(new THREE.Vector3()).distanceTo(hit) < 0.001);
  camera.rotation.y = 0;
  prefab.item.equippedDepth = 0.3;
  runtime.update(1 / 60);
  assert.ok(Math.abs(root.position.z + 0.3) < 1e-6);
  prefab.item.aimAtCursor = false;
  runtime.update(1 / 60);
  assert.deepEqual(spot.target.position.toArray(), [-4.053824, 0, 0]);
  prefab.item.aimAtCursor = true;
  runtime.update(1 / 60);
  runtime.dropHandled();
  assert.deepEqual(spot.target.position.toArray(), [-4.053824, 0, 0]);
});
