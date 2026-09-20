import assert from "node:assert/strict";
import test from "node:test";

import {
  buildShiftReport,
  createShiftRecorder,
  evaluateQualificationOutcome,
  updateShiftRecorder,
} from "../src/game/ShiftReport.js";
import { createFusionCoreSimulation } from "../src/FusionCoreSimulation.js";
import { LEVEL_EXPLORING_AROUND_CONFIG } from "../src/levels/LevelExploringAroundConfig.js";

const shiftProfile = LEVEL_EXPLORING_AROUND_CONFIG.shiftProfile;

function terminalSnapshot(overrides = {}) {
  return {
    mode: "complete",
    failureType: null,
    elapsed: 180,
    ...overrides,
  };
}

function passingRecorder() {
  return {
    ...createShiftRecorder(),
    elapsed: 180,
    efficiencySum: 70 * 180,
    qualificationScoredTime: 168,
    qualificationCompliantTime: 105,
    qualificationMaxSevereDeviationStreak: 12,
    qualificationPhases: {
      "PLASMA IGNITION": { scoredTime: 28, compliantTime: 16 },
      "STABLE BURN": { scoredTime: 38, compliantTime: 22 },
      "DEMAND SURGE": { scoredTime: 45, compliantTime: 24 },
      "SUSTAINED HIGH LOAD": { scoredTime: 45, compliantTime: 12 },
    },
    maxCoreStress: 68,
    tempCriticalTime: 12,
    quenchTime: 5,
    instabilityTime: 4,
  };
}

test("qualification passes sustained demand tracking with one recoverable weak phase", () => {
  const result = evaluateQualificationOutcome(passingRecorder(), terminalSnapshot(), shiftProfile);

  assert.equal(result.mode, "complete");
  assert.equal(result.qualification.passed, true);
  assert.equal(result.qualification.passingPhases, 3);
  assert.deepEqual(result.qualification.reasons, []);
});

test("qualification rejects a static high-efficiency run that ignores grid demand", () => {
  const recorder = passingRecorder();
  recorder.efficiencySum = 76 * 180;
  recorder.qualificationCompliantTime = 18;
  recorder.qualificationMaxSevereDeviationStreak = 74;
  Object.values(recorder.qualificationPhases).forEach((phase) => { phase.compliantTime = 2; });

  const result = evaluateQualificationOutcome(recorder, terminalSnapshot(), shiftProfile);

  assert.equal(result.mode, "failed");
  assert.equal(result.failureType, "qualityFailure");
  assert.equal(result.qualification.reasons.includes("gridCompliance"), true);
  assert.equal(result.qualification.reasons.includes("sustainedDemandDeviation"), true);
  assert.equal(result.qualification.reasons.includes("phaseTracking"), true);
});

test("qualification scoring applies its grace period and records per-phase compliance", () => {
  const recorder = createShiftRecorder();
  const controls = {
    fuelInjection: 50,
    magneticField: 50,
    coolantFlow: 50,
    ventActive: false,
    pulseActive: false,
    shiftProfile,
  };
  const snapshot = {
    mode: "running",
    elapsed: 13,
    demandError: 0.08,
    reactionEfficiency: 70,
    plasmaTemp: 90,
    powerOutput: 400,
    coreStress: 10,
    thermalSoak: 0,
    phase: { name: "FIELD PRECHARGE" },
    warning: {},
  };

  updateShiftRecorder(recorder, 2, snapshot, controls);

  assert.equal(recorder.qualificationScoredTime, 1);
  assert.equal(recorder.qualificationCompliantTime, 1);
  assert.deepEqual(recorder.qualificationPhases["FIELD PRECHARGE"], {
    scoredTime: 1,
    compliantTime: 1,
  });
});

test("physical reactor failures are never rewritten as qualification failures", () => {
  const destroyed = terminalSnapshot({ mode: "failed", failureType: "coreDestroyed" });
  assert.equal(evaluateQualificationOutcome(passingRecorder(), destroyed, shiftProfile), destroyed);
});

test("qualification shift report exposes the metrics that decide the result", () => {
  const recorder = passingRecorder();
  const outcome = evaluateQualificationOutcome(recorder, terminalSnapshot(), shiftProfile);
  const report = buildShiftReport(recorder, outcome);

  assert.deepEqual(report.stats.slice(0, 3), [
    ["results.stats.shiftTime", "3:00"],
    ["results.stats.gridCompliance", "63%"],
    ["results.stats.phasesPassed", "3 / 4"],
  ]);
});

test("real qualification simulation rejects static controls and accepts phase tracking", () => {
  const fixed = runQualification(() => ({
    fuelInjection: 50,
    magneticField: 50,
    coolantFlow: 50,
  }));
  assert.equal(fixed.outcome.mode, "failed");
  assert.equal(fixed.outcome.qualification.reasons.includes("gridCompliance"), true);

  const phaseControls = [
    [29, 61, 13],
    [56, 32, 49],
    [59, 63, 29],
    [85, 70, 26],
    [78, 70, 21],
  ];
  const managed = runQualification((snapshot) => {
    const index = snapshot.elapsed < 24 ? 0
      : snapshot.elapsed < 52 ? 1
        : snapshot.elapsed < 90 ? 2
          : snapshot.elapsed < 135 ? 3 : 4;
    const [fuelInjection, magneticField, coolantFlow] = phaseControls[index];
    return { fuelInjection, magneticField, coolantFlow };
  });
  assert.equal(managed.outcome.mode, "complete");
  assert.equal(managed.outcome.qualification.passed, true);
});

function runQualification(selectControls) {
  const simulation = createFusionCoreSimulation();
  const recorder = createShiftRecorder();
  simulation.start();
  let snapshot = simulation.getSnapshot();
  for (let index = 0; index < 1810 && snapshot.mode === "running"; index += 1) {
    const selected = selectControls(snapshot);
    const controls = {
      ...selected,
      ventActive: snapshot.plasmaTemp > 177,
      pulseActive: snapshot.coreStall > 75,
      fuelBlend: null,
      shiftProfile,
    };
    snapshot = simulation.update(0.1, controls);
    updateShiftRecorder(recorder, 0.1, snapshot, controls);
  }
  return {
    recorder,
    outcome: evaluateQualificationOutcome(recorder, snapshot, shiftProfile),
  };
}
