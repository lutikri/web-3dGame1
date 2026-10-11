import test from "node:test";
import assert from "node:assert/strict";

import { formatAssignmentDate, getAssignedLevels, getAssignmentMailbox, getTerminalScale, isAssignedShift, shouldClearMailSelection } from "../src/app/panels/LevelSelectPanel.js";

test("assigned shifts expose the two tutorials and public free shift while hiding story assignment three", () => {
  const levels = {
    freeplay: { id: "freeplay", playable: true, assignment: { order: 3, unlockAfter: ["qualification", "reliability"] } },
    qualification: { id: "qualification", playable: true, assignment: { order: 1, unlockAfter: [] } },
    cost: { id: "cost", playable: true, assignment: { order: 3, unlockAfter: ["qualification"], public: false } },
    reliability: { id: "reliability", playable: true, assignment: { order: 2, unlockAfter: ["qualification"] } },
  };

  assert.deepEqual(getAssignedLevels(levels).map((level) => level.id), ["qualification", "reliability", "freeplay"]);
});

test("completed shifts move from inbox to archive and assignment dates keep authored precision", () => {
  const level = { id: "qualification" };
  const progress = { completedLevels: {} };
  assert.equal(getAssignmentMailbox(level, progress), "inbox");
  progress.completedLevels.qualification = true;
  assert.equal(getAssignmentMailbox(level, progress), "archive");
  assert.equal(formatAssignmentDate({ date: "01.05.2036", time: "06:42" }), "01.05.2036 / 06:42");
  assert.equal(formatAssignmentDate({ dateKey: "freeplay" }, (key) => `translated:${key}`), "translated:freeplay");
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
