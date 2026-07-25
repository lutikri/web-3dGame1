import assert from "node:assert/strict";
import test from "node:test";
import { collectLevelSoundKeys } from "../src/audio/LevelSoundCatalog.js";

test("level sound catalog combines runtime, panel and prefab capabilities", () => {
  const registry = Object.fromEntries([
    "runtime", "Footsteps1_Walk1", "Core1_StartupNormal1", "LampTurnOn1", "DoorBulk1_Open1", "customBuzz",
  ].map((key) => [key, {}]));
  const result = collectLevelSoundKeys({
    levelId: "room", runtimeSoundKeys: ["runtime"], hasOperatorPanel: true, soundRegistry: registry,
    environment: { prefabs: [{ light: {} }, { prefabType: "bulkheadDoor" }, { controlPost: { buzzSoundKey: "customBuzz" } }] },
  });
  assert.deepEqual(result, ["Core1_StartupNormal1", "DoorBulk1_Open1", "Footsteps1_Walk1", "LampTurnOn1", "customBuzz", "runtime"]);
});

test("level sound catalog filters unregistered sound keys", () => {
  assert.deepEqual(collectLevelSoundKeys({ levelId: "empty", soundRegistry: {}, environment: null }), []);
});

test("level sound catalog preloads tutorial presentation audio", () => {
  assert.deepEqual(collectLevelSoundKeys({
    levelId: "tutorial",
    environment: { tutorial: { enabled: true } },
    soundRegistry: { Footsteps1_Walk1: {}, UI_Hint2: {} },
  }), ["Footsteps1_Walk1", "UI_Hint2"]);
});
