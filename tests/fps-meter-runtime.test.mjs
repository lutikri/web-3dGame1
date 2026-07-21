import assert from "node:assert/strict";
import test from "node:test";

import { FpsMeterRuntime } from "../src/ui/debug/FpsMeterRuntime.js";

test("fps meter runtime samples frames and exposes a stable snapshot", () => {
  const element = { textContent: "", title: "" };
  const runtime = new FpsMeterRuntime(element);
  runtime.update(0.1);
  runtime.update(0.1);
  runtime.update(0.1);
  assert.equal(runtime.snapshot().fps, 10);
  assert.equal(runtime.snapshot().frameTimeMs, 100);
  assert.equal(element.textContent, "FPS 10");
});

