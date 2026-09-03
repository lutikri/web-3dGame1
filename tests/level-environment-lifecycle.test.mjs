import assert from "node:assert/strict";
import test from "node:test";

import { LevelEnvironmentLifecycle } from "../src/runtime/LevelEnvironmentLifecycle.js";

test("level environment lifecycle composes build, physics and ownership cleanup", async () => {
  const calls = [];
  const onProgress = () => {};
  const lifecycle = new LevelEnvironmentLifecycle({
    environments: { room: { lighting: {}, prefabs: [] } },
    lighting: { createLevel: (id) => calls.push(`light:${id}`) },
    sceneBuilder: {
      build: async (runtime, levelId, environment, options) => {
        calls.push("build");
        assert.equal(options.onProgress, onProgress);
      },
    },
    disposeOwned: (id) => calls.push(`dispose:${id}`),
    rebuildStaticPhysics: () => calls.push("physics"),
    rebuildDebugPanels: () => calls.push("debug"),
    updateActiveEnvironment: () => calls.push("active"),
  });
  const runtime = await lifecycle.load("room", { onProgress });
  assert.deepEqual(calls, ["light:room", "build", "physics", "active"]);
  await lifecycle.dispose(runtime);
  assert.equal(calls.at(-1), "dispose:room");
});

test("level environment lifecycle rejects unknown environments", async () => {
  const lifecycle = new LevelEnvironmentLifecycle({ environments: {} });
  await assert.rejects(() => lifecycle.load("missing"), /Unknown environment/);
});
