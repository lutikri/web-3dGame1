import test from "node:test";
import assert from "node:assert/strict";

import { createMainMenuPanel, getMainMenuScale } from "../src/app/panels/MainMenuPanel.js";

test("main menu scales one fixed 1920 by 1080 composition uniformly", () => {
  assert.equal(getMainMenuScale(1920, 1080), 1);
  assert.equal(getMainMenuScale(2560, 1080), 1);
  assert.equal(getMainMenuScale(1280, 1024), 2 / 3);
  assert.equal(getMainMenuScale(960, 540), 0.5);
});

test("main menu owns viewport scaling and resize cleanup", () => {
  const listeners = new Map();
  const values = [];
  const panel = { style: { setProperty: (name, value) => values.push([name, value]) } };
  const view = {
    innerWidth: 1280,
    innerHeight: 720,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  const root = {
    defaultView: view,
    querySelector: () => panel,
  };
  const runtime = createMainMenuPanel({ root });

  runtime.wire();
  assert.deepEqual(values.at(-1), ["--main-menu-scale", String(2 / 3)]);

  view.innerWidth = 960;
  view.innerHeight = 540;
  listeners.get("resize")();
  assert.deepEqual(values.at(-1), ["--main-menu-scale", "0.5"]);

  runtime.dispose();
  assert.equal(listeners.size, 0);
});
