import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { LUTPass } from "three/addons/postprocessing/LUTPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { applyGtaoPreset, applySsrPreset } from "./PostProcessingPresets.js?v=architecture-split-82";
import {
  chromaticAberrationShader,
  colorAdjustmentShader,
  compatibleFxaaShader,
  lensDistortionShader,
  lensEffectsShader,
  sharpenShader,
} from "./PostProcessingShaders.js?v=architecture-split-82";

export class PostProcessingRuntime {
  composer = null;
  gtaoPass = null;
  ssrPass = null;
  bloomPass = null;
  lutPass = null;
  colorAdjustmentPass = null;
  sharpenPass = null;
  lensDistortionPass = null;
  chromaticAberrationPass = null;
  lensEffectsPass = null;
  fxaaPass = null;
  smaaPass = null;

  #revision = 0;
  #ssrPassClass = null;
  #ssrPromise = null;

  constructor({
    config,
    renderer,
    scene,
    camera,
    assets,
    presets,
    getQuality,
    applyColorAdjustments,
    applyLensDistortion,
    applyLensEffects,
    setupRealism,
    renderRealism,
    resizeRealism,
    disposeRealism,
    inspectRealism,
  }) {
    Object.assign(this, {
      config, renderer, scene, camera, assets, presets, getQuality,
      applyColorAdjustments, applyLensDistortion, applyLensEffects,
      setupRealism, renderRealism, resizeRealism, disposeRealism, inspectRealism,
    });
  }

