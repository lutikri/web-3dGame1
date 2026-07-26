import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_DEFINITIONS,
  getLevelEnvironmentId,
  getPlayableLevels,
} from "../src/levels/LevelRegistry.js";

test("registered playable levels have isolated prefab names", () => {
  getPlayableLevels().forEach((level) => {
    assert.ok(level.environment, `${level.id} must resolve an environment`);
    const names = (level.environment.prefabs ?? []).map((prefab) => prefab.name);
    assert.equal(new Set(names).size, names.length, `${level.id} has duplicate prefab names`);
  });
});

test("environment aliases resolve without duplicating environment objects", () => {
  assert.equal(getLevelEnvironmentId("freeplay"), "intro-shift");
  assert.strictEqual(
    LEVEL_DEFINITIONS.freeplay.environment,
    LEVEL_DEFINITIONS["intro-shift"].environment,
  );
});

test("deprecated elevator prototype is not a playable assignment", () => {
  assert.equal(LEVEL_DEFINITIONS["intro-elevator"].deprecated, true);
  assert.equal(LEVEL_DEFINITIONS["intro-elevator"].playable, false);
  assert.equal(getPlayableLevels().some((level) => level.id === "intro-elevator"), false);
});

test("registry owns the three-shift assignment progression", () => {
  const assignments = Object.values(LEVEL_DEFINITIONS)
    .filter((level) => level.assignment)
    .sort((a, b) => a.assignment.order - b.assignment.order);
  assert.deepEqual(assignments.map((level) => level.id), ["exploring-around", "unexpected-stuff", "fuel-problems"]);
  assert.deepEqual(assignments[0].assignment.unlockAfter, []);
  assert.deepEqual(assignments[1].assignment.unlockAfter, ["exploring-around"]);
  assert.deepEqual(assignments[2].assignment.unlockAfter, ["exploring-around"]);
  assignments.forEach((level) => {
    assert.match(level.assignment.reference, /^OP-[A-Z]+\/\d{3}$/);
    assert.equal(level.assignment.facility, "SITE-12");
    assert.ok(level.assignment.sectorKey);
    assert.ok(level.assignment.clearanceKey);
  });
});

test("exploring around completes only after the shift and authored bulkhead exit", () => {
  const session = LEVEL_DEFINITIONS["exploring-around"].environment.session;
  assert.equal(session.completion, "all");
  assert.deepEqual(session.objectives, [
    { id: "complete-shift", type: "shiftComplete" },
    {
      id: "exit-complex",
      type: "event",
      event: "doorUnlocked",
      target: "DoorBulk1_4",
      blockedStopDegrees: 5,
    },
  ]);
});

test("exploring around keeps the corridor trigger repeatable for the physical return", () => {
  assert.deepEqual(
    LEVEL_DEFINITIONS["exploring-around"].environment.repeatableTriggerSequences,
    ["MainCorridorEntrance"],
  );
});
