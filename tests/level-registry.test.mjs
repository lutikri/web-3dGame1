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

test("exploring around starts localized panel guidance on first control booth entry", () => {
  const environment = LEVEL_DEFINITIONS["exploring-around"].environment;
  const sequence = environment.triggerSequences.find(({ name }) => name === "ControlBooth");
  assert.equal(sequence.trigger.markerName, "TRGVOL_ControlBooth_1");
  assert.equal(sequence.trigger.once, true);
  assert.equal(sequence.narration, "panelTutorial");
  assert.equal(environment.tutorial.controlBoothNarration, "panelTutorial");
  assert.deepEqual(environment.narration.panelTutorial, {
    en: {
      soundKey: "MessageEN_WelcomePanelTutorial1",
      subtitlePath: "assets/sounds/narration/MessageEN_WelcomePanelTutorial1.srt",
      duration: 37.04,
    },
    ru: {
      soundKey: "MessageRU_WelcomePanelTutorial1",
      subtitlePath: "assets/sounds/narration/MessageRU_WelcomePanelTutorial1.srt",
      duration: 33.36,
    },
  });
});

test("instrument reliability shift reuses the facility with its own brief, intro and failed lights", () => {
  const level = LEVEL_DEFINITIONS["unexpected-stuff"];
  const environment = level.environment;
  assert.equal(getLevelEnvironmentId(level.id), level.id);
  assert.equal(environment.assetPath, LEVEL_DEFINITIONS["exploring-around"].environment.assetPath);
  assert.deepEqual(level.briefingImage, {
    en: ["assets/ui/briefings/T_Brief_InstrumentReabilityCheckEN.png"],
    ru: ["assets/ui/briefings/T_Brief_InstrumentReabilityCheckRU.png"],
  });
  assert.equal(level.autoShowBriefing, false);
  assert.deepEqual(environment.physicalBriefing.sheets, level.briefingImage);
  assert.equal(environment.physicalBriefing.briefingLevelId, level.id);
  assert.equal(environment.tutorial.enabled, false);
  assert.equal(
    environment.triggerSequences.find(({ name }) => name === "WelcomeEntry").narration,
    "faultsIntro",
  );
  assert.equal(
    environment.triggerSequences.find(({ name }) => name === "ControlBooth").narration,
    undefined,
  );
  assert.deepEqual(environment.narration.faultsIntro, {
    en: {
      soundKey: "MessageEN_FaultsIntro1",
      subtitlePath: "assets/sounds/narration/MessageEN_FaultsIntro1.srt",
      duration: 24.16,
    },
    ru: {
      soundKey: "MessageRU_FaultsIntro1",
      subtitlePath: "assets/sounds/narration/MessageRU_FaultsIntro1.srt",
      duration: 26.52,
    },
  });
  const failedLights = environment.prefabStatePolicies.at(-1);
  assert.equal(failedLights.overrides.light.enabled, false);
  assert.deepEqual(failedLights.prefabTypes, ["fluorescentLamp"]);
  assert.equal(environment.lighting.ambientIntensity, 0);
  assert.equal(environment.lighting.pointLights.fill.intensity, 0);
  assert.ok(environment.lighting.pointLights.LampFan.intensity > 0);
});
