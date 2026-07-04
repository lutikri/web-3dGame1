import { GUI } from "three/addons/libs/lil-gui.module.min.js";

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

function getStorageKey(levelId) {
  return `operatorGame.scene.${levelId}.v1`;
}

function readSaved(levelId) {
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(levelId)) ?? "null");
  } catch (error) {
    console.warn("[Scene debug] Ignoring invalid saved settings", error);
    return null;
  }
}

const MATERIAL_TUNING_KEYS = [
  "color",
  "roughness",
  "metalness",
  "normalScale",
  "aoMapIntensity",
  "emissive",
  "emissiveIntensity",
  "roomLightControlled",
];

function createSceneSnapshot(materials, lighting, decals) {
  const materialTuning = Object.fromEntries(
    Object.entries(materials).map(([key, config]) => {
      const tuning = {};
      MATERIAL_TUNING_KEYS.forEach((property) => {
        if (property in config) tuning[property] = config[property];
      });
      if (config.maskOverlay) tuning.maskOverlay = clone(config.maskOverlay);
      return [key, tuning];
    }),
  );
  return { materials: materialTuning, lighting: clone(lighting), decals: clone(decals) };
}

async function saveProjectConfig(config) {
  const response = await fetch("/__save-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "reactor1Scene", config }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to save scene config");
  return result;
}

