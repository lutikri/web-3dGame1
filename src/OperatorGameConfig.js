import * as THREE from "three";
import { POST_PROCESSING_CONFIG } from "./PostProcessingConfig.js";
import { LEVEL_REACTOR_1_CONFIG } from "./levels/LevelReactor1Config.js";

function applyLevelMaterialTuning(materials, tuning) {
  Object.entries(tuning ?? {}).forEach(([key, values]) => {
    if (materials[key]) Object.assign(materials[key], values);
  });
  return materials;
}

export const CONFIG = {
  assetPath: "assets/Panel1.glb",
  playerEyeHeight: 1.45,
  player: {
    spawnPosition: new THREE.Vector3(0, 1.45, 2),
    spawnYawDegrees: 0,
    spawnPitchDegrees: 0,
    collisionRadius: 0.15,
    collisionHeight: 1.7,
    collision: {
      assetPath: "assets/Interior1_Collision.glb",
      cameraRadius: 0.12,
      show: false,
      position: new THREE.Vector3(0, 0, 0),
    },
  },
  loading: {
    skip: false,
  },
  app: {
    firstVisitEmulation: false,
  },
  textureStreaming: {
    fullLoadDelaySeconds: 4,
  },
  camera: {
    fovDegrees: 72,
    zoomFovDegrees: 68,
    zoomDamping: 12,
    mouseSensitivity: 0.0022,
    pitchLimitDegrees: 72,
    leanPitchLimitDegrees: 88,
    walkSpeed: 1.8,
    runSpeed: 4.2,
    operatorMovement: {
      acceleration: 7,
      deceleration: 12,
      zoomSpeedMultiplier: 0.22,
      zoomSensitivityMultiplier: 0.88,
      headBobAmplitude: 0.018,
      headBobSway: 0.009,
      headBobFrequency: 4.5,
      leanForward: 0.26,
      leanDown: 0.025,
      leanDamping: 4,
    },
    noclip: {
      enabled: false,
      speed: 3.5,
      minSpeed: 0.25,
      maxSpeed: 30,
      wheelStep: 0.35,
    },
    menuView: {
      position: new THREE.Vector3(0.48, 1.02, 0.34),
      rotationDegrees: new THREE.Vector3(19.4, 62.8, 0),
      roomLightsOn: false,
    },
  },
  panel: {
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    placeholderColor: "#365247",
    maps: {
      preview: {
        baseColor: "assets/runtime-textures/T_Panel1_BaseColor_Critical_Preview_1024_ETC1S.ktx2",
        normal: "assets/runtime-textures/T_Panel1_Normal_Critical_Preview_1024_ETC1S.ktx2",
        orm: "assets/runtime-textures/T_Panel1_OcclusionRoughnessMetallic_Critical_Preview_1024_ETC1S.ktx2",
      },
      full: {
        baseColor: "assets/runtime-textures/T_Panel1_BaseColor_Critical_Full_ETC1S.ktx2",
        normal: "assets/runtime-textures/T_Panel1_Normal_Critical_Full_ETC1S.ktx2",
        orm: "assets/runtime-textures/T_Panel1_OcclusionRoughnessMetallic_Critical_Full_ETC1S.ktx2",
      },
    },
  },
  interior: {
    assetPath: "assets/Interior1_Panel1.glb",
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    decals: LEVEL_REACTOR_1_CONFIG.decals,
    material: {
      color: "#7e807e",
      roughness: 0.82,
      metalness: 0,
    },
    specialMaterials: applyLevelMaterialTuning({
      lamp1: {
        meshNames: ["SM_Lamp1", "SM_Lamp1_1", "SM_Lamp1001"],
        maps: {
          preview: {
            baseColor: "assets/runtime-textures/T_Lamp1_BaseColor_Critical_Preview_512_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Lamp1_Normal_Critical_Preview_512_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Lamp1_OcclusionRoughnessMetallic_Critical_Preview_512_ETC1S.ktx2",
            emissive: "assets/runtime-textures/T_Lamp1_Emissive_Critical_Preview_512_ETC1S.ktx2",
          },
          full: {
            baseColor: "assets/runtime-textures/T_Lamp1_BaseColor_Critical_Full_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Lamp1_Normal_Critical_Full_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Lamp1_OcclusionRoughnessMetallic_Critical_Full_ETC1S.ktx2",
            emissive: "assets/runtime-textures/T_Lamp1_Emissive_Critical_Full_ETC1S.ktx2",
          },
        },
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
        meshNames: ["SM_Lamp1_2"],
        maps: {
          preview: {
            baseColor: "assets/runtime-textures/T_Lamp1_BaseColor_Critical_Preview_512_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Lamp1_Normal_Critical_Preview_512_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Lamp1_OcclusionRoughnessMetallic_Critical_Preview_512_ETC1S.ktx2",
            emissive: "assets/runtime-textures/T_Lamp1_Emissive_Critical_Preview_512_ETC1S.ktx2",
          },
          full: {
            baseColor: "assets/runtime-textures/T_Lamp1_BaseColor_Critical_Full_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Lamp1_Normal_Critical_Full_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Lamp1_OcclusionRoughnessMetallic_Critical_Full_ETC1S.ktx2",
            emissive: "assets/runtime-textures/T_Lamp1_Emissive_Critical_Full_ETC1S.ktx2",
          },
        },
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
        meshNames: ["SM_Door1_Lamp", "SM_Door1_Handle", "SM_Door1_Panel", "SM_Door1_Frame"],
        maps: {
          preview: {
            baseColor: "assets/runtime-textures/T_DoorLamp1_BaseColor_Interactive_Preview_1024_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_DoorLamp1_Normal_Interactive_Preview_1024_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_DoorLamp1_OcclusionRoughnessMetallic_Interactive_Preview_1024_ETC1S.ktx2",
            emissive: "assets/runtime-textures/T_DoorLamp1_Emissive_Interactive_Preview_512_ETC1S.ktx2",
          },
          full: {
            baseColor: "assets/runtime-textures/T_DoorLamp1_BaseColor_Interactive_Full_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_DoorLamp1_Normal_Interactive_Full_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_DoorLamp1_OcclusionRoughnessMetallic_Interactive_Full_ETC1S.ktx2",
            emissive: "assets/runtime-textures/T_DoorLamp1_Emissive_Interactive_Full_ETC1S.ktx2",
          },
        },
        color: "#ffffff",
        roughness: 1,
        metalness: 1,
        normalScale: 1,
        aoMapIntensity: 1,
        emissive: "#ff0000",
        emissiveIntensity: 5.5,
      },
      bricks1: {
        meshNames: ["SM_Interior1"],
        maps: {
          preview: {
            baseColor: "assets/runtime-textures/T_Bricks1Old_BaseColor_Background_Preview_1024_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Bricks1Old_Normal_Background_Preview_1024_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Bricks1Old_ORM_Background_Preview_1024_ETC1S.ktx2",
            mask: "assets/runtime-textures/T_Interior1_Mask_Background_Preview_1024.png",
          },
          full: {
            baseColor: "assets/runtime-textures/T_Bricks1Old_BaseColor_Background_Full_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Bricks1Old_Normal_Background_Full_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Bricks1Old_ORM_Background_Full_ETC1S.ktx2",
            mask: "assets/runtime-textures/T_Interior1_Mask_Background_Full_ETC1S.ktx2",
          },
        },
        color: "#fdfffe",
        roughness: 1,
        metalness: 0,
        normalScale: 1,
        aoMapIntensity: 1,
        emissive: "#000000",
        emissiveIntensity: 0,
        textureRepeat: 6.8,
        maskOverlay: {
          debugView: false,
          red: { color: "#804800", opacity: 0.4, intensity: 1, threshold: 0, softness: 1, blend: "multiply" },
          green: { color: "#5e5343", opacity: 0.7, intensity: 1.0, threshold: 0, softness: 1, blend: "multiply" },
          blue: { color: "#1a1a1a", opacity: 0.8, intensity: 1, threshold: 0, softness: 1, blend: "multiply" },
        },
      },
      Interior1: {
        meshNames: [
          "SM_Piping1",
          "SM_Piping2",
          "SM_TubeBig1",
          "SM_TubeBig1_Attachment1",
          "SM_TubeBig1_Attachment2",
        ],
        maps: {
          preview: {
            baseColor: "assets/runtime-textures/T_Interior1_BaseColor_Background_Preview_1024_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Interior1_Normal_Background_Preview_1024_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Interior1_OcclusionRoughnessMetallic_Background_Preview_1024_ETC1S.ktx2",
          },
          full: {
            baseColor: "assets/runtime-textures/T_Interior1_BaseColor_Background_Full_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Interior1_Normal_Background_Full_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Interior1_OcclusionRoughnessMetallic_Background_Full_ETC1S.ktx2",
          },
        },
        color: "#ffffff",
        roughness: 1,
        metalness: 1,
        normalScale: 1,
        aoMapIntensity: 1,
        emissive: "#000000",
        emissiveIntensity: 0,
      },
      details1: {
        meshNames: [
          "SM_Fan",
          "SM_Details1_1",
          "SM_Details1_2",
          "SM_Details1_3",
          "SM_Details1_4",
          "SM_Details1_6",
          "SM_Details1_7",
          "SM_Details1_8",
          "SM_Details1_9",
          "SM_Details1_10",
          "SM_Details1_11",
          "SM_Details_LightButton1",
        ],
        maps: {
          preview: {
            baseColor: "assets/runtime-textures/T_Details1_BaseColor_Secondary_Preview_1024_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Details1_Normal_Secondary_Preview_1024_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Details1_OcclusionRoughnessMetallic_Secondary_Preview_1024_ETC1S.ktx2",
          },
          full: {
            baseColor: "assets/runtime-textures/T_Details1_BaseColor_Secondary_Full_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Details1_Normal_Secondary_Full_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Details1_OcclusionRoughnessMetallic_Secondary_Full_ETC1S.ktx2",
          },
        },
        color: "#ffffff",
        roughness: 1.2,
        metalness: 1,
        normalScale: 1,
        aoMapIntensity: 1,
        emissive: "#000000",
        emissiveIntensity: 0,
      },
      pipes1: {
        meshNames: [
          "SM_Pipes1_1",
          "SM_Pipes1_2",
          "SM_Pipes1_3",
          "SM_Pipes1_4",
          "SM_Pipes1_5",
          "SM_Pipes1_6",
          "SM_Pipes1_7",
          "SM_Pipes1_8",
          "SM_Pipes1_9",
          "SM_Pipes1_10",
          "SM_Pipes1_11",
          "SM_Pipes1_12",
        ],
        maps: {
          preview: {
            baseColor: "assets/runtime-textures/T_Pipes1_BaseColor_Secondary_Preview_1024_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Pipes1_Normal_Secondary_Preview_1024_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Pipes1_OcclusionRoughnessMetallic_Secondary_Preview_1024_ETC1S.ktx2",
          },
          full: {
            baseColor: "assets/runtime-textures/T_Pipes1_BaseColor_Secondary_Full_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Pipes1_Normal_Secondary_Full_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Pipes1_OcclusionRoughnessMetallic_Secondary_Full_ETC1S.ktx2",
          },
        },
        color: "#ffffff",
        roughness: 1,
        metalness: 1,
        normalScale: 1,
        aoMapIntensity: 1,
        emissive: "#000000",
        emissiveIntensity: 0,
      },
      beams1: {
        meshNames: ["SM_Beams_1", "SM_Beams_2", "SM_Beams_PipeAttachemts1"],
        maps: {
          preview: {
            baseColor: "assets/runtime-textures/T_Beams1_BaseColor_Secondary_Preview_1024_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Beams1_Normal_Secondary_Preview_1024_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Beams1_OcclusionRoughnessMetallic_Secondary_Preview_1024_ETC1S.ktx2",
          },
          full: {
            baseColor: "assets/runtime-textures/T_Beams1_BaseColor_Secondary_Full_ETC1S.ktx2",
            normal: "assets/runtime-textures/T_Beams1_Normal_Secondary_Full_ETC1S.ktx2",
            orm: "assets/runtime-textures/T_Beams1_OcclusionRoughnessMetallic_Secondary_Full_ETC1S.ktx2",
          },
        },
        color: "#ffffff",
        roughness: 1,
        metalness: 1,
        normalScale: 1,
        aoMapIntensity: 1,
        emissive: "#000000",
        emissiveIntensity: 0,
      },
    }, LEVEL_REACTOR_1_CONFIG.materials),
    lightToggleButton: {
      meshNames: ["SM_Details_LightButton1"],
      label: "ROOM LIGHTS",
      initialOn: true,
      hitRadius: 0.09,
      pressAxis: "x",
      pressDistance: -0.018,
      pressSpeed: 4,
      fadeSeconds: 0.3,
      flickerSeconds: 1.28,
      flickerFrequency: 22,
    },
    bulkheadExit: {
      meshName: "SM_Door1_Handle",
      label: "BULKHEAD HANDLE",
      rotationAxis: "x",
      maxInteractionDistance: 2.2,
      lockedStopDegrees: 20,
      lockedAttemptSeconds: 1.65,
      lockedKnockDegrees: 2.4,
      unlockedTurnDegrees: 270,
      unlockHoldSeconds: 2.8,
      turnJerkDegrees: 2.1,
      turnJerkFrequency: 9,
      returnSeconds: 1.1,
    },
    fans: {
      SM_Fan: {
        enabled: true,
        axis: "z",
        speedDegreesPerSecond: 120,
      },
    },
  },
  needleAnimation: {
    minDegrees: 30,
    maxDegrees: -210,
    inactiveDegrees: 30,
    activeDegrees: -210,
    speedDegreesPerSecond: {
      min: 30,
      max: 230,
    },
    speedRetargetInterval: 1.18,
    jitterDegrees: 1.2,
    jitterFrequency: 432,
    jitterRetargetInterval: 0.16,
    overshootDegrees: 4,
  },
  controls: {
    wheelPercentPerDelta: 0.025,
    wheelMaxStepPercent: 2.5,
    knobDialDegrees: 360,
    knobValue0DialPercent: 85,
    knobValue100DialPercent: 15,
    knobRotationAxis: "y",
    labelYOffset: 0.1,
    knobs: {
      Control_Knob_FuelInjection: {
        label: "FUEL INJECTION",
        initialPercent: 35,
      },
      Control_Knob_MagneticField: {
        label: "MAGNETIC FIELD",
        initialPercent: 55,
      },
      Control_Knob_CoolantFlow: {
        label: "COOLANT FLOW",
        initialPercent: 40,
      },
    },
    buttons: {
      Control_Btn_Test: {
        label: "INDICATOR TEST",
        action: "indicatorTest",
        pressAxis: "y",
        pressDistance: -0.006,
        pressSpeed: 18,
      },
      Control_Btn_Start: {
        label: "START CORE",
        action: "start",
        pressAxis: "y",
        pressDistance: -0.006,
        pressSpeed: 18,
      },
      Control_Btn_Reset: {
        label: "PULSE",
        action: "pulse",
        pressAxis: "y",
        pressDistance: -0.006,
        pressSpeed: 18,
      },
      Buttun_Test: {
        label: "INDICATOR TEST",
        action: "indicatorTest",
        pressAxis: "y",
        pressDistance: -0.006,
        pressSpeed: 18,
      },
      Buttun_Start: {
        label: "START CORE",
        action: "start",
        pressAxis: "y",
        pressDistance: -0.006,
        pressSpeed: 18,
      },
      Buttun_Reset: {
        label: "PULSE",
        action: "pulse",
        pressAxis: "y",
        pressDistance: -0.018,
        pressSpeed: 18,
      },
      Control_Btn_Vent: {
        label: "EMERGENCY VENT / PURGE",
        action: "vent",
        pressAxis: "y",
        pressDistance: -0.025,
        pressSpeed: 18,
      },
    },
  },

// operatorGameDebug.listNeedles()
// operatorGameDebug.setNeedleRotation(0, "x", 45)
// operatorGameDebug.setNeedleRotation(0, "y", 45)
// operatorGameDebug.setNeedleRotation(0, "z", 45)
// operatorGameDebug.getObjectTransform("GaugeSmall_Arrow_TargetOutput")
// operatorGameDebug.listObjects("Arrow")
// operatorGameDebug.findObject("GaugeSmall_Arrow_TargetOutput")
// operatorGameDebug.resumeNeedles()
// operatorGameDebug.startGame()
// operatorGameDebug.resetGame()
//window.operatorGameDebug.getPerformance()


  room: {
    width: 12,
    depth: 12,
    height: 4,
    floorVisible: false,
  },
  world: LEVEL_REACTOR_1_CONFIG.world,
  lighting: LEVEL_REACTOR_1_CONFIG.lighting,
  sceneDebug: LEVEL_REACTOR_1_CONFIG.debugPanels,
  feedback: {
    startup: {
      duration: 3.2,
      blackoutSeconds: 0.28,
      lampFrequency: 18,
      needleJitterDegrees: 40,
      cameraShake: 0.004,
      tubeOnPattern: [
        { time: 0, factor: 0 },
        { time: 0.32, factor: 0 },
        { time: 0.38, factor: 0.9 },
        { time: 0.43, factor: 0.06 },
        { time: 0.54, factor: 1.08 },
        { time: 0.62, factor: 0.16 },
        { time: 0.78, factor: 0.82 },
        { time: 0.93, factor: 0.28 },
        { time: 1.18, factor: 1 },
      ],
    },
    longTermLightFlicker: {
      enabled: true,
      minIntervalSeconds: 50,
      maxIntervalSeconds: 80,
      durationSeconds: [0.28, 3.42],
      minFactor: [0.1, 1.2],
      emissiveExponent: 2.5,
      retryChance: 0.85,
      pulseCount: [1, 5],
    },
    thermalEmergency: {
      lampFlickerFrequency: 16,
      cameraShake: 0.0035,
      bloomBoost: 0.42,
      chromaticBoost: 0.0045,
    },
    outputLow: {
      lightFlicker: 0.1,
      lampFlickerFrequency: 10,
      cameraShake: 0,
    },
    ignitionPulse: {
      duration: 0.72,
      cameraShake: 0.018,
      needleKickDegrees: 14,
    },
    panelIndicators: {
      amberEmissiveIntensity: 0.35,
      greenEmissiveIntensity: 0.35,
      redEmissiveIntensity: 0.55,
      statusScreenBrightness: 0.4,
    },
    terminal: {
      instrumentShutdownSeconds: 2.4,
      emergencyEffectFadeSeconds: 1.6,
      destroyedBlackoutSeconds: 1.4,
      emergencyLightSettleSeconds: 0.45,
      resultsHoldSeconds: 10,
      completeLightFactor: 0.82,
      failedLightFactor: 0.55,
      destroyedLightFactor: 0.32,
    },
    indicatorTest: {
      duration: 3,
      lampFrequency: 9,
    },
  },
  shadows: {
    defaultQuality: "min",
    type: THREE.PCFSoftShadowMap,
    castNeedleShadows: false,
    presets: {
      off: { enabled: false, mapSize: 0 },
      min: { enabled: true, mapSize: 512 },
      max: { enabled: true, mapSize: 2048 },
    },
  },
  postProcessing: POST_PROCESSING_CONFIG,
};

export const MATERIAL_COLORS = {
  wall: "#252d32",
  floor: "#171c20",
  trim: "#5d6b73",
  lampOff: "#171717",
  lampOffEmissive: "#000000",
  lampAmber: "#ffcc47",
  lampAmberEmissive: "#ffb000",
  lampGreen: "#55ff91",
  lampGreenEmissive: "#19ff6c",
  lampRed: "#ff5555",
  lampRedEmissive: "#ff1f1f",
  needle: "#ff5a58",
  needleEmissive: "#df840d",
  button: "#8e2621",
  buttonEmissive: "#290000",
  buttonOn: "#ff4e42",
  buttonOnEmissive: "#ff2b1f",
};
