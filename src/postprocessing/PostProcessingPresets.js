export function createPostProcessingPresets({ config }) {
  const getShadow = (quality) =>
    config.shadows.presets?.[quality] ?? config.shadows.presets?.min ?? { enabled: true, mapSize: 512 };
  const getGtao = (quality) =>
    config.postProcessing.gtao.presets?.[quality] ?? config.postProcessing.gtao.presets?.off ?? { enabled: false };
  const getSsgi = (quality) =>
    config.postProcessing.ssgi.presets?.[quality] ?? config.postProcessing.ssgi.presets?.off ?? { enabled: false };
  const getSsr = (quality) =>
    config.postProcessing.ssr.presets?.[quality] ?? config.postProcessing.ssr.presets?.off ?? { enabled: false };
  const getScreenSpaceShadows = (quality) =>
    config.postProcessing.screenSpaceShadows.presets?.[quality] ??
    config.postProcessing.screenSpaceShadows.presets?.off ?? { enabled: false };

  return { getShadow, getGtao, getSsgi, getSsr, getScreenSpaceShadows };
}

export function applyGtaoPreset(pass, preset) {
  pass.blendIntensity = preset.blendIntensity ?? 0;
  pass.updateGtaoMaterial({
    radius: preset.radius ?? 0.35,
    distanceExponent: preset.distanceExponent ?? 1.6,
    thickness: preset.thickness ?? 0.75,
    distanceFallOff: preset.distanceFallOff ?? 1,
    scale: preset.scale ?? 1.5,
    samples: preset.samples ?? 8,
  });
  pass.updatePdMaterial({
    radius: preset.denoiseRadius ?? 2,
    samples: preset.denoiseSamples ?? 4,
  });
}

export function applySsrPreset(pass, preset) {
  pass.opacity = preset.opacity ?? 0.35;
  pass.maxDistance = preset.maxDistance ?? 1.5;
  pass.thickness = preset.thickness ?? 0.025;
  pass.blur = preset.blur ?? true;
  pass.bouncing = preset.bouncing ?? false;
  pass.distanceAttenuation = preset.distanceAttenuation ?? true;
  pass.fresnel = preset.fresnel ?? true;
  pass.infiniteThick = preset.infiniteThick ?? false;
}
