import { LEVEL_EXPLORING_AROUND_CONFIG } from "./LevelExploringAroundConfig.js?v=locomotion-weight-pass";
import { LEVEL_INTRO_ELEVATOR_CONFIG } from "./LevelIntroElevatorConfig.js?v=locomotion-weight-pass";
import { LEVEL_INTRO_SHIFT_CONFIG } from "./LevelIntroShiftConfig.js?v=locomotion-weight-pass";
import { validateLevelEnvironmentConfig } from "./LevelConfigSchema.js?v=locomotion-weight-pass";

const LEVEL_UNEXPECTED_STUFF_CONFIG = createUnexpectedStuffConfig();
const LEVEL_COST_OF_RUNNING_CONFIG = createCostOfRunningConfig();

export const LEVEL_DEFINITIONS = {
  "intro-elevator": {
    id: "intro-elevator",
    title: "ELEVATOR ARRIVAL",
    mode: "arrival",
    description: "Deprecated prototype scene; the current product uses an implied off-screen transfer.",
    playable: false,
    deprecated: true,
    environment: LEVEL_INTRO_ELEVATOR_CONFIG,
  },
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
    assignment: {
      order: 1,
      unlockAfter: [],
      titleKey: "assignments.qualification.title",
      documentTitleKey: "assignments.qualification.documentTitle",
      summaryKey: "assignments.qualification.summary",
      reference: "OP-QUAL/001",
      facility: "SITE-12",
      sectorKey: "assignments.localOperations",
      clearanceKey: "assignments.assigned",
    },
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
    assignment: {
      order: 2,
      unlockAfter: ["exploring-around"],
      titleKey: "assignments.reliability.title",
      summaryKey: "assignments.reliability.summary",
      reference: "OP-REL/002",
      facility: "SITE-12",
      sectorKey: "assignments.localOperations",
      clearanceKey: "assignments.assigned",
    },
    briefingImage: {
      en: ["assets/ui/briefings/T_Brief_InstrumentReabilityCheckEN.png"],
      ru: ["assets/ui/briefings/T_Brief_InstrumentReabilityCheckRU.png"],
    },
    autoShowBriefing: false,
    environment: LEVEL_UNEXPECTED_STUFF_CONFIG,
  },
  "fuel-problems": {
    id: "fuel-problems",
    title: "COST OF RUNNING",
    mode: "story",
    description: "Three-minute fuel blend economy trial.",
    playable: true,
    assignment: {
      order: 3,
      unlockAfter: ["exploring-around"],
      titleKey: "assignments.cost.title",
      summaryKey: "assignments.cost.summary",
      reference: "OP-COST/003",
      facility: "SITE-12",
      sectorKey: "assignments.localOperations",
      clearanceKey: "assignments.assigned",
    },
    briefingImage: {
      en: ["assets/ui/briefings/CostOfRunning1-us.svg"],
      ru: ["assets/ui/briefings/CostOfRunning1-ru.svg"],
    },
    environmentId: "intro-shift",
    environment: LEVEL_COST_OF_RUNNING_CONFIG,
  },
  "power-bus-training": {
    id: "power-bus-training",
    title: "POWER BUS TRAINING",
    mode: "facility",
    description: "Switchgear and routing placeholder.",
    playable: false,
  },
  "longer-shifts": {
    id: "longer-shifts",
    title: "LONGER SHIFTS",
    mode: "facility",
    description: "Longer shift route placeholder.",
    playable: false,
  },
  "broken-lamp": {
    id: "broken-lamp",
    title: "BROKEN LAMP",
    mode: "test",
    description: "Unreliable warning indicator placeholder.",
    playable: false,
  },
  "low-fuel": {
    id: "low-fuel",
    title: "LOW FUEL",
    mode: "test",
    description: "Low reserve economy test placeholder.",
    playable: false,
  },
  "low-heat-sink": {
    id: "low-heat-sink",
    title: "LOW HEAT SINK",
    mode: "test",
    description: "Reduced thermal margin placeholder.",
    playable: false,
  },
  "maximum-load": {
    id: "maximum-load",
    title: "MAX LOAD",
    mode: "test",
    description: "Maximum load route placeholder.",
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
  const baseConfig = cloneConfigValue(LEVEL_EXPLORING_AROUND_CONFIG);
  return {
    ...baseConfig,
    saveKind: "unexpectedStuff",
    physicalBriefing: {
      ...baseConfig.physicalBriefing,
      briefingLevelId: "unexpected-stuff",
      sheets: {
        en: ["assets/ui/briefings/T_Brief_InstrumentReabilityCheckEN.png"],
        ru: ["assets/ui/briefings/T_Brief_InstrumentReabilityCheckRU.png"],
      },
    },
    session: {
      completion: "all",
      objectives: [
        { id: "operate-core", type: "survive", seconds: 180 },
        {
          id: "exit-complex",
          type: "event",
          event: "doorUnlocked",
          target: "DoorBulk1_4",
          blockedStopDegrees: 5,
        },
      ],
      bindings: baseConfig.session?.bindings ?? [],
    },
    narration: {
      ...baseConfig.narration,
      faultsIntro: {
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
      },
    },
    triggerSequences: (baseConfig.triggerSequences ?? []).map((sequence) => {
      if (sequence.name === "WelcomeEntry") return { ...sequence, narration: "faultsIntro" };
      if (sequence.name === "ControlBooth") {
        const { narration: _tutorialNarration, ...withoutNarration } = sequence;
        return withoutNarration;
      }
      return sequence;
    }),
    tutorial: {
      ...baseConfig.tutorial,
      enabled: false,
    },
    prefabStatePolicies: [
      ...(baseConfig.prefabStatePolicies ?? []),
      {
        prefabTypes: ["fluorescentLamp"],
        overrides: { light: { enabled: false } },
      },
    ],
    lighting: {
      ...baseConfig.lighting,
      ambientIntensity: 0,
      pointLights: {
        ...baseConfig.lighting?.pointLights,
        fill: {
          ...baseConfig.lighting?.pointLights?.fill,
          intensity: 0,
        },
      },
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

function createCostOfRunningConfig() {
  const baseConfig = cloneConfigValue(LEVEL_INTRO_SHIFT_CONFIG);
  return {
    ...baseConfig,
    saveKind: "costOfRunning",
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
      initialRandomFaults: [],
      timeline: [],
      randomTimeline: [],
    },
    shiftProfile: {
      defaultEvents: false,
      transitionSeconds: 5,
      demandWander: {
        enabled: false,
      },
      phases: [
        {
          name: "BASELINE COST RUN",
          start: 0,
          end: 60,
          temp: [95, 135],
          powerTemp: [112, 150],
          output: [500, 700],
          containmentMin: 70,
          demand: 600,
        },
        {
          name: "ECONOMY MIX LOAD",
          start: 60,
          end: 120,
          temp: [112, 148],
          powerTemp: [132, 160],
          output: [650, 860],
          containmentMin: 64,
          demand: 760,
        },
        {
          name: "HIGH COST-SAVING LOAD",
          start: 120,
          end: 180,
          temp: [128, 162],
          powerTemp: [150, 172],
          output: [800, 1040],
          containmentMin: 58,
          demand: 920,
        },
      ],
    },
    fuelBlend: {
      enabled: true,
      segments: [
        {
          start: 0,
          end: 20,
          state: "green",
          label: "STANDARD BLEND",
          fuelReserveCostFactor: 1.08,
        },
        {
          start: 20,
          end: 74,
          state: "yellow",
          label: "ECONOMY BLEND / HEAT DRIFT",
          heatPerFuelFactor: 1.32,
          outputFactor: 0.92,
          efficiencyPenalty: 0.12,
          fuelReserveCostFactor: 0.78,
          waves: [
            { property: "heatPerFuelFactor", amplitude: 0.28, frequency: 0.13, seed: 1.7 },
            { property: "temperatureBias", amplitude: 16, frequency: 0.08, seed: 0.2 },
            { property: "outputFactor", amplitude: 0.08, frequency: 0.17, seed: 2.4 },
          ],
          pulses: [
            {
              at: 38,
              duration: 3.8,
              temperatureBias: -42,
              outputFactor: -0.28,
              stallPressureBonus: 0.38,
              label: "LEAN POCKET / COLD DIP",
            },
            {
              at: 63,
              duration: 4.4,
              temperatureBias: 38,
              heatPerFuelFactor: 0.22,
              outputFactor: -0.12,
              label: "HOT POCKET / DIRTY BURN",
            },
          ],
        },
        {
          start: 74,
          end: 79,
          state: "off",
          label: "NO USABLE FEED",
          fuelFeedFactor: 0,
          heatPerFuelFactor: 0.42,
          outputFactor: 0.05,
          efficiencyPenalty: 0.58,
          stallPressureBonus: 0.95,
          fuelReserveCostFactor: 0.35,
        },
        {
          start: 79,
          end: 118,
          state: "yellow",
          label: "ECONOMY BLEND / SLUGS",
          heatPerFuelFactor: 1.14,
          outputFactor: 0.9,
          containmentPenalty: 4,
          efficiencyPenalty: 0.14,
          fuelReserveCostFactor: 0.8,
          waves: [
            { property: "heatPerFuelFactor", amplitude: 0.34, frequency: 0.21, seed: 5.2 },
            { property: "temperatureBias", amplitude: 24, frequency: 0.13, seed: 1.1 },
          ],
          pulses: [
            {
              at: 101,
              duration: 3.2,
              temperatureBias: 42,
              containmentPenalty: 10,
              efficiencyPenalty: 0.12,
              label: "RICH SLUG / HEAT SPIKE",
            },
          ],
        },
        {
          start: 118,
          end: 145,
          state: "red",
          label: "UNSTABLE LOW-COST BLEND",
          heatPerFuelFactor: 1.26,
          outputFactor: 0.84,
          containmentPenalty: 12,
          efficiencyPenalty: 0.24,
          stallPressureBonus: 0.28,
          fuelReserveCostFactor: 0.72,
          waves: [
            { property: "heatPerFuelFactor", amplitude: 0.55, frequency: 0.36, seed: 3.1 },
            { property: "outputFactor", amplitude: 0.22, frequency: 0.31, seed: 6.2 },
            { property: "temperatureBias", amplitude: 32, frequency: 0.27, seed: 4.8 },
            { property: "containmentPenalty", amplitude: 7, frequency: 0.22, seed: 2.7 },
          ],
        },
        {
          start: 145,
          end: 180,
          state: "yellow",
          label: "ECONOMY BLEND / FINAL WINDOW",
          heatPerFuelFactor: 1.18,
          outputFactor: 0.95,
          containmentPenalty: 3,
          efficiencyPenalty: 0.08,
          fuelReserveCostFactor: 0.78,
          waves: [
            { property: "heatPerFuelFactor", amplitude: 0.2, frequency: 0.16, seed: 7.3 },
            { property: "temperatureBias", amplitude: 14, frequency: 0.19, seed: 2.9 },
          ],
        },
      ],
    },
  };
}

function cloneConfigValue(value) {
  if (value == null || typeof value !== "object") return value;
  if (typeof value.clone === "function") return value.clone();
  if (Array.isArray(value)) {
    const clone = value.map((entry) => cloneConfigValue(entry));
    Reflect.ownKeys(value)
      .filter((key) => typeof key === "symbol")
      .forEach((key) => Object.defineProperty(clone, key, {
        value: cloneConfigValue(value[key]),
        configurable: true,
      }));
    return clone;
  }
  return Object.fromEntries(
    Reflect.ownKeys(value).map((key) => [key, cloneConfigValue(value[key])]),
  );
}
