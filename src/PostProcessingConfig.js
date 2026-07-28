export const POST_PROCESSING_CONFIG = {
  "debugPanel": {
    "enabled": true,
    "startClosed": true
  },
  "enabled": true,
  "gtao": {
    "defaultQuality": "off",
    "presets": {
      "off": {
        "enabled": false
      },
      "min": {
        "enabled": true,
        "resolutionScale": 0.5,
        "blendIntensity": 0.45,
        "radius": 0.28,
        "distanceExponent": 1.5,
        "thickness": 0.65,
        "distanceFallOff": 1,
        "scale": 1.2,
        "samples": 8,
        "denoiseRadius": 2,
        "denoiseSamples": 4
      },
      "med": {
        "enabled": true,
        "blendIntensity": 0.62,
        "radius": 0.38,
        "distanceExponent": 1.65,
        "thickness": 0.78,
        "distanceFallOff": 1,
        "scale": 1.65,
        "samples": 12,
        "denoiseRadius": 2,
        "denoiseSamples": 6
      },
      "max": {
        "enabled": true,
        "resolutionScale": 0.5,
        "blendIntensity": 0.8,
        "radius": 0.42,
        "distanceExponent": 1.7,
        "thickness": 0.85,
        "distanceFallOff": 1,
        "scale": 2,
        "samples": 16,
        "denoiseRadius": 2,
        "denoiseSamples": 8
      }
    }
  },
  "ssgi": {
    "defaultQuality": "off",
    "presets": {
      "off": {
        "enabled": false
      },
      "min": {
        "enabled": true,
        "resolutionScale": 0.75,
        "distance": 4,
        "thickness": 3,
        "maxRoughness": 0.9,
        "blend": 0.94,
        "denoiseIterations": 2,
        "denoiseKernel": 2,
        "denoiseDiffuse": 16,
        "denoiseSpecular": 16,
        "directLightMultiplier": 0.75,
        "steps": 8,
        "refineSteps": 2,
        "spp": 1,
        "missedRays": false,
        "importanceSampling": false
      },
      "med": {
        "enabled": true,
        "resolutionScale": 0.875,
        "distance": 5.5,
        "thickness": 4,
        "maxRoughness": 0.95,
        "blend": 0.92,
        "denoiseIterations": 2,
        "denoiseKernel": 2,
        "denoiseDiffuse": 14,
        "denoiseSpecular": 14,
        "directLightMultiplier": 0.85,
        "steps": 12,
        "refineSteps": 3,
        "spp": 1,
        "missedRays": false,
        "importanceSampling": false
      },
      "max": {
        "enabled": true,
        "resolutionScale": 1,
        "distance": 7,
        "thickness": 5,
        "maxRoughness": 1,
        "blend": 0.9,
        "denoiseIterations": 3,
        "denoiseKernel": 2,
        "denoiseDiffuse": 12,
        "denoiseSpecular": 12,
        "directLightMultiplier": 1,
        "steps": 18,
        "refineSteps": 4,
        "spp": 1,
        "missedRays": false,
        "importanceSampling": false
      }
    }
  },
  "ssr": {
    "defaultQuality": "off",
    "presets": {
      "off": {
        "enabled": false
      },
      "min": {
        "enabled": true,
        "resolutionScale": 0.7,
        "opacity": 0.22,
        "maxDistance": 1.5,
        "thickness": 0.025,
        "blur": true,
        "bouncing": false,
        "distanceAttenuation": true,
        "fresnel": true,
        "infiniteThick": false
      },
      "med": {
        "enabled": true,
        "resolutionScale": 0.85,
        "opacity": 0.32,
        "maxDistance": 2.5,
        "thickness": 0.04,
        "blur": true,
        "bouncing": false,
        "distanceAttenuation": true,
        "fresnel": true,
        "infiniteThick": false
      },
      "max": {
        "enabled": true,
        "resolutionScale": 1,
        "opacity": 0.45,
        "maxDistance": 3.5,
        "thickness": 0.055,
        "blur": true,
        "bouncing": false,
        "distanceAttenuation": true,
        "fresnel": true,
        "infiniteThick": false
      }
    }
  },
  "screenSpaceShadows": {
    "defaultQuality": "off",
    "presets": {
      "off": {
        "enabled": false
      },
      "min": {
        "enabled": true,
        "resolutionScale": 0.75,
        "spp": 8,
        "distance": 0.8,
        "distancePower": 1.1,
        "power": 1.15,
        "bias": 28,
        "thickness": 0.05,
        "useNormalPass": true
      },
      "med": {
        "enabled": true,
        "resolutionScale": 0.875,
        "spp": 12,
        "distance": 1.1,
        "distancePower": 1.15,
        "power": 1.3,
        "bias": 32,
        "thickness": 0.065,
        "useNormalPass": true
      },
      "max": {
        "enabled": true,
        "resolutionScale": 1,
        "spp": 16,
        "distance": 1.35,
        "distancePower": 1.2,
        "power": 1.5,
        "bias": 36,
        "thickness": 0.08,
        "useNormalPass": true
      }
    }
  },
  "bloom": {
    "enabled": true,
    "strength": 0.52,
    "radius": 0.8,
    "threshold": 0.33
  },
  "antiAliasing": {
    "method": "off",
    "msaaSamples": 4
  },
  "lensEffects": {
    "enabled": true,
    "anamorphicGlare": {
      "enabled": true,
      "strength": 0.25,
      "threshold": 0.21,
      "length": 0.195,
      "tint": "#ffffff"
    },
    "flareGhosts": {
      "enabled": true,
      "strength": 0.05,
      "threshold": 0.55,
      "spacing": 0.76,
      "tint": "#ffffff",
      "chromaticAberration": 0.015,
      "haloStrength": 1,
      "haloRadius": 0.43
    },
    "lensDirt": {
      "enabled": true,
      "strength": 1,
      "spread": 0.035,
      "assetPath": "assets/LensDirt1.webp",
      "tint": "#ffffff",
      "maxTextureSize": 1024,
      "scale": 7.9
    }
  },
  "lut": {
    "enabled": true,
    "assetPath": "assets/luts/Green1.cube",
    "format": "cube",
    "inputColorSpace": "display-srgb",
    "intensity": 0.66
  },
  "colorAdjustments": {
    "enabled": true,
    "brightness": 0.025,
    "contrast": 1.074,
    "saturation": 0.88,
    "gamma": 0.93,
    "temperature": -0.13,
    "tint": -0.05,
    "emergencyTint": "#c2c2c2",
    "emergencyTintStrength": 0,
    "vignette": {
      "enabled": true,
      "strength": 0.575,
      "radius": 0.69,
      "softness": 0.38,
      "emergencyBoost": 0.46
    },
    "grain": {
      "enabled": false,
      "amount": 0,
      "emergencyBoost": 0.018
    }
  },
  "sharpen": {
    "enabled": true,
    "amount": 0.295,
    "zoomBoost": 0.035
  },
  "lensDistortion": {
    "enabled": true,
    "barrelAmount": 0,
    "fisheyeAmount": 0.14,
    "emergencyBarrelBoost": 0.038,
    "emergencyFisheyeBoost": 0.034
  },
  "chromaticAberration": {
    "enabled": true,
    "amount": 0.0014
  }
};
