import * as THREE from "three";

const PREFAB_DEFINITIONS = {
  operatorPanel: {
    assetPath: "assets/mesh/SM_Panel1.glb",
    materialKey: "panel1",
    behavior: "operatorPanel",
  },
  fluorescentLamp: {
    assetPath: "assets/mesh/SM_Lamp1.glb",
    materialKey: "lamp1",
    behavior: "fluorescentLamp",
    light: {
      enabled: true,
      color: "#d9e8ff",
      intensity: 1.5,
      distance: 5,
      decay: 1,
      localOffset: new THREE.Vector3(0.060629, -0.41959, 0),
      castShadow: false,
      shadowMapSize: 512,
      shadowBias: -0.0002,
      shadowNormalBias: 0.012,
      shadowRadius: 1,
      shadowNear: 0.1,
      shadowFar: 6,
      fluorescentStartup: true,
      roomLightControlled: false,
      startupDelaySeconds: 0,
      faultyStarterLoop: false,
      afterglow: {
        enabled: true,
        durationSeconds: 3,
        initialFactor: 0.2,
        exponent: 2.4,
      },
      flicker: {
        enabled: false,
        minIntervalSeconds: 35,
        maxIntervalSeconds: 110,
        retryChance: 0.35,
      },
    },
  },
  bulkheadDoor: {
    assetPath: "assets/mesh/SM_DoorBulk1.glb",
    materialKey: "doorLamp2",
    behavior: "hingedDoor",
    interaction: {
      type: "hingedDoor",
      meshName: "SM_DoorBulk1_Door",
      colliderName: "SM_DoorBulk1_Door_Coll",
      axis: "y",
      initialDegrees: 0,
      minDegrees: -105,
      maxDegrees: 5,
      openDegrees: -90,
      dragDegreesPerPixel: 0.28,
      maxDistance: 1.8,
      density: 180,
      angularDamping: 0.65,
      maxAngularVelocity: 1.8,
      initialHoldSeconds: 0.45,
      motorStiffness: 55,
      motorDamping: 10,
    },
  },
  redBulkLamp: {
    assetPath: "assets/mesh/SM_Lamp_BulkRed.glb",
    materialKey: "doorLamp2",
    behavior: "staticLamp",
    light: {
      enabled: true,
      color: "#ff1b0a",
      intensity: 0.2,
      distance: 3,
      decay: 1,
      localOffset: new THREE.Vector3(),
      castShadow: false,
      shadowMapSize: 512,
      shadowBias: -0.0006,
      shadowNormalBias: 0.035,
      shadowRadius: 1,
      shadowNear: 0.1,
      shadowFar: 9,
      fluorescentStartup: false,
      startupDelaySeconds: 0,
      faultyStarterLoop: false,
      flicker: {
        enabled: false,
        minIntervalSeconds: 35,
        maxIntervalSeconds: 110,
        retryChance: 0,
      },
    },
  },
};

export function createPrefabInstance(prefabType, instance) {
  const definition = PREFAB_DEFINITIONS[prefabType];
  if (!definition) throw new Error(`[PrefabRegistry] Unknown prefab type: ${prefabType}`);
  const resolved = cloneValue(definition);
  mergeKnown(resolved, instance.overrides ?? {});
  resolved.prefabType = prefabType;
  resolved.name = instance.name;
  resolved.position = instance.position?.clone?.() ?? instance.position ?? new THREE.Vector3();
  resolved.rotation = instance.rotation?.clone?.() ?? instance.rotation ?? new THREE.Euler();
  resolved.scale = instance.scale?.clone?.() ?? instance.scale ?? new THREE.Vector3(1, 1, 1);
  return resolved;
}

export function getPrefabDefinition(prefabType) {
  return PREFAB_DEFINITIONS[prefabType] ? cloneValue(PREFAB_DEFINITIONS[prefabType]) : null;
}

export function listPrefabTypes() {
  return Object.keys(PREFAB_DEFINITIONS);
}

function cloneValue(value) {
  if (value?.clone) return value.clone();
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

function mergeKnown(target, source) {
  Object.entries(source ?? {}).forEach(([key, value]) => {
    if (!(key in target)) return;
    if (value && typeof value === "object" && !Array.isArray(value) && !value.isVector3 && !value.isEuler) {
      mergeKnown(target[key], value);
    } else {
      target[key] = cloneValue(value);
    }
  });
  return target;
}
