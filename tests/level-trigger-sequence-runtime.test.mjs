import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { LevelTriggerSequenceRuntime } from "../src/runtime/LevelTriggerSequenceRuntime.js";

test("level trigger sequence starts once and unlocks its barrier relative to narration end", async () => {
  const marker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  marker.name = "TRGVOL_WelcomeEntry_01";
  const root = new THREE.Group();
  root.add(marker);
  const barrierGate = {};
  const timers = [];
  const player = new THREE.Vector3(3, 0, 0);
  let narrationCalls = 0;
  let unlockCalls = 0;
  const runtime = new LevelTriggerSequenceRuntime({
    environmentModels: new Map([["room", root]]),
    prefabInstances: new Map([["room:Barrier1_1", { barrierGate }]]),
    getActiveLevelId: () => "room",
    getLevelConfig: () => ({
      triggerSequences: [{
        trigger: { markerName: marker.name, once: true },
        narration: "welcome",
        actions: [{ action: "unlockBarrierGate", target: "Barrier1_1", relativeTo: "narrationEnd", offsetSeconds: -0.8 }],
      }],
    }),
    getPlayerPosition: () => player,
    isLevelView: () => true,
    playNarration: async () => { narrationCalls += 1; return { duration: 25.6 }; },
    requestBarrierUnlock: (target) => { assert.equal(target, barrierGate); unlockCalls += 1; },
    setTimeoutFn: (callback, ms) => { timers.push({ callback, ms }); return timers.length; },
    clearTimeoutFn: () => {},
  });

  runtime.update();
  player.set(0, 0, 0);
  runtime.update();
  await Promise.resolve();
  assert.equal(narrationCalls, 1);
  assert.equal(timers[0].ms, 24800);
  timers[0].callback();
  assert.equal(unlockCalls, 1);

  player.set(3, 0, 0);
  runtime.update();
  player.set(0, 0, 0);
  runtime.update();
  assert.equal(narrationCalls, 1);
});

test("reset cancels pending level sequence actions", async () => {
  const marker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  marker.name = "TRGVOL_Reset_01";
  const root = new THREE.Group();
  root.add(marker);
  const cleared = [];
  const runtime = new LevelTriggerSequenceRuntime({
    environmentModels: new Map([["room", root]]),
    prefabInstances: new Map(),
    getActiveLevelId: () => "room",
    getLevelConfig: () => ({ triggerSequences: [{
      trigger: { markerName: marker.name }, narration: "welcome",
      actions: [{ action: "unlockBarrierGate", target: "missing", delaySeconds: 2 }],
    }] }),
    getPlayerPosition: () => new THREE.Vector3(),
    isLevelView: () => true,
    playNarration: async () => ({ duration: 1 }),
    requestBarrierUnlock: () => {},
    setTimeoutFn: () => 42,
    clearTimeoutFn: (timer) => cleared.push(timer),
  });

  runtime.update();
  await Promise.resolve();
  runtime.reset();
  assert.deepEqual(cleared, [42]);
});

test("an unavailable narration does not unlock the sequence barrier", async () => {
  const marker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  marker.name = "TRGVOL_NoNarration_01";
  const root = new THREE.Group();
  root.add(marker);
  let scheduled = false;
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const runtime = new LevelTriggerSequenceRuntime({
      environmentModels: new Map([["room", root]]),
      prefabInstances: new Map(),
      getActiveLevelId: () => "room",
      getLevelConfig: () => ({ triggerSequences: [{
        trigger: { markerName: marker.name }, narration: "welcome",
        actions: [{ action: "unlockBarrierGate", target: "Barrier1_1" }],
      }] }),
      getPlayerPosition: () => new THREE.Vector3(),
      isLevelView: () => true,
      playNarration: async () => false,
      requestBarrierUnlock: () => assert.fail("barrier unlocked without narration"),
      setTimeoutFn: () => { scheduled = true; },
    });
    runtime.update();
    await Promise.resolve();
    assert.equal(scheduled, false);
  } finally {
    console.warn = originalWarn;
  }
});

