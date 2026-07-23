import test from "node:test";
import assert from "node:assert/strict";

import { BriefInteractionRuntime } from "../src/interactions/BriefInteractionRuntime.js";

test("brief interaction registers a sheet and opens it only after the configured hold", () => {
  const interactive = [];
  const opened = [];
  let hovered = null;
  const progress = [];
  const runtime = new BriefInteractionRuntime({
    interactive,
    getHoveredInteractive: () => hovered,
    openBriefingSheet: (request) => opened.push(request),
    setHoldProgress: (value, active) => progress.push([value, active]),
  });
  const mesh = { userData: {} };
  assert.equal(runtime.register("exploring-around", {
    behavior: "briefSheet",
    briefSheet: { briefingLevelId: "intro-shift", sheetIndex: 1, holdSeconds: 0.5, maxDistance: 1.65 },
  }, { briefSheet: { mesh } }), true);
  assert.equal(interactive[0], mesh);
  hovered = mesh;
  assert.equal(runtime.begin(mesh), true);
  runtime.update(0.49);
  assert.deepEqual(opened, []);
  runtime.update(0.01);
  assert.deepEqual(opened, [{ levelId: "intro-shift", sheetIndex: 1 }]);
  runtime.update(2);
  assert.equal(opened.length, 1);
  assert.ok(progress.some(([value, active]) => value === 0.98 && active));
  assert.deepEqual(progress.at(-1), [1, true]);
  runtime.release();
  assert.deepEqual(progress.at(-1), [0, false]);
});

test("brief hold cancels when aim leaves the sheet", () => {
  let hovered = null;
  const opened = [];
  const runtime = new BriefInteractionRuntime({
    interactive: [], getHoveredInteractive: () => hovered, openBriefingSheet: (request) => opened.push(request),
  });
  const mesh = { userData: { kind: "briefSheet", holdInteractionSeconds: 0.5 } };
  hovered = mesh;
  runtime.begin(mesh);
  runtime.update(0.25);
  hovered = null;
  runtime.update(0.25);
  assert.deepEqual(opened, []);
});
