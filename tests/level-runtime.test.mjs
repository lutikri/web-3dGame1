import test from "node:test";
import assert from "node:assert/strict";
import { LevelRuntime } from "../src/runtime/LevelRuntime.js";

test("level runtime disposes resources once in reverse ownership order", async () => {
  const calls = [];
  const runtime = new LevelRuntime("test");
  runtime.defer(() => calls.push("first"));
  runtime.defer(async () => calls.push("second"));
  runtime.activate();
  await Promise.all([runtime.dispose(), runtime.dispose()]);
  assert.deepEqual(calls, ["second", "first"]);
  assert.equal(runtime.state, "disposed");
});

test("level runtime continues cleanup after a disposer fails", async () => {
  const calls = [];
  const runtime = new LevelRuntime("test");
  runtime.defer(() => calls.push("survived"));
  runtime.defer(() => {
    throw new Error("broken resource");
  });
  await assert.rejects(runtime.dispose(), AggregateError);
  assert.deepEqual(calls, ["survived"]);
  assert.equal(runtime.state, "disposed");
});
