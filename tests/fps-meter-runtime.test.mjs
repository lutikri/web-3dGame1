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

test("hidden fps meter keeps sampling without periodic DOM writes", () => {
  const element = { hidden: true, textContent: "FPS --", title: "" };
  const runtime = new FpsMeterRuntime(element);
  runtime.update(0.13);
  runtime.update(0.13);
  assert.equal(runtime.snapshot().fps, 7.7);
  assert.equal(element.textContent, "FPS --");
});

