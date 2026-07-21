import test from "node:test";
import assert from "node:assert/strict";
import { DeferredTextureUpgradeQueue } from "../src/runtime/DeferredTextureUpgradeQueue.js";

test("deferred texture upgrades wait for readiness and run serially", async () => {
  const timers = [];
  const windowRef = { setTimeout: (callback) => { timers.push(callback); } };
  let ready = false;
  const order = [];
  const queue = new DeferredTextureUpgradeQueue({ windowRef, canStart: () => ready, delayMs: 0 });
  queue.schedule(async () => { order.push("first"); });
  assert.equal(timers.length, 1);
  ready = true;
  timers.shift()();
  timers.shift()();
  timers.shift()();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(order, ["first"]);
  assert.equal(queue.active, false);
});
