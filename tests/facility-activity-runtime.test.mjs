import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { FacilityActivityRuntime } from "../src/audio/FacilityActivityRuntime.js";

test("facility activity delays multi-step spatial events and pauses them during critical blocks", () => {
  let blocked = true;
  const root = new THREE.Group();
  const played = [];
  const config = {
    facilityActivity: {
      enabled: true,
      checkIntervalRangeSeconds: [1, 1],
      chance: 1,
      recentHistorySize: 3,
      emitters: { shaft: { position: { x: 4, y: 2, z: -6 } } },
      sounds: [
        {
          id: "gears", file: "Gears", category: "machinery", weight: 1,
          minCooldown: 5, maxCooldown: 5, volume: 0.3, pitchVariation: 0,
          allowRepeat: true, emitterIds: ["shaft"], duration: 2,
        },
        {
          id: "metal", file: "Metal", category: "structural", weight: 1,
          minCooldown: 5, maxCooldown: 5, volume: 0.2, pitchVariation: 0,
          allowRepeat: true, emitterIds: ["shaft"], duration: 3,
        },
      ],
      events: [{
        id: "lift-transfer",
        weight: 1,
        steps: [{ soundId: "gears" }, { soundId: "metal", delayRangeSeconds: [4, 4] }],
      }],
    },
  };
  const runtime = new FacilityActivityRuntime({
    getActiveLevelId: () => "room",
    getLevelConfig: () => config,
    getEnvironmentRoot: () => root,
    getShiftElapsed: () => 60,
    getCoreSnapshot: () => ({ mode: "running" }),
    isPlaybackAllowed: () => true,
    isBlocked: () => blocked,
    playSound: (emitter, soundKey, options) => {
      played.push({ emitter, soundKey, options });
      return true;
    },
    random: () => 0,
  });

  runtime.update(5);
  assert.equal(played.length, 0);
  assert.equal(root.children.length, 1);

  blocked = false;
  runtime.update(1);
  assert.deepEqual(played.map(({ soundKey }) => soundKey), ["Gears"]);
  assert.deepEqual(played[0].emitter.position.toArray(), [4, 2, -6]);

  runtime.update(3);
  assert.equal(played.length, 1);
  runtime.update(1);
  assert.deepEqual(played.map(({ soundKey }) => soundKey), ["Gears", "Metal"]);
});

test("facility activity keeps uncanny events rare and does not select recent sounds", () => {
  const config = {
    facilityActivity: {
      enabled: true,
      checkIntervalRangeSeconds: [1, 1],
      chance: 1,
      uncannyChance: 0.04,
      recentHistorySize: 3,
      emitters: { deep: { position: { x: 0, y: 0, z: 0 } } },
      sounds: [
        { id: "ordinary", file: "Ordinary", category: "machinery", weight: 1, minCooldown: 1, maxCooldown: 1, volume: 1, emitterIds: ["deep"], duration: 1, allowRepeat: true },
        { id: "uncanny", file: "Uncanny", category: "uncanny", weight: 1, minCooldown: 1, maxCooldown: 1, volume: 1, emitterIds: ["deep"], duration: 1, allowRepeat: true },
      ],
      events: [
        { id: "ordinary", weight: 1, steps: [{ soundId: "ordinary" }] },
        { id: "uncanny", category: "uncanny", weight: 1, steps: [{ soundId: "uncanny" }] },
      ],
    },
  };
  const played = [];
  const runtime = new FacilityActivityRuntime({
    getActiveLevelId: () => "room",
    getLevelConfig: () => config,
    getShiftElapsed: () => 60,
    getCoreSnapshot: () => ({ mode: "running" }),
    isPlaybackAllowed: () => true,
    playSound: (_emitter, soundKey) => { played.push(soundKey); return true; },
    random: () => 0.5,
  });

  runtime.update(1);
  assert.deepEqual(played, ["Ordinary"]);
});
