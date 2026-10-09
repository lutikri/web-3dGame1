import assert from "node:assert/strict";
import test from "node:test";
import { collectLevelSoundKeys } from "../src/audio/LevelSoundCatalog.js";
import { createPrefabInstance } from "../src/prefabs/PrefabRegistry.js";
import { SOUND_REGISTRY } from "../src/audio/SoundRegistry.js";
import { readFileSync } from "node:fs";

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

test("panel audio is preloaded from its live sound assignments and resolves to converted Ogg files", () => {
  const panel = createPrefabInstance("LightPanel1", { name: "Panel" });
  const sounds = Object.values(panel.lightPanel.audio);
  const keys = collectLevelSoundKeys({ environment: { prefabs: [panel] }, soundRegistry: SOUND_REGISTRY });
  sounds.forEach((key) => {
    assert.ok(keys.includes(key));
    const bytes = readFileSync(new URL(`../${SOUND_REGISTRY[key].path}`, import.meta.url));
    assert.equal(bytes.subarray(0, 4).toString(), "OggS");
  });
  assert.equal(SOUND_REGISTRY.ElectricalBoxHum1.loop, true);
  panel.lightPanel.audio.humSoundKey = "Clock1_loop";
  assert.ok(collectLevelSoundKeys({ environment: { prefabs: [panel] }, soundRegistry: SOUND_REGISTRY }).includes("Clock1_loop"));
});

test("level sound catalog preloads tutorial presentation audio", () => {
  assert.deepEqual(collectLevelSoundKeys({
    levelId: "tutorial",
    environment: { tutorial: { enabled: true } },
    soundRegistry: { Footsteps1_Walk1: {}, UI_Hint2: {} },
  }), ["Footsteps1_Walk1", "UI_Hint2"]);
});

test("level sound catalog preloads sounds authored by trigger actions", () => {
  const soundRegistry = { MetalPipeImpactFall1: {} };
  const keys = collectLevelSoundKeys({
    levelId: "qualification",
    environment: {
      triggerSequences: [{ actions: [{ soundKey: "MetalPipeImpactFall1" }] }],
    },
    soundRegistry,
  });
  assert.deepEqual(keys, ["MetalPipeImpactFall1"]);
});
