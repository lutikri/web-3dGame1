import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { SceneAudioRuntime } from "../src/audio/SceneAudioRuntime.js";
import { SOUND_REGISTRY } from "../src/audio/SoundRegistry.js";

test("entry hall marker key and clock loop resolve to runtime OGG assets", () => {
  assert.equal(SOUND_REGISTRY.Ambience_EntryHall1.path,
    "assets/sounds/ambience/AmbienceLoop_EntryHall1.ogg");
  assert.equal(SOUND_REGISTRY.Clock1_loop.path, "assets/sounds/machinery/Clock1_loop.ogg");
  assert.equal(SOUND_REGISTRY.Clock1_loop.loop, true);
});

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
    ["room:ClockA", { root: {}, light: null, controlPost: null }],
  ]);
  const runtime = new SceneAudioRuntime({
    config: {
      camera: { walkSpeed: 2, runSpeed: 4 },
      levelEnvironments: {
        room: { prefabs: [
          { name: "LampA", light: { fluorescentStartup: true } },
          { name: "ClockA", audio: { loopSoundKey: "Clock1_loop", volume: 0.2, maxDistance: 2 } },
        ] },
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
    coreAudio: {
      update: (dt, state) => attached.push(["coreAudio", dt, state]),
    },
    playSound: () => {},
  });

  runtime.update(0.016);

  assert.ok(attached.some(([id, , , active]) => id === "lamp:room:LampA" && active));
  assert.ok(attached.some(([id, , state]) => id === "coreAudio" && state.active));
  assert.ok(attached.some(([id, , soundKey, active]) => id === "prefab:room:ClockA:loop" && soundKey === "Clock1_loop" && active));
  assert.ok(loops.some(([id, active]) => id === "Footsteps1_Walk1" && active));
});
