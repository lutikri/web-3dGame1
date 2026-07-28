import * as THREE from "three";
import { LEVEL_INTRO_SHIFT_OVERRIDES } from "../generated/LevelIntroShiftOverrides.js?v=preflight-audio-lifecycle";
import { createPrefabInstance } from "../prefabs/PrefabRegistry.js?v=preflight-audio-lifecycle";
import { LEVEL_CONFIG_SCHEMA_VERSION, migrateLevelOverrides } from "./LevelConfigSchema.js?v=preflight-audio-lifecycle";
import { applyLevelOverrides } from "./LevelConfigOverrides.js?v=preflight-audio-lifecycle";

function blenderPosition(x, y, z) {
  return new THREE.Vector3(x, z, -y);
}

const LEVEL_INTRO_SHIFT_DEFAULTS = {
  schemaVersion: LEVEL_CONFIG_SCHEMA_VERSION,
  saveKind: "introShift",
  assetPath: "assets/mesh/environment/SM_Interior1_1.glb",
  collisionAssetPath: "assets/mesh/environment/SM_Interior1_1.glb",
  collision: {
    meshNameIncludes: ["convcolonly"],
  },
  render: {
    meshNameExcludes: ["convcolonly"],
  },
  position: new THREE.Vector3(),
  rotation: new THREE.Euler(),
  scale: new THREE.Vector3(1, 1, 1),
  world: {
    backgroundColor: "#080b0d",
    fogColor: "#080b0d",
    fogNear: 1,
    fogFar: 10,
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
    bindings: [
      {
        source: "SM_Details_LightButton1",
        event: "press",
        action: "togglePrefabLight",
        target: "Lamp1_TutorialCabin",
      },
    ],
  },
  prefabs: [
    createPrefabInstance("operatorPanel", {
      name: "Panel1",
      position: blenderPosition(3.60587, 2.49771, -0.010162),
    }),
    createPrefabInstance("bulkheadDoor", {
      name: "DoorBulk1_Tutorial",
      position: blenderPosition(3.6, 0.022979, 0.151831),
      overrides: {
        state: {
          latched: true,
        },
        interaction: {
          initialDegrees: 0,
        },
      },
    }),
    createPrefabInstance("redBulkLamp", {
      name: "LampBulkRed_Tutorial",
      position: blenderPosition(3.02204, 0.030289, 2.0058),
    }),
    createPrefabInstance("fluorescentLamp", {
      name: "Lamp1_TutorialCabin",
      position: blenderPosition(3.6861, 1.49811, 2.39028),
      overrides: {
        light: {
          fluorescentStartup: false,
          roomLightControlled: true,
          castShadow: true,
        },
      },
    }),
    createPrefabInstance("analogClock", {
      name: "Clock1_Tutorial",
      position: new THREE.Vector3(3.1, 2.0, -1.35),
      rotation: new THREE.Euler(0, Math.PI, 0),
    }),
  ],
  lighting: {
    ambientSky: "#9fb6c7",
    ambientGround: "#101010",
    ambientIntensity: 0.03,
    pointLights: {
      fill: {
        color: "#87b1ff",
        intensity: 0.2,
        distance: 6,
        decay: 0.4,
        position: new THREE.Vector3(0.64, 2.03, 0.45),
        castShadow: false,
        shadowMapSize: 512,
        shadowBias: -0.0005,
        shadowNormalBias: 0.03,
        shadowRadius: 1,
        shadowNear: 0.1,
        shadowFar: 7,
      },
      LampFan: {
        color: "#75b1ff",
        intensity: 0.4,
        distance: 3,
        decay: 1,
        position: new THREE.Vector3(-0.45, 2.33, -0.47),
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
    spawnPosition: new THREE.Vector3(3.58, 1.63, -0.85),
    rotationDegrees: new THREE.Vector3(0, 0, 0),
  },
};

export const LEVEL_INTRO_SHIFT_CONFIG = applyLevelOverrides(
  LEVEL_INTRO_SHIFT_DEFAULTS,
  migrateLevelOverrides(LEVEL_INTRO_SHIFT_OVERRIDES),
);
