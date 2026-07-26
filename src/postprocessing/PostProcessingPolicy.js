export class PostProcessingPolicy {
  constructor({ config, renderer, presets, assets, pointLights, prefabInstances, applyShadowSettings, getTime }) {
    Object.assign(this, { config, renderer, presets, assets, pointLights, prefabInstances, applyShadowSettings, getTime });
    this.quality = {
      shadows: config.shadows.defaultQuality ?? "min",
      gtao: config.postProcessing.gtao.defaultQuality ?? "off",
      ssgi: config.postProcessing.ssgi.defaultQuality ?? "off",
      ssr: config.postProcessing.ssr.defaultQuality ?? "off",
      screenSpaceShadows: config.postProcessing.screenSpaceShadows.defaultQuality ?? "off",
    };
    this.runtime = null;
    this.realism = null;
  }

  attach({ runtime, realism }) {
    this.runtime = runtime;
    this.realism = realism;
  }

  snapshot = () => ({ ...this.quality });
  replace = (quality) => { Object.assign(this.quality, quality); };
  getShadowPreset = (quality = this.quality.shadows) => this.presets.getShadow(quality);
  getGtaoPreset = (quality = this.quality.gtao) => this.presets.getGtao(quality);
  getSsgiPreset = (quality = this.quality.ssgi) => this.presets.getSsgi(quality);
  getSsrPreset = (quality = this.quality.ssr) => this.presets.getSsr(quality);
  getScreenSpaceShadowPreset = (quality = this.quality.screenSpaceShadows) => this.presets.getScreenSpaceShadows(quality);

  applyLiveConfig = () => {
    const runtime = this.runtime;
    const config = this.config.postProcessing;
    if (runtime?.bloomPass) Object.assign(runtime.bloomPass, {
      strength: config.bloom.strength, radius: config.bloom.radius, threshold: config.bloom.threshold,
    });
    this.realism?.applyLiveConfig();
    if (runtime?.lutPass) runtime.lutPass.intensity = config.lut.intensity;
    if (runtime?.colorAdjustmentPass) this.applyColorAdjustments(runtime.colorAdjustmentPass, 0);
    if (runtime?.sharpenPass) runtime.sharpenPass.uniforms.amount.value = config.sharpen.amount;
    if (runtime?.lensDistortionPass) this.applyLensDistortion(runtime.lensDistortionPass, 0);
    if (runtime?.lensEffectsPass) this.applyLensEffects(runtime.lensEffectsPass);
    if (runtime?.chromaticAberrationPass) {
      runtime.chromaticAberrationPass.uniforms.amount.value = config.chromaticAberration.amount;
    }
  };

  applyColorAdjustments = (pass, emergency) => {
    const config = this.config.postProcessing.colorAdjustments ?? {};
    const vignette = config.vignette ?? {};
    const grain = config.grain ?? {};
    pass.uniforms.brightness.value = config.brightness ?? 0;
    pass.uniforms.contrast.value = config.contrast ?? 1;
    pass.uniforms.saturation.value = config.saturation ?? 1;
    pass.uniforms.gamma.value = config.gamma ?? 1;
    pass.uniforms.temperature.value = config.temperature ?? 0;
    pass.uniforms.tint.value = config.tint ?? 0;
    pass.uniforms.emergency.value = emergency;
    pass.uniforms.emergencyTint.value.set(config.emergencyTint ?? "#ff4a2c").convertLinearToSRGB();
    pass.uniforms.emergencyTintStrength.value = config.emergencyTintStrength ?? 0;
    pass.uniforms.vignetteStrength.value = (vignette.enabled ? vignette.strength ?? 0 : 0) + emergency * (vignette.emergencyBoost ?? 0);
    pass.uniforms.vignetteRadius.value = vignette.radius ?? 0.78;
    pass.uniforms.vignetteSoftness.value = vignette.softness ?? 0.38;
    pass.uniforms.grainAmount.value = (grain.enabled ? grain.amount ?? 0 : 0) + emergency * (grain.emergencyBoost ?? 0);
    pass.uniforms.time.value = this.getTime();
  };

  applyLensDistortion = (pass, emergency) => {
    const config = this.config.postProcessing.lensDistortion ?? {};
    pass.uniforms.barrelAmount.value = (config.barrelAmount ?? 0) + emergency * (config.emergencyBarrelBoost ?? 0);
    pass.uniforms.fisheyeAmount.value = (config.fisheyeAmount ?? 0) + emergency * (config.emergencyFisheyeBoost ?? 0);
  };

  applyLensEffects = (pass) => {
    const config = this.config.postProcessing.lensEffects ?? {};
    const glare = config.anamorphicGlare ?? {};
    const ghosts = config.flareGhosts ?? {};
    const dirt = config.lensDirt ?? {};
    const bloom = this.runtime?.bloomPass?.renderTargetsHorizontal?.[0]?.texture ?? null;
    setTextureUniform(pass, "bloomTexture", "hasBloomTexture", bloom);
    setTextureUniform(pass, "lensDirtTexture", "hasLensDirtTexture", this.assets.lensDirtTexture);
    setToggle(pass, "glareEnabled", glare.enabled);
    pass.uniforms.glareStrength.value = glare.strength ?? 0;
    pass.uniforms.glareThreshold.value = glare.threshold ?? 0.72;
    pass.uniforms.glareLength.value = glare.length ?? 0.1;
    setColor(pass, "glareTint", glare.tint ?? "#d8e8ff");
    setToggle(pass, "ghostsEnabled", ghosts.enabled);
    pass.uniforms.ghostStrength.value = ghosts.strength ?? 0;
    pass.uniforms.ghostThreshold.value = ghosts.threshold ?? 0.82;
    pass.uniforms.ghostSpacing.value = ghosts.spacing ?? 0.72;
    setColor(pass, "ghostTint", ghosts.tint ?? "#b7d8ff");
    pass.uniforms.ghostChromaticAberration.value = ghosts.chromaticAberration ?? 0.006;
    pass.uniforms.haloStrength.value = ghosts.haloStrength ?? 0.12;
    pass.uniforms.haloRadius.value = ghosts.haloRadius ?? 0.42;
    setToggle(pass, "dirtEnabled", dirt.enabled);
    pass.uniforms.dirtStrength.value = dirt.strength ?? 0;
    pass.uniforms.dirtSpread.value = dirt.spread ?? 0;
    setColor(pass, "dirtTint", dirt.tint ?? "#ffffff");
  };

  setShadowQuality = (quality = "min") => {
    const key = this.config.shadows.presets?.[quality] ? quality : this.config.shadows.defaultQuality ?? "min";
    const preset = this.getShadowPreset(key);
    if (this.quality.shadows === key && this.renderer.shadowMap.enabled === Boolean(preset.enabled)) return key;
    this.quality.shadows = key;
    this.renderer.shadowMap.enabled = Boolean(preset.enabled);
    this.renderer.shadowMap.type = this.config.shadows.type;
    const reset = (light) => {
      const lightConfig = light.userData.lightConfig ?? {};
      light.shadow?.map?.dispose?.();
      if (light.shadow) light.shadow.map = null;
      this.applyShadowSettings(light, lightConfig);
    };
    this.pointLights.forEach(reset);
    this.prefabInstances.forEach((placed) => placed.light && reset(placed.light));
    return key;
  };

  setGtaoQuality = (quality = "off") => this.#setStandard("gtao", quality, "gtaoPass");
  setSsrQuality = (quality = "off") => this.#setExclusiveTracing("ssr", "ssgi", quality, "ssrPass", this.runtime);
  setSsgiQuality = (quality = "off") => this.#setExclusiveTracing("ssgi", "ssr", quality, "ssgiEffect");
  setScreenSpaceShadowQuality = (quality = "off") => this.#setRealism("screenSpaceShadows", quality, "screenSpaceShadowEffect");

  setCinematicQuality = (quality = "off") => {
    const kinds = ["ssgi", "screenSpaceShadows"];
    const key = kinds.every((kind) => this.config.postProcessing[kind].presets?.[quality]) ? quality : "off";
    const next = { ssgi: key, ssr: "off", screenSpaceShadows: key };
    const changed = Object.entries(next).some(([kind, value]) => this.quality[kind] !== value);
    Object.assign(this.quality, next);
    const active = Boolean(this.realism?.ssgiEffect || this.realism?.ssrEffect || this.realism?.screenSpaceShadowEffect);
    if (changed || active !== (key !== "off")) this.runtime?.setup();
    return { cinematic: key, ...this.snapshot() };
  };

  #setStandard(kind, quality, passName) {
    const section = this.config.postProcessing[kind];
    const key = section.presets?.[quality] ? quality : section.defaultQuality ?? "off";
    const preset = kind === "gtao" ? this.getGtaoPreset(key) : this.getSsrPreset(key);
    if (this.quality[kind] === key && Boolean(this.runtime?.[passName]) === Boolean(preset.enabled)) return key;
    this.quality[kind] = key;
    this.runtime?.setup();
    return key;
  }

  #setRealism(kind, quality, effectName) {
    const section = this.config.postProcessing[kind];
    const key = section.presets?.[quality] ? quality : section.defaultQuality ?? "off";
    const preset = kind === "ssgi" ? this.getSsgiPreset(key) : this.getScreenSpaceShadowPreset(key);
    if (this.quality[kind] === key && Boolean(this.realism?.[effectName]) === Boolean(preset.enabled)) return key;
    this.quality[kind] = key;
    this.realism?.setup();
    return key;
  }

  #setExclusiveTracing(kind, conflictingKind, quality, effectName, owner = this.realism) {
    const section = this.config.postProcessing[kind];
    const key = section.presets?.[quality] ? quality : section.defaultQuality ?? "off";
    const preset = kind === "ssgi" ? this.getSsgiPreset(key) : this.getSsrPreset(key);
    const disablesConflict = Boolean(preset.enabled) && this.quality[conflictingKind] !== "off";
    const active = Boolean(owner?.[effectName]);
    if (this.quality[kind] === key && !disablesConflict && active === Boolean(preset.enabled)) return key;
    this.quality[kind] = key;
    if (preset.enabled) this.quality[conflictingKind] = "off";
    this.runtime?.setup();
    return key;
  }
}

function setTextureUniform(pass, textureName, toggleName, texture) {
  pass.uniforms[textureName].value = texture;
  pass.uniforms[toggleName].value = texture ? 1 : 0;
}

function setToggle(pass, name, enabled) {
  pass.uniforms[name].value = enabled ? 1 : 0;
}

function setColor(pass, name, value) {
  pass.uniforms[name].value.set(value).convertLinearToSRGB();
}
