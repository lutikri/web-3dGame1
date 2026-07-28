const POST_EFFECT_KEYS = [
  "bloom",
  "lensEffects",
  "lut",
  "colorAdjustments",
  "sharpen",
  "lensDistortion",
  "chromaticAberration",
];

export const GRAPHICS_QUALITY_PROFILES = {
  low: {
    pixelRatio: 0.6,
    maxRenderPixels: 1280 * 720,
    adaptivePixelRatioFactor: 1,
    pointLightSlots: 5,
    photometricLightSlots: 2,
    shadowQuality: "off",
    gtaoQuality: "off",
    fullTextures: false,
    effects: ["lut", "colorAdjustments"],
  },
  medium: {
    pixelRatio: 0.75,
    maxRenderPixels: 1920 * 1080,
    adaptivePixelRatioFactor: 0.85,
    pointLightSlots: 8,
    photometricLightSlots: 4,
    shadowQuality: "min",
    gtaoQuality: "min",
    fullTextures: true,
    effects: ["bloom", "lensEffects", "lut", "colorAdjustments"],
  },
  high: {
    pixelRatio: 1,
    maxRenderPixels: 2560 * 1440,
    adaptivePixelRatioFactor: 0.8,
    pointLightSlots: 12,
    photometricLightSlots: 6,
    shadowQuality: "med",
    gtaoQuality: "max",
    fullTextures: true,
    effects: [
      "bloom",
      "lensEffects",
      "lut",
      "colorAdjustments",
      "sharpen",
      "lensDistortion",
      "chromaticAberration",
    ],
  },
};

export function getGraphicsQualityProfile(profile = "low") {
  return GRAPHICS_QUALITY_PROFILES[profile] ?? GRAPHICS_QUALITY_PROFILES.low;
}

export function resolveGraphicsPixelRatio(profile, viewportWidth, viewportHeight, degraded = false) {
  const quality = typeof profile === "string" ? getGraphicsQualityProfile(profile) : profile;
  const width = Math.max(1, Number(viewportWidth) || 1);
  const height = Math.max(1, Number(viewportHeight) || 1);
  const baseRatio = Math.max(0.1, Number(quality?.pixelRatio) || 1);
  const maxPixels = Math.max(1, Number(quality?.maxRenderPixels) || width * height * baseRatio * baseRatio);
  const pixelBudgetRatio = Math.sqrt(maxPixels / (width * height));
  const cappedRatio = Math.min(baseRatio, pixelBudgetRatio);
  const adaptiveFactor = degraded
    ? Math.max(0.1, Math.min(1, Number(quality?.adaptivePixelRatioFactor) || 1))
    : 1;
  return cappedRatio * adaptiveFactor;
}

export function applyGraphicsQualityProfileToConfig(config, profile = "low") {
  const normalized = GRAPHICS_QUALITY_PROFILES[profile] ? profile : "low";
  const quality = getGraphicsQualityProfile(normalized);
  const post = config.postProcessing;

  post.enabled = true;
  post.antiAliasing.method = "off";
  post.antiAliasing.msaaSamples = 0;
  post.gtao.defaultQuality = quality.gtaoQuality;
  post.ssgi.defaultQuality = "off";
  post.ssr.defaultQuality = "off";
  post.screenSpaceShadows.defaultQuality = "off";
  POST_EFFECT_KEYS.forEach((key) => {
    if (post[key]) post[key].enabled = quality.effects.includes(key);
  });
  config.shadows.defaultQuality = quality.shadowQuality;
  return normalized;
}
