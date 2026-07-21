import assert from "node:assert/strict";
import test from "node:test";
import { DebugToolsRuntime } from "../src/ui/debug/DebugToolsRuntime.js";

test("debug tools runtime lazily owns hub visibility and configured workspace", () => {
  const calls = [];
  const hub = { ensureWorkspace: () => calls.push("workspace"), setVisible: (value) => value, toggle: () => true };
  const runtime = new DebugToolsRuntime({
    config: { postProcessing: { debugPanel: { enabled: true } }, sceneDebug: { enabled: false } },
    factories: { createDebugHub: (options) => { calls.push(options.initialVisible); return hub; } },
    stopPositionGizmo() {},
  });
  runtime.setupConfiguredTools();
  assert.deepEqual(calls, [false, "workspace"]);
  assert.equal(runtime.setVisible(true), true);
  assert.equal(runtime.toggle(), true);
  assert.equal(runtime.getHub(), hub);
});

test("debug tools runtime does not create tools when both configs are disabled", () => {
  const runtime = new DebugToolsRuntime({ config: { postProcessing: {}, sceneDebug: {} }, factories: { createDebugHub: () => { throw new Error("unexpected"); } } });
  runtime.setupConfiguredTools();
  assert.equal(runtime.getHub(), null);
});
