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

test("core panel alarms follow stress, red temperature, and stall policies", () => {
  const { runtime, loops, oneShots } = createHarness();
  const danger = snapshot({ plasmaTemp: 156, coreStress: 91, warning: { coreStall: true } });
  runtime.update(0, { levelId: "room", active: true, snapshot: danger });
  assert.equal(loops.find(([id]) => id === "panel:alarm:stress")[3], true);
  assert.equal(loops.find(([id]) => id === "panel:alarm:stall")[3], true);
  assert.equal(oneShots.filter(([, key]) => key === "Core1_Panel1_AlarmHighTemp1").length, 1);

  for (let index = 0; index < 10; index += 1) {
    runtime.update(2.3, { levelId: "room", active: true, snapshot: danger });
  }
  assert.equal(oneShots.filter(([, key]) => key === "Core1_Panel1_AlarmHighTemp1").length, 8);

  runtime.update(0, { levelId: "room", active: true, snapshot: snapshot() });
  runtime.update(0, { levelId: "room", active: true, snapshot: danger });
  assert.equal(oneShots.filter(([, key]) => key === "Core1_Panel1_AlarmHighTemp1").length, 9);
});
