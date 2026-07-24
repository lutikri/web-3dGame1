import assert from "node:assert/strict";
import test from "node:test";

import { RenderWarmupRuntime } from "../src/runtime/RenderWarmupRuntime.js";

test("render warmup waits for visibility and settles complete frames behind the curtain", async () => {
  const calls = [];
  const documentRef = new EventTarget();
  documentRef.hidden = true;
  let frameTime = 0;
  let foregroundLeases = 0;
  const gl = {
    SYNC_GPU_COMMANDS_COMPLETE: 1,
    ALREADY_SIGNALED: 2,
    CONDITION_SATISFIED: 3,
    WAIT_FAILED: 4,
    fenceSync: () => ({}),
    clientWaitSync: () => gl.CONDITION_SATISFIED,
    deleteSync: () => calls.push("deleteSync"),
    flush: () => calls.push("flush"),
  };
  const runtime = new RenderWarmupRuntime({
    renderer: {
      compileAsync: async () => calls.push("compile"),
      getContext: () => gl,
    },
    scene: { updateMatrixWorld: () => calls.push("sceneMatrix") },
    camera: { updateMatrixWorld: () => calls.push("cameraMatrix") },
    prepare: async () => calls.push("prepare"),
    renderFrame: () => calls.push("render"),
    acquireForegroundLease: () => {
      foregroundLeases += 1;
      return () => { foregroundLeases -= 1; };
    },
    documentRef,
    setTimeoutFn: (callback) => callback(),
    requestAnimationFrameFn: (callback) => {
      frameTime += 100;
      callback(frameTime);
    },
    minimumSettleFrames: 2,
    settleDurationMs: 200,
  });

  const pending = runtime.warmup();
  await Promise.resolve();
  assert.equal(foregroundLeases, 1);
  assert.equal(calls.includes("render"), false);
  documentRef.hidden = false;
  documentRef.dispatchEvent(new Event("visibilitychange"));
  await pending;

  assert.equal(calls.filter((call) => call === "render").length, 2);
  assert.equal(calls.filter((call) => call === "flush").length, 2);
  assert.equal(calls.filter((call) => call === "deleteSync").length, 2);
  assert.equal(foregroundLeases, 0);
});
