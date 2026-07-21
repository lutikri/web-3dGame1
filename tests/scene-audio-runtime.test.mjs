import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { SceneAudioRuntime } from "../src/audio/SceneAudioRuntime.js";

test("scene audio runtime composes panel, movement, prefab, and core loops", () => {
  const attached = [];
  const loops = [];
  const audio = {
    update: (...args) => loops.push(["update", ...args]),
    setLoop: (...args) => loops.push(args),
    setAttachedLoop: (...args) => attached.push(args),
  };
  const prefabInstances = new Map([
    ["room:LampA", { root: {}, light: {}, controlPost: null }],
  ]);
  const runtime = new SceneAudioRuntime({
    config: {
      camera: { walkSpeed: 2, runSpeed: 4 },
      levelEnvironments: {
        room: { prefabs: [{ name: "LampA", light: { fluorescentStartup: true } }] },
      },
    },
    audio,
    camera: { position: new THREE.Vector3() },
    getPanel: () => ({ name: "panel" }),
    keys: new Set(["KeyW"]),
    prefabInstances,
    getViewMode: () => "level",
    getActiveLevelId: () => "room",
    resolveEnvironmentId: (id) => id,
    hasPanel: () => true,
    getMovementVelocity: () => new THREE.Vector3(0.5, 0, 0),
    isNoclipEnabled: () => false,
    getLightFactor: () => 1,
    getSnapshot: () => ({
      mode: "running", failureType: null, plasmaTemp: 100, coreStress: 20, coreStall: 0,
    }),
    getTerminalElapsed: () => -1,
    getTime: () => 0,
    playSound: () => {},
  });

  runtime.update(0.016);

  assert.ok(attached.some(([id, , , active]) => id === "panel:Panel1" && active));
  assert.ok(attached.some(([id, , , active]) => id === "lamp:room:LampA" && active));
  assert.ok(attached.some(([id, , , active]) => id === "core:FusionCore_Working1" && active));
  assert.ok(loops.some(([id, active]) => id === "Footsteps1_Walk1" && active));
});

