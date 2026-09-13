import * as THREE from "three";

export class RealismPostProcessingRuntime {
  composer = null;
  velocityDepthNormalPass = null;
  ssgiEffect = null;
  screenSpaceShadowEffect = null;
  bloomEffect = null;
  chromaticAberrationEffect = null;
  fxaaEffect = null;

  #modulesPromise = null;
  #revision = 0;
  #originalCopyFramebufferToTexture = null;
  #compatibleCopyFramebufferToTexture = null;

  constructor({ config, renderer, scene, camera, presets, getQuality }) {
    Object.assign(this, { config, renderer, scene, camera, presets, getQuality });
  }

  isEnabled() {
    const quality = this.getQuality();
    return Boolean(
      this.presets.getSsgi(quality.ssgi).enabled ||
      this.presets.getScreenSpaceShadows(quality.screenSpaceShadows).enabled
    );
  }

  async setup() {
    const revision = ++this.#revision;
    if (!this.config.postProcessing.enabled || !this.isEnabled()) {
      this.dispose();
      return;
    }
    try {
      const modules = await this.#loadModules();
      if (revision !== this.#revision || !this.isEnabled()) return;
      this.#build(modules);
    } catch (error) {
      console.warn("[RealismPostProcessingRuntime] Failed to load experimental effects", error);
      this.dispose();
    }
  }

  #loadModules() {
    this.#modulesPromise ??= Promise.all([import("postprocessing"), import("realism-effects")]).then(
      ([postprocessing, realismEffects]) => ({ postprocessing, realismEffects }),
    );
    return this.#modulesPromise;
  }

  #build({ postprocessing, realismEffects }) {
    this.dispose();
    const {
      EffectComposer, EffectPass, RenderPass, BloomEffect,
      ChromaticAberrationEffect, FXAAEffect, BlendFunction,
    } = postprocessing;
    const { SSGIEffect, HBAOEffect, VelocityDepthNormalPass } = realismEffects;
    const quality = this.getQuality();
    const ssgi = this.presets.getSsgi(quality.ssgi);
    const shadows = this.presets.getScreenSpaceShadows(quality.screenSpaceShadows);
    const selection = resolveRealismEffectSelection({
      ssgi: ssgi.enabled,
      screenSpaceShadows: shadows.enabled,
    });
    const tracedEffects = [];
    const presentationEffects = [];

    const aa = resolveRealismAntiAliasing(this.config.postProcessing.antiAliasing, this.renderer.capabilities);
    this.composer = new EffectComposer(this.renderer, { depthBuffer: true, multisampling: aa.msaaSamples });
    this.#installFramebufferCopyCompatibility();
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.velocityDepthNormalPass = new VelocityDepthNormalPass(this.scene, this.camera);
    this.composer.addPass(this.velocityDepthNormalPass);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (selection.ssgi) {
      this.ssgiEffect = new SSGIEffect(this.scene, this.camera, this.velocityDepthNormalPass, {
        width: window.innerWidth,
        height: window.innerHeight,
        ...ssgi,
      });
      tracedEffects.push(this.ssgiEffect);
    }
    if (selection.hbao) {
      this.screenSpaceShadowEffect = new HBAOEffect(this.composer, this.camera, this.scene, {
        ...shadows,
      });
      tracedEffects.push(this.screenSpaceShadowEffect);
    }
    if (tracedEffects.length) this.composer.addPass(new EffectPass(this.camera, ...tracedEffects));

    const post = this.config.postProcessing;
    if (post.bloom.enabled) {
      this.bloomEffect = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        luminanceThreshold: post.bloom.threshold,
        intensity: post.bloom.strength,
        radius: post.bloom.radius,
      });
      presentationEffects.push(this.bloomEffect);
    }
    if (post.chromaticAberration.enabled) {
      this.chromaticAberrationEffect = new ChromaticAberrationEffect({
        offset: new THREE.Vector2(post.chromaticAberration.amount),
        radialModulation: true,
        modulationOffset: 0.18,
      });
      presentationEffects.push(this.chromaticAberrationEffect);
    }
    if (presentationEffects.length) {
      this.composer.addPass(new EffectPass(this.camera, ...presentationEffects));
    }
    if (aa.method === "fxaa") {
      this.fxaaEffect = new FXAAEffect();
      this.composer.addPass(new EffectPass(this.camera, this.fxaaEffect));
    }
  }

  render(dt) {
    if (!this.composer) return false;
    this.composer.render(dt);
    return true;
  }

  resize(width, height) {
    this.composer?.setSize(width, height);
    this.ssgiEffect?.setSize?.(width, height);
    this.screenSpaceShadowEffect?.setSize?.(width, height);
  }

  applyLiveConfig() {
    const post = this.config.postProcessing;
    if (this.bloomEffect) this.bloomEffect.intensity = post.bloom.strength;
    if (this.chromaticAberrationEffect?.offset) {
      const amount = post.chromaticAberration.amount;
      this.chromaticAberrationEffect.offset.set(amount, amount);
    }
  }

  applyEmergency(emergency, chromaFlicker = 1) {
    const post = this.config.postProcessing;
    if (this.bloomEffect) {
      this.bloomEffect.intensity = post.bloom.strength +
        emergency * this.config.feedback.thermalEmergency.bloomBoost;
    }
    if (this.chromaticAberrationEffect?.offset) {
      const amount = post.chromaticAberration.amount +
        emergency * this.config.feedback.thermalEmergency.chromaticBoost * chromaFlicker;
      this.chromaticAberrationEffect.offset.set(amount, amount);
    }
  }

  dispose() {
    this.#revision += 1;
    this.#restoreFramebufferCopyCompatibility();
    this.composer?.dispose?.();
    this.velocityDepthNormalPass?.dispose?.();
    this.ssgiEffect?.dispose?.();
    this.screenSpaceShadowEffect?.dispose?.();
    this.bloomEffect?.dispose?.();
    this.chromaticAberrationEffect?.dispose?.();
    this.fxaaEffect?.dispose?.();
    this.composer = null;
    this.velocityDepthNormalPass = null;
    this.ssgiEffect = null;
    this.screenSpaceShadowEffect = null;
    this.bloomEffect = null;
    this.chromaticAberrationEffect = null;
    this.fxaaEffect = null;
  }

  inspect() {
    return { realismComposer: Boolean(this.composer) };
  }

  #installFramebufferCopyCompatibility() {
    if (this.#originalCopyFramebufferToTexture || !this.renderer?.copyFramebufferToTexture) return;
    this.#originalCopyFramebufferToTexture = this.renderer.copyFramebufferToTexture;
    this.#compatibleCopyFramebufferToTexture = createFramebufferCopyCompatibilityWrapper(
      this.renderer,
      this.#originalCopyFramebufferToTexture,
    );
    this.renderer.copyFramebufferToTexture = this.#compatibleCopyFramebufferToTexture;
  }

  #restoreFramebufferCopyCompatibility() {
    if (this.renderer?.copyFramebufferToTexture === this.#compatibleCopyFramebufferToTexture) {
      this.renderer.copyFramebufferToTexture = this.#originalCopyFramebufferToTexture;
    }
    this.#originalCopyFramebufferToTexture = null;
    this.#compatibleCopyFramebufferToTexture = null;
  }
}

export function resolveRealismEffectSelection({ ssgi = false, screenSpaceShadows = false } = {}) {
  return {
    ssgi: Boolean(ssgi),
    hbao: Boolean(screenSpaceShadows),
  };
}

export function resolveRealismAntiAliasing(config = {}, capabilities = {}) {
  const requested = Math.max(0, Number(config?.msaaSamples ?? 0));
  const maxSamples = capabilities?.isWebGL2 ? Math.max(0, Number(capabilities.maxSamples ?? requested)) : 0;
  const msaaSamples = Math.min(requested, maxSamples);
  const selectedMethod = config?.method ?? "off";
  return {
    msaaSamples,
    method: requested > 0 && msaaSamples === 0 && selectedMethod === "off" ? "fxaa" : selectedMethod,
  };
}

export function createFramebufferCopyCompatibilityWrapper(renderer, copyFramebufferToTexture) {
  return function copyFramebufferCompatible(textureOrPosition, positionOrTexture = null, level = 0) {
    if (textureOrPosition?.isTexture) {
      return copyFramebufferToTexture.call(renderer, textureOrPosition, positionOrTexture, level);
    }
    return copyFramebufferToTexture.call(renderer, positionOrTexture, textureOrPosition, level);
  };
}
