import * as THREE from "three";
import { LEVEL_EXPLORING_AROUND_OVERRIDES } from "../generated/LevelExploringAroundOverrides.js?v=terminal-icons";
import { LEVEL_CONFIG_SCHEMA_VERSION, migrateLevelOverrides } from "./LevelConfigSchema.js?v=terminal-icons";
import { applyLevelOverrides } from "./LevelConfigOverrides.js?v=terminal-icons";

const LEVEL_EXPLORING_AROUND_DEFAULTS = {
  schemaVersion: LEVEL_CONFIG_SCHEMA_VERSION,
  saveKind: "exploringAround",
  assetPath: "assets/mesh/environment/SM_Interior2.glb",
  collisionAssetPath: "assets/mesh/environment/SM_Interior2.glb",
  collision: {
    meshNameIncludes: ["convcolonly", "UBX_"],
    meshNameExcludes: ["SM_Door2"],
  },
  render: {
    meshNameExcludes: ["convcolonly", "UBX_", "SM_Door2"],
  },
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Euler(0, 0, 0),
  scale: new THREE.Vector3(1, 1, 1),
  world: {
    backgroundColor: "#080b0d",
    fogColor: "#080b0d",
    fogNear: 1,
    fogFar: 18,
  },
  behaviors: {
    fans: {
      "SM_Fan.002": {
        enabled: true,
        axis: "z",
        speedDegreesPerSecond: 120,
      },
    },
  },
  physicalBriefing: {
    enabled: false,
    prefabType: "briefSheet",
    socketPrefix: "SOCKET_Brief_",
    briefingLevelId: "intro-shift",
    holdSeconds: 0.5,
    maxDistance: 1.65,
    sheets: {
      en: ["assets/ui/briefings/Intro1-us.png"],
      ru: [
        "assets/ui/briefings/Intro1-ru.png",
        "assets/ui/briefings/Intro1_2-ru.png",
      ],
    },
  },
  session: {
    completion: "all",
    objectives: [
      { id: "complete-shift", type: "shiftComplete" },
      {
        id: "exit-complex",
        type: "event",
        event: "doorUnlocked",
        target: "DoorBulk1_4",
        blockedStopDegrees: 5,
      },
    ],
    bindings: [
      {
        source: "SM_Details_LightButton1",
        event: "press",
        action: "togglePrefabLight",
        target: "fluorescentLamp_TutorialCabin",
      },
    ],
  },
  shiftProfile: {
    defaultEvents: false,
    transitionSeconds: 9,
    demandWander: { enabled: false },
    phases: [
      { name: "FIELD PRECHARGE", start: 0, end: 24, temp: [20, 55], powerTemp: [25, 70], output: [0, 250], containmentMin: 75, demand: 140 },
      { name: "PLASMA IGNITION", start: 24, end: 52, temp: [75, 105], powerTemp: [85, 120], output: [300, 550], containmentMin: 65, demand: 430 },
      { name: "STABLE BURN", start: 52, end: 90, temp: [100, 135], powerTemp: [118, 148], output: [500, 750], containmentMin: 70, demand: 650 },
      { name: "DEMAND SURGE", start: 90, end: 135, temp: [125, 155], powerTemp: [150, 166], output: [750, 950], containmentMin: 60, demand: 850 },
      { name: "SUSTAINED HIGH LOAD", start: 135, end: 180, temp: [138, 162], powerTemp: [158, 172], output: [850, 1100], containmentMin: 55, demand: 980 },
    ],
    qualification: {
      graceSeconds: 12,
      demandToleranceRatio: 0.12,
      severeDemandToleranceRatio: 0.25,
      minGridComplianceRatio: 0.45,
      minAverageEfficiency: 62,
      maxPeakCoreStress: 92,
      maxCriticalTempRatio: 0.15,
      maxCoreStallRatio: 0.12,
      maxInstabilityRatio: 0.12,
      maxSevereDemandStreakSeconds: 42,
      minPhaseComplianceRatio: 0.45,
      minPassingPhases: 2,
      minPhaseScoredSeconds: 8,
      excludedPhaseNames: ["FIELD PRECHARGE"],
    },
  },
  narration: {
    autoStart: false,
    welcome: {
      en: {
        soundKey: "MessageEN_Welcome1",
        subtitlePath: "assets/sounds/narration/MessageEN_Welcome1.srt",
        duration: 24.48,
      },
      ru: {
        soundKey: "MessageRU_Welcome1",
        subtitlePath: "assets/sounds/narration/MessageRU_Welcome1.srt",
        duration: 25.6,
      },
    },
    panelTutorial: {
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
    },
    passed: {
      en: { soundKey: "MessageEN_WelcomePassed1", duration: 15.12 },
      ru: { soundKey: "MessageRU_WelcomePassed1", subtitlePath: "assets/sounds/narration/MessageRU_WelcomePassed1.srt", duration: 15.44 },
    },
    insufficient: {
      en: { soundKey: "MessageEN_WelcomeInnsuficient1", duration: 21.68 },
      ru: { soundKey: "MessageRU_WelcomeInnsuficient1", subtitlePath: "assets/sounds/narration/MessageRU_WelcomeInnsuficient1.srt", duration: 17.04 },
    },
    trip: {
      en: { soundKey: "MessageEN_WelcomeTrip1", duration: 17.16 },
      ru: { soundKey: "MessageRU_WelcomeTrip1", subtitlePath: "assets/sounds/narration/MessageRU_WelcomeTrip1.srt", duration: 18.16 },
    },
  },
  triggerSequences: [
    {
      name: "WelcomeEntry",
      trigger: { markerName: "TRGVOL_WelcomeEntry_01", once: true },
      narration: "welcome",
      actions: [
        {
          action: "unlockBarrierGate",
          target: "Barrier1_1",
          relativeTo: "narrationEnd",
          offsetSeconds: -0.8,
        },
      ],
    },
    {
      name: "MainCorridorEntrance",
      trigger: { markerName: "TRGVOL_MainCorridorEntrance_1", once: true },
    },
    {
      name: "ControlBooth",
      trigger: { markerName: "TRGVOL_ControlBooth_1", once: true },
      narration: "panelTutorial",
    },
  ],
  repeatableTriggerSequences: ["MainCorridorEntrance"],
  tutorial: {
    enabled: true,
    spawnHintDelaySeconds: 2,
    advanceHintDelaySeconds: 2,
    postMovementDelaySeconds: 5,
    hoverConfirmSeconds: 0.4,
    entryDoorTarget: "serviceDoor_Exit2",
    welcomeTrigger: "WelcomeEntry",
    mainCorridorTrigger: "MainCorridorEntrance",
    controlBoothTrigger: "ControlBooth",
    controlBoothNarration: "panelTutorial",
    mainCorridorThought: "tutorial-control-booth",
    startCoreThought: "tutorial-start-core",
  },
  prefabStatePolicies: [
    {
      prefabTypes: ["bulkheadDoor", "DoorBulk1"],
      state: { latched: true },
      exceptions: {
        DoorBulk1_DoorBulkLocalObservation: { latched: false },
        DoorBulk1_DoorBulkControlBooth: { latched: false },
      },
    },
  ],
  prefabMarkerReferences: [
    { name: "fluorescentLamp_TutorialCabin", prefabType: "fluorescentLamp" },
  ],
  prefabs: [],
  lighting: {
    ambientSky: "#71808c",
    ambientGround: "#08090a",
    ambientIntensity: 0.018,
    pointLights: {
      fill: {
        color: "#75bcff",
        intensity: 0.25,
        distance: 2.5,
        decay: 0.63,
        position: new THREE.Vector3(3.3063295628550096, 1.4615465941703416, -1.6873887166078796),
        castShadow: false,
        shadowMapSize: 512,
        shadowBias: -0.0005,
        shadowNormalBias: 0.03,
        shadowRadius: 1,
        shadowNear: 0.1,
        shadowFar: 7,
      },
      LampFan: {
        color: "#ff9875",
        intensity: 0.6,
        distance: 3,
        decay: 0.49,
        position: new THREE.Vector3(3.1715786524857754, 2.2591211289988005, -2.910675730137223),
        castShadow: true,
        heroShadow: true,
        shadowMapSize: 512,
        shadowBias: -0.0006,
        shadowNormalBias: 0.035,
        shadowRadius: 1,
        shadowNear: 0.1,
        shadowFar: 9,
      },
    },
  },
  player: {
    spawnPosition: new THREE.Vector3(-1.74, 1.52, 21.94),
    rotationDegrees: new THREE.Vector3(0, 0, 0),
  },
};

export const LEVEL_EXPLORING_AROUND_CONFIG = applyLevelOverrides(
  LEVEL_EXPLORING_AROUND_DEFAULTS,
  migrateLevelOverrides(LEVEL_EXPLORING_AROUND_OVERRIDES),
);

// Shift briefing content now lives in the service terminal. Keep stale saved
// socket placements from restoring the retired paper briefing sheets.
LEVEL_EXPLORING_AROUND_CONFIG.physicalBriefing.enabled = false;
