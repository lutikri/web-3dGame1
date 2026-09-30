import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { LUTPass } from "three/addons/postprocessing/LUTPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import {
  bindGtaoToComposerDepth,
  configureGtaoContactAo,
  createComposerTarget,
} from "./GtaoContactAo.js?v=combined-presentation-pass";
import { applyGtaoPreset } from "./PostProcessingPresets.js?v=combined-presentation-pass";
import { RenderPerformanceMonitor } from "./RenderPerformanceMonitor.js?v=combined-presentation-pass";
import {
  compatibleFxaaShader,
  presentationShader,
} from "./PostProcessingShaders.js?v=combined-presentation-pass";

export class PostProcessingRuntime {
  composer = null;
  gtaoPass = null;
  bloomPass = null;
  lutPass = null;
  presentationPass = null;
  colorAdjustmentPass = null;
  sharpenPass = null;
  lensDistortionPass = null;
  chromaticAberrationPass = null;
  lensEffectsPass = null;
  fxaaPass = null;
  smaaPass = null;

  #revision = 0;

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
    this.performanceMonitor = new RenderPerformanceMonitor({ renderer });
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
      configureGtaoGeometryCoverage(this.gtaoPass);
      configureGtaoContactAo(this.gtaoPass, gtao);
      bindGtaoToComposerDepth(this.gtaoPass);
      this.gtaoPass.output = GTAOPass.OUTPUT.Default;
      applyGtaoPreset(this.gtaoPass, gtao);
      this.composer.addPass(this.gtaoPass);
      this.gtaoPass.setSize(
        Math.max(1, Math.round(window.innerWidth * scale)),
        Math.max(1, Math.round(window.innerHeight * scale)));
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
    // The authored display-sRGB LUT and screen-space color shaders consume display values.
    // Keep the linear effects before this explicit conversion boundary.
    this.composer.addPass(new OutputPass());
    if (lut?.enabled && lut.assetPath && lut.inputColorSpace !== "linear") this.#setupLut(lut, revision, addLut);

    const presentationEnabled = config.colorAdjustments?.enabled || config.sharpen?.enabled
      || config.lensEffects?.enabled || config.lensDistortion?.enabled
      || config.chromaticAberration?.enabled;
    if (presentationEnabled) {
      this.presentationPass = new ShaderPass(presentationShader);
      this.presentationPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
      this.composer.addPass(this.presentationPass);
    }
    if (config.colorAdjustments?.enabled) {
      this.colorAdjustmentPass = createPresentationPassAlias(this.presentationPass, COLOR_UNIFORMS);
      this.applyColorAdjustments(this.colorAdjustmentPass, 0);
    }
    if (config.sharpen?.enabled) {
      this.sharpenPass = createPresentationPassAlias(this.presentationPass, {
        resolution: "resolution", amount: "sharpenAmount",
      });
      this.sharpenPass.uniforms.amount.value = config.sharpen.amount ?? 0;
    }
    if (config.lensEffects?.enabled) {
      this.lensEffectsPass = createPresentationPassAlias(this.presentationPass, LENS_EFFECT_UNIFORMS);
      this.applyLensEffects(this.lensEffectsPass);
      const dirt = config.lensEffects.lensDirt ?? {};
      if (dirt.enabled && dirt.assetPath) this.assets.loadLensDirt(dirt).then(() => {
        if (revision === this.#revision && this.lensEffectsPass) this.applyLensEffects(this.lensEffectsPass);
      }).catch((error) => console.warn("[PostProcessingRuntime] Failed to load lens dirt", error));
    }
    if (config.lensDistortion?.enabled) {
      this.lensDistortionPass = createPresentationPassAlias(this.presentationPass, {
        barrelAmount: "barrelAmount", fisheyeAmount: "fisheyeAmount",
      });
      this.applyLensDistortion(this.lensDistortionPass, 0);
    }
    if (config.chromaticAberration?.enabled) {
      this.chromaticAberrationPass = createPresentationPassAlias(this.presentationPass, {
        amount: "chromaticAberrationAmount",
      });
      this.chromaticAberrationPass.uniforms.amount.value = config.chromaticAberration.amount;
    }
    const requestedMsaa = Number(config.antiAliasing?.msaaSamples ?? 0);
    const selectedAa = config.antiAliasing?.method ?? "off";
    const aa = requestedMsaa > 0 && !this.composer.renderTarget1.samples && selectedAa === "off"
      ? "fxaa" : selectedAa;
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
    this.resize(window.innerWidth, window.innerHeight);
  }

