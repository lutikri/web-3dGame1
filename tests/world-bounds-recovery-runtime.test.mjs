import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { WorldBoundsRecoveryRuntime } from "../src/runtime/WorldBoundsRecoveryRuntime.js";

test("world bounds recovery returns the player to the authored level spawn behind a black curtain", async () => {
  const playerPosition = new THREE.Vector3(1, 1.5, 2);
  const calls = [];
  const runtime = new WorldBoundsRecoveryRuntime({
    config: {
      playerMinimumY: -4,
      propMinimumY: -8,
      propCheckIntervalSeconds: 0.1,
      coverDurationMs: 1,
      revealDurationMs: 1,
    },
    playerPosition,
    getLevelId: () => "room",
    getViewMode: () => "level",
    getSpawnPosition: () => new THREE.Vector3(0, 1.5, 0),
    teleportPlayer: (position) => {
      calls.push(["teleport", position.clone()]);
      playerPosition.copy(position);
    },
    suspendPlayer: () => {
      calls.push(["suspend"]);
      return "state";
    },
    restorePlayer: (state) => calls.push(["restore", state]),
    resetOutOfBoundsProps: (minimumY) => calls.push(["props", minimumY]),
    screenTransition: {
      cover: async (options) => calls.push(["cover", options]),
      reveal: async (options) => calls.push(["reveal", options]),
    },
  });

  runtime.update(0.1);
  playerPosition.set(5, -10, 6);
  runtime.update(0.1);
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(playerPosition.toArray(), [0, 1.5, 0]);
  assert.deepEqual(calls.map(([type]) => type), [
    "props", "props", "suspend", "cover", "teleport", "reveal", "restore",
  ]);
  assert.equal(calls[3][1].tone, "black");
});

test("world bounds recovery resets fallen props without moving a safe player", () => {
  const resets = [];
  const runtime = new WorldBoundsRecoveryRuntime({
    config: { propMinimumY: -12, propCheckIntervalSeconds: 0.25 },
    playerPosition: new THREE.Vector3(0, 1.5, 0),
    getLevelId: () => "room",
    getViewMode: () => "level",
    getSpawnPosition: () => new THREE.Vector3(0, 1.5, 0),
    teleportPlayer() {},
    suspendPlayer() {},
    restorePlayer() {},
    resetOutOfBoundsProps: (minimumY) => resets.push(minimumY),
    screenTransition: { cover: async () => {}, reveal: async () => {} },
  });

  runtime.update(0.1);
  runtime.update(0.15);
  assert.deepEqual(resets, [-12]);
});
