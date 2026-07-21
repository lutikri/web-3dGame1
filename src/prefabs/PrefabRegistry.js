import * as THREE from "three";

const SERVICE_DOOR_DEFINITION = {
  assetPath: "assets/mesh/prefabs/SM_Door2_1.glb",
  materialKey: "door2",
  behavior: "hingedDoor",
  materialOverrides: {
    SM_Door2_Glass: "door2Glass",
  },
  interaction: {
    type: "hingedDoor",
    meshName: "SM_Door2_Door",
    colliderName: "UBX_SM_Door2_Door_01",
    latchHandleNames: ["SM_Door2_Handle1", "SM_Door2_Handle2"],
    latchHandleAxis: "z",
    latchHandleDegreesByName: {
      SM_Door2_Handle1: 28,
      SM_Door2_Handle2: -28,
    },
    latchAction: "holdOpen",
    latchHoldSeconds: 0.4,
    latchReturnSeconds: 0.35,
    latchTurnDegrees: 28,
    latchJerkDegrees: 0,
    doorClickAction: "none",
    axis: "y",
    initialDegrees: 0,
    minDegrees: 0,
    maxDegrees: 80,
    openDegrees: 80,
    closeDegrees: 0,
    closeToleranceDegrees: 0.35,
    dragDegreesPerPixel: 0.24,
    maxDistance: 1.8,
    density: 120,
    angularDamping: 1.1,
    maxAngularVelocity: 1.6,
    initialHoldSeconds: 0.35,
    motorStiffness: 85,
    motorDamping: 18,
  },
  state: {
    latched: true,
  },
};

