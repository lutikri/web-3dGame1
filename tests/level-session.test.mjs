import test from "node:test";
import assert from "node:assert/strict";
import { LevelSession } from "../src/levels/LevelSession.js";

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("level session completes combined time and event objectives", () => {
  const session = new LevelSession({
    levelId: "tutorial",
    storage: createStorage(),
    config: {
      objectives: [
        { id: "operate", type: "survive", seconds: 3 },
        { id: "exit", type: "event", event: "doorOpened", target: "TutorialDoor" },
      ],
    },
  });
  session.start({ resume: false });
  session.update(3, { shiftMode: "running" });
  assert.equal(session.snapshot().status, "running");
  session.emit("doorOpened", { target: "TutorialDoor" });
  assert.equal(session.snapshot().status, "complete");
});

test("level session persists and resumes current shift state", () => {
  const storage = createStorage();
  const config = { objectives: [{ id: "operate", type: "survive", seconds: 10 }] };
  const first = new LevelSession({ levelId: "tutorial", config, storage });
  first.start({ resume: false });
  first.update(4, { shiftMode: "running" });
  first.setCheckpoint("game", { mode: "running", heat: 42 });
  first.persist();
  const resumed = new LevelSession({ levelId: "tutorial", config, storage });
  resumed.start();
  assert.equal(resumed.snapshot().activeShiftSeconds, 4);
  assert.deepEqual(resumed.getCheckpoint("game"), { mode: "running", heat: 42 });
});

test("level bindings are selected by source and event", () => {
  const session = new LevelSession({
    levelId: "tutorial",
    storage: createStorage(),
    config: {
      bindings: [
        { source: "LightButton", event: "press", action: "togglePrefabLight", target: "CabinLamp" },
      ],
    },
  });
  assert.equal(session.bindingsFor("LightButton", "press")[0].target, "CabinLamp");
});
