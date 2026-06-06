import * as THREE from "three";

export const CONFIG = {
  assetPath: "assets/Panel1.glb",
  playerEyeHeight: 1.65,
  panel: {
    // Location, rotation and scale of assets/Panel1.glb in the room.
    position: new THREE.Vector3(0, 1.3, 4),
    rotation: new THREE.Euler(0, 0, 0),
    width: 1.5,
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
    jitterDegrees: 3.5,
    jitterFrequency: 16,
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
      Control_Btn_Vent: {
        label: "EMERGENCY VENT / PURGE",
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
// operatorGameDebug.setTestActive(true)
//window.operatorGameDebug.getPerformance()



  room: {
    width: 12,
    depth: 12,
    height: 4,
  },
  world: {
    backgroundColor: "#080b0d",
    fogColor: "#080b0d",
    fogNear: 10,
    fogFar: 28,
  },
  lighting: {
    ambientSky: "#9fb6c7",
    ambientGround: "#101010",
    ambientIntensity: 0.25,
    pointLights: {
      key: {
        color: "#f7d67b",
        intensity: 5,
        distance: 8,
        decay: 2,
        position: new THREE.Vector3(-1.8, 2.8, 5.4),
        castShadow: true,
        shadowMapSize: 4096,
        shadowBias: -0.0006,
        shadowNormalBias: 0.035,
        shadowNear: 0.1,
        shadowFar: 9,
      },
      fill: {
        color: "#87b1ff",
        intensity: 3,
        distance: 6,
        decay: 2,
        position: new THREE.Vector3(1.1, 2.9, 5.3),
        castShadow: false,
        shadowMapSize: 4096,
        shadowBias: -0.0005,
        shadowNormalBias: 0.03,
        shadowNear: 0.1,
        shadowFar: 7,
      },
    },
  },
  shadows: {
    enabled: true,
    type: THREE.PCFSoftShadowMap,
  },
  postProcessing: {
    enabled: true,
    gtao: {
      enabled: true,
      blendIntensity: 1.65,
      radius: 0.42,
      distanceExponent: 1.7,
      thickness: 0.85,
      distanceFallOff: 1,
      scale: 2,
      samples: 16,
      denoiseRadius: 8,
      denoiseSamples: 16,
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
  lampRed: "#ff5555",
  lampRedEmissive: "#ff1f1f",
  needle: "#ff5a58",
  needleEmissive: "#df840d",
  button: "#8e2621",
  buttonEmissive: "#290000",
  buttonOn: "#ff4e42",
  buttonOnEmissive: "#ff2b1f",
};
