import assert from "node:assert/strict";
import test from "node:test";

import { createLevelTutorialRuntime } from "../src/app/LevelTutorialRuntime.js";

function createTimerWindow() {
  const pending = [];
  return {
    window: {
      setTimeout: (callback, delay) => {
        const task = { callback, delay, cancelled: false };
        pending.push(task);
        return task;
      },
      clearTimeout: (task) => { if (task) task.cancelled = true; },
    },
    runNext() {
      let task = pending.shift();
      while (task?.cancelled) task = pending.shift();
      if (task) task.callback();
      return task?.delay;
    },
  };
}

test("level tutorial spaces hints, does not replay hover, and retires the door hint on input", () => {
  const previousWindow = globalThis.window;
  const timers = createTimerWindow();
  const hints = [];
  const worlds = [];
  const thoughts = [];
  globalThis.window = timers.window;
  const runtime = createLevelTutorialRuntime({
    hintQueue: {
      show: (hint) => hints.push(hint.id),
      clear: () => hints.push("clear"),
    },
    worldHint: {
      show: (target) => worlds.push(target),
      clear: () => worlds.push(null),
    },
    emitThought: (id) => thoughts.push(id),
    isAllowed: () => true,
  });
  const config = {
    enabled: true,
    spawnHintDelaySeconds: 2,
    advanceHintDelaySeconds: 2,
    postMovementDelaySeconds: 5,
    entryDoorTarget: "serviceDoor_Exit2",
    welcomeTrigger: "WelcomeEntry",
    mainCorridorTrigger: "MainCorridorEntrance",
    controlBoothTrigger: "ControlBooth",
    controlBoothNarration: "panelTutorial",
    mainCorridorThought: "tutorial-control-booth",
    startCoreThought: "tutorial-start-core",
  };

  try {
    runtime.start({ levelId: "exploring-around", config });
    assert.equal(timers.runNext(), 2000);
    assert.equal(hints.at(-1), "look");

    runtime.handleMouseMove({ movementX: 3, movementY: 0 });
    assert.equal(hints.at(-1), "clear");
    assert.equal(timers.runNext(), 2000);
    assert.equal(hints.at(-1), "move");

    runtime.handleKey({ code: "KeyW", repeat: false });
    assert.equal(timers.runNext(), 5000);
    assert.equal(hints.at(-1), "door-look");
    assert.equal(worlds.at(-1).prefab, "serviceDoor_Exit2");
    const presentations = hints.length;
    runtime.handleHover({ levelId: "exploring-around", kind: "doorLatchHandle", prefabName: "anotherDoor" });
    assert.equal(hints.length, presentations);

    runtime.handleHover({ levelId: "exploring-around", kind: "doorLatchHandle", prefabName: "serviceDoor_Exit2" });
    assert.equal(hints.at(-1), "door-look");
    assert.equal(timers.runNext(), 400);
    assert.equal(hints.at(-1), "door-hold");
    assert.equal(worlds.at(-1).indicator, "!");
    const holdPresentations = hints.length;
    runtime.handleHover({ levelId: "exploring-around", kind: "none", prefabName: "" });
    assert.equal(hints.at(-1), "door-hold");
    runtime.handleHover({ levelId: "exploring-around", kind: "doorLatchHandle", prefabName: "serviceDoor_Exit2" });
    assert.equal(hints.length, holdPresentations);

    runtime.handleInputAction({ levelId: "exploring-around", action: "primary" });
    assert.equal(hints.at(-1), "door-hold");
    runtime.handleInputAction({
      levelId: "exploring-around",
      action: "primary",
      kind: "doorLatchHandle",
      prefabName: "anotherDoor",
    });
    assert.equal(hints.at(-1), "door-hold");
    runtime.handleInputAction({
      levelId: "exploring-around",
      action: "primary",
      kind: "doorLatchHandle",
      prefabName: "serviceDoor_Exit2",
    });
    assert.equal(hints.at(-1), "clear");
    assert.equal(worlds.at(-1), null);
    runtime.handleEvent({ type: "narrationStarted", detail: { line: "welcome" } });
    runtime.handleEvent({ type: "narrationEnded", detail: { line: "welcome" } });
    timers.runNext();
    assert.equal(hints.at(-1), "brief");
    runtime.handleHover({ levelId: "exploring-around", kind: "briefSheet" });
    assert.equal(hints.at(-1), "brief");
    assert.equal(timers.runNext(), 400);
    assert.equal(hints.at(-1), "brief-hold");
    const briefPresentations = hints.length;
    runtime.handleHover({ levelId: "exploring-around", kind: "none" });
    assert.equal(hints.at(-1), "brief-hold");
    assert.equal(hints.length, briefPresentations);
    runtime.handleEvent({ type: "itemStored", detail: { target: "brief" } });
    timers.runNext();
    assert.equal(hints.at(-1), "brief-select");
    runtime.handleEvent({ type: "briefOpened", detail: { target: "brief" } });
    assert.equal(hints.at(-1), "clear");

    runtime.handleEvent({ type: "triggerEntered", detail: { target: "MainCorridorEntrance" } });
    assert.deepEqual(thoughts, ["tutorial-control-booth"]);
    runtime.handleEvent({ type: "triggerEntered", detail: { target: "ControlBooth" } });
    runtime.handleEvent({ type: "narrationStarted", detail: { line: "panelTutorial" } });
    timers.runNext();
    assert.equal(hints.at(-1), "clear");
    runtime.handleEvent({ type: "narrationEnded", detail: { line: "panelTutorial" } });
    assert.equal(hints.at(-1), "lean");
    runtime.handleHover({ levelId: "exploring-around", kind: "controlKnob" });
    assert.equal(hints.at(-1), "lean");
    assert.equal(timers.runNext(), 400);
    runtime.handleInputAction({ levelId: "exploring-around", action: "lean" });
    timers.runNext();
    assert.equal(hints.at(-1), "wheel");
    const controlPresentations = hints.length;
    runtime.handleHover({ levelId: "exploring-around", kind: "none" });
    assert.equal(hints.at(-1), "wheel");
    runtime.handleHover({ levelId: "exploring-around", kind: "controlKnob" });
    assert.equal(hints.length, controlPresentations);
  } finally {
    runtime.stop();
    globalThis.window = previousWindow;
  }
});

