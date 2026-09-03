import assert from "node:assert/strict";
import test from "node:test";

import { LevelRouteCoordinator } from "../src/runtime/LevelRouteCoordinator.js";

function createCoordinator({ loaded = "room" } = {}) {
  const calls = [];
  const record = (name, result) => (...args) => { calls.push([name, ...args]); return result; };
  const coordinator = new LevelRouteCoordinator({
    sessions: { reset: record("sessionReset"), start: record("sessionStart") },
    setShiftProfile: record("shiftProfile"),
    resetLevelRuntime: record("resetLevel"),
    resetShift: record("resetShift"),
    enterMenuView: record("menu", true),
    stopEditing: record("stopEditing"),
    loadEnvironment: async (levelId, { onProgress } = {}) => {
      onProgress?.(0);
      onProgress?.(0.2);
      onProgress?.(0.6);
      onProgress?.(1);
      return loaded;
    },
    resolveEnvironmentId: () => "room",
    getLevelConfig: () => ({ session: { objectives: [] }, shiftProfile: "high" }),
    setActiveRoute: record("route"), setLevelView: record("levelView"), resetDoors: record("doors"),
    activateEnvironment: record("activate"), restartPrefabLights: record("lights"),
    warmupRendering: async ({ onProgress } = {}) => {
      calls.push(["warmup"]);
      onProgress?.(0);
      onProgress?.(0.05);
      onProgress?.(0.75);
      onProgress?.(0.78);
      onProgress?.(1);
    },
    setRoomLights: record("roomLights"), resetDiagnostics: record("diagnostics"),
    resetFuelBlend: record("fuelReset"), resetRecorder: record("recorder"), resetCore: record("coreReset"),
    resetThoughts: record("thoughtsReset"),
    stopFuelBlend: record("fuelStop"), getCoreSnapshot: () => ({ mode: "standby" }),
    resetCompletion: record("completion"), updateStatus: record("status"), scheduleNarration: record("narration"),
  });
  return { coordinator, calls };
}

test("level route coordinator composes a complete level entry", async () => {
  const { coordinator, calls } = createCoordinator();
  const progress = [];
  assert.equal(await coordinator.enterLevel({
    levelId: "qualification",
    mode: "tutorial",
    onProgress: (value) => progress.push(value),
  }), true);
  assert.deepEqual(calls.map(([name]) => name), [
    "stopEditing", "route", "sessionStart", "levelView", "doors", "activate", "lights",
    "roomLights", "diagnostics", "fuelReset", "shiftProfile", "resetLevel", "recorder",
    "thoughtsReset", "coreReset", "fuelStop", "completion", "status", "warmup", "narration",
  ]);
  assert.equal(progress[0], 8);
  assert.equal(progress.at(-1), 98);
  assert.ok(progress.some((value) => value > 8 && value < 68));
  assert.ok(progress.some((value) => value > 76 && value < 94));
  assert.ok(progress.every((value, index) => index === 0 || value > progress[index - 1]));
});

test("level route coordinator aborts when the requested environment was not loaded", async () => {
  const { coordinator, calls } = createCoordinator({ loaded: "other" });
  assert.equal(await coordinator.enterLevel({ levelId: "qualification", mode: "tutorial" }), false);
  assert.deepEqual(calls.map(([name]) => name), ["stopEditing"]);
});

test("level route coordinator clears session state before entering menu", async () => {
  const { coordinator, calls } = createCoordinator();
  assert.equal(await coordinator.resetForMenu(), true);
  assert.deepEqual(calls.map(([name]) => name), ["sessionReset", "shiftProfile", "resetLevel", "resetShift", "menu"]);
});
