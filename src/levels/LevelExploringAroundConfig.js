import * as THREE from "three";
import { LEVEL_EXPLORING_AROUND_OVERRIDES } from "../generated/LevelExploringAroundOverrides.js?v=body-motion-debug";
import { createPrefabInstance } from "../prefabs/PrefabRegistry.js?v=body-motion-debug";
import { LEVEL_CONFIG_SCHEMA_VERSION, migrateLevelOverrides } from "./LevelConfigSchema.js?v=body-motion-debug";
import { applyLevelOverrides } from "./LevelConfigOverrides.js?v=body-motion-debug";

// Blender uses Z-up. glTF/Three.js uses Y-up: (x, y, z) -> (x, z, -y).
function blenderPosition(x, y, z) {
  return new THREE.Vector3(x, z, -y);
}

const corridorLampXs = [1.6, 5.10382, 8.60764, 12.11146];

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
    enabled: true,
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
        target: "Lamp1_TutorialCabin",
      },
    ],
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
        DoorBulk1_A: { latched: false },
      },
    },
  ],
  prefabs: [
    createPrefabInstance("operatorPanel", {
      name: "Panel1",
      position: blenderPosition(3.6, 2.44, -0.055),
    }),
    createPrefabInstance("bulkheadDoor", {
      name: "DoorBulk1_A",
      position: new THREE.Vector3(3.6, 0.151831, -0.02457743734996512),
    }),
    createPrefabInstance("bulkheadDoor", {
      name: "DoorBulk1_B",
      position: blenderPosition(13.1869, 0.006729, 0.151831),
    }),
    createPrefabInstance("serviceDoor", {
      name: "Door2_ServiceA",
      position: new THREE.Vector3(0, 0, 0),
    }),
    ...corridorLampXs.map((x, index) =>
      createPrefabInstance("fluorescentLamp", {
        name: `Lamp1_Corridor_${index + 1}`,
        position: blenderPosition(x, -1.23, 2.38),
        rotation: new THREE.Euler(0, Math.PI / 2, 0),
        overrides: {
          light: {
            intensity: 1.35,
            castShadow: index === 1,
            startupDelaySeconds: (index + 1) * 2,
            faultyStarterLoop: index === 1,
          },
        },
      }),
    ),
    createPrefabInstance("fluorescentLamp", {
      name: "Lamp1_TutorialCabin",
      position: new THREE.Vector3(3.5663008893845523, 2.39028, -1.7304095448416588),
      overrides: {
        light: {
          color: "#fffdfa",
          intensity: 1.98,
          distance: 3.25,
          decay: 0.33,
          localOffset: new THREE.Vector3(0.060629, -0.45930362303042627, 0),
          castShadow: true,
          shadowBias: 0.00024,
          shadowRadius: 5.2,
          fluorescentStartup: true,
          roomLightControlled: true,
          startupDelaySeconds: 3,
          flicker: {
            enabled: true,
            minIntervalSeconds: 35,
            maxIntervalSeconds: 110,
            retryChance: 0.35,
          },
        },
      },
    }),
    createPrefabInstance("redBulkLamp", {
      name: "LampBulkRed_Exploring",
      position: blenderPosition(3.02204, 0.030289, 2.0058),
      overrides: {
        light: {
          intensity: 3.17,
          distance: 1.5,
          decay: 0.4,
          localOffset: new THREE.Vector3(0, 0, -0.12778707579195908),
        },
      },
    }),
    createPrefabInstance("analogClock", {
      name: "Clock1_Exploring",
      position: new THREE.Vector3(3.1, 2.0, -1.35),
      rotation: new THREE.Euler(0, Math.PI, 0),
    }),
  ],
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
