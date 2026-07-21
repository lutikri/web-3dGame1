import test from "node:test";
import assert from "node:assert/strict";

import { createLevelSelectPanel, createRoutePath } from "../src/app/panels/LevelSelectPanel.js";

const emptyRoot = { querySelector: () => null, querySelectorAll: () => [] };

test("level select unlocks dependent shifts from shared progress", () => {
  const levels = {
    "intro-shift": { id: "intro-shift", playable: true },
    "unexpected-stuff": { id: "unexpected-stuff", playable: true },
  };
  const progress = { completedLevels: {}, finishedLevels: {} };
  const panel = createLevelSelectPanel({ levels, progress, root: emptyRoot });
  assert.equal(panel.isUnlocked("intro-shift"), true);
  assert.equal(panel.isUnlocked("unexpected-stuff"), false);
  progress.completedLevels["intro-shift"] = true;
  assert.equal(panel.isUnlocked("unexpected-stuff"), true);
});

test("level route path uses orthogonal connectors", () => {
  assert.equal(
    createRoutePath({ x: 10, y: 20 }, { x: 40, y: 80 }, { fromSide: "bottom", toSide: "top" }),
    "M 10 20 L 10 50 L 40 50 L 40 80",
  );
});
