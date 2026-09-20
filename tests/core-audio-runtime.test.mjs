import assert from "node:assert/strict";
import test from "node:test";

import { CoreAudioRuntime } from "../src/audio/CoreAudioRuntime.js";

function createHarness() {
  const loops = [];
  const oneShots = [];
  const core = { name: "core" };
  const panel = { name: "panel" };
  const runtime = new CoreAudioRuntime({
    audio: { setAttachedLoop: (...args) => loops.push(args) },
    getCoreAnchor: () => core,
    getPanel: () => panel,
    playSound: (object, key) => oneShots.push([object.name, key]),
  });
  return { runtime, loops, oneShots };
}

const snapshot = (overrides = {}) => ({
  mode: "running",
  plasmaTemp: 100,
  coreStress: 20,
  warning: { coreStall: false },
  ...overrides,
});

test("core audio crossfades the default loop across authored transition durations", () => {
  const { runtime, loops, oneShots } = createHarness();
  runtime.update(0, { levelId: "room", active: true, snapshot: snapshot() });
  assert.deepEqual(oneShots, [["core", "Core1_StartupNormal1"]]);
  assert.equal(loops.find(([id]) => id === "core:default")[4].volume, 0);

  loops.length = 0;
  runtime.update(27.85 / 2, { levelId: "room", active: true, snapshot: snapshot() });
  assert.ok(Math.abs(loops.find(([id]) => id === "core:default")[4].volume - 0.32) < 0.001);

  runtime.update(0, { levelId: "room", active: true, snapshot: snapshot({ mode: "complete" }) });
  assert.equal(oneShots.at(-1)[1], "Core1_TurnDown");
  loops.length = 0;
  runtime.update(20.15 / 2, { levelId: "room", active: true, snapshot: snapshot({ mode: "complete" }) });
  assert.ok(Math.abs(loops.find(([id]) => id === "core:default")[4].volume - 0.32) < 0.001);
});

test("core audio leaves panel alarm playback to the announcement system", () => {
  const { runtime, loops, oneShots } = createHarness();
  runtime.update(1, {
    levelId: "room",
    active: true,
    snapshot: snapshot({ plasmaTemp: 170, coreStress: 99, warning: { coreStall: true } }),
  });
  assert.equal(loops.some(([id]) => id.includes("alarm")), false);
  assert.equal(oneShots.some(([, key]) => key.includes("Alarm")), false);
});
