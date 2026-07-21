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
