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

test("demand announcement sounds resolve to converted panel audio", () => {
  assert.equal(SOUND_REGISTRY.SFX_Panel1_DemandYellow1.path,
    "assets/sounds/machinery/SFX_Panel1_DemandYellow1.ogg");
  assert.equal(SOUND_REGISTRY.SFX_Panel1_DemandRed1.path,
    "assets/sounds/machinery/SFX_Panel1_DemandRed1.ogg");
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
    announcements: {
      update: (dt, state) => attached.push(["announcements", dt, state]),
    },
    playSound: () => {},
  });

  runtime.update(0.016);

  assert.ok(attached.some(([id, , , active]) => id === "lamp:room:LampA" && active));
  assert.ok(attached.some(([id, , state]) => id === "coreAudio" && state.active));
  assert.ok(attached.some(([id, , state]) => id === "announcements" && state.active));
  assert.ok(attached.some(([id, , soundKey, active]) => id === "prefab:room:ClockA:loop" && soundKey === "Clock1_loop" && active));
  assert.ok(loops.some(([id, active]) => id === "Footsteps1_Walk1" && active));
});

test("scene audio stays inactive behind presentation curtains and suppresses hidden lamp startup", () => {
  const attached = [];
  const loops = [];
  const oneShots = [];
  let lightFactor = 0;
  const runtime = new SceneAudioRuntime({
    config: {
      camera: { walkSpeed: 2, runSpeed: 4 },
      levelEnvironments: {
        room: { prefabs: [{ name: "LampA", light: { fluorescentStartup: true } }] },
      },
    },
    audio: {
      update: (...args) => loops.push(["update", ...args]),
      setLoop: (...args) => loops.push(args),
      setAttachedLoop: (...args) => attached.push(args),
    },
    camera: { position: new THREE.Vector3() },
    getPanel: () => ({ name: "panel" }),
    keys: new Set(),
    prefabInstances: new Map([["room:LampA", { root: {}, light: {}, controlPost: null }]]),
    getViewMode: () => "level",
    getActiveLevelId: () => "room",
    resolveEnvironmentId: (id) => id,
    hasPanel: () => true,
    getMovementVelocity: () => new THREE.Vector3(),
    isNoclipEnabled: () => false,
    getLightFactor: () => lightFactor,
    getSnapshot: () => ({ mode: "standby" }),
    coreAudio: { update: (dt, state) => attached.push(["coreAudio", dt, state]) },
    announcements: { update: (dt, state) => attached.push(["announcements", dt, state]) },
    playSound: (...args) => oneShots.push(args),
    presentationBlocked: true,
  });

  lightFactor = 1;
  runtime.update(0.016);
  assert.equal(loops.find(([id]) => id === "update")[3], null);
  assert.equal(attached.find(([id]) => id === "lamp:room:LampA")[3], false);
  assert.equal(attached.find(([id]) => id === "coreAudio")[2].active, false);
  assert.equal(oneShots.length, 0);

  runtime.setPresentationBlocked(false);
  runtime.update(0.016);
  assert.equal(oneShots.length, 0);
  assert.equal(attached.filter(([id]) => id === "lamp:room:LampA").at(-1)[3], true);
});
