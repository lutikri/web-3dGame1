import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";
import { DoorStateRuntime } from "../src/interactions/DoorStateRuntime.js";

function createDoorState({ mode = "running", objectives = [], results = null, waitForExit = false } = {}) {
  const events = [];
  const thoughts = [];
  const physicsCalls = [];
  const root = new THREE.Group();
  const mesh = new THREE.Group();
  mesh.userData.prefabInitialRotation = new THREE.Euler();
  root.add(mesh);
  const placed = {
    root,
    physicsDoorKey: "room:DoorBulk1",
    door: {
      mesh,
      prefabName: "DoorBulk1",
      latched: true,
      defaultLatched: true,
      degrees: 0,
      interaction: { axis: "y", initialDegrees: 0 },
    },
  };
  const runtime = new DoorStateRuntime({
    instances: new Map([["room:DoorBulk1", placed]]),
    physics: { setDoorLocked: (...args) => physicsCalls.push(args) },
    resolveEnvironmentId: (id) => id,
    getSessionConfig: () => ({ objectives }),
    getGameMode: () => mode,
    emitThought: (...args) => thoughts.push(args),
    emitSessionEvent: (...args) => events.push(args),
    getResults: () => results,
    shouldWaitForExit: () => waitForExit,
    showResults: (snapshot) => events.push(["results", snapshot]),
    refreshTooltip: () => {},
    playSound: () => {},
    setHoverClass: () => {},
  });
  return { runtime, placed, events, thoughts, physicsCalls };
}

test("door state runtime owns latch state, physics lock and objective event", () => {
  const { runtime, placed, events, physicsCalls } = createDoorState();
  assert.equal(runtime.setLatched(placed, false), true);
  assert.equal(placed.door.latched, false);
  assert.deepEqual(physicsCalls, [["room:DoorBulk1", false]]);
  assert.deepEqual(events, [["doorUnlocked", { target: "DoorBulk1" }]]);
});

test("door state runtime blocks an objective exit until the shift terminates", () => {
  const objective = {
    type: "event",
    event: "doorUnlocked",
    target: "DoorBulk1",
    blockedStopDegrees: 5,
  };
  const { runtime, placed, thoughts } = createDoorState({ objectives: [objective] });
  assert.equal(runtime.canOperateLatch(placed), false);
  assert.equal(placed.door.blockedLatchStopDegrees, 5);
  assert.deepEqual(thoughts, [["door-shift-incomplete", 2, 2.8]]);
});

test("door state runtime applies authored axis rotation", () => {
  const { runtime, placed } = createDoorState();
  placed.door.degrees = 45;
  runtime.applyRotation(placed);
  assert.ok(Math.abs(placed.door.mesh.rotation.y - Math.PI / 4) < 1e-9);
});

test("deferred results appear only after unlocking the configured exit latch", () => {
  const objective = { type: "event", event: "doorUnlocked", target: "DoorBulk1" };
  const result = { mode: "complete" };
  const { runtime, placed, events } = createDoorState({ objectives: [objective], results: result, waitForExit: true });
  runtime.onDoorOpened("room:ServiceDoor");
  assert.equal(events.some(([type]) => type === "results"), false);
  runtime.setLatched(placed, false);
  assert.deepEqual(events.at(-1), ["results", result]);
});
