import assert from "node:assert/strict";
import test from "node:test";

import {
  createLoadingOverlay,
  getLoadingStageScale,
  pickBootBackground,
  updateLoadingStageScale,
} from "../src/ui/LoadingOverlay.js";

test("loading stage scales a fixed 1920 by 1080 composition without CSS typed arithmetic", () => {
  assert.equal(getLoadingStageScale(1920, 1080), 1);
  assert.equal(getLoadingStageScale(2560, 1080), 1);
  assert.equal(getLoadingStageScale(1280, 720), 2 / 3);
});

test("repeat boot chooses one runtime background from the configured set", () => {
  const backgrounds = ["one.webp", "two.webp", "three.webp"];
  assert.equal(pickBootBackground(backgrounds, () => 0), "one.webp");
  assert.equal(pickBootBackground(backgrounds, () => 0.5), "two.webp");
  assert.equal(pickBootBackground(backgrounds, () => 0.999), "three.webp");
});

test("loading stage writes a browser-compatible numeric scale", () => {
  let property = null;
  let value = null;
  const stage = {
    style: {
      setProperty(nextProperty, nextValue) {
        property = nextProperty;
        value = nextValue;
      },
    },
  };
  const overlay = { querySelector: () => stage };

  const scale = updateLoadingStageScale(overlay, { innerWidth: 1280, innerHeight: 720 });

  assert.equal(scale, 2 / 3);
  assert.equal(property, "--loading-stage-scale");
  assert.equal(value, String(2 / 3));
});

test("repeat boot systems expose their real lifecycle state", () => {
  const classes = new Set(["is-active"]);
  const output = { textContent: "LOADING" };
  const row = {
    classList: {
      add: (value) => classes.add(value),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
    },
    querySelector: (selector) => selector === "b" ? output : null,
  };
  const stage = { style: { setProperty() {} } };
  const overlay = {
    querySelector(selector) {
      if (selector === ".loading-stage") return stage;
      if (selector === '[data-boot-system="siteData"]') return row;
      return null;
    },
  };
  const runtime = createLoadingOverlay({
    overlay,
    view: { innerWidth: 1920, innerHeight: 1080 },
  });

  assert.equal(runtime.setBootSystem("siteData", "complete", "LOADED"), true);
  assert.deepEqual([...classes], ["is-complete"]);
  assert.equal(output.textContent, "LOADED");
  assert.equal(runtime.setBootSystem("missing", "complete", "READY"), false);
});

test("boot progress renders immediately before the game animation loop starts", () => {
  const percent = { textContent: "00%" };
  const barFill = { style: { width: "0%" } };
  const stage = { style: { setProperty() {} } };
  const overlay = {
    querySelector: (selector) => selector === ".loading-stage" ? stage : null,
  };
  const runtime = createLoadingOverlay({
    overlay,
    percent,
    barFill,
    view: { innerWidth: 1920, innerHeight: 1080 },
  });

  runtime.setProgress(62);

  assert.equal(percent.textContent, "62%");
  assert.equal(barFill.style.width, "62%");
});

test("shared boot transition hides the loading overlay without a competing css fade", async () => {
  const classes = new Set();
  let scheduled = null;
  const overlay = {
    hidden: false,
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
    },
    querySelector: () => null,
  };
  const runtime = createLoadingOverlay({
    overlay,
    minimumVisibleMs: 0,
    view: { innerWidth: 1920, innerHeight: 1080 },
    setTimeoutFn: (callback) => {
      scheduled = callback;
      return 1;
    },
  });

  runtime.finish(null, {
    beforeHide: async () => classes.add("covered"),
    immediateHide: true,
  });
  await scheduled();

  assert.equal(overlay.hidden, true);
  assert.equal(classes.has("covered"), true);
  assert.equal(classes.has("is-complete"), false);
  assert.equal(runtime.isComplete(), true);
});
