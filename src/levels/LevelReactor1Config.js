import * as THREE from "three";
import { LEVEL_REACTOR_1_OVERRIDES } from "../generated/LevelReactor1Overrides.js";

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

const LEVEL_REACTOR_1_DEFAULTS = {
  id: "reactor-1",
  debugPanels: {
    enabled: true,
    levelId: "reactor-1",
    startClosed: true,
    toggleSequence: "debug3",
  },
  world: {
    backgroundColor: "#080b0d",
    fogColor: "#080b0d",
    fogNear: 1,
    fogFar: 10,
  },
  decals: {
    assetPath: "assets/mesh/SM_Interior1_Decals1.glb",
    atlasPath: "assets/Interior1DecalAtlas1.png",
    tint: "#ffffff",
    brightness: 0.72,
    contrast: 0.82,
    saturation: 0.82,
    opacity: 1,
    textureSoftness: 0.7,
    alphaTest: 0.35,
    edgeSoftness: 0.08,
    roughness: 0.9,
    metalness: 0,
    polygonOffsetFactor: -1,
  },
  materials: {
    lamp1: {
      color: "#ffffff",
      roughness: 1,
      metalness: 1,
      normalScale: 1,
      aoMapIntensity: 1,
      emissive: "#ffffff",
      emissiveIntensity: 2.35,
      roomLightControlled: true,
    },
    lamp1_2: {
      color: "#ffffff",
      roughness: 1,
      metalness: 1,
      normalScale: 1,
      aoMapIntensity: 1,
      emissive: "#ffffff",
      emissiveIntensity: 2.35,
      roomLightControlled: true,
    },
    doorLamp1: {
      color: "#ffffff",
      roughness: 1,
      metalness: 1,
      normalScale: 1,
      aoMapIntensity: 1,
      emissive: "#ff0000",
      emissiveIntensity: 5.5,
    },
    bricks1: {
      color: "#fdfffe",
      roughness: 1,
      metalness: 0,
      normalScale: 1,
      aoMapIntensity: 1,
      emissive: "#000000",
      emissiveIntensity: 0,
    },
    Interior1: {
      color: "#ffffff",
      roughness: 1,
      metalness: 1,
      normalScale: 1,
      aoMapIntensity: 1,
      emissive: "#000000",
      emissiveIntensity: 0,
    },
    details1: {
      color: "#ffffff",
      roughness: 1.2,
      metalness: 1,
      normalScale: 1,
      aoMapIntensity: 1,
      emissive: "#000000",
      emissiveIntensity: 0,
    },
    pipes1: {
      color: "#ffffff",
      roughness: 1,
      metalness: 1,
      normalScale: 1,
      aoMapIntensity: 1,
      emissive: "#000000",
      emissiveIntensity: 0,
    },
    beams1: {
      color: "#ffffff",
      roughness: 1,
      metalness: 1,
      normalScale: 1,
      aoMapIntensity: 1,
      emissive: "#000000",
      emissiveIntensity: 0,
    },
  },
  lighting: {
    ambientSky: "#9fb6c7",
    ambientGround: "#101010",
    ambientIntensity: 0.03,
    pointLights: {
      SM_Lamp1_2_Light: {
        color: "#ffffff",
        intensity: 1.5,
        roomLightControlled: true,
        distance: 5,
        decay: 1,
        position: new THREE.Vector3(0.01, 1.91, 0.66),
        castShadow: true,
        shadowMapSize: 256,
        shadowBias: -0.0001,
        shadowNormalBias: 0.003,
        shadowRadius: 1,
        shadowNear: 0.1,
        shadowFar: 5,
      },
      fill: {
        color: "#87b1ff",
        intensity: 0.2,
        roomLightControlled: false,
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
      LampDoor1: {
        color: "#ff0000",
        intensity: 0.2,
        distance: 3,
        decay: 1,
        position: new THREE.Vector3(-0.01, 1.99, 2.31),
        castShadow: false,
        shadowMapSize: 512,
        shadowBias: -0.0006,
        shadowNormalBias: 0.035,
        shadowRadius: 1,
        shadowNear: 0.1,
        shadowFar: 9,
      },
      LampFan: {
        color: "#75b1ff",
        intensity: 0.4,
        distance: 3,
        decay: 1,
        position: new THREE.Vector3(-0.45, 2.33, -0.47),
        castShadow: true,
        shadowMapSize: 512,
        shadowBias: -0.0006,
        shadowNormalBias: 0.035,
        shadowRadius: 1,
        shadowNear: 0.1,
        shadowFar: 9,
      },
    },
    fixtures: {
      SM_Lamp1: {
        lightNames: ["SM_Lamp1_2_Light"],
        materialKeys: ["lamp1"],
      },
    },
  },
};

export const LEVEL_REACTOR_1_CONFIG = applyOverrides(
  LEVEL_REACTOR_1_DEFAULTS,
  LEVEL_REACTOR_1_OVERRIDES,
);
