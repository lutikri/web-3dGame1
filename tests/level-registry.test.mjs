import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LEVEL_DEFINITIONS,
  getLevelEnvironmentId,
  getPlayableLevels,
} from "../src/levels/LevelRegistry.js";
import { getPendingPrefabOverrides } from "../src/levels/LevelConfigOverrides.js";

function readGlbJson(relativePath) {
  const buffer = readFileSync(new URL(relativePath, import.meta.url));
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString().replace(/\0+$/, ""));
}

test("facility GLB preserves runtime material slot names without embedding source images", () => {
  const glb = readGlbJson("../assets/mesh/environment/SM_Interior2.glb");
  const materialNames = (glb.materials ?? []).map(({ name }) => name);
  const assignedPrimitiveCount = glb.meshes.reduce(
    (count, mesh) => count + mesh.primitives.filter(({ material }) => material !== undefined).length,
    0,
  );

  assert.deepEqual(materialNames, [
    "M_Pipes1", "MI_COL", "M_Desk1", "M_ControlPost1", "M_Beams",
    "M_TrimTiles1", "M_Details1", "M_InteriorCab", "M_Posters1",
    "M_Posters2", "M_Rock1", "M_Signs1", "M_TrimConcrete1",
  ]);
  assert.ok(assignedPrimitiveCount > 400);
  assert.equal((glb.images ?? []).length, 0);
  assert.equal((glb.textures ?? []).length, 0);
});

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

test("qualification owns a completion-gated one-shot exit pipe scare", () => {
  const environment = LEVEL_DEFINITIONS["exploring-around"].environment;
  const scare = environment.triggerSequences.find(({ name }) => name === "QualificationExitScare");
  assert.deepEqual(scare.trigger, { markerName: "TRGVOL_ControlboothExit", once: true });
  assert.deepEqual(scare.condition, { levelId: "exploring-around", shiftMode: "complete" });
  assert.equal(scare.actions[0].action, "releaseRigidPrefab");
  assert.equal(scare.actions[0].target, "LoosePipe1_QualificationScare01");
  assert.equal(scare.actions[1].soundKey, "MetalPipeImpactFall1");
  assert.equal(scare.actions[1].delaySeconds, 0.44);
  assert.equal(
    environment.prefabMarkerReferences.some(({ name, prefabType }) => (
      name === "LoosePipe1_QualificationScare01" && prefabType === "LoosePipe1"
    )),
    true,
  );
});

test("qualification status viewport targets the migrated observation shutter instance", () => {
  const environment = LEVEL_DEFINITIONS["exploring-around"].environment;
  const overrides = getPendingPrefabOverrides(environment.prefabs);
  const coreViewport = overrides.find(({ name }) => name === "CoreViewport1_ObservationCoreViewport1");
  const statusViewport = overrides.find(({ name }) => name === "PanelStatusViewport1_PanelStatusViewport2");

  assert.ok(coreViewport, "migrated core viewport override is missing");
  assert.equal(
    statusViewport?.statusViewport?.shutterTargetPrefabName,
    "CoreViewport1_ObservationCoreViewport1",
  );
});

test("service-terminal shifts do not spawn retired paper briefings", () => {
  assert.equal(LEVEL_DEFINITIONS["exploring-around"].environment.physicalBriefing.enabled, false);
  assert.equal(LEVEL_DEFINITIONS["unexpected-stuff"].environment.physicalBriefing.enabled, false);
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
  assert.deepEqual(environment.narration.passed, {
    en: { soundKey: "MessageEN_InstrumentReliabilityPassed1", duration: 17.5 },
    ru: { soundKey: "MessageRU_InstrumentReliabilityPassed1", duration: 12.2 },
  });
  assert.deepEqual(environment.narration.insufficient, {
    en: { soundKey: "MessageEN_InstrumentReliabilityFailed1", duration: 16.5 },
    ru: { soundKey: "MessageRU_InstrumentReliabilityFailed1", duration: 14.8 },
  });
  assert.deepEqual(environment.narration.trip, environment.narration.insufficient);
  assert.deepEqual(
    environment.narration.randomSpeech.lines.map(({ id }) => id),
    ["lore-difficulties", "lore-modernization", "work-supervision", "structure-noises"],
  );
  assert.ok(environment.narration.randomSpeech.lines.every((line) => line.shift === "unexpected-stuff"));
  const failedLights = environment.prefabStatePolicies.at(-1);
  assert.equal(failedLights.overrides.light.enabled, false);
  assert.deepEqual(failedLights.prefabTypes, ["fluorescentLamp"]);
  assert.equal(environment.lighting.ambientIntensity, 0);
  assert.equal(environment.lighting.pointLights.fill.intensity, 0);
  assert.ok(environment.lighting.pointLights.LampFan.intensity > 0);
});

test("facility observation and control booth bulkheads start unlatched in both facility shifts", () => {
  const doorNames = [
    "DoorBulk1_DoorBulkLocalObservation",
    "DoorBulk1_DoorBulkControlBooth",
  ];
  ["exploring-around", "unexpected-stuff"].forEach((levelId) => {
    const policies = LEVEL_DEFINITIONS[levelId].environment.prefabStatePolicies;
    const bulkheadPolicy = policies.find((policy) => policy.prefabTypes?.includes("DoorBulk1"));
    doorNames.forEach((doorName) => {
      assert.deepEqual(bulkheadPolicy.exceptions?.[doorName], { latched: false });
    });
  });
});
