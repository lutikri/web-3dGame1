import { LEVEL_EXPLORING_AROUND_CONFIG } from "./LevelExploringAroundConfig.js?v=compact-loading-game";
import { LEVEL_INTRO_ELEVATOR_CONFIG } from "./LevelIntroElevatorConfig.js?v=compact-loading-game";
import { LEVEL_INTRO_SHIFT_CONFIG } from "./LevelIntroShiftConfig.js?v=compact-loading-game";
import { validateLevelEnvironmentConfig } from "./LevelConfigSchema.js?v=compact-loading-game";

const LEVEL_UNEXPECTED_STUFF_CONFIG = createUnexpectedStuffConfig();
const LEVEL_COST_OF_RUNNING_CONFIG = createCostOfRunningConfig();
const LEVEL_FREEPLAY_CONFIG = createFreeplayConfig();

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
      subjectKey: "assignments.applicationApproved",
      documentTitleKey: "assignments.qualification.documentTitle",
      summaryKey: "assignments.qualification.summary",
      reference: "OP-QUAL/001",
      facility: "SITE-12",
      sectorKey: "assignments.localOperations",
      clearanceKey: "assignments.assigned",
      date: "01.05.2036",
      time: "06:42",
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
      subjectKey: "assignments.operationsSubject",
      summaryKey: "assignments.reliability.summary",
      reference: "OP-REL/002",
      facility: "SITE-12",
      sectorKey: "assignments.localOperations",
      clearanceKey: "assignments.assigned",
      date: "02.05.2036",
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
      public: false,
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
    description: "Ten-minute free shift with wandering demand and randomized incidents.",
    playable: true,
    assignment: {
      order: 3,
      unlockAfter: ["exploring-around", "unexpected-stuff"],
      titleKey: "assignments.freeplay.title",
      subjectKey: "assignments.developmentSubject",
      documentTitleKey: "assignments.freeplay.documentTitle",
      summaryKey: "assignments.freeplay.summary",
      reference: "OP-FREE/003",
      facility: "SITE-12",
      sectorKey: "assignments.localOperations",
      clearanceKey: "assignments.assigned",
      dateKey: "assignments.freeplay.date",
    },
    environment: LEVEL_FREEPLAY_CONFIG,
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
    shiftProfile: {
      ...baseConfig.shiftProfile,
      completionMode: "timed",
      powerQualification: null,
    },
    narration: {
      ...baseConfig.narration,
      passed: {
        en: { soundKey: "MessageEN_InstrumentReliabilityPassed1", duration: 17.5 },
        ru: { soundKey: "MessageRU_InstrumentReliabilityPassed1", duration: 12.2 },
      },
      insufficient: {
        en: { soundKey: "MessageEN_InstrumentReliabilityFailed1", duration: 16.5 },
        ru: { soundKey: "MessageRU_InstrumentReliabilityFailed1", duration: 14.8 },
      },
      trip: {
        en: { soundKey: "MessageEN_InstrumentReliabilityFailed1", duration: 16.5 },
        ru: { soundKey: "MessageRU_InstrumentReliabilityFailed1", duration: 14.8 },
      },
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
      randomSpeech: {
        enabled: true,
        checkIntervalSeconds: 8,
        chance: 0.3,
        cooldownRangeSeconds: [55, 88],
        recentHistorySize: 2,
        lines: [
          {
            id: "lore-difficulties",
            shift: "unexpected-stuff",
            minTime: 34,
            maxTime: 140,
            weight: 0.9,
            cooldown: 130,
            once: true,
            reactor: { modes: ["running"] },
            en: { soundKey: "MessageEN_RandomLoreDifficulties1", duration: 9.71 },
            ru: { soundKey: "MessageRU_RandomLoreDifficulties1", duration: 8.71 },
          },
          {
            id: "lore-modernization",
            shift: "unexpected-stuff",
            minTime: 52,
            maxTime: 166,
            weight: 1,
            cooldown: 130,
            once: true,
            reactor: { modes: ["running"] },
            en: { soundKey: "MessageEN_RandomLoreModernization1", duration: 9.94 },
            ru: { soundKey: "MessageRU_RandomLoreModernization1", duration: 8.81 },
          },
          {
            id: "work-supervision",
            shift: "unexpected-stuff",
            minTime: 44,
            maxTime: 166,
            weight: 1.2,
            cooldown: 130,
            once: true,
            reactor: { modes: ["running"] },
            en: { soundKey: "MessageEN_RandomWorkSupervision1", duration: 9.94 },
            ru: { soundKey: "MessageRU_RandomWorkSupervision1", duration: 9.68 },
          },
          {
            id: "structure-noises",
            shift: "unexpected-stuff",
            minTime: 26,
            maxTime: 124,
            weight: 0.65,
            cooldown: 105,
            once: true,
            reactor: { modes: ["running"] },
            en: { soundKey: "MessageEN_RandomStructureNoises1", duration: 7.57 },
            ru: { soundKey: "MessageRU_RandomStructureNoises1", duration: 7.64 },
          },
        ],
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
      flashlightHints: true,
    },
    prefabStatePolicies: [
      ...(baseConfig.prefabStatePolicies ?? []),
      {
        prefabTypes: ["LightPanel1"],
        overrides: { lightPanel: { startsTripped: true } },
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
        lamps: [
          {
            id: "over-demand-off-at-start",
            type: "lampFault",
            name: "LightCase1_Light_OverDemand",
            force: "off",
            failColors: ["all"],
            durationSeconds: 45,
          },
        ],
        gauges: [
          {
            id: "plasma-temp-needle-off-at-start",
            type: "gaugeFault",
            key: "plasmaTemp",
            maxRatio: 0,
            durationSeconds: 45,
          },
        ],
        knobs: [],
      },
      initialRandomFaults: [],
      timeline: [
        {
          id: "critical-temperature-lighting-trip",
          type: "lightPanelTrip",
          atSeconds: 110,
          when: { modes: ["running"], warning: "tempCritical" },
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

function createFreeplayConfig() {
  const baseConfig = cloneConfigValue(LEVEL_EXPLORING_AROUND_CONFIG);
  return {
    ...baseConfig,
    saveKind: "freeplay",
    session: {
      completion: "all",
      objectives: [
        { id: "operate-core", type: "survive", seconds: 600 },
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
    shiftProfile: {
      completionMode: "timed",
      durationSeconds: 600,
      powerQualification: null,
      defaultEvents: false,
      transitionSeconds: 14,
      demandWander: { enabled: true, randomized: true, amount: 2.4 },
      phases: [
        { name: "FREE SHIFT / STARTUP", start: 0, end: 80, temp: [70, 118], powerTemp: [88, 138], output: [260, 620], containmentMin: 68, demand: 420 },
        { name: "FREE SHIFT / LOW LOAD", start: 80, end: 190, temp: [92, 138], powerTemp: [110, 154], output: [430, 780], containmentMin: 64, demand: 590 },
        { name: "FREE SHIFT / VARIABLE LOAD", start: 190, end: 330, temp: [108, 151], powerTemp: [128, 165], output: [560, 910], containmentMin: 60, demand: 735 },
        { name: "FREE SHIFT / HIGH LOAD", start: 330, end: 470, temp: [124, 160], powerTemp: [145, 172], output: [720, 1060], containmentMin: 56, demand: 895 },
        { name: "FREE SHIFT / HANDOVER", start: 470, end: 600, temp: [104, 148], powerTemp: [126, 162], output: [500, 880], containmentMin: 62, demand: 700 },
      ],
    },
    triggerSequences: (baseConfig.triggerSequences ?? []).map((sequence) => {
      if (!["WelcomeEntry", "ControlBooth"].includes(sequence.name)) return sequence;
      const { narration: _narration, ...withoutNarration } = sequence;
      return withoutNarration;
    }),
    tutorial: {
      ...baseConfig.tutorial,
      enabled: false,
      flashlightHints: false,
    },
    diagnostics: {
      selfTest: { durationSeconds: 10 },
      initialFaults: { lamps: [], gauges: [], knobs: [] },
      initialRandomFaults: [],
      timeline: [],
      randomTimeline: [
        {
          count: 1,
          pool: [
            { id: "freeplay-early-blackout", type: "blackout", atSeconds: 76, durationSeconds: 0.7, restartLights: true },
            { id: "freeplay-early-demand-lamp", type: "lampFault", atSeconds: 94, durationSeconds: 85, name: "LightCase1_Light_UnderDemand", material: "amber", blink: true, blinkFrequency: 7 },
            { id: "freeplay-early-output-lag", type: "gaugeFault", atSeconds: 113, durationSeconds: 90, key: "powerOutput", delaySeconds: 2.1, noiseDegrees: 1.1 },
          ],
        },
        {
          count: 1,
          pool: [
            { id: "freeplay-mid-containment-offset", type: "gaugeFault", atSeconds: 202, durationSeconds: 105, key: "containment", offsetRatio: -0.09, noiseDegrees: 0.8 },
            { id: "freeplay-mid-efficiency-lamp", type: "lampFault", atSeconds: 229, durationSeconds: 110, name: "LightCase1_Light_ReactionEfficiency", material: "green", blink: true, blinkFrequency: 9 },
            { id: "freeplay-mid-coolant-sticky", type: "knobFault", atSeconds: 257, durationSeconds: 120, name: "Control_Knob_CoolantFlow", sensitivity: 0.08, exercisePercent: 90 },
          ],
        },
        {
          count: 1,
          pool: [
            { id: "freeplay-late-blackout", type: "blackout", atSeconds: 358, durationSeconds: 0.8, restartLights: true },
            { id: "freeplay-late-output-offset", type: "gaugeFault", atSeconds: 391, durationSeconds: 115, key: "powerOutput", offsetRatio: 0.1, noiseDegrees: 1.3 },
            { id: "freeplay-late-over-demand-lamp", type: "lampFault", atSeconds: 424, durationSeconds: 105, name: "LightCase1_Light_OverDemand", material: "amber", blink: true, blinkFrequency: 6 },
          ],
        },
        {
          count: 1,
          pool: [
            { id: "freeplay-handover-heat-sink", type: "gaugeFault", atSeconds: 489, durationSeconds: 75, key: "heatSinkCapacity", offsetRatio: 0.1, noiseDegrees: 0.9 },
            { id: "freeplay-handover-fuel-lamp", type: "lampFault", atSeconds: 513, durationSeconds: 70, name: "LightCase1_Light_FuelQuality", material: "amber", blink: true, blinkFrequency: 5 },
            { id: "freeplay-handover-field-sticky", type: "knobFault", atSeconds: 538, durationSeconds: 80, name: "Control_Knob_MagneticField", sensitivity: 0.12, exercisePercent: 75 },
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