test("restart skips repeated narration and unlocks its gate after the authored retry delay", async () => {
  const marker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  marker.name = "TRGVOL_Retry_01";
  const root = new THREE.Group();
  root.add(marker);
  const barrierGate = {};
  const timers = [];
  let narrationCalls = 0;
  let unlockCalls = 0;
  const runtime = new LevelTriggerSequenceRuntime({
    environmentModels: new Map([["room", root]]),
    prefabInstances: new Map([["room:Barrier1_1", { barrierGate }]]),
    getActiveLevelId: () => "room",
    getLevelConfig: () => ({ triggerSequences: [{
      trigger: { markerName: marker.name },
      narration: "welcome",
      actions: [{
        action: "unlockBarrierGate",
        target: "Barrier1_1",
        relativeTo: "narrationEnd",
        restartDelaySeconds: 0.6,
      }],
    }] }),
    getPlayerPosition: () => new THREE.Vector3(),
    isLevelView: () => true,
    playNarration: async () => { narrationCalls += 1; return { duration: 25 }; },
    requestBarrierUnlock: (target) => { assert.equal(target, barrierGate); unlockCalls += 1; },
    setTimeoutFn: (callback, ms) => { timers.push({ callback, ms }); return timers.length; },
    clearTimeoutFn: () => {},
  });

  runtime.configureAttempt({ replayNarration: false });
  runtime.update();
  await Promise.resolve();
  assert.equal(narrationCalls, 0);
  assert.equal(timers[0].ms, 600);
  timers[0].callback();
  assert.equal(unlockCalls, 1);
});

test("qualification scare waits for completion, releases its rigid prefab and schedules attached audio", () => {
  const marker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  marker.name = "TRGVOL_ControlboothExit";
  const root = new THREE.Group();
  root.add(marker);
  const pipeRuntime = { root: new THREE.Group(), rigidPrefabKey: "room:pipe:rigid" };
  const player = new THREE.Vector3(3, 0, 0);
  const timers = [];
  const releases = [];
  const sounds = [];
  let shiftMode = "running";
  const runtime = new LevelTriggerSequenceRuntime({
    environmentModels: new Map([["room", root]]),
    prefabInstances: new Map([["room:pipe", pipeRuntime]]),
    getActiveLevelId: () => "qualification",
    resolveEnvironmentId: () => "room",
    getLevelConfig: () => ({ triggerSequences: [{
      name: "scare",
      trigger: { markerName: marker.name, once: true },
      condition: { levelId: "qualification", shiftMode: "complete" },
      actions: [
        { action: "releaseRigidPrefab", target: "pipe", angularVelocity: { x: 1, y: 2, z: 3 } },
        { action: "playSoundAtPrefab", target: "pipe", soundKey: "impact", delaySeconds: 0.64 },
      ],
    }] }),
    getPlayerPosition: () => player,
    isLevelView: () => true,
    getShiftMode: () => shiftMode,
    playNarration: () => null,
    requestBarrierUnlock: () => {},
    releaseRigidPrefab: (...args) => releases.push(args),
    playSoundAtPrefab: (...args) => sounds.push(args),
    setTimeoutFn: (callback, ms) => { timers.push({ callback, ms }); return timers.length; },
    clearTimeoutFn: () => {},
  });

  runtime.update();
  player.set(0, 0, 0);
  runtime.update();
  assert.equal(releases.length, 0);

  player.set(3, 0, 0);
  runtime.update();
  shiftMode = "complete";
  player.set(0, 0, 0);
  runtime.update();
  assert.equal(timers.length, 2);
  assert.equal(timers[0].ms, 0);
  assert.equal(timers[1].ms, 640);
  timers[0].callback();
  assert.equal(releases[0][0], pipeRuntime);
  assert.deepEqual(releases[0][1].angularVelocity, { x: 1, y: 2, z: 3 });
  timers[1].callback();
  assert.equal(sounds[0][0], pipeRuntime);
  assert.equal(sounds[0][1].soundKey, "impact");
});
