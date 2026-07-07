import * as THREE from "three";
import { LEVEL_EXPLORING_AROUND_OVERRIDES } from "../generated/LevelExploringAroundOverrides.js?v=20260707-localized-results1";
import { createPrefabInstance } from "../prefabs/PrefabRegistry.js?v=20260707-localized-results1";
import { LEVEL_CONFIG_SCHEMA_VERSION, migrateLevelOverrides } from "./LevelConfigSchema.js?v=20260707-localized-results1";
import { applyLevelOverrides } from "./LevelConfigOverrides.js?v=20260707-localized-results1";

// Blender uses Z-up. glTF/Three.js uses Y-up: (x, y, z) -> (x, z, -y).
function blenderPosition(x, y, z) {
  return new THREE.Vector3(x, z, -y);
}

const corridorLampXs = [1.6, 5.10382, 8.60764, 12.11146];

const LEVEL_EXPLORING_AROUND_DEFAULTS = {
  schemaVersion: LEVEL_CONFIG_SCHEMA_VERSION,
  saveKind: "exploringAround",
  assetPath: "assets/mesh/SM_Interior2.glb",
  collisionAssetPath: "assets/mesh/SM_Interior2_Collision.glb",
  collision: {
    meshNameIncludes: ["convcolonly"],
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
  session: {
    objectives: [],
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
    spawnPosition: new THREE.Vector3(0.45, 1.52, 1.56),
    rotationDegrees: new THREE.Vector3(1.1, 280, 0),
  },
};

export const LEVEL_EXPLORING_AROUND_CONFIG = applyLevelOverrides(
  LEVEL_EXPLORING_AROUND_DEFAULTS,
  migrateLevelOverrides(LEVEL_EXPLORING_AROUND_OVERRIDES),
);
