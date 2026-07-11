import { LEVEL_EXPLORING_AROUND_CONFIG } from "./LevelExploringAroundConfig.js?v=20260711-obvious-selftest-training";
import { LEVEL_INTRO_SHIFT_CONFIG } from "./LevelIntroShiftConfig.js?v=20260711-obvious-selftest-training";
import { validateLevelEnvironmentConfig } from "./LevelConfigSchema.js?v=20260711-obvious-selftest-training";

const LEVEL_UNEXPECTED_STUFF_CONFIG = createUnexpectedStuffConfig();

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
  "shift-coordination": {
    id: "shift-coordination",
    title: "SHIFT COORDINATION",
    mode: "coordination",
    description: "Same console route placeholder with a clock-start shift.",
    playable: true,
    environmentId: "intro-shift",
    environment: LEVEL_INTRO_SHIFT_CONFIG,
  },
  "unexpected-stuff": {
    id: "unexpected-stuff",
    title: "UNEXPECTED STUFF",
    mode: "unexpected",
    description: "Three-minute shift with instrument and control faults.",
    playable: true,
    environmentId: "intro-shift",
    environment: LEVEL_UNEXPECTED_STUFF_CONFIG,
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

function createUnexpectedStuffConfig() {
  return {
    ...LEVEL_INTRO_SHIFT_CONFIG,
    saveKind: "unexpectedStuff",
    session: {
      completion: "all",
      objectives: [
        { id: "operate-core", type: "survive", seconds: 180 },
        {
          id: "unlock-bulkhead",
          type: "event",
          event: "doorUnlocked",
          target: "DoorBulk1_Tutorial",
        },
      ],
      bindings: LEVEL_INTRO_SHIFT_CONFIG.session?.bindings ?? [],
    },
    diagnostics: {
      selfTest: {
        durationSeconds: 10,
      },
      initialFaults: {
        lamps: [],
        gauges: [],
        knobs: [],
      },
      initialRandomFaults: [
        {
          count: 1,
          pool: [
            {
              id: "plasma-temp-stuck-at-sixty",
              type: "gaugeFault",
              key: "plasmaTemp",
              delaySeconds: 2.6,
              maxRatio: 0.6,
              noiseDegrees: 0.18,
              durationSeconds: 145,
            },
            {
              id: "containment-stuck-at-sixty",
              type: "gaugeFault",
              key: "containment",
              delaySeconds: 2,
              maxRatio: 0.62,
              noiseDegrees: 0.16,
              durationSeconds: 145,
            },
            {
              id: "power-output-stuck-at-sixty",
              type: "gaugeFault",
              key: "powerOutput",
              delaySeconds: 2.2,
              maxRatio: 0.6,
              noiseDegrees: 0.2,
              durationSeconds: 145,
            },
          ],
        },
        {
          count: 1,
          pool: [
            {
              id: "under-demand-amber-missing",
              type: "lampFault",
              name: "LightCase1_Light_UnderDemand",
              failColors: ["amber"],
              material: "amber",
              blink: true,
              blinkFrequency: 6,
              durationSeconds: 145,
            },
            {
              id: "over-demand-red-missing",
              type: "lampFault",
              name: "LightCase1_Light_OverDemand",
              failColors: ["red"],
              material: "amber",
              blink: true,
              blinkFrequency: 5,
              durationSeconds: 145,
            },
            {
              id: "efficiency-green-missing",
              type: "lampFault",
              name: "LightCase1_Light_ReactionEfficiency",
              failColors: ["green"],
              material: "green",
              blink: true,
              blinkFrequency: 9,
              durationSeconds: 145,
            },
            {
              id: "fuel-quality-green-missing",
              type: "lampFault",
              name: "LightCase1_Light_FuelQuality",
              failColors: ["green"],
              material: "amber",
              blink: true,
              blinkFrequency: 4,
              durationSeconds: 145,
            },
          ],
        },
      ],
      timeline: [
        {
          id: "bus-dip-1",
          type: "blackout",
          atSeconds: 65,
          durationSeconds: 0.6,
          restartLights: true,
        },
        {
          id: "coolant-sticky-midshift",
          type: "knobFault",
          atSeconds: 105,
          durationSeconds: 120,
          name: "Control_Knob_CoolantFlow",
          sensitivity: 0.04,
          exercisePercent: 95,
        },
      ],
      randomTimeline: [
        {
          count: 1,
          pool: [
            {
              id: "under-demand-false-positive",
              type: "lampFault",
              atSeconds: 48,
              durationSeconds: 120,
              name: "LightCase1_Light_UnderDemand",
              material: "amber",
              blink: true,
              blinkFrequency: 7,
            },
            {
              id: "over-demand-false-positive",
              type: "lampFault",
              atSeconds: 54,
              durationSeconds: 120,
              name: "LightCase1_Light_OverDemand",
              material: "amber",
              blink: true,
              blinkFrequency: 6,
            },
            {
              id: "efficiency-lamp-dirty-contact",
              type: "lampFault",
              atSeconds: 62,
              durationSeconds: 120,
              name: "LightCase1_Light_ReactionEfficiency",
              material: "green",
              blink: true,
              blinkFrequency: 11,
            },
            {
              id: "fuel-quality-false-warning",
              type: "lampFault",
              atSeconds: 70,
              durationSeconds: 120,
              name: "LightCase1_Light_FuelQuality",
              material: "amber",
              blink: true,
              blinkFrequency: 5,
            },
          ],
        },
        {
          count: 1,
          pool: [
            {
              id: "power-output-offset-low",
              type: "gaugeFault",
              atSeconds: 118,
              durationSeconds: 120,
              key: "powerOutput",
              offsetRatio: -0.08,
              delaySeconds: 1.6,
              noiseDegrees: 1.4,
            },
            {
              id: "reaction-efficiency-lag",
              type: "gaugeFault",
              atSeconds: 118,
              durationSeconds: 120,
              key: "reactionEfficiency",
              delaySeconds: 2.4,
              noiseDegrees: 1,
            },
            {
              id: "heat-sink-offset-high",
              type: "gaugeFault",
              atSeconds: 118,
              durationSeconds: 120,
              key: "heatSinkCapacity",
              offsetRatio: 0.1,
              noiseDegrees: 0.8,
            },
          ],
        },
      ],
    },
  };
}
