import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { OperatorViewRuntime } from "../src/player/OperatorViewRuntime.js";

function createHarness() {
  const state = {};
  const camera = new THREE.PerspectiveCamera();
  const runtime = new OperatorViewRuntime({
    config: { player: {}, camera: { menuView: { position: new THREE.Vector3(4, 3, 2), rotationDegrees: { x: -5, y: 90 }, roomLightsOn: true } }, levelEnvironments: { room: { player: { spawnPosition: new THREE.Vector3(1, 2, 3), rotationDegrees: { x: 12, y: 24 }, controlMode: "walk" } } } },
    camera, keys: new Set(["KeyW"]), pointer: new THREE.Vector2(1, 1), playerPosition: new THREE.Vector3(),
    playerSpawnPosition: new THREE.Vector3(), movementVelocity: new THREE.Vector3(1, 1, 1), movementRuntime: { resetPresentation() {} },
    getActiveLevelId: () => "room", setViewMode: (v) => { state.view = v; }, setControlMode: (v) => { state.control = v; },
    setJumpQueued: (v) => { state.jump = v; }, setZoomActive: (v) => { state.zoom = v; }, setYaw: (v) => { state.yaw = v; }, setPitch: (v) => { state.pitch = v; },
    teleportCharacter() {}, syncPlayerCapsule() {}, loadLevelEnvironment: async () => "intro-shift", resetLevelDoors() {},
    updateActiveLevelEnvironment() {}, setRoomLightsEnabled: (v) => { state.lights = v; }, exitPointerLock() {},
  });
  return { runtime, state, camera };
}

test("operator view runtime applies the authored level spawn", () => {
  const { runtime, state, camera } = createHarness();
  runtime.resetLevelView();
  assert.equal(state.view, "level");
  assert.equal(state.control, "walk");
  assert.equal(state.jump, false);
  assert.deepEqual(camera.position.toArray(), [1, 2, 3]);
  assert.ok(Math.abs(state.yaw - THREE.MathUtils.degToRad(24)) < 1e-9);
});

test("operator view runtime applies menu presentation after loading the preview", async () => {
  const { runtime, state, camera } = createHarness();
  assert.equal(await runtime.enterMenuView(), true);
  assert.equal(state.view, "menu");
  assert.equal(state.lights, true);
  assert.deepEqual(camera.position.toArray(), [4, 3, 2]);
});
