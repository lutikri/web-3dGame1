import test from "node:test";
import assert from "node:assert/strict";
import { runLevelRuntimeSmoke } from "../src/runtime/RuntimeSmoke.js";

test("runtime smoke rejects foreign level ownership", async () => {
  const api = {
    startLevel: async () => true,
    resetForMenu: async () => true,
    inspectRuntime: () => ({
      loadedRuntimeLevelId: "intro-shift",
      environmentRoots: ["intro-shift", "exploring-around"],
      collisionLevels: ["intro-shift"],
      prefabInstances: ["intro-shift:Lamp"],
      physics: { activeSceneKey: "intro-shift" },
    }),
  };
  await assert.rejects(runLevelRuntimeSmoke(api), /foreign or missing entries/);
});
