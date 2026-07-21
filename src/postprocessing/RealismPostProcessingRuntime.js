import * as THREE from "three";

export class RealismPostProcessingRuntime {
  composer = null;
  velocityDepthNormalPass = null;
  ssgiEffect = null;
  screenSpaceShadowEffect = null;
  bloomEffect = null;
  chromaticAberrationEffect = null;

  #modulesPromise = null;
  #revision = 0;

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
      ChromaticAberrationEffect, BlendFunction,
    } = postprocessing;
    const { SSGIEffect, HBAOEffect, VelocityDepthNormalPass } = realismEffects;
    const quality = this.getQuality();
    const ssgi = this.presets.getSsgi(quality.ssgi);
    const shadows = this.presets.getScreenSpaceShadows(quality.screenSpaceShadows);
    const effects = [];

    this.composer = new EffectComposer(this.renderer, { depthBuffer: true });
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.velocityDepthNormalPass = new VelocityDepthNormalPass(this.scene, this.camera);
    this.composer.addPass(this.velocityDepthNormalPass);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    if (ssgi.enabled) {
      this.ssgiEffect = new SSGIEffect(this.scene, this.camera, this.velocityDepthNormalPass, {
        width: window.innerWidth,
        height: window.innerHeight,
        ...ssgi,
      });
      effects.push(this.ssgiEffect);
    }
    if (shadows.enabled) {
      this.screenSpaceShadowEffect = new HBAOEffect(this.composer, this.camera, this.scene, {
        ...shadows,
        velocityDepthNormalPass: this.velocityDepthNormalPass,
        normalTexture: this.velocityDepthNormalPass.texture,
      });
      effects.push(this.screenSpaceShadowEffect);
    }
    const post = this.config.postProcessing;
    if (post.bloom.enabled) {
      this.bloomEffect = new BloomEffect({
        blendFunction: BlendFunction.SCREEN,
        luminanceThreshold: post.bloom.threshold,
        intensity: post.bloom.strength,
        radius: post.bloom.radius,
      });
      effects.push(this.bloomEffect);
    }
    if (post.chromaticAberration.enabled) {
      this.chromaticAberrationEffect = new ChromaticAberrationEffect({
        offset: new THREE.Vector2(post.chromaticAberration.amount),
        radialModulation: true,
        modulationOffset: 0.18,
      });
      effects.push(this.chromaticAberrationEffect);
    }
    if (effects.length) this.composer.addPass(new EffectPass(this.camera, ...effects));
  }

  render(dt) {
    if (!this.composer) return false;
    const originalWarn = console.warn;
    console.warn = (message, ...args) => {
      if (typeof message === "string" && message.includes("copyFramebufferToTexture function signature has changed")) return;
      originalWarn.call(console, message, ...args);
    };
    try {
      this.composer.render(dt);
    } finally {
      console.warn = originalWarn;
    }
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
    this.composer?.dispose?.();
    this.velocityDepthNormalPass?.dispose?.();
    this.ssgiEffect?.dispose?.();
    this.screenSpaceShadowEffect?.dispose?.();
    this.bloomEffect?.dispose?.();
    this.chromaticAberrationEffect?.dispose?.();
    this.composer = null;
    this.velocityDepthNormalPass = null;
    this.ssgiEffect = null;
    this.screenSpaceShadowEffect = null;
    this.bloomEffect = null;
    this.chromaticAberrationEffect = null;
  }

  inspect() {
    return { realismComposer: Boolean(this.composer) };
  }
}
