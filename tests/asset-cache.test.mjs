import test from "node:test";
import assert from "node:assert/strict";
import { AssetCache } from "../src/runtime/AssetCache.js";

test("asset cache loads a source once and creates isolated instances", async () => {
  let loads = 0;
  const cache = new AssetCache({
    load: async (key) => {
      loads += 1;
      return { key, nested: { value: 1 } };
    },
    instantiate: (source) => structuredClone(source),
  });
  const first = await cache.instantiate("room.glb");
  const second = await cache.instantiate("room.glb");
  first.nested.value = 9;
  assert.equal(loads, 1);
  assert.equal(second.nested.value, 1);
});

test("failed loads do not poison future retries", async () => {
  let attempts = 0;
  const cache = new AssetCache({
    load: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("temporary");
      return { ok: true };
    },
    instantiate: (source) => ({ ...source }),
  });
  await assert.rejects(cache.instantiate("retry.glb"), /temporary/);
  assert.deepEqual(await cache.instantiate("retry.glb"), { ok: true });
  assert.equal(attempts, 2);
});

test("asset cache reports source phases once and clone timing for every instance", async () => {
  let clock = 0;
  const timings = [];
  const cache = new AssetCache({
    now: () => ++clock,
    load: async (_key, reportTiming) => {
      reportTiming({ fetchMs: 12, bytes: 4096 });
      reportTiming({ parseMs: 8 });
      return { value: 1 };
    },
    instantiate: (source) => ({ ...source }),
  });
  const context = { kind: "prefab", name: "Lamp", onTiming: (entry) => timings.push(entry) };

  await cache.instantiate("lamp.glb", context);
  await cache.instantiate("lamp.glb", context);

  assert.equal(timings[0].cacheHit, false);
  assert.equal(timings[0].fetchMs, 12);
  assert.equal(timings[0].parseMs, 8);
  assert.equal(timings[0].bytes, 4096);
  assert.equal(timings[0].cloneMs, 1);
  assert.equal(timings[1].cacheHit, true);
  assert.equal(timings[1].fetchMs, 0);
  assert.equal(timings[1].parseMs, 0);
  assert.equal(timings[1].cloneMs, 1);
});
