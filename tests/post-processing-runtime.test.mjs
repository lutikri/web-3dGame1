import assert from "node:assert/strict";
import test from "node:test";

import { PostProcessingRuntime } from "../src/postprocessing/PostProcessingRuntime.js";

test("post-processing runtime owns disabled fallback lifecycle", () => {
  const calls = [];
  const runtime = new PostProcessingRuntime({
    config: { postProcessing: { enabled: false } },
    renderer: { render: () => calls.push("render") },
    scene: {},
    camera: {},
    assets: { dispose: () => calls.push("assets.dispose") },
    presets: {},
    getQuality: () => ({}),
    applyColorAdjustments: () => {},
    applyLensDistortion: () => {},
    applyLensEffects: () => {},
    setupRealism: () => calls.push("realism.setup"),
    renderRealism: () => false,
    resizeRealism: () => calls.push("realism.resize"),
    disposeRealism: () => calls.push("realism.dispose"),
    inspectRealism: () => ({ realismComposer: false }),
  });

  runtime.setup();
  runtime.render(0.016);
  runtime.resize(800, 600);
  assert.deepEqual(runtime.inspect(), { composer: false, realismComposer: false });
  runtime.dispose();
  assert.deepEqual(calls, [
    "realism.setup", "render", "realism.resize", "realism.dispose", "assets.dispose",
  ]);
});