  #setupLut(config, revision, add) {
    if (this.assets.hasLut(config.assetPath)) add();
    else this.assets.loadLut(config).then(() => {
      if (revision === this.#revision && this.config.postProcessing.lut?.enabled) this.setup();
    }).catch((error) => console.warn("[PostProcessingRuntime] Failed to load LUT", error));
  }

  render(dt) {
    this.performanceMonitor.beginFrame();
    try {
      if (this.renderRealism(dt)) return;
      if (this.composer) this.composer.render();
      else this.renderer.render(this.scene, this.camera);
    } finally {
      this.performanceMonitor.endFrame();
    }
  }

  resize(width, height) {
    const pixelRatio = this.renderer.getPixelRatio();
    this.composer?.setPixelRatio(pixelRatio);
    this.composer?.setSize(width, height);
    const renderWidth = width * pixelRatio;
    const renderHeight = height * pixelRatio;
    const quality = this.getQuality();
    if (this.gtaoPass) {
      const scale = this.presets.getGtao(quality.gtao).resolutionScale ?? 1;
      this.gtaoPass.setSize(
        Math.max(1, Math.round(renderWidth * scale)),
        Math.max(1, Math.round(renderHeight * scale)),
      );
    }
    (this.presentationPass ?? this.sharpenPass)?.uniforms.resolution.value.set(renderWidth, renderHeight);
    this.#updateFxaa();
    this.resizeRealism(width, height);
  }

  dispose() {
    this.#revision += 1;
    this.#disposeStandard();
    this.disposeRealism();
    this.performanceMonitor.dispose();
    this.assets.dispose();
  }

  inspect() {
    return {
      composer: Boolean(this.composer),
      performance: this.performanceMonitor.snapshot(),
      ...this.inspectRealism(),
    };
  }

  resetPerformanceSamples() {
    this.performanceMonitor.reset();
  }

  getPerformanceSnapshot() {
    return this.performanceMonitor.snapshot();
  }

  #disposeStandard() {
    this.composer?.passes?.forEach((pass) => pass.dispose?.());
    this.composer?.dispose?.();
    for (const key of ["composer", "gtaoPass", "bloomPass", "lutPass", "presentationPass", "colorAdjustmentPass",
      "sharpenPass", "lensDistortionPass", "chromaticAberrationPass", "lensEffectsPass", "fxaaPass", "smaaPass"]) {
      this[key] = null;
    }
  }

  #createComposer() {
    const requested = Number(this.config.postProcessing.antiAliasing?.msaaSamples ?? 0);
    if (!this.renderer.capabilities.isWebGL2) return new EffectComposer(this.renderer);
    const samples = requested > 0
      ? Math.min(requested, this.renderer.capabilities.maxSamples ?? requested)
      : 0;
    const ratio = this.renderer.getPixelRatio();
    const target = createComposerTarget(
      Math.max(1, Math.round(window.innerWidth * ratio)),
      Math.max(1, Math.round(window.innerHeight * ratio)),
      { samples },
    );
    return new EffectComposer(this.renderer, target);
  }

  #updateFxaa() {
    if (!this.fxaaPass) return;
    const ratio = this.renderer.getPixelRatio();
    this.fxaaPass.material.uniforms.resolution.value.set(
      1 / Math.max(1, window.innerWidth * ratio),
      1 / Math.max(1, window.innerHeight * ratio));
  }

}

const COLOR_UNIFORMS = [
  "brightness", "contrast", "saturation", "gamma", "temperature", "tint", "emergency",
  "emergencyTint", "emergencyTintStrength", "vignetteStrength", "vignetteRadius",
  "vignetteSoftness", "grainAmount", "time",
];

const LENS_EFFECT_UNIFORMS = [
  "bloomTexture", "lensDirtTexture", "hasBloomTexture", "hasLensDirtTexture", "glareEnabled",
  "glareStrength", "glareThreshold", "glareLength", "glareTint", "ghostsEnabled", "ghostStrength",
  "ghostThreshold", "ghostSpacing", "ghostTint", "ghostChromaticAberration", "haloStrength",
  "haloRadius", "dirtEnabled", "dirtStrength", "dirtSpread", "dirtTint",
];

export function createPresentationPassAlias(pass, mapping) {
  if (!pass?.uniforms) return null;
  const entries = Array.isArray(mapping) ? mapping.map((name) => [name, name]) : Object.entries(mapping);
  return {
    material: pass.material,
    uniforms: Object.fromEntries(entries.map(([alias, source]) => [alias, pass.uniforms[source]])),
  };
}

export function configureGtaoGeometryCoverage(pass) {
  if (!pass?.normalMaterial) return false;
  pass.normalMaterial.side = THREE.DoubleSide;
  pass.normalMaterial.needsUpdate = true;
  return true;
}
