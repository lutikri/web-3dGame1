import * as THREE from "three";

export const CONFIG = {
  assetPath: "assets/Panel1.glb",
  playerEyeHeight: 1.45,
  player: {
    spawnPosition: new THREE.Vector3(0, 1.45, 2),
    spawnYawDegrees: 0,
    spawnPitchDegrees: 0,
  },
  loading: {
    skip: false,
  },
  camera: {
    fovDegrees: 72,
    zoomFovDegrees: 38,
    zoomDamping: 12,
    mouseSensitivity: 0.0022,
    walkSpeed: 2.4,
    runSpeed: 4.2,
    noclip: {
      enabled: false,
      speed: 3.5,
      minSpeed: 0.25,
      maxSpeed: 30,
      wheelStep: 0.35,
    },
  },
  panel: {
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
  },
  interior: {
    assetPath: "assets/Interior1_Panel1.glb",
    position: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    material: {
      color: "#7e807e",
      roughness: 0.82,
      metalness: 0,
    },
    fans: {
      SM_Interior1_Fan1: {
        enabled: true,
        axis: "y",
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
    knobRotationDegrees: 360,
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
        label: "RESET CORE",
        action: "reset",
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
        label: "RESET CORE",
        action: "reset",
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
  world: {
    backgroundColor: "#080b0d",
    fogColor: "#080b0d",
    fogNear: 1,
    fogFar: 10,
  },
  lighting: {
    ambientSky: "#9fb6c7",
    ambientGround: "#101010",
    ambientIntensity: 1.15,
    pointLights: {
      key: {
        color: "#f7d67b",
        intensity: 1.3,
        distance: 5,
        decay: 1,
        position: new THREE.Vector3(-0.53, 1.87, 0.594996),
        castShadow: false,
        shadowMapSize: 512,
        shadowBias: -0.0006,
        shadowNormalBias: 0.035,
        shadowNear: 0.1,
        shadowFar: 9,
      },
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
        shadowNear: 0.1,
        shadowFar: 7,
      },
    },
  },
  feedback: {
    startup: {
      duration: 3.2,
      blackoutSeconds: 0.28,
      flickerFrequency: 24,
      lampFrequency: 18,
      needleJitterDegrees: 40,
      cameraShake: 0.004,
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
    indicatorTest: {
      duration: 3,
      lampFrequency: 9,
    },
  },
  shadows: {
    enabled: true,
    type: THREE.PCFSoftShadowMap,
  },
  postProcessing: {
    enabled: true,
    gtao: {
      enabled: false,
      blendIntensity: 0.8,
      radius: 0.42,
      distanceExponent: 1.7,
      thickness: 0.85,
      distanceFallOff: 1,
      scale: 2,
      samples: 16,
      denoiseRadius: 2,
      denoiseSamples: 8,
    },
    bloom: {
      enabled: true,
      strength: 0.28,
      radius: 0.62,
      threshold: 0.18,
    },
    chromaticAberration: {
      enabled: true,
      amount: 0.0018,
    },
  },
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