const PREFAB_DEFINITIONS = {
  operatorPanel: {
    assetPath: "assets/mesh/panel/SM_Panel1.glb",
    materialKey: "panel1",
    behavior: "operatorPanel",
  },
  elevator: {
    assetPath: "assets/mesh/prefabs/SM_Elevator1.glb",
    materialKey: "trimConcrete1",
    behavior: "elevator",
    elevator: {
      cageName: "SM_ElevatorCage1",
      doorName: "SM_ElevatorDoor1",
      cageColliderNamePrefixes: ["UBX_SM_ElevatorCage1"],
      doorColliderNamePrefixes: ["UBX_SM_ElevatorDoor1"],
      cageColliderMode: "floor",
      cageFloorThickness: 0.12,
      cageFloorInset: 0.08,
      disableCageCollisionOnArrival: false,
      travelDurationSeconds: 80,
      endY: 0,
      doorOpenHeight: 1.75,
      doorOpenAxis: "y",
      doorOpenSeconds: 2.4,
      carryPlayer: true,
      carryRadius: 1.25,
      carryHeight: 2.4,
    },
  },
  Elevator1: {
    assetPath: "assets/mesh/prefabs/SM_Elevator1.glb",
    materialKey: "trimConcrete1",
    behavior: "elevator",
    elevator: {
      cageName: "SM_ElevatorCage1",
      doorName: "SM_ElevatorDoor1",
      cageColliderNamePrefixes: ["UBX_SM_ElevatorCage1"],
      doorColliderNamePrefixes: ["UBX_SM_ElevatorDoor1"],
      cageColliderMode: "floor",
      cageFloorThickness: 0.12,
      cageFloorInset: 0.08,
      disableCageCollisionOnArrival: false,
      travelDurationSeconds: 80,
      endY: 0,
      doorOpenHeight: 1.75,
      doorOpenAxis: "y",
      doorOpenSeconds: 2.4,
      carryPlayer: true,
      carryRadius: 1.25,
      carryHeight: 2.4,
    },
  },
  radio: {
    assetPath: "assets/mesh/prefabs/SM_Radio1.glb",
    materialKey: "radio1",
    behavior: "narratorRadio",
    materialOverrides: {
      SM_Radio1_Lamp: "radioLamp",
    },
    radio: {
      lampName: "SM_Radio1_Lamp",
      welcomeDelaySeconds: 0.7,
      maxDistance: 3.8,
      refDistance: 0.7,
      lampBlinkFrequency: 1.1,
    },
  },
  radio1: {
    assetPath: "assets/mesh/prefabs/SM_Radio1.glb",
    materialKey: "radio1",
    behavior: "narratorRadio",
    materialOverrides: {
      SM_Radio1_Lamp: "radioLamp",
    },
    radio: {
      lampName: "SM_Radio1_Lamp",
      welcomeDelaySeconds: 0.7,
      maxDistance: 3.8,
      refDistance: 0.7,
      lampBlinkFrequency: 1.1,
    },
  },
  fluorescentLamp: {
    assetPath: "assets/mesh/prefabs/SM_Lamp1.glb",
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
      photometricProfile: {
        enabled: true,
        path: "assets/runtime-textures/T_Lamp1_LightDistribution_1024_RGBE.hdr",
        strength: 1,
        flipY: true,
      },
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
    assetPath: "assets/mesh/prefabs/SM_DoorBulk1.glb",
    materialKey: "doorLamp2",
    behavior: "hingedDoor",
    interaction: {
      type: "hingedDoor",
      meshName: "SM_DoorBulk1_Door",
      colliderName: "SM_DoorBulk1_Door_Coll",
      latchHandleName: "SM_DoorBulk1_Handle",
      latchHandleAxis: "z",
      latchHandleLatchedDegrees: -70,
      latchHoldSeconds: 2,
      latchReturnSeconds: 0.75,
      latchTurnDegrees: 180,
      latchJerkDegrees: 4,
      latchJerkFrequency: 3,  
      latchBlockedAttemptSeconds: 0.85,
      latchBlockedStopDegrees: 26,
      latchBlockedKnockDegrees: 3,
      latchClosedToleranceDegrees: 7,
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
    state: {
      latched: false,
    },
  },
  serviceDoor: SERVICE_DOOR_DEFINITION,
  ServiceDoor1: SERVICE_DOOR_DEFINITION,
  door2: SERVICE_DOOR_DEFINITION,
  Barrier1: {
    assetPath: "assets/mesh/prefabs/SM_Barrier1.glb",
    materialKey: "barrier1",
    behavior: "barrierGate",
    barrierGate: {
      enabled: false,
      gateName: "SM_Barrier1_Gate",
      colliderName: "UBX_SM_Barrier1_Gate_01",
      axis: "y",
      minDegrees: -90,
      maxDegrees: 90,
      locked: true,
      unlockDelaySeconds: 20,
      unlockMotorSoundKey: "MotorSmall1",
      unlockBeepSoundKey: "BeepShortLight1",
      soundGapSeconds: 0.35,
      targetDegreesOnUnlock: 10,
      density: 70,
      angularDamping: 0.85,
      maxAngularVelocity: 1.7,
      initialHoldSeconds: 0.2,
      motorStiffness: 42,
      motorDamping: 9,
      returnToRest: true,
      restDegrees: 0,
      restMotorStiffness: 3.5,
      restMotorDamping: 0.9,
      refDistance: 0.55,
      maxDistance: 3,
    },
  },
  Controlpost: {
    assetPath: "assets/mesh/prefabs/SM_ControlPost1.glb",
    materialKey: "controlPost1",
    behavior: "controlPost",
    controlPost: {
      enabled: false,
      triggerName: "SM_ControlPost1_Trigger_1",
      buzzSoundKey: "ControlPostBuzzLoop1",
      alertSoundKey: "ControlPostAlert1",
      triggerHoldSeconds: 0.5,
      triggerCooldownSeconds: 8,
      refDistance: 0.45,
      maxDistance: 2,
      alertRefDistance: 0.55,
      alertMaxDistance: 2.4,
    },
  },
  Desk1: {
    assetPath: "assets/mesh/prefabs/SM_Desk1.glb",
    rootName: "SM_Desk1",
    materialKey: "desk1",
    behavior: "rigidProp",
    rigidBody: {
      enabled: true,
      bodyType: "dynamic",
      colliderNamePrefixes: ["UBX_SM_Desk1"],
      density: 260,
      linearDamping: 1.2,
      angularDamping: 2.2,
      friction: 0.95,
      restitution: 0,
      canSleep: true,
    },
  },
  Chair1: {
    assetPath: "assets/mesh/prefabs/SM_Chair1.glb",
    rootName: "SM_Chair1",
    materialKey: "desk1",
    behavior: "rigidProp",
    rigidBody: {
      enabled: true,
      bodyType: "dynamic",
      colliderNamePrefixes: ["UBX_SM_Chair1"],
      density: 55,
      linearDamping: 0.75,
      angularDamping: 1.3,
      friction: 0.8,
      restitution: 0.02,
      canSleep: true,
    },
  },
  LampDesk1: {
    assetPath: "assets/mesh/prefabs/SM_LampDesk1.glb",
    rootName: "SM_LampDesk1",
    materialKey: "desk1",
    behavior: "rigidProp",
    rigidBody: {
      enabled: true,
      bodyType: "dynamic",
      colliderNamePrefixes: ["UBX_SM_Lamp1"],
      density: 35,
      linearDamping: 0.85,
      angularDamping: 1.6,
      friction: 0.82,
      restitution: 0.01,
      canSleep: true,
    },
    light: {
      enabled: true,
      type: "spot",
      markerName: "LGT_DeskLamp1",
      color: "#fff1cf",
      intensity: 1.25,
      distance: 4,
      decay: 1.5,
      angle: 0.63,
      penumbra: 0.18,
      localOffset: new THREE.Vector3(0.000087, 0.3648, -0.108834),
      castShadow: false,
      shadowMapSize: 512,
      shadowBias: -0.0004,
      shadowNormalBias: 0.02,
      shadowRadius: 1,
      shadowNear: 0.05,
      shadowFar: 5,
      fluorescentStartup: false,
      startupDelaySeconds: 0,
      faultyStarterLoop: false,
      flicker: {
        enabled: false,
        minIntervalSeconds: 25,
        maxIntervalSeconds: 80,
        retryChance: 0.12,
      },
    },
  },
  redBulkLamp: {
    assetPath: "assets/mesh/prefabs/SM_Lamp_BulkRed.glb",
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
  analogClock: {
    assetPath: "assets/mesh/prefabs/SM_Clock1.glb",
    materialKey: "clock1",
    behavior: "analogClock",
    materialOverrides: {
      SM_Clock1_Glass: "clock1Glass",
    },
    clock: {
      enabled: true,
      axis: "x",
      direction: 1,
      secondsHandName: "SM_Clock1_ArrowSeconds",
      minutesHandName: "SM_Clock1_ArrowMinutes",
      hoursHandName: "SM_Clock1_ArrowHours",
      smoothSeconds: true,
    },
  },
};

const REGISTRY_OWNED_KEYS = new Set([
  "assetPath",
  "rootName",
  "materialKey",
  "materialOverrides",
  "behavior",
  "interaction",
  "radio",
  "prefabType",
]);

export function createPrefabInstance(prefabType, instance) {
  const definition = PREFAB_DEFINITIONS[prefabType];
  if (!definition) throw new Error(`[PrefabRegistry] Unknown prefab type: ${prefabType}`);
  const resolved = cloneValue(definition);
  const instanceOverrides = Object.fromEntries(
    Object.entries(instance.overrides ?? {}).filter(([key]) => !REGISTRY_OWNED_KEYS.has(key)),
  );
  mergeKnown(resolved, instanceOverrides);
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
