import assert from "node:assert/strict";
import test from "node:test";

import {
  createLevelArrivalSequence,
  getLevelArrivalConfig,
} from "../src/app/LevelArrivalSequence.js";

test("arrival config follows shift metadata and localization", () => {
  const qualification = getLevelArrivalConfig("exploring-around", "en");
  const diagnostic = getLevelArrivalConfig("unexpected-stuff", "ru");

  assert.deepEqual(qualification, {
    shiftId: "qualification",
    location: "SITE-12 / SHAFT 03",
    accessLabel: "PERSONNEL ACCESS",
    dateTime: "30 APR 2037   13:30",
    status: "ARRIVAL CONFIRMED",
    title: "QUALIFICATION SHIFT",
    subtitleTop: "SITE-12 / SHAFT 03",
    subtitleBottom: "FIRST OPERATOR QUALIFICATION",
  });
  assert.equal(diagnostic.dateTime, "02 МАЙ 2037   06:00");
  assert.equal(diagnostic.title, "НАДЁЖНОСТЬ ПРИБОРОВ");
});

test("arrival sequence releases input before its title finishes", async () => {
  const harness = createHarness();
  let inputReady = 0;
  let finished = false;
  const completion = harness.sequence.play(getLevelArrivalConfig("exploring-around"), {
    onCovered: () => { harness.covered += 1; },
    onInputReady: () => { inputReady += 1; },
  }).then((result) => { finished = true; return result; });
  await settlePlay();

  harness.clock.runTo(2399);
  assert.equal(harness.root.classList.contains("is-revealing-world"), false);
  assert.equal(inputReady, 0);

  harness.clock.runTo(3000);
  await Promise.resolve();
  assert.equal(harness.covered, 1);
  assert.equal(inputReady, 1);
  assert.equal(finished, false);
  assert.equal(harness.root.classList.contains("is-title-visible"), true);
  assert.equal(harness.root.hidden, false);

  harness.clock.runTo(8139);
  assert.equal(harness.root.classList.contains("is-title-fading"), false);
  harness.clock.runTo(8200);
  assert.equal(harness.root.classList.contains("is-title-fading"), true);

  harness.clock.runTo(9000);
  assert.equal(await completion, true);
  assert.equal(finished, true);
  assert.equal(harness.root.hidden, true);
  assert.equal(inputReady, 1);
});

test("arrival skip preserves a minimum system-text phase before revealing gameplay", async () => {
  const harness = createHarness();
  const completion = harness.sequence.play(getLevelArrivalConfig("exploring-around"));
  await settlePlay();

  harness.clock.runTo(200);
  assert.equal(harness.sequence.skip(), true);
  assert.equal(harness.root.classList.contains("is-revealing-world"), false);

  harness.clock.runTo(699);
  assert.equal(harness.root.classList.contains("is-revealing-world"), false);
  harness.clock.runTo(700);
  assert.equal(harness.root.classList.contains("is-revealing-world"), true);

  harness.clock.runTo(1300);
  assert.equal(harness.root.classList.contains("is-title-visible"), true);
  assert.equal(harness.sequence.skip(), false);

  harness.clock.runTo(7300);
  assert.equal(await completion, true);
});

test("primary click requests first person and advances without dismissing the title", async () => {
  const harness = createHarness();
  const completion = harness.sequence.play(getLevelArrivalConfig("exploring-around"));
  await settlePlay();

  harness.clock.runTo(900);
  harness.dispatch("pointerdown", {
    button: 0,
    preventDefault: () => { throw new Error("arrival should not consume the pointer-lock click"); },
  });
  assert.equal(harness.firstPersonRequests, 1);
  assert.equal(harness.root.classList.contains("is-revealing-world"), true);

  harness.clock.runTo(1500);
  assert.equal(harness.sequence.isActive(), true);
  assert.equal(harness.root.hidden, false);
  assert.equal(harness.root.classList.contains("is-title-visible"), true);

  harness.dispatch("pointerdown", { button: 0 });
  assert.equal(harness.firstPersonRequests, 1);
  assert.equal(harness.root.classList.contains("is-title-visible"), true);

  harness.clock.runTo(7500);
  assert.equal(await completion, true);
});

test("arrival cancel clears timers, stops its sound, and restores input", async () => {
  const harness = createHarness();
  let inputReady = 0;
  const completion = harness.sequence.play(getLevelArrivalConfig("fuel-problems"), {
    onInputReady: () => { inputReady += 1; },
  });
  await settlePlay();

  harness.clock.runTo(700);
  assert.equal(harness.sequence.cancel(), true);
  assert.equal(await completion, false);
  assert.equal(harness.clock.size(), 0);
  assert.equal(inputReady, 1);
  assert.equal(harness.audioInstances.length, 1);
  assert.equal(harness.audioInstances[0].paused, true);
  assert.equal(harness.root.hidden, true);
  assert.equal(harness.body.classList.contains("level-arrival-active"), false);
});

async function settlePlay() {
  await Promise.resolve();
  await Promise.resolve();
}

function createHarness() {
  const clock = createClock();
  const lines = Array.from({ length: 4 }, () => createElement());
  const title = createElement();
  const subtitleTop = createElement();
  const subtitleBottom = createElement();
  const root = createElement();
  root.hidden = true;
  root.querySelectorAll = (selector) => selector === "[data-arrival-line]" ? lines : [];
  root.querySelector = (selector) => ({
    "[data-arrival-title]": title,
    "[data-arrival-subtitle-top]": subtitleTop,
    "[data-arrival-subtitle-bottom]": subtitleBottom,
  })[selector] ?? null;
  const body = createElement();
  const listeners = new Map();
  const documentRef = {
    body,
    addEventListener: (type, handler) => listeners.set(type, handler),
    removeEventListener: (type, handler) => {
      if (listeners.get(type) === handler) listeners.delete(type);
    },
  };
  const audioInstances = [];
  class FakeAudio {
    constructor(path) {
      this.path = path;
      this.currentTime = 0;
      this.paused = false;
      audioInstances.push(this);
    }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const harness = {
    root,
    body,
    clock,
    audioInstances,
    covered: 0,
    firstPersonRequests: 0,
    dispatch: (type, event) => listeners.get(type)?.(event),
  };
  harness.sequence = createLevelArrivalSequence({
    root,
    documentRef,
    AudioClass: FakeAudio,
    soundConfig: { path: "arrival.ogg", volume: 0.5 },
    getMasterVolume: () => 0.8,
    setTimeoutFn: clock.setTimeout,
    clearTimeoutFn: clock.clearTimeout,
    requestAnimationFrameFn: (callback) => callback(),
    randomFn: () => 0,
    requestFirstPerson: () => { harness.firstPersonRequests += 1; },
  });
  return harness;
}

function createElement() {
  const classes = new Set();
  return {
    hidden: false,
    textContent: "",
    dataset: {},
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
  };
}

function createClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout: (callback, delay = 0) => {
      const id = nextId++;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    runTo: (target) => {
      while (true) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.due <= target)
          .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
        if (!next) break;
        const [id, timer] = next;
        timers.delete(id);
        now = timer.due;
        timer.callback();
      }
      now = target;
    },
    size: () => timers.size,
  };
}
