import assert from "node:assert/strict";
import test from "node:test";
import { ScreenshotCaptureRuntime } from "../src/runtime/ScreenshotCaptureRuntime.js";

function fixture() {
  const listeners = new Map();
  const urls = [];
  const revoked = [];
  const downloads = [];
  const timers = new Map();
  let captures = 0;
  let encode;
  let ready = true;
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: (source) => assert.equal(source.width, 800) }),
    toBlob: (callback, type) => { assert.equal(type, "image/png"); encode = callback; },
  };
  const runtime = new ScreenshotCaptureRuntime({
    captureFrame: (copy) => {
      captures += 1;
      return { canvas: copy({ width: 800, height: 600 }), width: 800, height: 600, samples: 8 };
    },
    documentRef: {
      addEventListener: (name, handler) => listeners.set(name, handler),
      removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); },
      body: { append() {} },
      createElement: (type) => type === "canvas" ? canvas : {
        click() { downloads.push({ href: this.href, filename: this.download }); },
        remove() {},
      },
    },
    urlApi: {
      createObjectURL: (blob) => { urls.push(blob); return "blob:screenshot"; },
      revokeObjectURL: (url) => revoked.push(url),
    },
    canCapture: () => ready,
    now: () => new Date("2026-10-05T10:20:30.000Z"),
    setTimeoutFn: (handler) => { timers.set(1, handler); return 1; },
    clearTimeoutFn: (id) => timers.delete(id),
  });
  return {
    runtime, listeners, urls, revoked, downloads, timers, canvas,
    finish: (blob = new Blob(["png"], { type: "image/png" })) => encode(blob),
    captures: () => captures,
    setReady: (value) => { ready = value; },
  };
}

test("PNG export copies before encoding, downloads once and releases its canvas and URL", async () => {
  const f = fixture();
  const first = f.runtime.capture();
  assert.equal(f.runtime.capture(), first);
  await Promise.resolve();
  assert.equal(f.captures(), 1);
  assert.equal(f.canvas.width, 800);
  assert.equal(f.downloads.length, 0);
  f.finish();
  const result = await first;
  assert.deepEqual(result, { filename: "baseload-2026-10-05T10-20-30-000Z-800x600.png", width: 800, height: 600, samples: 8 });
  assert.equal(f.downloads.length, 1);
  assert.equal(f.canvas.width, 0);
  f.timers.get(1)();
  assert.deepEqual(f.revoked, ["blob:screenshot"]);
  assert.equal(f.timers.size, 0);
});

test("F9 ignores repeats, editing, modifiers and loading, and its listener has cleanup", async () => {
  const f = fixture();
  f.runtime.wire();
  f.runtime.wire();
  let prevented = 0;
  const event = { code: "F9", target: { tagName: "CANVAS" }, preventDefault: () => { prevented += 1; } };
  const handler = f.listeners.get("keydown");
  for (const changed of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true }, { metaKey: true }, { target: { tagName: "INPUT" } }, { code: "F8" }]) handler({ ...event, ...changed });
  f.setReady(false);
  handler(event);
  f.setReady(true);
  assert.equal(prevented, 0);
  handler(event);
  await Promise.resolve();
  assert.equal(prevented, 1);
  assert.equal(f.captures(), 1);
  f.finish();
  await f.runtime.pending;
  f.runtime.dispose();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.revoked, ["blob:screenshot"]);
});

test("encoding failure frees the staging canvas and permits retry", async () => {
  const f = fixture();
  const pending = f.runtime.capture();
  await Promise.resolve();
  f.finish(null);
  await assert.rejects(pending, /encode screenshot PNG/);
  assert.equal(f.canvas.width, 0);
  assert.equal(f.downloads.length, 0);
  const retry = f.runtime.capture();
  await Promise.resolve();
  f.finish();
  await retry;
  f.runtime.dispose();
});

test("disposing during encoding prevents a late download", async () => {
  const f = fixture();
  const pending = f.runtime.capture();
  await Promise.resolve();
  f.runtime.dispose();
  f.finish();
  await assert.rejects(pending, /disposed/);
  assert.equal(f.downloads.length, 0);
  assert.equal(f.canvas.width, 0);
});
