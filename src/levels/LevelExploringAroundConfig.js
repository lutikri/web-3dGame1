import * as THREE from "three";
import { LEVEL_EXPLORING_AROUND_OVERRIDES } from "../generated/LevelExploringAroundOverrides.js";

// Blender uses Z-up. glTF/Three.js uses Y-up: (x, y, z) -> (x, z, -y).
function blenderPosition(x, y, z) {
  return new THREE.Vector3(x, z, -y);
}

function applyOverrides(target, overrides) {
  Object.entries(overrides ?? {}).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      applyOverrides(target[key], value);
    } else {
      target[key] = value;
    }
  });
  return target;
}

const corridorLampXs = [1.6, 5.10382, 8.60764, 12.11146];

function lampPrefab(name, position, { intensity = 1.5, castShadow = false, rotateAroundUp = false } = {}) {
  return {
    name,
    assetPath: "assets/mesh/SM_Lamp1.glb",
    materialKey: "lamp1",
    position,
    rotation: new THREE.Euler(0, rotateAroundUp ? Math.PI / 2 : 0, 0),
    light: {
      enabled: true,
      color: "#d9e8ff",
      intensity,
      distance: 5,
      decay: 1,
      localOffset: blenderPosition(0.060629, 0, -0.41959),
      castShadow,
      shadowMapSize: 512,
      shadowBias: -0.0002,
      shadowNormalBias: 0.012,
      shadowRadius: 1,
      shadowNear: 0.1,
      shadowFar: 6,
      fluorescentStartup: true,
      flicker: {
        enabled: false,
        minIntervalSeconds: 35,
        maxIntervalSeconds: 110,
        minDurationSeconds: 0.08,
        maxDurationSeconds: 0.42,
        pulseCount: 6,
        minFactor: 0.55,
        retryChance: 0.35,
      },
    },
  };
}

const LEVEL_EXPLORING_AROUND_DEFAULTS = {
  assetPath: "assets/mesh/SM_Interior2.glb",
  collisionAssetPath: "assets/mesh/SM_Interior2_Collision.glb",
  collision: {
    meshNameIncludes: ["convcolonly"],
  },
  position: new THREE.Vector3(0, 0, 0),
  rotation: new THREE.Euler(0, 0, 0),
  scale: new THREE.Vector3(1, 1, 1),
  panel: {
    position: blenderPosition(3.6, 2.44, -0.055),
  },
  prefabs: [
    {
      name: "DoorBulk1_A",
      assetPath: "assets/mesh/SM_DoorBulk1.glb",
      materialKey: "doorLamp2",
      position: blenderPosition(3.6, 0.006729, 0.151831),
      interaction: {
        type: "hingedDoor",
        meshName: "SM_DoorBulk1_Door",
        colliderName: "SM_DoorBulk1_Door_Coll",
        axis: "y",
        initialDegrees: -20,
        minDegrees: -105,
        maxDegrees: 5,
        dragDegreesPerPixel: 0.28,
        maxDistance: 2.8,
      },
    },
    {
      name: "DoorBulk1_B",
      assetPath: "assets/mesh/SM_DoorBulk1.glb",
      materialKey: "doorLamp2",
      position: blenderPosition(13.1869, 0.006729, 0.151831),
      interaction: {
        type: "hingedDoor",
        meshName: "SM_DoorBulk1_Door",
        colliderName: "SM_DoorBulk1_Door_Coll",
        axis: "y",
        initialDegrees: -20,
        minDegrees: -105,
        maxDegrees: 5,
        dragDegreesPerPixel: 0.28,
        maxDistance: 2.8,
      },
    },
    ...corridorLampXs.map((x, index) =>
      lampPrefab(`Lamp1_Corridor_${index + 1}`, blenderPosition(x, -1.23, 2.38), {
        intensity: 1.35,
        castShadow: index === 1,
        rotateAroundUp: true,
      }),
    ),
    lampPrefab("Lamp1_ControlRoom", blenderPosition(3.60587, 1.811, 2.3792), {
      intensity: 1.5,
      castShadow: true,
    }),
  ],
  lighting: {
    ambientSky: "#71808c",
    ambientGround: "#08090a",
    ambientIntensity: 0.018,
  },
};

export const LEVEL_EXPLORING_AROUND_CONFIG = applyOverrides(
  LEVEL_EXPLORING_AROUND_DEFAULTS,
  LEVEL_EXPLORING_AROUND_OVERRIDES,
);
