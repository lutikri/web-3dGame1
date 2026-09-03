import test from "node:test";
import assert from "node:assert/strict";
import { LevelRuntimeManager } from "../src/runtime/LevelRuntimeManager.js";

test("a transition disposes the previous runtime exactly once", async () => {
  const disposed = [];
  const contexts = [];
  const manager = new LevelRuntimeManager({
    load: async (levelId, context) => {
      contexts.push(context);
      return { levelId };
    },
    dispose: async (runtime) => disposed.push(runtime.levelId),
  });
  await manager.request("intro");
  const progressContext = { onProgress: () => {} };
  await manager.request("exploring", progressContext);
  assert.equal(manager.snapshot().levelId, "exploring");
  assert.deepEqual(disposed, ["intro"]);
  assert.equal(contexts.at(-1), progressContext);
});

test("latest request wins during rapid route changes", async () => {
  const disposed = [];
  let markLoadStarted;
  const loadStarted = new Promise((resolve) => {
    markLoadStarted = resolve;
  });
  let releaseLoad;
  const loadGate = new Promise((resolve) => {
    releaseLoad = resolve;
  });
  const manager = new LevelRuntimeManager({
    load: async (levelId) => {
      if (levelId === "exploring") {
        markLoadStarted();
        await loadGate;
      }
      return { levelId };
    },
    dispose: async (runtime) => disposed.push(runtime.levelId),
  });

  await manager.request("intro");
  const exploring = manager.request("exploring");
  await loadStarted;
  const menu = manager.request("menu-preview");
  releaseLoad();
  await Promise.all([exploring, menu]);

  assert.equal(manager.snapshot().levelId, "menu-preview");
  assert.ok(disposed.includes("intro"));
  assert.ok(disposed.includes("exploring"));
});
