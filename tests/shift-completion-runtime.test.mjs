import assert from "node:assert/strict";
import test from "node:test";

import { ShiftCompletionRuntime, resolveOutcomeNarrationKey } from "../src/game/ShiftCompletionRuntime.js";

const config = {
  feedback: {
    terminal: {
      instrumentShutdownSeconds: 1,
      destroyedBlackoutSeconds: 2,
      emergencyLightSettleSeconds: 0.5,
      resultsHoldSeconds: 0.5,
    },
  },
};

test("terminal outcomes select the authored narrator line", () => {
  assert.equal(resolveOutcomeNarrationKey({ mode: "complete" }), "passed");
  assert.equal(resolveOutcomeNarrationKey({ mode: "failed", failureType: "qualityFailure" }), "insufficient");
  assert.equal(resolveOutcomeNarrationKey({ mode: "failed", failureType: "coreDestroyed" }), "trip");
});

function terminalSnapshot(overrides = {}) {
  return {
    mode: "complete",
    failureType: null,
    plasmaTemp: 100,
    containment: 80,
    powerOutput: 600,
    burnRate: 20,
    coreStress: 30,
    outputSurge: 10,
    reactionEfficiency: 90,
    shutdownLevel: 0,
    ...overrides,
  };
}

test("shift completion owns terminal timing, presentation decay, and result display", () => {
  let stopped = 0;
  const narration = [];
  const shown = [];
  const resultsController = {
    visible: false,
    show(snapshot) {
      shown.push(snapshot);
      this.visible = true;
    },
  };
  const runtime = new ShiftCompletionRuntime({
    config,
    initialMode: "running",
    createStartupPattern: () => [0.4, 0.6],
    getStartupDuration: () => 1,
    stopCoreLoop: () => { stopped += 1; },
    emitThought: () => {},
    playOutcomeNarration: (line) => narration.push(line),
    canUnlockBulkhead: () => false,
    unlockBulkhead: () => {},
    shouldWaitForDoorExit: () => false,
    hasBulkhead: () => false,
    resultsController,
  });
  const snapshot = terminalSnapshot();

  runtime.update(0.25, snapshot);
  assert.equal(stopped, 1);
  assert.deepEqual(narration, ["passed"]);
  assert.equal(runtime.resultsSnapshot, snapshot);
  assert.equal(runtime.terminalElapsed, 0.25);
  assert.equal(runtime.resultsTimer, 1.25);

  const presentation = runtime.getPresentationSnapshot(snapshot);
  assert.ok(presentation.plasmaTemp < snapshot.plasmaTemp);
  assert.ok(presentation.shutdownLevel > 0);
  assert.equal(presentation.terminalElapsed, 0.25);

  runtime.update(1.25, snapshot);
  assert.deepEqual(shown, [snapshot]);
});

test("destroyed core waits for blackout, fluorescent restart, and settling", () => {
  let unlocked = 0;
  const runtime = new ShiftCompletionRuntime({
    config,
    initialMode: "running",
    createStartupPattern: () => [0.4, 0.6],
    getStartupDuration: () => 1,
    stopCoreLoop: () => {},
    emitThought: () => {},
    canUnlockBulkhead: () => true,
    unlockBulkhead: () => { unlocked += 1; },
    shouldWaitForDoorExit: () => true,
    hasBulkhead: () => true,
    resultsController: { visible: false, show: () => {} },
  });
  const snapshot = terminalSnapshot({ mode: "failed", failureType: "coreDestroyed" });

  runtime.update(3.49, snapshot);
  assert.equal(unlocked, 0);
  assert.equal(runtime.terminalStartupPattern.length, 2);
  assert.equal(runtime.getPresentationSnapshot(snapshot).terminalBlackout, false);

  runtime.update(0.01, snapshot);
  assert.equal(unlocked, 1);
});