  setup() {
    const config = this.config.postProcessing;
    if (!config.enabled) {
      this.#revision += 1;
      this.#disposeStandard();
      this.setupRealism();
      return;
    }
    const revision = ++this.#revision;
    this.#disposeStandard();
    this.composer = this.#createComposer();
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    const quality = this.getQuality();
    const gtao = this.presets.getGtao(quality.gtao);
    if (gtao.enabled) {
      const scale = gtao.resolutionScale ?? 1;
      this.gtaoPass = new GTAOPass(this.scene, this.camera,
        Math.max(1, Math.round(window.innerWidth * scale)),
        Math.max(1, Math.round(window.innerHeight * scale)));
      this.gtaoPass.output = GTAOPass.OUTPUT.Default;
      applyGtaoPreset(this.gtaoPass, gtao);
      this.composer.addPass(this.gtaoPass);
      this.gtaoPass.setSize(
        Math.max(1, Math.round(window.innerWidth * scale)),
        Math.max(1, Math.round(window.innerHeight * scale)));
    }

    const ssr = this.presets.getSsr(quality.ssr);
    if (ssr.enabled) {
      if (this.#ssrPassClass) {
        const scale = ssr.resolutionScale ?? 1;
        this.ssrPass = new this.#ssrPassClass({
          renderer: this.renderer, scene: this.scene, camera: this.camera,
          width: Math.max(1, Math.round(window.innerWidth * scale)),
          height: Math.max(1, Math.round(window.innerHeight * scale)),
        });
        applySsrPreset(this.ssrPass, ssr);
        this.composer.addPass(this.ssrPass);
      } else {
        this.#loadSsr().then(() => {
          if (revision === this.#revision && this.presets.getSsr(this.getQuality().ssr).enabled) this.setup();
        }).catch((error) => console.warn("[PostProcessingRuntime] Failed to load SSRPass", error));
      }
    }

    if (config.bloom.enabled) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        config.bloom.strength, config.bloom.radius, config.bloom.threshold);
      this.composer.addPass(this.bloomPass);
    }

    const lut = config.lut;
    const addLut = () => {
      this.lutPass = new LUTPass({ lut: this.assets.lutTexture, intensity: lut.intensity ?? 1 });
      this.composer.addPass(this.lutPass);
    };
    if (lut?.enabled && lut.assetPath && lut.inputColorSpace === "linear") this.#setupLut(lut, revision, addLut);
    this.composer.addPass(new OutputPass());
    if (lut?.enabled && lut.assetPath && lut.inputColorSpace !== "linear") this.#setupLut(lut, revision, addLut);

    if (config.colorAdjustments?.enabled) {
      this.colorAdjustmentPass = new ShaderPass(colorAdjustmentShader);
      this.applyColorAdjustments(this.colorAdjustmentPass, 0);
      this.composer.addPass(this.colorAdjustmentPass);
    }
    if (config.sharpen?.enabled) {
      this.sharpenPass = new ShaderPass(sharpenShader);
      this.sharpenPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
      this.sharpenPass.uniforms.amount.value = config.sharpen.amount ?? 0;
      this.composer.addPass(this.sharpenPass);
    }
    if (config.lensEffects?.enabled) {
      this.lensEffectsPass = new ShaderPass(lensEffectsShader);
      this.applyLensEffects(this.lensEffectsPass);
      this.composer.addPass(this.lensEffectsPass);
      const dirt = config.lensEffects.lensDirt ?? {};
      if (dirt.enabled && dirt.assetPath) this.assets.loadLensDirt(dirt).then(() => {
        if (revision === this.#revision && this.lensEffectsPass) this.applyLensEffects(this.lensEffectsPass);
      }).catch((error) => console.warn("[PostProcessingRuntime] Failed to load lens dirt", error));
    }
    if (config.lensDistortion?.enabled) {
      this.lensDistortionPass = new ShaderPass(lensDistortionShader);
      this.applyLensDistortion(this.lensDistortionPass, 0);
      this.composer.addPass(this.lensDistortionPass);
    }
    if (config.chromaticAberration.enabled) {
      this.chromaticAberrationPass = new ShaderPass(chromaticAberrationShader);
      this.chromaticAberrationPass.uniforms.amount.value = config.chromaticAberration.amount;
      this.composer.addPass(this.chromaticAberrationPass);
    }
    const aa = config.antiAliasing?.method ?? "off";
    if (aa === "fxaa") {
      this.fxaaPass = new ShaderPass(compatibleFxaaShader);
      this.#updateFxaa();
      this.composer.addPass(this.fxaaPass);
    } else if (aa === "smaa") {
      const ratio = this.renderer.getPixelRatio();
      this.smaaPass = new SMAAPass(window.innerWidth * ratio, window.innerHeight * ratio);
      this.composer.addPass(this.smaaPass);
    }
    this.setupRealism();
  }

  #setupLut(config, revision, add) {
    if (this.assets.hasLut(config.assetPath)) add();
    else this.assets.loadLut(config).then(() => {
      if (revision === this.#revision && this.config.postProcessing.lut?.enabled) this.setup();
    }).catch((error) => console.warn("[PostProcessingRuntime] Failed to load LUT", error));
  }

  render(dt) {
    if (this.renderRealism(dt)) return;
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    this.composer?.setSize(width, height);
    const quality = this.getQuality();
    if (this.ssrPass) {
      const scale = this.presets.getSsr(quality.ssr).resolutionScale ?? 1;
      this.ssrPass.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    }
    if (this.gtaoPass) {
      const scale = this.presets.getGtao(quality.gtao).resolutionScale ?? 1;
      this.gtaoPass.setSize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
    }
    this.bloomPass?.setSize(width, height);
    this.sharpenPass?.uniforms.resolution.value.set(width, height);
    this.#updateFxaa();
    this.resizeRealism(width, height);
  }

  dispose() {
    this.#revision += 1;
    this.#disposeStandard();
    this.disposeRealism();
    this.assets.dispose();
  }

  inspect() {
    return { composer: Boolean(this.composer), ...this.inspectRealism() };
  }

  #disposeStandard() {
    this.composer?.passes?.forEach((pass) => pass.dispose?.());
    this.composer?.dispose?.();
    for (const key of ["composer", "gtaoPass", "ssrPass", "bloomPass", "lutPass", "colorAdjustmentPass",
      "sharpenPass", "lensDistortionPass", "chromaticAberrationPass", "lensEffectsPass", "fxaaPass", "smaaPass"]) {
      this[key] = null;
    }
  }

  #createComposer() {
    const requested = Number(this.config.postProcessing.antiAliasing?.msaaSamples ?? 0);
    if (!this.renderer.capabilities.isWebGL2 || requested <= 0) return new EffectComposer(this.renderer);
    const samples = Math.min(requested, this.renderer.capabilities.maxSamples ?? requested);
    const ratio = this.renderer.getPixelRatio();
    const target = new THREE.WebGLRenderTarget(
      Math.max(1, Math.round(window.innerWidth * ratio)),
      Math.max(1, Math.round(window.innerHeight * ratio)),
      { type: THREE.HalfFloatType });
    target.samples = samples;
    return new EffectComposer(this.renderer, target);
  }

  #updateFxaa() {
    if (!this.fxaaPass) return;
    const ratio = this.renderer.getPixelRatio();
    this.fxaaPass.material.uniforms.resolution.value.set(
      1 / Math.max(1, window.innerWidth * ratio),
      1 / Math.max(1, window.innerHeight * ratio));
  }

  async #loadSsr() {
    if (this.#ssrPassClass) return this.#ssrPassClass;
    this.#ssrPromise ??= import("three/addons/postprocessing/SSRPass.js").then(({ SSRPass }) => SSRPass);
    this.#ssrPassClass = await this.#ssrPromise;
    return this.#ssrPassClass;
  }
}
