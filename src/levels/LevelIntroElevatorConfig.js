import * as THREE from "three";
import { LEVEL_INTRO_ELEVATOR_OVERRIDES } from "../generated/LevelIntroElevatorOverrides.js?v=architecture-split-82";
import { LEVEL_CONFIG_SCHEMA_VERSION } from "./LevelConfigSchema.js?v=architecture-split-82";
import { applyLevelOverrides } from "./LevelConfigOverrides.js?v=architecture-split-82";

const elevatorStart = new THREE.Vector3(0.8082548379898071, 35.64804458618164, -2.094832181930542);

const LEVEL_INTRO_ELEVATOR_DEFAULTS = {
  schemaVersion: LEVEL_CONFIG_SCHEMA_VERSION,
  saveKind: "introElevator",
  assetPath: "assets/mesh/environment/SM_InteriorElevator1.glb",
  collisionAssetPath: "assets/mesh/environment/SM_InteriorElevator1.glb",
  collision: {
    meshNameIncludes: ["convcolonly", "UBX_"],
  },
  render: {
    meshNameExcludes: ["convcolonly", "UBX_"],
  },
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Euler(0, 0, 0),
  scale: new THREE.Vector3(1, 1, 1),
  world: {
    backgroundColor: "#05080a",
    fogColor: "#05080a",
    fogNear: 2,
    fogFar: 42,
  },
  behaviors: {},
  session: {
    objectives: [],
    bindings: [],
  },
  narration: {
    welcome: {
      en: {
        soundKey: "MessageEN_WelcomeElevator1",
        subtitlePath: "assets/sounds/narration/MessageEN_WelcomeElevator1.srt",
        duration: 79.4,
      },
      ru: {
        soundKey: "MessageRU_WelcomeElevator1",
        subtitlePath: "assets/sounds/narration/MessageRU_WelcomeElevator1.srt",
        duration: 76.4,
      },
    },
  },
  prefabs: [],
  lighting: {
    ambientSky: "#71808c",
    ambientGround: "#070707",
    ambientIntensity: 0.018,
    pointLights: {
      elevatorSoftFill: {
        position: elevatorStart.clone().add(new THREE.Vector3(0, 1.35, 0)),
        color: "#9db7bc",
        intensity: 0.35,
        distance: 5,
        decay: 1.4,
        castShadow: false,
      },
    },
  },
  player: {
    spawnPosition: elevatorStart.clone().add(new THREE.Vector3(0, 1.45, 0)),
    rotationDegrees: new THREE.Vector3(0, 180, 0),
  },
};

export const LEVEL_INTRO_ELEVATOR_CONFIG = applyLevelOverrides(
  LEVEL_INTRO_ELEVATOR_DEFAULTS,
  LEVEL_INTRO_ELEVATOR_OVERRIDES,
);
