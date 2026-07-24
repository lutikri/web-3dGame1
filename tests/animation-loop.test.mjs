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
    requestDelayedFrame: () => assert.fail("foreground loop used delayed scheduler"),
    getFrameDelay: () => null,
  });

  loop.start();
  assert.deepEqual(calls, [["simulation", 0.05], ["render", 0.05]]);
  assert.equal(typeof nextFrame, "function");

  loop.stop();
  nextFrame();
  assert.equal(calls.length, 2);
});

test("animation loop uses the delay selected by its scheduling policy", () => {
  const delays = [];
  const loop = new AnimationLoop({
    clock: { getDelta: () => 0.01 },
    steps: [() => {}],
    requestFrame: () => assert.fail("delayed loop used foreground scheduler"),
    requestDelayedFrame: (_callback, delayMs) => { delays.push(delayMs); },
    getFrameDelay: () => 1000,
  });

  loop.start();
  assert.deepEqual(delays, [1000]);
});

test("animation loop wakes immediately when scheduling state changes", () => {
  let delayMs = 1000;
  let schedulingListener;
  let delayedFrame;
  let foregroundFrame;
  let steps = 0;
  const schedulingPolicy = {
    getDelayMs: () => delayMs,
    subscribe: (listener) => {
      schedulingListener = listener;
      return () => { schedulingListener = null; };
    },
  };
  const loop = new AnimationLoop({
    clock: { getDelta: () => 0.01 },
    steps: [() => { steps += 1; }],
    schedulingPolicy,
    requestFrame: (callback) => { foregroundFrame = callback; },
    requestDelayedFrame: (callback) => { delayedFrame = callback; },
  });

  loop.start();
  delayMs = null;
  schedulingListener();
  delayedFrame();
  assert.equal(steps, 1);
  foregroundFrame();
  assert.equal(steps, 2);
  loop.stop();
});
