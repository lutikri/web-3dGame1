import test from "node:test";
import assert from "node:assert/strict";

import { getAssignedLevels, getTerminalScale, isAssignedShift, shouldClearMailSelection } from "../src/app/panels/LevelSelectPanel.js";

test("assigned shifts expose only the three ordered GDD assignments", () => {
  const levels = {
    freeplay: { id: "freeplay", playable: true },
    qualification: { id: "qualification", playable: true, assignment: { order: 1, unlockAfter: [] } },
    cost: { id: "cost", playable: true, assignment: { order: 3, unlockAfter: ["qualification"] } },
    reliability: { id: "reliability", playable: true, assignment: { order: 2, unlockAfter: ["qualification"] } },
  };

  assert.deepEqual(getAssignedLevels(levels).map((level) => level.id), ["qualification", "reliability", "cost"]);
});

test("qualification unlocks both later assignments only after successful completion", () => {
  const qualification = { playable: true, assignment: { order: 1, unlockAfter: [] } };
  const laterShift = { playable: true, assignment: { order: 2, unlockAfter: ["exploring-around"] } };
  const progress = { completedLevels: {}, finishedLevels: { "exploring-around": true } };

  assert.equal(isAssignedShift(qualification, progress), true);
  assert.equal(isAssignedShift(laterShift, progress), false);
  progress.completedLevels["exploring-around"] = true;
  assert.equal(isAssignedShift(laterShift, progress), true);
});

test("operations mail scales one 1920 by 1080 composition uniformly", () => {
  assert.equal(getTerminalScale(1920, 1080), 1);
  assert.equal(getTerminalScale(2560, 1080), 1);
  assert.equal(getTerminalScale(1280, 1024), 2 / 3);
  assert.equal(getTerminalScale(960, 540), 0.5);
});

test("operations mail clears selection only from empty panel space", () => {
  assert.equal(shouldClearMailSelection({ insidePane: true }), true);
  assert.equal(shouldClearMailSelection({ insidePane: true, insideLetter: true }), false);
  assert.equal(shouldClearMailSelection({ insidePane: true, insideAction: true }), false);
  assert.equal(shouldClearMailSelection({ insidePane: false }), false);
});
