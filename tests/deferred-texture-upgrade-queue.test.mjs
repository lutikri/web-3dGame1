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

test("deferred texture upgrades pause before idle work and resume after a quiet delay", async () => {
  const timers = [];
  const idleCallbacks = [];
  const windowRef = {
    setTimeout: (callback, delay) => { timers.push({ callback, delay }); },
    requestIdleCallback: (callback) => { idleCallbacks.push(callback); },
  };
  const order = [];
  const queue = new DeferredTextureUpgradeQueue({
    windowRef,
    canStart: () => true,
    delayMs: 40,
    pollMs: 5,
  });

  queue.enqueue(async () => { order.push("first"); });
  queue.pause();
  idleCallbacks.shift()();
  assert.deepEqual(order, []);
  assert.equal(queue.active, false);

  queue.resume();
  assert.equal(timers.at(-1).delay, 40);
  timers.pop().callback();
  assert.equal(idleCallbacks.length, 1);
  idleCallbacks.shift()();
  await Promise.resolve();
  await Promise.resolve();

  assert.deepEqual(order, ["first"]);
  assert.equal(queue.active, false);
});

test("a new pause cancels a pending resume", () => {
  const timers = [];
  const windowRef = { setTimeout: (callback) => { timers.push(callback); } };
  const order = [];
  const queue = new DeferredTextureUpgradeQueue({ windowRef, canStart: () => true, delayMs: 0 });

  queue.pause();
  queue.resume();
  queue.pause();
  timers.shift()();
  queue.enqueue(async () => { order.push("started"); });

  assert.deepEqual(order, []);
  assert.equal(queue.active, false);
});