async function saveLevelProjectConfig(config) {
  const response = await fetch("/__save-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "exploringAround", config }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error ?? "Unable to save level config");
  return result;
}

export function restoreSavedSceneConfig({ levelId, materials, lighting, decals }) {
  const saved = readSaved(levelId);
  if (!saved) return false;
  mergeConfig(materials, saved.materials);
  mergeConfig(lighting, saved.lighting);
  mergeConfig(decals, saved.decals);
  return true;
}

function positionGui(gui, slot) {
  gui.domElement.classList.add("scene-debug-panel");
  gui.domElement.style.right = `${slot * 320}px`;
}

export function createSceneDebugPanels({
  levelId,
  materialConfigs,
  materialInstances,
  lightingConfig,
  pointLights,
  hemisphereLight,
  gameConfig,
  defaults,
  startClosed = true,
  applyShadowSettings,
  applyMaterialOverlay,
  applyCollisionSettings,
  applyPlayerCollisionSettings,
  decalConfig,
  applyDecalMaterial,
  levelEnvironmentConfigs = {},
  applyLevelAmbient,
  applyLevelPrefab,
  saveAllProjectConfigs,
}) {
  const materialsGui = new GUI({ title: "MATERIALS", width: 320 });
  const lightsGui = new GUI({ title: "SCENE LIGHTS", width: 320 });
  const prefabsGui = new GUI({ title: "LEVEL PREFABS", width: 320 });
  const gameGui = new GUI({ title: "GAME", width: 320 });
  positionGui(materialsGui, 1);
  positionGui(lightsGui, 2);
  positionGui(prefabsGui, 2);
  positionGui(gameGui, 3);

  const collisionConfig = gameConfig?.collision;
  if (collisionConfig) {
    const collisionFolder = gameGui.addFolder("Collision mesh");
    collisionFolder.add(collisionConfig, "show").name("Show collision").onChange(applyCollisionSettings);
    const positionFolder = collisionFolder.addFolder("Position");
    positionFolder.add(collisionConfig.position, "x", -10, 10, 0.01).onChange(applyCollisionSettings);
    positionFolder.add(collisionConfig.position, "y", -10, 10, 0.01).onChange(applyCollisionSettings);
    positionFolder.add(collisionConfig.position, "z", -10, 10, 0.01).onChange(applyCollisionSettings);
  }

  if (gameConfig) {
    const projectFolder = gameGui.addFolder("Project configs");
    const projectActions = {
      async saveAll() {
        return saveAllProjectConfigs?.();
      },
    };
    projectFolder.add(projectActions, "saveAll").name("UPDATE ALL CONFIGS");

    const playerCollisionFolder = gameGui.addFolder("Player collision");
    playerCollisionFolder
      .add(gameConfig, "collisionRadius", 0.1, 0.6, 0.01)
      .name("Body radius")
      .onChange(applyPlayerCollisionSettings);
    playerCollisionFolder
      .add(gameConfig, "collisionHeight", 0.6, 2.2, 0.01)
      .name("Body height")
      .onChange(applyPlayerCollisionSettings);
    if (collisionConfig) {
      playerCollisionFolder
        .add(collisionConfig, "stepHeight", 0, 0.6, 0.01)
        .name("Step height")
        .onChange(applyPlayerCollisionSettings);
      playerCollisionFolder
        .add(collisionConfig, "stepMinWidth", 0.01, 0.6, 0.01)
        .name("Step min width")
        .onChange(applyPlayerCollisionSettings);
      playerCollisionFolder
        .add(collisionConfig, "snapToGround", 0, 1, 0.01)
        .name("Snap to ground")
        .onChange(applyPlayerCollisionSettings);
      playerCollisionFolder
        .add(collisionConfig, "controllerOffset", 0.001, 0.1, 0.001)
        .name("Skin offset")
        .onChange(applyPlayerCollisionSettings);
      playerCollisionFolder.add(collisionConfig, "jumpSpeed", 0, 8, 0.1).name("Jump speed");
      playerCollisionFolder
        .add(collisionConfig, "floorNormalThreshold", 0.1, 0.95, 0.01)
        .name("Floor normal threshold");
      playerCollisionFolder
        .add(collisionConfig, "cameraRadius", 0.02, 0.3, 0.01)
        .name("Lean camera radius")
        .onChange(applyPlayerCollisionSettings);
    }
  }

  function applyMaterial(key) {
    const config = materialConfigs[key];
    const material = materialInstances[key];
    if (!config || !material) return;
    material.color.set(config.color ?? "#ffffff");
    material.roughness = config.roughness ?? 1;
    material.metalness = config.metalness ?? 0;
    material.aoMapIntensity = config.aoMapIntensity ?? 1;
    material.emissive.set(config.emissive ?? "#000000");
    material.emissiveIntensity = config.emissiveIntensity ?? 0;
    material.userData.baseEmissiveIntensity = material.emissiveIntensity;
    const normalScale = config.normalScale ?? 1;
    material.normalScale.set(normalScale, normalScale);
    material.needsUpdate = true;
  }

  Object.entries(materialConfigs).forEach(([key, config]) => {
    const material = materialInstances[key];
    if (!material) return;
    const folder = materialsGui.addFolder(key);
    folder.addColor(config, "color").onChange(() => applyMaterial(key));
    folder.add(config, "roughness", 0, 2, 0.01).onChange(() => applyMaterial(key));
    folder.add(config, "metalness", 0, 1, 0.01).onChange(() => applyMaterial(key));
    folder.add(config, "normalScale", 0, 3, 0.01).onChange(() => applyMaterial(key));
    folder.add(config, "aoMapIntensity", 0, 3, 0.01).onChange(() => applyMaterial(key));
    folder.addColor(config, "emissive").onChange(() => applyMaterial(key));
    folder.add(config, "emissiveIntensity", 0, 12, 0.05).onChange(() => applyMaterial(key));

    const overlay = config.maskOverlay;
    if (overlay) {
      const maskFolder = folder.addFolder("Mask overlay");
      maskFolder.add(overlay, "debugView").onChange(() => applyMaterialOverlay?.(key));
      ["red", "green", "blue"].forEach((channelName) => {
        const channel = overlay[channelName];
        if (!channel) return;
        const channelFolder = maskFolder.addFolder(channelName);
        channelFolder.addColor(channel, "color").onChange(() => applyMaterialOverlay?.(key));
        channelFolder.add(channel, "opacity", 0, 1, 0.01).onChange(() => applyMaterialOverlay?.(key));
        channelFolder.add(channel, "intensity", 0, 3, 0.01).onChange(() => applyMaterialOverlay?.(key));
        channelFolder.add(channel, "threshold", 0, 1, 0.01).onChange(() => applyMaterialOverlay?.(key));
        channelFolder.add(channel, "softness", 0.001, 1, 0.005).onChange(() => applyMaterialOverlay?.(key));
        channelFolder
          .add(channel, "blend", ["mix", "multiply", "overlay"])
          .onChange(() => applyMaterialOverlay?.(key));
        channelFolder.close();
      });
      maskFolder.close();
    }
    folder.close();
  });

  if (decalConfig) {
    const folder = materialsGui.addFolder("Interior decals");
    folder.addColor(decalConfig, "tint").name("Tint").onChange(applyDecalMaterial);
    folder.add(decalConfig, "brightness", 0, 2, 0.01).name("Brightness").onChange(applyDecalMaterial);
    folder.add(decalConfig, "contrast", 0, 2, 0.01).name("Contrast").onChange(applyDecalMaterial);
    folder.add(decalConfig, "saturation", 0, 2, 0.01).name("Saturation").onChange(applyDecalMaterial);
    folder.add(decalConfig, "opacity", 0, 1, 0.01).name("Opacity").onChange(applyDecalMaterial);
    folder
      .add(decalConfig, "textureSoftness", 0, 3, 0.05)
      .name("Texture softness")
      .onChange(applyDecalMaterial);
    folder.add(decalConfig, "roughness", 0, 1, 0.01).name("Roughness").onChange(applyDecalMaterial);
    folder.add(decalConfig, "metalness", 0, 1, 0.01).name("Metalness").onChange(applyDecalMaterial);
    folder.add(decalConfig, "alphaTest", 0, 1, 0.01).name("Alpha cutoff").onChange(applyDecalMaterial);
    folder.add(decalConfig, "edgeSoftness", 0, 0.3, 0.005).name("Edge softness").onChange(applyDecalMaterial);
    folder.close();
  }

  function applyAmbient() {
    if (!hemisphereLight) return;
    hemisphereLight.color.set(lightingConfig.ambientSky);
    hemisphereLight.groundColor.set(lightingConfig.ambientGround);
    hemisphereLight.intensity = lightingConfig.ambientIntensity;
    hemisphereLight.userData.baseIntensity = hemisphereLight.intensity;
  }

  const ambient = lightsGui.addFolder("Ambient");
  ambient.addColor(lightingConfig, "ambientSky").onChange(applyAmbient);
  ambient.addColor(lightingConfig, "ambientGround").onChange(applyAmbient);
  ambient.add(lightingConfig, "ambientIntensity", 0, 2, 0.005).onChange(applyAmbient);

  function applyLight(key, structural = false) {
    const config = lightingConfig.pointLights[key];
    const light = pointLights.get(key);
    if (!config || !light) return;
    light.color.set(config.color);
    light.intensity = config.intensity;
    light.userData.baseIntensity = config.intensity;
    light.distance = config.distance;
    light.decay = config.decay;
    light.position.copy(config.position);
    if (structural) applyShadowSettings?.(light, config);
  }

  Object.entries(lightingConfig.pointLights).forEach(([key, config]) => {
    const folder = lightsGui.addFolder(key);
    folder.addColor(config, "color").onChange(() => applyLight(key));
    folder.add(config, "intensity", 0, 20, 0.01).onChange(() => applyLight(key));
    folder.add(config, "distance", 0, 30, 0.05).onChange(() => applyLight(key));
    folder.add(config, "decay", 0, 4, 0.01).onChange(() => applyLight(key));
    folder.add(config.position, "x", -10, 10, 0.01).onChange(() => applyLight(key));
    folder.add(config.position, "y", -2, 10, 0.01).onChange(() => applyLight(key));
    folder.add(config.position, "z", -10, 10, 0.01).onChange(() => applyLight(key));
    folder.add(config, "castShadow").onChange(() => applyLight(key, true));
    const shadows = folder.addFolder("Shadows");
    shadows
      .add(config, "shadowBias", -0.01, 0.01, 0.00001)
      .name("Bias")
      .onChange(() => applyLight(key, true));
    shadows
      .add(config, "shadowNormalBias", 0, 0.2, 0.0005)
      .name("Normal bias")
      .onChange(() => applyLight(key, true));
    shadows
      .add(config, "shadowRadius", 0, 10, 0.1)
      .name("Radius (PCF/VSM)")
      .onChange(() => applyLight(key, true));
    shadows
      .add(config, "shadowNear", 0.01, 2, 0.01)
      .name("Camera near")
      .onChange(() => applyLight(key, true));
    shadows
      .add(config, "shadowFar", 0.5, 30, 0.05)
      .name("Camera far")
      .onChange(() => applyLight(key, true));
    shadows.close();
    folder.close();
  });

  Object.entries(levelEnvironmentConfigs).forEach(([environmentId, environmentConfig]) => {
    const environmentFolder = prefabsGui.addFolder(environmentId);
    let saveProjectController = null;
    const levelActions = {
      async saveProject() {
        saveProjectController?.name("Saving...");
        try {
          const result = await saveLevelProjectConfig(clone(environmentConfig));
          saveProjectController?.name("Saved — reloading");
          window.setTimeout(() => window.location.reload(), 180);
          return result;
        } catch (error) {
          saveProjectController?.name("SAVE FAILED");
          console.error("[Scene debug] Failed to save level config", error);
          throw error;
        }
      },
      async copyConfig() {
        const source = JSON.stringify(environmentConfig, null, 2);
        await navigator.clipboard.writeText(source);
        return source;
      },
    };
    const presetFolder = environmentFolder.addFolder("Preset");
    saveProjectController = presetFolder.add(levelActions, "saveProject").name("Save to project");
    presetFolder.add(levelActions, "copyConfig").name("Copy level config");
    const ambientConfig = environmentConfig.lighting;
    if (ambientConfig) {
      const ambientFolder = environmentFolder.addFolder("Ambient");
      ambientFolder.addColor(ambientConfig, "ambientSky").onChange(() => applyLevelAmbient?.(environmentId));
      ambientFolder.addColor(ambientConfig, "ambientGround").onChange(() => applyLevelAmbient?.(environmentId));
      ambientFolder
        .add(ambientConfig, "ambientIntensity", 0, 2, 0.005)
        .onChange(() => applyLevelAmbient?.(environmentId));
    }

    (environmentConfig.prefabs ?? []).forEach((prefabConfig) => {
      const folder = environmentFolder.addFolder(prefabConfig.name);
      const placement = folder.addFolder("Position");
      placement
        .add(prefabConfig.position, "x", -30, 30, 0.001)
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name, true));
      placement
        .add(prefabConfig.position, "y", -5, 10, 0.001)
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name, true));
      placement
        .add(prefabConfig.position, "z", -30, 30, 0.001)
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name, true));
      if (!prefabConfig.light) {
        folder.close();
        return;
      }
      const lightConfig = prefabConfig.light;
      folder.add(lightConfig, "enabled").name("Light enabled").onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name));
      folder.addColor(lightConfig, "color").onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name));
      folder
        .add(lightConfig, "intensity", 0, 20, 0.01)
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name));
      folder
        .add(lightConfig, "distance", 0, 30, 0.05)
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name));
      folder
        .add(lightConfig, "decay", 0, 4, 0.01)
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name));
      folder.add(lightConfig, "fluorescentStartup").name("Starter on power-up");
      folder.add(lightConfig, "startupDelaySeconds", 0, 30, 0.1).name("Startup delay");
      folder.add(lightConfig, "faultyStarterLoop").name("Faulty starter loop");
      folder
        .add(lightConfig, "castShadow")
        .name("Cast shadows")
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name, true));

      const offset = folder.addFolder("Light offset");
      offset
        .add(lightConfig.localOffset, "x", -2, 2, 0.001)
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name));
      offset
        .add(lightConfig.localOffset, "y", -2, 2, 0.001)
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name));
      offset
        .add(lightConfig.localOffset, "z", -2, 2, 0.001)
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name));

      const flicker = lightConfig.flicker;
      if (flicker) {
        flicker.minIntervalSeconds ??= 35;
        flicker.maxIntervalSeconds ??= 110;
        flicker.retryChance ??= 0.35;
        const flickerFolder = folder.addFolder("Random flicker");
        flickerFolder.add(flicker, "enabled");
        flickerFolder.add(flicker, "minIntervalSeconds", 0.1, 180, 0.1).name("Min interval");
        flickerFolder.add(flicker, "maxIntervalSeconds", 0.1, 300, 0.1).name("Max interval");
        flickerFolder.add(flicker, "retryChance", 0, 1, 0.01);
        flickerFolder.close();
      }

      const shadows = folder.addFolder("Shadows");
      shadows
        .add(lightConfig, "shadowBias", -0.01, 0.01, 0.00001)
        .name("Bias")
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name, true));
      shadows
        .add(lightConfig, "shadowNormalBias", 0, 0.2, 0.0005)
        .name("Normal bias")
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name, true));
      shadows
        .add(lightConfig, "shadowRadius", 0, 10, 0.1)
        .name("Radius")
        .onChange(() => applyLevelPrefab?.(environmentId, prefabConfig.name, true));
      shadows.close();
      folder.close();
    });
    environmentFolder.close();
  });

  function applyAll() {
    Object.keys(materialConfigs).forEach((key) => {
      applyMaterial(key);
      applyMaterialOverlay?.(key);
    });
    applyAmbient();
    Object.keys(lightingConfig.pointLights).forEach((key) => applyLight(key, true));
    applyDecalMaterial?.();
  }

  function refresh() {
    [
      ...materialsGui.controllersRecursive(),
      ...lightsGui.controllersRecursive(),
      ...prefabsGui.controllersRecursive(),
      ...gameGui.controllersRecursive(),
    ].forEach((controller) => {
      controller.updateDisplay();
    });
  }

  const actions = {
    save() {
      localStorage.setItem(
        getStorageKey(levelId),
        JSON.stringify(createSceneSnapshot(materialConfigs, lightingConfig, decalConfig)),
      );
    },
    async saveProject() {
      const result = await saveProjectConfig(createSceneSnapshot(materialConfigs, lightingConfig, decalConfig));
      localStorage.removeItem(getStorageKey(levelId));
      return result;
    },
    load() {
      const saved = readSaved(levelId);
      if (!saved) return false;
      mergeConfig(materialConfigs, saved.materials);
      mergeConfig(lightingConfig, saved.lighting);
      mergeConfig(decalConfig, saved.decals);
      applyAll();
      refresh();
      return true;
    },
    reset() {
      mergeConfig(materialConfigs, defaults.materials);
      mergeConfig(lightingConfig, defaults.lighting);
      mergeConfig(decalConfig, defaults.decals);
      applyAll();
      refresh();
    },
    async copyConfig() {
      const source = JSON.stringify(createSceneSnapshot(materialConfigs, lightingConfig, decalConfig), null, 2);
      await navigator.clipboard.writeText(source);
      return source;
    },
    clearSaved() {
      localStorage.removeItem(getStorageKey(levelId));
    },
  };

  [materialsGui, lightsGui].forEach((gui) => {
    const preset = gui.addFolder("Preset");
    preset.add(actions, "save").name("Save in browser");
    preset.add(actions, "saveProject").name("Save to project");
    preset.add(actions, "load").name("Load saved");
    preset.add(actions, "reset").name("Reset defaults");
    preset.add(actions, "copyConfig").name("Copy scene config");
    preset.add(actions, "clearSaved").name("Clear saved");
    if (startClosed) window.setTimeout(() => gui.close(), 0);
  });
  if (startClosed) window.setTimeout(() => gameGui.close(), 0);

  let visible = true;
  const setVisible = (nextVisible) => {
    visible = Boolean(nextVisible);
    updateGuiVisibility();
    return visible;
  };

  let activeLevelId = null;
  function updateGuiVisibility() {
    const usesLevelPrefabs = Boolean(activeLevelId && levelEnvironmentConfigs[activeLevelId]);
    [materialsGui, gameGui].forEach((gui) => (visible ? gui.show() : gui.hide()));
    if (visible && !usesLevelPrefabs) lightsGui.show();
    else lightsGui.hide();
    if (visible && usesLevelPrefabs) prefabsGui.show();
    else prefabsGui.hide();
  }
  updateGuiVisibility();

  return {
    ...actions,
    getProjectConfig: () => createSceneSnapshot(materialConfigs, lightingConfig, decalConfig),
    guis: [materialsGui, lightsGui, prefabsGui, gameGui],
    isVisible: () => visible,
    setVisible,
    setActiveLevel(levelId) {
      activeLevelId = levelId;
      updateGuiVisibility();
    },
    toggle: () => setVisible(!visible),
  };
}
