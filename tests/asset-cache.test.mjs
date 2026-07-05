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
