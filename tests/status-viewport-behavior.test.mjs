import assert from "node:assert/strict";
import test from "node:test";

import {
  getMasterSystemStatus,
  getStatusViewportIndicatorStates,
} from "../src/prefabs/behaviors/StatusViewportBehavior.js";

test("master status indicators classify nominal and dangerous core snapshots", () => {
  const nominal = getStatusViewportIndicatorStates({
    mode: "running",
    reactionEfficiency: 78,
    powerOutput: 840,
    targetOutput: 850,
    demandError: -0.01,
    heatSinkCapacity: 82,
    fuelReserve: 76,
    pulseCharge: 90,
    coreStall: 8,
    coreStress: 24,
    warning: {},
  });
  assert.equal(nominal.Efficiency, "green");
  assert.equal(nominal.Output, "green");
  assert.equal(nominal.Stall, "green");
  assert.equal(nominal.AlarmSilence, "off");

  const dangerous = getStatusViewportIndicatorStates({
    mode: "running",
    reactionEfficiency: 35,
    powerOutput: 200,
    targetOutput: 850,
    demandError: -0.76,
    heatSinkCapacity: 18,
    fuelReserve: 12,
    pulseCharge: 15,
    coreStall: 88,
    coreStress: 94,
    warning: { tempCritical: true, coreStallCritical: true },
  });
  assert.equal(dangerous.Efficiency, "red");
  assert.equal(dangerous.Output, "red");
  assert.equal(dangerous.Stress, "red");
  assert.equal(dangerous.Coolant, "red");
  assert.equal(dangerous.AlarmSilence, "amber");
});

test("master status line follows core lifecycle and warning severity", () => {
  assert.equal(getMasterSystemStatus(null), "SYSTEM STANDBY");
  assert.equal(getMasterSystemStatus({ mode: "running", warning: {} }), "SYSTEM STABLE");
  assert.equal(getMasterSystemStatus({ mode: "running", warning: { outputLow: true } }), "ATTENTION REQUIRED");
  assert.equal(getMasterSystemStatus({ mode: "running", warning: { tempCritical: true } }), "IMMEDIATE ATTENTION");
  assert.equal(getMasterSystemStatus({ mode: "failed", warning: {} }), "SYSTEM FAULT");
});
