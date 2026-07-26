import assert from "node:assert/strict";
import test from "node:test";

import { OperatorThoughtRuntime } from "../src/game/OperatorThoughtRuntime.js";

test("operator thought runtime applies tutorial rules and deduplicates subtitles", () => {
  const target = new EventTarget();
  const subtitles = [];
  target.addEventListener("operatorgame:subtitle", (event) => subtitles.push(event.detail));
  const runtime = new OperatorThoughtRuntime({
    getActiveLevelId: () => "intro-shift",
    translate: (key) => `translated:${key}`,
    dispatchTarget: target,
  });
  const previous = { warning: { fieldWeak: false }, reactionStalled: false, phase: { name: "IGNITION" } };
  const snapshot = {
    mode: "running",
    elapsed: 5,
    warning: { fieldWeak: true, tempCritical: false },
    reactionStalled: false,
    phase: { name: "IGNITION" },
  };

  runtime.update(previous, snapshot, { fuelInjection: 0, coolantFlow: 0 });
  runtime.update(previous, snapshot, { fuelInjection: 0, coolantFlow: 0 });

  assert.equal(subtitles.length, 1);
  assert.equal(subtitles[0].id, "field-weak");
  assert.equal(subtitles[0].text, "translated:subtitles.field-weak");
});

test("operator thought runtime points toward the exit on the terminal corridor return", () => {
  const target = new EventTarget();
  const subtitles = [];
  target.addEventListener("operatorgame:subtitle", (event) => subtitles.push(event.detail));
  const runtime = new OperatorThoughtRuntime({
    getActiveLevelId: () => "exploring-around",
    translate: (key) => key,
    dispatchTarget: target,
  });
  assert.equal(runtime.handleLevelEvent({
    type: "triggerEntered",
    detail: { target: "MainCorridorEntrance" },
  }, { mode: "complete" }), true);
  assert.equal(subtitles[0].id, "shift-exit-corridor");
});
