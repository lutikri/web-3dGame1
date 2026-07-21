import assert from "node:assert/strict";
import test from "node:test";
import { LevelBindingRuntime } from "../src/levels/LevelBindingRuntime.js";

test("level binding runtime toggles prefab light state and startup", () => {
  const light = { enabled: false, startupDelaySeconds: 0.5, fluorescentStartup: true };
  const instance = { root: {}, light: { visible: false, intensity: 0 }, afterglowRemaining: 2 };
  const calls = [];
  const runtime = new LevelBindingRuntime({
    config: { levelEnvironments: { room: { prefabs: [{ name: "lamp", light }] } } },
    levelPrefabInstances: new Map([["room:lamp", instance]]), getLevelEnvironmentId: (id) => id,
    toggleRoomLights() {}, playSoundAtObject: () => calls.push("sound"), createFixtureFlickerState: () => ({ active: true }),
    createFluorescentStartupPattern: () => [1], applyLevelPrefabConfig: () => calls.push("apply"),
    updateControlTooltip: () => calls.push("tooltip"), warn() {},
  });
  assert.equal(runtime.togglePrefabLight("room", "lamp"), true);
  assert.equal(light.enabled, true);
  assert.equal(instance.light.visible, true);
  assert.equal(instance.startupElapsed, 0.5);
  assert.deepEqual(instance.startupPattern, [1]);
  assert.deepEqual(calls, ["sound", "apply", "tooltip"]);
});

test("level binding runtime routes room light actions", () => {
  let toggles = 0;
  const runtime = new LevelBindingRuntime({ getLevelEnvironmentId: (id) => id, toggleRoomLights: () => { toggles += 1; }, warn() {} });
  assert.equal(runtime.execute({ action: "toggleRoomLights" }, "room"), true);
  assert.equal(toggles, 1);
});
