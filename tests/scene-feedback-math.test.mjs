import assert from "node:assert/strict";
import test from "node:test";

import {
  flickerWave,
  getStartupAmount,
  getThermalEmergencyAmount,
  getTerminalLightFactor,
} from "../src/lighting/SceneFeedbackMath.js";

test("scene feedback startup and flicker math stays bounded", () => {
  assert.equal(getStartupAmount(5, 10), 0.5);
  assert.equal(getStartupAmount(-1, 10), 0);
  assert.equal(getStartupAmount(5, 0), 0);
  assert.equal(flickerWave(1.25, 17, 3), flickerWave(1.25, 17, 3));
  assert.ok(flickerWave(1.25, 17, 3) >= 0);
  assert.ok(flickerWave(1.25, 17, 3) <= 1);
});

test("thermal feedback only persists after a terminal sequence starts", () => {
  const snapshot = {
    mode: "idle",
    plasmaTemp: 180,
    thermalSoak: 100,
    outputSurge: 100,
  };
  assert.equal(getThermalEmergencyAmount(snapshot, -1, 2), 0);
  assert.ok(getThermalEmergencyAmount({ ...snapshot, mode: "running" }, -1, 2) > 0.9);
  assert.ok(getThermalEmergencyAmount(snapshot, 1, 2) > 0);
  assert.equal(getThermalEmergencyAmount(snapshot, 2, 2), 0);
});

test("terminal light factor delegates destroyed startup ownership", () => {
  const factor = getTerminalLightFactor({
    snapshot: { mode: "failed", failureType: "coreDestroyed" },
    terminalElapsed: 1.5,
    terminalConfig: {
      completeLightFactor: 0.8,
      failedLightFactor: 0.3,
      destroyedLightFactor: 0.1,
      destroyedBlackoutSeconds: 1,
      emergencyLightSettleSeconds: 2,
    },
    startupPattern: [{ duration: 1 }],
    getStartupDuration: () => 2,
    getStartupFactor: (_pattern, elapsed) => elapsed / 2,
  });
  assert.equal(factor, 0.25);
});

test("destroyed core lighting returns to the configured level after restart", () => {
  assert.equal(getTerminalLightFactor({
    snapshot: { mode: "failed", failureType: "coreDestroyed" },
    terminalElapsed: 10,
    terminalConfig: {
      destroyedLightFactor: 1,
      destroyedBlackoutSeconds: 1,
      emergencyLightSettleSeconds: 1,
    },
    startupPattern: [],
    getStartupDuration: () => 2,
    getStartupFactor: () => 1,
  }), 1);
});
