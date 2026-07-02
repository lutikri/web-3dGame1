import { GUI } from "three/addons/libs/lil-gui.module.min.js";

const STORAGE_KEY = "operatorGame.postProcessing.v1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeConfig(target, source) {
  if (!source || typeof source !== "object") return target;

  Object.entries(source).forEach(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== "object") target[key] = {};
      mergeConfig(target[key], value);
    } else if (key in target) {
      target[key] = value;
    }
  });

  return target;
}

function readSavedConfig() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch (error) {
    console.warn("[Post FX] Ignoring invalid saved settings", error);
    return null;
  }
}

async function saveProjectConfig(config) {
  const response = await fetch("/__save-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "postProcessing", config }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to save post-processing config");
  return result;
}

export function restoreSavedPostProcessingConfig(config) {
  const saved = readSavedConfig();
  if (saved) mergeConfig(config, saved);
  return Boolean(saved);
}

export function createPostProcessingDebugPanel({ config, defaults = config, rebuild, update }) {
  const defaultValues = clone(defaults);
  const gui = new GUI({ title: "POST FX", width: 320 });
  gui.domElement.classList.add("post-fx-debug-panel");

  const live = (controller) => controller.onChange(update);
  const structural = (controller) => controller.onChange(rebuild);
  const range = (folder, object, key, min, max, step) => live(folder.add(object, key, min, max, step));

  structural(gui.add(config, "enabled").name("Master enabled"));

  const bloom = gui.addFolder("Bloom");
  structural(bloom.add(config.bloom, "enabled"));
  range(bloom, config.bloom, "strength", 0, 2, 0.01);
  range(bloom, config.bloom, "radius", 0, 1, 0.01);
  range(bloom, config.bloom, "threshold", 0, 1, 0.01);

  const antiAliasing = gui.addFolder("Anti-aliasing");
  structural(antiAliasing.add(config.antiAliasing, "method", ["off", "fxaa", "smaa"]));
  structural(antiAliasing.add(config.antiAliasing, "msaaSamples", { Off: 0, "2x": 2, "4x": 4 }));

  const lensEffects = gui.addFolder("Lens effects");
  structural(lensEffects.add(config.lensEffects, "enabled"));

  const glare = lensEffects.addFolder("Anamorphic glare");
  live(glare.add(config.lensEffects.anamorphicGlare, "enabled"));
  range(glare, config.lensEffects.anamorphicGlare, "strength", 0, 2, 0.01);
  range(glare, config.lensEffects.anamorphicGlare, "threshold", 0, 1, 0.01);
  range(glare, config.lensEffects.anamorphicGlare, "length", 0.005, 0.35, 0.005);
  live(glare.addColor(config.lensEffects.anamorphicGlare, "tint"));

  const ghosts = lensEffects.addFolder("Flare ghosts");
  live(ghosts.add(config.lensEffects.flareGhosts, "enabled"));
  range(ghosts, config.lensEffects.flareGhosts, "strength", 0, 1, 0.01);
  range(ghosts, config.lensEffects.flareGhosts, "threshold", 0, 1, 0.01);
  range(ghosts, config.lensEffects.flareGhosts, "spacing", 0.1, 1.5, 0.01);
  range(ghosts, config.lensEffects.flareGhosts, "chromaticAberration", 0, 0.05, 0.0005);
  range(ghosts, config.lensEffects.flareGhosts, "haloStrength", 0, 1, 0.01);
  range(ghosts, config.lensEffects.flareGhosts, "haloRadius", 0.05, 0.8, 0.01);
  live(ghosts.addColor(config.lensEffects.flareGhosts, "tint"));

  const dirt = lensEffects.addFolder("Lens dirt");
  structural(dirt.add(config.lensEffects.lensDirt, "enabled"));
  range(dirt, config.lensEffects.lensDirt, "strength", 0, 1, 0.01);
  range(dirt, config.lensEffects.lensDirt, "spread", 0, 0.15, 0.0025);
  structural(dirt.add(config.lensEffects.lensDirt, "assetPath"));
  live(dirt.addColor(config.lensEffects.lensDirt, "tint"));
  structural(dirt.add(config.lensEffects.lensDirt, "maxTextureSize", [512, 1024, 2048]));

  const lut = gui.addFolder("LUT");
  structural(lut.add(config.lut, "enabled"));
  structural(lut.add(config.lut, "assetPath"));
  structural(lut.add(config.lut, "format", ["cube", "3dl"]));
  structural(lut.add(config.lut, "inputColorSpace", ["display-srgb", "linear"]));
  range(lut, config.lut, "intensity", 0, 1, 0.01);

  const color = gui.addFolder("Color adjustments");
  structural(color.add(config.colorAdjustments, "enabled"));
  range(color, config.colorAdjustments, "brightness", -0.25, 0.25, 0.001);
  range(color, config.colorAdjustments, "contrast", 0.5, 1.5, 0.001);
  range(color, config.colorAdjustments, "saturation", 0, 2, 0.01);
  range(color, config.colorAdjustments, "gamma", 0.5, 2, 0.01);
  range(color, config.colorAdjustments, "temperature", -1, 1, 0.005);
  range(color, config.colorAdjustments, "tint", -1, 1, 0.005);
  color.addColor(config.colorAdjustments, "emergencyTint");
  range(color, config.colorAdjustments, "emergencyTintStrength", 0, 0.5, 0.005);

  const vignette = color.addFolder("Vignette");
  live(vignette.add(config.colorAdjustments.vignette, "enabled"));
  range(vignette, config.colorAdjustments.vignette, "strength", 0, 1, 0.005);
  range(vignette, config.colorAdjustments.vignette, "radius", 0.1, 1.5, 0.01);
  range(vignette, config.colorAdjustments.vignette, "softness", 0.01, 1, 0.01);
  range(vignette, config.colorAdjustments.vignette, "emergencyBoost", 0, 1, 0.01);

  const grain = color.addFolder("Grain");
  live(grain.add(config.colorAdjustments.grain, "enabled"));
  range(grain, config.colorAdjustments.grain, "amount", 0, 0.2, 0.001);
  range(grain, config.colorAdjustments.grain, "emergencyBoost", 0, 0.2, 0.001);

  const sharpen = gui.addFolder("Sharpen");
  structural(sharpen.add(config.sharpen, "enabled"));
  range(sharpen, config.sharpen, "amount", 0, 1, 0.005);
  range(sharpen, config.sharpen, "zoomBoost", 0, 0.5, 0.005);

  const lens = gui.addFolder("Lens distortion");
  structural(lens.add(config.lensDistortion, "enabled"));
  range(lens, config.lensDistortion, "barrelAmount", -0.5, 0.5, 0.001);
  range(lens, config.lensDistortion, "fisheyeAmount", -1, 1, 0.005);
  range(lens, config.lensDistortion, "emergencyBarrelBoost", 0, 0.25, 0.001);
  range(lens, config.lensDistortion, "emergencyFisheyeBoost", 0, 0.25, 0.001);

  const chromatic = gui.addFolder("Chromatic aberration");
  structural(chromatic.add(config.chromaticAberration, "enabled"));
  range(chromatic, config.chromaticAberration, "amount", 0, 0.025, 0.0001);

  const refresh = () => gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  const actions = {
    save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      gui.title("POST FX - SAVED");
      window.setTimeout(() => gui.title("POST FX"), 1200);
    },
    async saveProject() {
      await saveProjectConfig(config);
      localStorage.removeItem(STORAGE_KEY);
      gui.title("POST FX - PROJECT SAVED");
      window.setTimeout(() => gui.title("POST FX"), 1200);
    },
    load() {
      const saved = readSavedConfig();
      if (!saved) return false;
      mergeConfig(config, saved);
      refresh();
      rebuild();
      return true;
    },
    reset() {
      mergeConfig(config, defaultValues);
      refresh();
      rebuild();
    },
    async copyConfig() {
      const source = `export const POST_PROCESSING_CONFIG = ${JSON.stringify(config, null, 2)};\n`;
      await navigator.clipboard.writeText(source);
      gui.title("POST FX - COPIED");
      window.setTimeout(() => gui.title("POST FX"), 1200);
      return source;
    },
    clearSaved() {
      localStorage.removeItem(STORAGE_KEY);
    },
  };

  const presets = gui.addFolder("Preset");
  presets.add(actions, "save").name("Save in browser");
  presets.add(actions, "saveProject").name("Save to project");
  presets.add(actions, "load").name("Load saved");
  presets.add(actions, "reset").name("Reset defaults");
  presets.add(actions, "copyConfig").name("Copy config");
  presets.add(actions, "clearSaved").name("Clear saved");

  color.close();
  sharpen.close();
  lens.close();
  chromatic.close();
  antiAliasing.close();
  lensEffects.close();
  presets.open();

  return {
    ...actions,
    gui,
    hide: () => gui.hide(),
    show: () => gui.show(),
    toggle: () => (gui._hidden ? gui.show() : gui.hide()),
  };
}
