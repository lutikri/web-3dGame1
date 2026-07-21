import assert from "node:assert/strict";
import test from "node:test";

import { LevelOwnedState, removeLevelEntries } from "../src/runtime/LevelOwnedState.js";

test("level owned state removes only the disposed level resources", () => {
  const removed = [];
  let materialDisposals = 0;
  const environmentModels = new Map([["a", { name: "env" }], ["a:prefabs", { name: "prefabs" }], ["b", {}]]);
  const collisionModels = new Map([["a", { name: "collision" }]]);
  const prefabInstances = new Map([
    ["a:lamp", { materialClones: [{ dispose: () => { materialDisposals += 1; } }], light: {} }],
    ["b:lamp", {}],
  ]);
  const interactive = [{ userData: { levelId: "a" } }, { userData: { levelId: "b" } }];
  const calls = [];
  const state = new LevelOwnedState({
    scene: { remove: (value) => removed.push(value.name) },
    environmentModels, collisionModels, prefabInstances, interactive,
    roomLightButtons: [], interiorFans: [],
    physics: { resetWorld: () => calls.push("physics") }, playerPosition: {},
    photometricLights: { unregister: () => calls.push("photometric") },
    lighting: { disposeLevel: () => calls.push("lighting") },
    audio: { disposeLevel: () => calls.push("audio") },
    stopEditing: () => calls.push("editing"), clearNarration: () => calls.push("narration"),
    clearLoadedLevel: () => calls.push("loaded"), resetCollision: () => calls.push("collision"),
  });
  state.disposeLevel("a");
  assert.deepEqual(removed, ["env", "prefabs", "collision"]);
  assert.equal(materialDisposals, 1);
  assert.equal(prefabInstances.has("a:lamp"), false);
  assert.equal(prefabInstances.has("b:lamp"), true);
  assert.deepEqual(interactive.map((item) => item.userData.levelId), ["b"]);
  assert.ok(calls.includes("collision"));
});

test("removeLevelEntries preserves foreign entries", () => {
  const entries = [{ userData: { levelId: "a" } }, { userData: { levelId: "b" } }];
  removeLevelEntries(entries, "a");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].userData.levelId, "b");
});
