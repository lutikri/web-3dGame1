import { LinearFilter } from "three";
import { applyGraphicsQualityProfileToConfig } from "../config/GraphicsQualityProfiles.js?v=compact-loading-game";

export class PhotoModeRuntime {
  constructor({
    config, bootOptions, renderer, scene, textureSets, materialTextures,
    adaptiveQuality, postProcessingPolicy, rebuildPostProcessing,
    getDevicePixelRatio = () => globalThis.devicePixelRatio ?? 1,
    now = () => globalThis.performance?.now?.() ?? Date.now(),
  }) {
    Object.assign(this, {
      config, bootOptions, renderer, scene, textureSets, materialTextures,
      adaptiveQuality, postProcessingPolicy, rebuildPostProcessing, getDevicePixelRatio, now,
    });
    this.saved = null;
    this.mip0 = false;
    this.loading = false;
    this.revision = 0;
    this.nextTextureScan = 0;
    this.textureStates = new Map();
  }

  setEnabled = (enabled = true, options = {}) => enabled ? this.enable(options) : this.disable();

  async enable({ mip0 = false } = {}) {
    const revision = ++this.revision;
    try {
      if (!this.saved) {
        this.saved = this.#capture();
        applyGraphicsQualityProfileToConfig(this.config, "ultra");
        Object.assign(this.bootOptions, { qualityProfile: "ultra", deferFullTextures: false, disableFullTextures: false });
        this.config.postProcessing.gtao.presets.max.resolutionScale = 1;
        this.postProcessingPolicy.replace({ gtao: "max", ssgi: "off", ssr: "off", screenSpaceShadows: "off" });
        this.postProcessingPolicy.setShadowQuality("max");
        this.adaptiveQuality.setResolutionOverride(this.getDevicePixelRatio());
        this.rebuildPostProcessing();
      }
      this.mip0 = Boolean(mip0);
      this.loading = true;
      this.nextTextureScan = 0;
      this.update();
      await this.materialTextures.ensureFullResolution();
      if (revision === this.revision && this.saved) {
        this.loading = false;
        this.nextTextureScan = 0;
        this.update();
      }
      return this.snapshot();
    } catch (error) {
      if (revision === this.revision) this.disable();
      throw error;
    }
  }

  disable = () => {
    ++this.revision;
    if (!this.saved) return this.snapshot();
    const saved = this.saved;
    this.saved = null;
    this.loading = false;
    this.mip0 = false;
    for (const texture of this.textureStates.keys()) this.#restoreTexture(texture);
    Object.assign(this.bootOptions, saved.bootOptions);
    this.config.postProcessing.enabled = saved.postEnabled;
    Object.assign(this.config.postProcessing.antiAliasing, saved.antiAliasing);
    for (const [key, settings] of Object.entries(saved.sections)) Object.assign(this.config.postProcessing[key], settings);
    this.config.postProcessing.gtao.presets.max.resolutionScale = saved.gtaoResolutionScale;
    this.config.shadows.defaultQuality = saved.shadowDefault;
    const { shadows, ...postQuality } = saved.quality;
    this.postProcessingPolicy.replace(postQuality);
    this.postProcessingPolicy.setShadowQuality(shadows);
    this.adaptiveQuality.setResolutionOverride(saved.resolutionOverride);
    this.rebuildPostProcessing();
    return this.snapshot();
  };

  // Run in the existing animation loop so late texture loads and viewport DPI changes are covered.
  update = () => {
    if (!this.saved) return;
    this.adaptiveQuality.setResolutionOverride(this.getDevicePixelRatio());
    const timestamp = this.now();
    if (timestamp < this.nextTextureScan) return;
    this.nextTextureScan = timestamp + 1000;
    const textures = this.#collectTextures();
    for (const texture of this.textureStates.keys()) {
      if (!textures.has(texture)) this.#restoreTexture(texture);
    }
    for (const texture of textures) {
      if (!this.textureStates.has(texture)) {
        const onDispose = () => this.#restoreTexture(texture);
        this.textureStates.set(texture, { minFilter: texture.minFilter, anisotropy: texture.anisotropy, onDispose });
        texture.addEventListener("dispose", onDispose);
      }
      const original = this.textureStates.get(texture);
      const minFilter = this.mip0 ? LinearFilter : original.minFilter;
      const anisotropy = this.mip0 ? 1 : this.renderer.capabilities.getMaxAnisotropy();
      if (texture.minFilter !== minFilter || texture.anisotropy !== anisotropy) {
        texture.minFilter = minFilter;
        texture.anisotropy = anisotropy;
        texture.needsUpdate = true;
      }
    }
  };

  snapshot = () => ({
    enabled: Boolean(this.saved),
    loading: this.loading,
    mip0: this.mip0,
    pixelRatio: this.adaptiveQuality.snapshot().pixelRatio,
    textures: this.textureStates.size,
  });

  #capture() {
    const post = this.config.postProcessing;
    const sections = {};
    for (const [key, section] of Object.entries(post)) {
      if (!section || typeof section !== "object") continue;
      const settings = {};
      if ("enabled" in section) settings.enabled = section.enabled;
      if ("defaultQuality" in section) settings.defaultQuality = section.defaultQuality;
      if (key === "bloom") settings.resolutionScale = section.resolutionScale;
      if (Object.keys(settings).length) sections[key] = settings;
    }
    return {
      bootOptions: {
        qualityProfile: this.bootOptions.qualityProfile,
        deferFullTextures: this.bootOptions.deferFullTextures,
        disableFullTextures: this.bootOptions.disableFullTextures,
      },
      postEnabled: post.enabled,
      antiAliasing: { ...post.antiAliasing },
      sections,
      gtaoResolutionScale: post.gtao.presets.max.resolutionScale,
      shadowDefault: this.config.shadows.defaultQuality,
      quality: this.postProcessingPolicy.snapshot(),
      resolutionOverride: this.adaptiveQuality.resolutionOverride,
    };
  }

  #collectTextures() {
    const textures = new Set();
    const add = (texture) => {
      // Render targets, environment maps and data textures belong to other rendering systems.
      if (texture?.isTexture && !texture.isRenderTargetTexture && !texture.isCubeTexture
        && !texture.isDataTexture && !texture.isData3DTexture && !texture.isDataArrayTexture) textures.add(texture);
    };
    this.textureSets.forEach((set) => set.textures.forEach(({ texture }) => add(texture)));
    this.scene.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (!material) continue;
        Object.values(material).forEach(add);
        add(material.userData?.maskOverlayUniforms?.interiorMaskMap?.value);
      }
    });
    return textures;
  }

  #restoreTexture(texture) {
    const original = this.textureStates.get(texture);
    if (!original) return;
    texture.removeEventListener("dispose", original.onDispose);
    texture.minFilter = original.minFilter;
    texture.anisotropy = original.anisotropy;
    texture.needsUpdate = true;
    this.textureStates.delete(texture);
  }
}
