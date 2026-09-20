import assert from "node:assert/strict";
import test from "node:test";

import { AnnouncementSystemRuntime, getDemandSeverity } from "../src/audio/AnnouncementSystemRuntime.js";

function createHarness(emitterCount = 1) {
  const loops = [];
  const oneShots = [];
  const stoppedOneShots = [];
  const emitters = Array.from({ length: emitterCount }, (_, index) => ({
    root: { name: `pa-${index}` },
    radio: { refDistance: 0.7, maxDistance: 3.8 },
  }));
  const runtime = new AnnouncementSystemRuntime({
    audio: {
      setAttachedLoop: (...args) => loops.push(args),
      stopAttachedOneShots: (predicate) => {
        const candidates = [
          { id: "announcement:oneshot:SFX_Panel1_DemandRed1:pa-0:0", soundKey: "SFX_Panel1_DemandRed1" },
          { id: "narration:welcome", soundKey: "MessageEN_Welcome1" },
        ];
        candidates.filter(predicate).forEach((state) => stoppedOneShots.push(state.id));
      },
    },
    getEmitters: () => emitters,
    getFallbackEmitter: () => ({ name: "panel" }),
    playSound: (object, key) => oneShots.push([object.name, key]),
  });
  return { runtime, loops, oneShots, stoppedOneShots, emitters };
}

const snapshot = (warning = {}, overrides = {}) => ({
  mode: "running",
  plasmaTemp: 100,
  coreStress: 20,
  warning,
  ...overrides,
});

test("demand severity follows the panel yellow and red warning states", () => {
  assert.equal(getDemandSeverity({}, "underDemand"), "off");
  assert.equal(getDemandSeverity({ underDemand: true }, "underDemand"), "yellow");
  assert.equal(getDemandSeverity({ underDemand: true, underDemandCritical: true }, "underDemand"), "red");
});

test("demand alarms play once whenever under or over demand changes to yellow or red", () => {
  const { runtime, oneShots } = createHarness();
  runtime.update(0.1, { levelId: "room", active: true, snapshot: snapshot() });
  runtime.update(0.1, { levelId: "room", active: true, snapshot: snapshot({ underDemand: true }) });
  runtime.update(0.1, { levelId: "room", active: true, snapshot: snapshot({ underDemand: true }) });
  runtime.update(0.1, { levelId: "room", active: true, snapshot: snapshot({ underDemand: true, underDemandCritical: true }) });
  runtime.update(0.1, { levelId: "room", active: true, snapshot: snapshot({ underDemand: true, underDemandCritical: true }) });
  runtime.update(0.1, { levelId: "room", active: true, snapshot: snapshot({ underDemand: true }) });
  runtime.update(0.1, { levelId: "room", active: true, snapshot: snapshot() });
  runtime.update(0.1, { levelId: "room", active: true, snapshot: snapshot({ overDemand: true, overDemandCritical: true }) });

  assert.deepEqual(oneShots.map(([, key]) => key), [
    "SFX_Panel1_DemandYellow1",
    "SFX_Panel1_DemandRed1",
    "SFX_Panel1_DemandYellow1",
    "SFX_Panel1_DemandRed1",
  ]);
});

test("each announcement is emitted by every PA system in the active environment", () => {
  const { runtime, oneShots } = createHarness(3);
  runtime.update(0.1, {
    levelId: "room",
    active: true,
    snapshot: snapshot({ overDemand: true }),
  });
  assert.deepEqual(oneShots, [
    ["pa-0", "SFX_Panel1_DemandYellow1"],
    ["pa-1", "SFX_Panel1_DemandYellow1"],
    ["pa-2", "SFX_Panel1_DemandYellow1"],
  ]);
});

test("panel is used only as a fallback when the environment has no PA system", () => {
  const oneShots = [];
  const runtime = new AnnouncementSystemRuntime({
    audio: { setAttachedLoop: () => {} },
    getEmitters: () => [],
    getFallbackEmitter: () => ({ name: "panel" }),
    playSound: (object, key) => oneShots.push([object.name, key]),
  });
  runtime.update(0.1, {
    levelId: "room",
    active: true,
    snapshot: snapshot({ underDemand: true }),
  });
  assert.deepEqual(oneShots, [["panel", "SFX_Panel1_DemandYellow1"]]);
});

test("announcement system owns the existing stress, stall, and high-temperature alarms", () => {
  const { runtime, loops, oneShots } = createHarness();
  const danger = snapshot({ coreStall: true }, { plasmaTemp: 156, coreStress: 91 });
  runtime.update(0, { levelId: "room", active: true, snapshot: danger });
  assert.equal(loops.find(([id]) => id.startsWith("announcement:alarm:stress:"))[3], true);
  assert.equal(loops.find(([id]) => id.startsWith("announcement:alarm:stall:"))[3], true);
  assert.equal(oneShots.filter(([, key]) => key === "Core1_Panel1_AlarmHighTemp1").length, 1);

  for (let index = 0; index < 10; index += 1) {
    runtime.update(2.3, { levelId: "room", active: true, snapshot: danger });
  }
  assert.equal(oneShots.filter(([, key]) => key === "Core1_Panel1_AlarmHighTemp1").length, 8);
});

test("announcement loops inherit their calibrated volume from the sound registry", () => {
  const { runtime, loops } = createHarness();
  runtime.update(0.1, {
    levelId: "room",
    active: true,
    snapshot: snapshot({ coreStall: true }, { coreStress: 81 }),
  });

  const alarmLoops = loops.filter(([id]) => id.startsWith("announcement:alarm:"));
  assert.equal(alarmLoops.length, 2);
  alarmLoops.forEach(([, , , , options]) => assert.equal(options.volume, undefined));
});

test("announcement stress alarm starts above eighty or during a rapid stress rise", () => {
  const { runtime, loops } = createHarness();
  runtime.update(1, { levelId: "room", active: true, snapshot: snapshot({}, { coreStress: 60 }) });
  assert.equal(loops.find(([id]) => id.startsWith("announcement:alarm:stress:"))[3], false);
  loops.length = 0;
  runtime.update(1, { levelId: "room", active: true, snapshot: snapshot({}, { coreStress: 67 }) });
  assert.equal(loops.find(([id]) => id.startsWith("announcement:alarm:stress:"))[3], true);
});

test("alarm silence stops permitted announcements and leaves unrelated audio alone", () => {
  const { runtime, loops, oneShots, stoppedOneShots } = createHarness();
  assert.equal(runtime.setSilenced(true), true);
  runtime.update(0.1, {
    levelId: "room",
    active: true,
    snapshot: snapshot({ coreStall: true, underDemand: true }, { coreStress: 81, plasmaTemp: 160 }),
  });

  assert.deepEqual(stoppedOneShots, ["announcement:oneshot:SFX_Panel1_DemandRed1:pa-0:0"]);
  assert.equal(loops.every(([, , , active]) => active === false), true);
  assert.deepEqual(oneShots, []);
  assert.equal(runtime.toggleSilenced(), false);
});

test("core damage announcement cannot be silenced", () => {
  const { runtime, oneShots } = createHarness();
  runtime.setSilenced(true);
  runtime.update(0.1, {
    levelId: "room",
    active: true,
    snapshot: snapshot({}, {
      mode: "failed",
      failureType: "coreDestroyed",
      coreStress: 100,
      plasmaTemp: 180,
    }),
  });

  assert.deepEqual(oneShots.map(([, key]) => key), ["Core1_Panel1_AlarmHighTemp1"]);
});
