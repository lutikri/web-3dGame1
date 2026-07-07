import { LEVEL_EXPLORING_AROUND_CONFIG } from "./LevelExploringAroundConfig.js?v=20260707-tutorial2";
import { LEVEL_INTRO_SHIFT_CONFIG } from "./LevelIntroShiftConfig.js?v=20260707-tutorial2";
import { validateLevelEnvironmentConfig } from "./LevelConfigSchema.js?v=20260707-tutorial2";

export const LEVEL_DEFINITIONS = {
  "intro-shift": {
    id: "intro-shift",
    title: "INTRO SHIFT",
    mode: "tutorial",
    description: "Current first fusion shift scenario.",
    playable: true,
    briefingImage: {
      en: ["assets/ui/briefings/Intro1-us.png"],
      ru: ["assets/ui/briefings/Intro1-ru.png", "assets/ui/briefings/Intro1_2-ru.png"],
    },
    environment: LEVEL_INTRO_SHIFT_CONFIG,
  },
  "exploring-around": {
    id: "exploring-around",
    title: "EXPLORING AROUND",
    mode: "tutorial",
    description: "The tutorial shift in the service corridor.",
    playable: true,
    environment: LEVEL_EXPLORING_AROUND_CONFIG,
  },
  "unexpected-stuff": {
    id: "unexpected-stuff",
    title: "UNEXPECTED STUFF",
    mode: "story",
    description: "Instrument fault route placeholder.",
    playable: false,
  },
  "fuel-problems": {
    id: "fuel-problems",
    title: "FUEL PROBLEMS",
    mode: "story",
    description: "Fuel quality route placeholder.",
    playable: false,
  },
  freeplay: {
    id: "freeplay",
    title: "FREEPLAY",
    mode: "freeplay",
    description: "Loose target mode placeholder using the current shift for now.",
    playable: true,
    environmentId: "intro-shift",
    environment: LEVEL_INTRO_SHIFT_CONFIG,
  },
  competitive: {
    id: "competitive",
    title: "COMPETITIVE",
    mode: "competitive",
    description: "Scored route placeholder.",
    playable: false,
  },
};

export const LEVEL_ENVIRONMENTS = createEnvironmentLookup(LEVEL_DEFINITIONS);

validateLevelDefinitions(LEVEL_DEFINITIONS);

export function getLevelDefinition(levelId) {
  return LEVEL_DEFINITIONS[levelId] ?? null;
}

export function getPlayableLevels() {
  return Object.values(LEVEL_DEFINITIONS).filter((level) => level.playable);
}

export function getLevelEnvironmentId(levelId) {
  const level = LEVEL_DEFINITIONS[levelId];
  return level?.environmentId ?? levelId;
}

function validateLevelDefinitions(definitions) {
  Object.entries(definitions).forEach(([registryId, level]) => {
    if (level.id !== registryId) throw new Error(`[LevelRegistry] Level id mismatch: ${registryId}`);
    if (!level.title || !level.mode || typeof level.playable !== "boolean") {
      throw new Error(`[LevelRegistry] Incomplete metadata for level: ${registryId}`);
    }
    const environment = level.environment;
    if (!environment) return;
    validateLevelEnvironmentConfig(registryId, environment);
  });
}

function createEnvironmentLookup(definitions) {
  const environments = {};
  Object.values(definitions).forEach((level) => {
    if (!level.environment) return;
    const environmentId = level.environmentId ?? level.id;
    Object.defineProperty(environments, level.id, {
      value: level.environment,
      enumerable: environmentId === level.id,
      configurable: false,
      writable: false,
    });
  });
  return environments;
}