test("narration and early core start retire stale tutorial hints", () => {
  const previousWindow = globalThis.window;
  const timers = createTimerWindow();
  let activeHint = null;
  globalThis.window = timers.window;
  const runtime = createLevelTutorialRuntime({
    hintQueue: { show: ({ id }) => { activeHint = id; }, clear: () => { activeHint = null; } },
    worldHint: { show: () => {}, clear: () => {} },
    emitThought: () => {},
    isAllowed: () => true,
  });
  try {
    runtime.start({ levelId: "exploring-around", config: { enabled: true } });
    timers.runNext();
    assert.equal(activeHint, "look");
    runtime.handleEvent({ type: "narrationStarted", detail: { line: "welcome" } });
    assert.equal(activeHint, null);
    runtime.handleEvent({ type: "coreStarted" });
    assert.equal(activeHint, null);
  } finally {
    runtime.stop();
    globalThis.window = previousWindow;
  }
});

test("brief completion is retained while the briefing UI blocks tutorial presentation", () => {
  const previousWindow = globalThis.window;
  const timers = createTimerWindow();
  let allowed = true;
  let activeHint = null;
  globalThis.window = timers.window;
  const runtime = createLevelTutorialRuntime({
    hintQueue: { show: ({ id }) => { activeHint = id; }, clear: () => { activeHint = null; } },
    worldHint: { show: () => {}, clear: () => {} },
    emitThought: () => {},
    isAllowed: () => allowed,
  });
  try {
    runtime.start({ levelId: "exploring-around", config: {
      enabled: true,
      welcomeTrigger: "WelcomeEntry",
      advanceHintDelaySeconds: 0,
    } });
    timers.runNext();
    runtime.handleEvent({ type: "triggerEntered", detail: { target: "WelcomeEntry" } });
    runtime.handleEvent({ type: "narrationEnded", detail: { line: "welcome" } });
    timers.runNext();
    assert.equal(activeHint, "brief");

    allowed = false;
    runtime.handleEvent({ type: "briefOpened", detail: { target: "brief" } });
    timers.runNext();
    allowed = true;
    runtime.refresh();
    assert.equal(activeHint, null);
  } finally {
    runtime.stop();
    globalThis.window = previousWindow;
  }
});
