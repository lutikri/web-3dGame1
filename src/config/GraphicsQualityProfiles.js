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
    shadowQuality: "off",
    gtaoQuality: "off",
    fullTextures: false,
    effects: ["lut", "colorAdjustments"],
  },
  medium: {
    pixelRatio: 0.75,
    shadowQuality: "off",
    gtaoQuality: "off",
    fullTextures: true,
    effects: ["bloom", "lut", "colorAdjustments"],
  },
  high: {
    pixelRatio: 1,
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
