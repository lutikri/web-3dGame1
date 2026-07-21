import assert from "node:assert/strict";
import test from "node:test";

import { AnimationLoop } from "../src/runtime/AnimationLoop.js";

test("animation loop clamps delta and executes ordered runtime steps", () => {
  const calls = [];
  let nextFrame = null;
  const loop = new AnimationLoop({
    clock: { getDelta: () => 0.2 },
    steps: [
      (dt) => calls.push(["simulation", dt]),
      (dt) => calls.push(["render", dt]),
    ],
    requestFrame: (callback) => { nextFrame = callback; },
    requestBackgroundFrame: () => assert.fail("foreground loop used background scheduler"),
    isBackground: () => false,
  });

  loop.start();
  assert.deepEqual(calls, [["simulation", 0.05], ["render", 0.05]]);
  assert.equal(typeof nextFrame, "function");

  loop.stop();
  nextFrame();
  assert.equal(calls.length, 2);
});

test("animation loop throttles scheduling while the page is in background", () => {
  let backgroundFrames = 0;
  const loop = new AnimationLoop({
    clock: { getDelta: () => 0.01 },
    steps: [() => {}],
    requestFrame: () => assert.fail("background loop used foreground scheduler"),
    requestBackgroundFrame: () => { backgroundFrames += 1; },
    isBackground: () => true,
  });

  loop.start();
  assert.equal(backgroundFrames, 1);
});

