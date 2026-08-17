import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import {
  cloneSerializable,
  createLevelOverrideSnapshot,
} from "../../../levels/LevelConfigSerialization.js?v=open-facility-bulkheads";
import {
  applyPrefabPlacementOffset,
  createPrefabPlacementOffset,
  isSocketGeneratedPrefab,
  resetPrefabToAuthoredPlacement,
} from "../../../prefabs/PrefabPlacementMetadata.js?v=open-facility-bulkheads";

const PREFAB_GROUP_ORDER = ["elevator", "operatorPanel", "fluorescentLamp", "radio", "serviceDoor", "bulkheadDoor"];
const PREFAB_TYPE_ALIASES = { DoorBulk1: "bulkheadDoor" };
const SHADOW_MAP_SIZES = [128, 256, 512, 1024, 2048, 4096];
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
const POST_FX_QUALITY_SECTIONS = new Set(["gtao", "ssgi", "ssr", "screenSpaceShadows"]);
const ENUMS = {
  method: ["off", "fxaa", "smaa"],
  msaaSamples: [0, 2, 4, 8],
  defaultQuality: ["off", "min", "med", "max"],
  format: ["cube", "3dl"],
  inputColorSpace: ["display-srgb", "linear"],
};

export function compareDebugPrefabs(a, b) {
  const aType = PREFAB_TYPE_ALIASES[a.prefabType] ?? a.prefabType;
  const bType = PREFAB_TYPE_ALIASES[b.prefabType] ?? b.prefabType;
  const ai = PREFAB_GROUP_ORDER.indexOf(aType);
  const bi = PREFAB_GROUP_ORDER.indexOf(bType);
  return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    || a.name.localeCompare(b.name, undefined, { numeric: true });
}

export function getSuspendedLampDebugProperties(prefab, materialConfigs = {}) {
  if (prefab?.behavior !== "suspendedLamp" || !prefab.suspension) return null;
  return {
    suspension: prefab.suspension,
    bulbMaterial: materialConfigs.lampDome1Bulb ?? null,
  };
}

export function getPlasmaViewDebugProperties(prefab) {
  return prefab?.behavior === "plasmaView" && prefab.plasma ? prefab.plasma : null;
}

export function createDebugProjectSavePayload({
  environment,
  materialConfigs,
  globalLightingConfig,
  decalConfig,
  cameraConfig,
  postProcessingConfig,
}) {
  const config = {
    globalScene: {
      materials: Object.fromEntries(Object.entries(materialConfigs ?? {}).map(([key, material]) => {
        const tuning = {};
        MATERIAL_TUNING_KEYS.forEach((property) => {
          if (property in material) tuning[property] = cloneSerializable(material[property]);
        });
        if (material.maskOverlay) tuning.maskOverlay = cloneSerializable(material.maskOverlay);
        return [key, tuning];
      })),
      lighting: cloneSerializable(globalLightingConfig ?? {}),
      camera: cloneSerializable(cameraConfig ?? {}),
    },
    postProcessing: cloneSerializable(postProcessingConfig ?? {}),
  };
  if (decalConfig != null) config.globalScene.decals = cloneSerializable(decalConfig);
  if (environment?.saveKind) config[environment.saveKind] = createLevelOverrideSnapshot(environment);
  return { kind: "allConfigs", config };
}

export function createDebugWorkspace({
  levelEnvironmentConfigs = {},
  materialConfigs = {},
  globalLightingConfig = {},
  decalConfig = null,
  gameConfig = {},
  cameraConfig = {},
  postProcessingConfig = {},
  getPostProcessingQualities,
  setPostProcessingQuality,
  soundRegistry = {},
  soundMix = {},
  getAudioDebugState,
  getSceneSoundKeys,
  applyLevelPrefab,
  applyLevelPointLight,
  applyLevelWorld,
  applyLevelAmbient,
  applyPlayerCollisionSettings,
  applyPostProcessing,
  rebuildPostProcessing,
  applyAudioMix,
  applyMaterialConfig,
  togglePositionGizmo,
}) {
  let masterGui = null;
  let propertiesGui = null;
  let visible = false;
  let activeLevelId = null;
  let selectedId = "global:player";
  let filter = "";
  const lastSelectedByLevel = new Map();
  const selectionControllers = new Map();
  const statusState = { status: "ready" };

  function makeGui(title, right) {
    const gui = new GUI({ title, width: 350 });
    gui.domElement.classList.add("debug-lil-panel");
    Object.assign(gui.domElement.style, {
      position: "fixed",
      top: "8px",
      right: `${right}px`,
      maxHeight: "calc(100vh - 16px)",
      overflowY: "auto",
      zIndex: "10020",
    });
    if (!visible) gui.hide();
    return gui;
  }

  function getEnvironment(levelId = activeLevelId) {
    return levelId ? levelEnvironmentConfigs[levelId] : null;
  }

  function setStatus(message, state = "") {
    statusState.status = state ? `${state.toUpperCase()}: ${message}` : message;
  }

  function action(folder, label, callback) {
    const holder = { [label]: callback };
    return folder.add(holder, label);
  }

  function select(id) {
    selectedId = id;
    if (activeLevelId) lastSelectedByLevel.set(activeLevelId, id);
    updateSelectedController();
    rebuildProperties();
    return id;
  }

  function selectionAction(folder, label, id) {
    const controller = action(folder, label, () => select(id));
    const controllers = selectionControllers.get(id) ?? [];
    controllers.push(controller);
    selectionControllers.set(id, controllers);
    return controller;
  }

  function updateSelectedController() {
    selectionControllers.forEach((controllers, id) => {
      const selected = id === selectedId;
      controllers.forEach((controller) => {
        controller.domElement.style.borderLeft = selected ? "3px solid #9dd8a0" : "3px solid transparent";
        controller.domElement.style.background = selected ? "rgba(100, 180, 110, 0.18)" : "";
      });
    });
  }

  function rebuildMaster() {
    masterGui?.destroy();
    selectionControllers.clear();
    masterGui = makeGui("LEVEL / OUTLINER", 370);
    masterGui.add({ filter }, "filter").name("FILTER").onFinishChange((value) => {
      filter = String(value ?? "").trim().toLowerCase();
      rebuildMaster();
    });
    masterGui.add(statusState, "status").name("STATUS").listen().disable();
    action(masterGui, "SAVE CONFIGS TO PROJECT", saveProject);

    const globals = masterGui.addFolder("MASTER");
    selectionAction(globals, "PLAYER", "global:player");
    selectionAction(globals, "POST FX", "global:postfx");
    selectionAction(globals, "AUDIO", "global:audio");

    const env = getEnvironment();
    if (!env) {
      updateSelectedController();
      return;
    }
    const level = masterGui.addFolder(`LEVEL — ${activeLevelId}`);
    selectionAction(level, "WORLD / FOG", `level:${activeLevelId}:world`);
    selectionAction(level, "PLAYER SPAWN", `level:${activeLevelId}:spawn`);
    selectionAction(level, "AMBIENT", `level:${activeLevelId}:ambient`);

    const lights = masterGui.addFolder("LIGHTS");
    Object.keys(env.lighting?.pointLights ?? {})
      .filter(matchesFilter)
      .sort(naturalCompare)
      .forEach((key) => selectionAction(lights, key, `level-light:${activeLevelId}:${key}`));
    (env.prefabs ?? []).filter((prefab) => prefab.light && !isSocketGeneratedPrefab(prefab) && matchesFilter(prefab.name))
      .sort(compareDebugPrefabs)
      .forEach((prefab) => selectionAction(lights, getPrefabDisplayName(prefab), `prefab:${activeLevelId}:${prefab.name}`));

    const prefabs = masterGui.addFolder("PREFABS");
    (env.prefabs ?? []).filter((prefab) => !isSocketGeneratedPrefab(prefab) && matchesFilter(prefab.name))
      .sort(compareDebugPrefabs)
      .forEach((prefab) => selectionAction(prefabs, getPrefabDisplayName(prefab), `prefab:${activeLevelId}:${prefab.name}`));

    const materials = masterGui.addFolder("MATERIALS");
    Object.keys(materialConfigs).filter(matchesFilter).sort(naturalCompare)
      .forEach((key) => selectionAction(materials, key, `material:${key}`));
    updateSelectedController();
  }

  function rebuildProperties() {
    propertiesGui?.destroy();
    propertiesGui = makeGui("PROPERTIES", 8);
    const [kind, levelId, key] = selectedId.split(":");
    if (kind === "prefab") buildPrefabProperties(levelId, key);
    else if (kind === "level-light") buildPointLightProperties(levelId, key);
    else if (kind === "level") buildLevelProperties(levelId, key);
    else if (kind === "material") buildMaterialProperties(key);
    else if (selectedId === "global:postfx") buildPostFxProperties();
    else if (selectedId === "global:audio") buildAudioProperties();
    else buildPlayerProperties();
  }

  function buildPrefabProperties(levelId, prefabName) {
    const prefab = levelEnvironmentConfigs[levelId]?.prefabs?.find((entry) => entry.name === prefabName);
    if (!prefab) return action(propertiesGui, `MISSING: ${prefabName}`, () => {});
    propertiesGui.title(`PROPERTIES — ${getPrefabDisplayName(prefab)}`);
    const apply = (structural = false) => {
      const applied = applyLevelPrefab?.(levelId, prefab.name, structural);
      setStatus(applied === false ? `${prefab.name} is not loaded` : `applied ${prefab.name}`, applied === false ? "warning" : "live");
    };
    const transform = propertiesGui.addFolder("TRANSFORM");
    const placementOffset = createPrefabPlacementOffset(prefab);
    if (placementOffset) {
      const offset = transform.addFolder("ADDITIONAL OFFSET");
      const applyOffset = () => {
        applyPrefabPlacementOffset(prefab, placementOffset);
        apply(true);
      };
      addVector(offset, "POSITION", placementOffset.position, -20, 20, 0.001, applyOffset);
      addVector(offset, "ROTATION", placementOffset.rotation, -Math.PI * 2, Math.PI * 2, 0.001, applyOffset, ["_x", "_y", "_z"]);
      addVector(offset, "SCALE MULTIPLIER", placementOffset.scale, 0.01, 10, 0.001, applyOffset);
      action(offset, "RESET OFFSETS", () => {
        resetPrefabToAuthoredPlacement(prefab);
        apply(true);
        setStatus(`reset ${prefab.name} offsets`, "live");
        rebuildProperties();
      });
    } else {
      addVector(transform, "POSITION", prefab.position, -50, 50, 0.001, () => apply(true));
      addVector(transform, "ROTATION", prefab.rotation, -Math.PI * 2, Math.PI * 2, 0.001, () => apply(true), ["_x", "_y", "_z"]);
      addVector(transform, "SCALE", prefab.scale, 0.01, 10, 0.001, () => apply(true));
    }
    if (!placementOffset) {
      action(transform, "EDIT POSITION GIZMO", () => togglePositionGizmo?.({
        id: `prefab:${levelId}:${prefab.name}`,
        type: "prefab",
        levelId,
        key: prefab.name,
        position: prefab.position,
        onChange: () => apply(true),
      }));
    }

    if (prefab.light) addPrefabLightProperties(propertiesGui.addFolder("LIGHT"), prefab, apply);
    const suspended = getSuspendedLampDebugProperties(prefab, materialConfigs);
    if (suspended) {
      const folder = propertiesGui.addFolder("SUSPENDED LAMP");
      addBoolean(folder, suspended.suspension, "enabled", "MOVEMENT", apply);
      addNumber(folder, suspended.suspension, "maxAngleDegrees", "MAX ANGLE", 0, 12, 0.05, apply);
      addNumber(folder, suspended.suspension, "naturalPeriodSeconds", "PERIOD", 0.5, 12, 0.05, apply);
      addNumber(folder, suspended.suspension, "dampingPerSecond", "DAMPING", 0, 4, 0.01, apply);
      addNumber(folder, suspended.suspension, "airflowDegrees", "AIRFLOW", 0, 8, 0.05, apply);
      if (suspended.bulbMaterial) addNumber(folder, suspended.bulbMaterial, "emissiveIntensity", "BULB EMISSIVE", 0, 30, 0.05,
        () => applyMaterialConfig?.("lampDome1Bulb"));
    }
    if (prefab.radio) {
      const radio = propertiesGui.addFolder("RADIO");
      addNumber(radio, prefab.radio, "maxDistance", "MAX DISTANCE", 0.5, 20, 0.05, apply);
      addNumber(radio, prefab.radio, "refDistance", "REF DISTANCE", 0.05, 5, 0.05, apply);
      addNumber(radio, prefab.radio, "lampBlinkFrequency", "BLINK FREQUENCY", 0, 8, 0.05, apply);
    }
    const plasmaConfig = getPlasmaViewDebugProperties(prefab);
    if (plasmaConfig) {
      const plasma = propertiesGui.addFolder("PLASMA VIEW");
      addNumber(plasma, plasmaConfig, "flowSpeed", "FLOW SPEED", 0, 80, 0.1, apply);
      addNumber(plasma, plasmaConfig, "baseFlowRatio", "BASE SPEED RATIO", 0, 0.5, 0.001, apply);
      addNumber(plasma, plasmaConfig, "baseStrength", "BASE PLASMA", 0, 2, 0.005, apply);
      addNumber(plasma, plasmaConfig, "coreGain", "CORE GAIN", 0, 3, 0.005, apply);
      addNumber(plasma, plasmaConfig, "coreOpacity", "CORE OPACITY", 0, 1, 0.005, apply);
      addNumber(plasma, plasmaConfig, "haloGain", "HALO GAIN", 0, 2, 0.005, apply);
      addNumber(plasma, plasmaConfig, "haloOpacity", "HALO OPACITY", 0, 1, 0.005, apply);
      addNumber(plasma, plasmaConfig, "haloScale", "HALO SCALE", 1, 1.3, 0.001, apply);
      addNumber(plasma, plasmaConfig, "hazeStrength", "HAZE", 0, 1, 0.005, apply);
      addNumber(plasma, plasmaConfig, "filamentStrength", "FILAMENTS", 0, 3, 0.005, apply);
      addNumber(plasma, plasmaConfig, "filamentDensity", "LINE DENSITY", 2, 40, 0.1, apply);
      addNumber(plasma, plasmaConfig, "filamentSharpness", "LINE SHARPNESS", 0.25, 0.95, 0.005, apply);
      addNumber(plasma, plasmaConfig, "filamentSegmentation", "LINE BREAKUP", 0, 1, 0.005, apply);
      addNumber(plasma, plasmaConfig, "hotspotStrength", "HOTSPOTS", 0, 3, 0.005, apply);
      addNumber(plasma, plasmaConfig, "hotspotThreshold", "HOTSPOT RARITY", 0.35, 0.95, 0.005, apply);
      addNumber(plasma, plasmaConfig, "colorVariation", "COLOR VARIATION", 0, 1, 0.005, apply);
      addColor(plasma, plasmaConfig, "baseColor", "BASE COLOR", apply);
      addColor(plasma, plasmaConfig, "stableColor", "STABLE COLOR", apply);
      addColor(plasma, plasmaConfig, "filamentColor", "FILAMENT COLOR", apply);
      addColor(plasma, plasmaConfig, "hotspotColor", "HOTSPOT COLOR", apply);
      addColor(plasma, plasmaConfig, "dangerColor", "DANGER COLOR", apply);
      addColor(plasma, plasmaConfig, "impurityColor", "IMPURITY COLOR", apply);
      addNumber(plasma, plasmaConfig, "displacementScale", "SURFACE MOTION", 0, 0.3, 0.001, apply);
      addColor(plasma, plasmaConfig, "lightColor", "LIGHT COLOR", apply);
      addNumber(plasma, plasmaConfig, "lightIntensity", "LIGHT INTENSITY", 0, 20, 0.01, apply);
      addNumber(plasma, plasmaConfig, "lightDistance", "LIGHT DISTANCE", 0, 30, 0.05, apply);
      addNumber(plasma, plasmaConfig, "lightDecay", "LIGHT DECAY", 0, 4, 0.01, apply);
      addVector(plasma, "LIGHT OFFSET", plasmaConfig.lightLocalOffset, -10, 10, 0.001, apply);
    }
    const actions = propertiesGui.addFolder("ACTIONS");
    action(actions, "COPY PREFAB CONFIG", () => copyJson(prefab, `${prefab.name} copied`));
    action(actions, "SAVE CONFIGS TO PROJECT", saveProject);
  }

  function addPrefabLightProperties(folder, prefab, apply) {
    const light = prefab.light;
    light.shadowMapSize ??= 512;
    addBoolean(folder, light, "enabled", "ENABLED", apply);
    addColor(folder, light, "color", "COLOR", apply);
    addNumber(folder, light, "intensity", "INTENSITY", 0, 30, 0.01, apply);
    addNumber(folder, light, "distance", "DISTANCE", 0, 80, 0.05, apply);
    addNumber(folder, light, "decay", "DECAY", 0, 4, 0.01, apply);
    addVector(folder, "LOCAL OFFSET", light.localOffset, -3, 3, 0.001, apply);
    if (light.type === "spot") {
      addNumber(folder, light, "angle", "SPOT ANGLE", 0.05, 1.55, 0.001, apply);
      addNumber(folder, light, "penumbra", "PENUMBRA", 0, 1, 0.01, apply);
      addVector(folder, "TARGET", light.targetLocalOffset, -20, 20, 0.001, apply);
      if (light.cookiePath) addNumber(folder, light, "cookieRotationDegrees", "COOKIE ROTATION", -180, 180, 1, apply);
    }
    if (light.fluorescentStartup !== undefined) addBoolean(folder, light, "fluorescentStartup", "STARTER", apply);
    if (light.startupDelaySeconds !== undefined) addNumber(folder, light, "startupDelaySeconds", "START DELAY", 0, 30, 0.1, apply);
    if (light.faultyStarterLoop !== undefined) addBoolean(folder, light, "faultyStarterLoop", "FAULTY LOOP", apply);
    if (light.flicker) {
      const flicker = folder.addFolder("FLICKER");
      addBoolean(flicker, light.flicker, "enabled", "ENABLED", apply);
      addNumber(flicker, light.flicker, "minIntervalSeconds", "MIN INTERVAL", 0.1, 180, 0.1, apply);
      addNumber(flicker, light.flicker, "maxIntervalSeconds", "MAX INTERVAL", 0.1, 300, 0.1, apply);
    }
    if (light.afterglow) {
      const afterglow = folder.addFolder("AFTERGLOW");
      addBoolean(afterglow, light.afterglow, "enabled", "ENABLED", apply);
      addNumber(afterglow, light.afterglow, "durationSeconds", "DURATION", 0, 10, 0.05, apply);
      addNumber(afterglow, light.afterglow, "initialFactor", "INITIAL", 0, 1, 0.01, apply);
      addNumber(afterglow, light.afterglow, "exponent", "EXPONENT", 0.1, 6, 0.05, apply);
    }
    const shadows = folder.addFolder("SHADOWS");
    addBoolean(shadows, light, "castShadow", "CAST SHADOW", () => apply(true));
    if (light.shadowMapSize !== undefined) addSelect(shadows, light, "shadowMapSize", "MAP SIZE", SHADOW_MAP_SIZES, () => apply(true));
    addNumber(shadows, light, "shadowBias", "BIAS", -0.01, 0.01, 0.00001, () => apply(true));
    addNumber(shadows, light, "shadowNormalBias", "NORMAL BIAS", 0, 0.2, 0.0005, () => apply(true));
    addNumber(shadows, light, "shadowRadius", "RADIUS", 0, 10, 0.1, () => apply(true));
    addNumber(shadows, light, "shadowNear", "NEAR", 0.005, 5, 0.005, () => apply(true));
    addNumber(shadows, light, "shadowFar", "FAR", 0.5, 80, 0.05, () => apply(true));
  }

  function buildPointLightProperties(levelId, key) {
    const light = levelEnvironmentConfigs[levelId]?.lighting?.pointLights?.[key];
    if (!light) return;
    propertiesGui.title(`PROPERTIES — ${key}`);
    const apply = (structural = false) => {
      const applied = applyLevelPointLight?.(levelId, key, structural);
      setStatus(applied === false ? `${key} is not loaded` : `applied ${key}`, applied === false ? "warning" : "live");
    };
    addColor(propertiesGui, light, "color", "COLOR", apply);
    addNumber(propertiesGui, light, "intensity", "INTENSITY", 0, 30, 0.01, apply);
    addNumber(propertiesGui, light, "distance", "DISTANCE", 0, 80, 0.05, apply);
    addNumber(propertiesGui, light, "decay", "DECAY", 0, 4, 0.01, apply);
    addVector(propertiesGui, "POSITION", light.position, -50, 50, 0.01, apply);
    const shadows = propertiesGui.addFolder("SHADOWS");
    addBoolean(shadows, light, "castShadow", "CAST SHADOW", () => apply(true));
    addNumber(shadows, light, "shadowBias", "BIAS", -0.01, 0.01, 0.00001, () => apply(true));
    addNumber(shadows, light, "shadowNormalBias", "NORMAL BIAS", 0, 0.2, 0.0005, () => apply(true));
    addNumber(shadows, light, "shadowRadius", "RADIUS", 0, 10, 0.1, () => apply(true));
  }

  function buildLevelProperties(levelId, key) {
    const env = levelEnvironmentConfigs[levelId];
    if (!env) return;
    if (key === "world") {
      propertiesGui.title("PROPERTIES — WORLD / FOG");
      const apply = () => applyLevelWorld?.(levelId);
      addColor(propertiesGui, env.world, "backgroundColor", "BACKGROUND", apply);
      addColor(propertiesGui, env.world, "fogColor", "FOG COLOR", apply);
      addNumber(propertiesGui, env.world, "fogNear", "FOG NEAR", 0, 100, 0.05, apply);
      addNumber(propertiesGui, env.world, "fogFar", "FOG FAR", 0.1, 300, 0.1, apply);
    } else if (key === "spawn") {
      propertiesGui.title("PROPERTIES — PLAYER SPAWN");
      addVector(propertiesGui, "POSITION", env.player?.spawnPosition, -50, 50, 0.01);
      addVector(propertiesGui, "ROTATION DEGREES", env.player?.rotationDegrees, -360, 360, 0.1);
    } else {
      propertiesGui.title("PROPERTIES — AMBIENT");
      const apply = () => applyLevelAmbient?.(levelId);
      addColor(propertiesGui, env.lighting, "ambientSky", "SKY", apply);
      addColor(propertiesGui, env.lighting, "ambientGround", "GROUND", apply);
      addNumber(propertiesGui, env.lighting, "ambientIntensity", "INTENSITY", 0, 2, 0.005, apply);
    }
    action(propertiesGui, "SAVE CONFIGS TO PROJECT", saveProject);
  }

  function buildMaterialProperties(key) {
    const material = materialConfigs[key];
    if (!material) return;
    propertiesGui.title(`PROPERTIES — ${key}`);
    const apply = () => {
      applyMaterialConfig?.(key);
      setStatus(`applied material ${key}`, "live");
    };
    MATERIAL_TUNING_KEYS.forEach((property) => addAutoController(propertiesGui, material, property, apply));
    if (material.maskOverlay) addObjectFolder(propertiesGui.addFolder("MASK OVERLAY"), material.maskOverlay, apply);
    action(propertiesGui, "SAVE CONFIGS TO PROJECT", saveProject);
  }

  function buildPostFxProperties() {
    propertiesGui.title("PROPERTIES — POST FX");
    const apply = () => {
      applyPostProcessing?.();
      rebuildPostProcessing?.();
      setStatus("applied Post FX", "live");
    };
    Object.entries(postProcessingConfig).forEach(([key, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const folder = propertiesGui.addFolder(labelize(key).toUpperCase());
        if (POST_FX_QUALITY_SECTIONS.has(key) && value.presets) {
          const quality = { active: getPostProcessingQualities?.()?.[key] ?? value.defaultQuality ?? "off" };
          folder.add(quality, "active", Object.keys(value.presets)).name("ACTIVE QUALITY").onChange((next) => {
            setPostProcessingQuality?.(key, next);
            setStatus(`${key}: ${next}`, "live");
          });
        }
        addObjectFolder(folder, value, apply, new Set(["presets"]));
      } else addAutoController(propertiesGui, postProcessingConfig, key, apply);
    });
    action(propertiesGui, "COPY POST FX", () => copyJson(postProcessingConfig, "Post FX copied"));
    action(propertiesGui, "SAVE CONFIGS TO PROJECT", saveProject);
  }

  function buildPlayerProperties() {
    propertiesGui.title("PROPERTIES — PLAYER");
    const collision = gameConfig.collision ?? {};
    const movement = cameraConfig.operatorMovement ?? {};
    const bodyRig = movement.bodyRig ?? {};

    const movementFolder = propertiesGui.addFolder("MOVEMENT");
    addNumber(movementFolder, cameraConfig, "walkSpeed", "WALK SPEED", 0.1, 5, 0.01);
    addNumber(movementFolder, cameraConfig, "runSpeed", "RUN SPEED", 0.1, 8, 0.01);
    addNumber(movementFolder, cameraConfig, "crouchSpeed", "CROUCH SPEED", 0.1, 4, 0.01);
    addNumber(movementFolder, movement, "acceleration", "ACCELERATION", 0.1, 30, 0.1);
    addNumber(movementFolder, movement, "deceleration", "DECELERATION", 0.1, 30, 0.1);
    addNumber(movementFolder, movement, "leanForward", "RMB LEAN FORWARD", 0, 0.6, 0.005);
    addNumber(movementFolder, movement, "leanDown", "RMB LEAN DOWN", 0, 0.2, 0.002);
    addNumber(movementFolder, movement, "leanDamping", "RMB LEAN DAMPING", 0.1, 20, 0.1);

    const bodyYaw = propertiesGui.addFolder("SOMA BODY YAW / HEAD");
    addNumber(bodyYaw, bodyRig, "freeHeadYawDegrees", "FREE HEAD YAW", 0, 60, 0.5);
    addNumber(bodyYaw, bodyRig, "stationaryBodyTurnFrequency", "STATIONARY FOLLOW", 0.1, 12, 0.1);
    addNumber(bodyYaw, bodyRig, "movingBodyTurnFrequency", "MOVING FOLLOW", 0.1, 12, 0.1);
    addNumber(bodyYaw, bodyRig, "fastBodyTurnFrequency", "FAST FOLLOW", 0.1, 16, 0.1);
    addNumber(bodyYaw, bodyRig, "stationaryTurnStepDegrees", "TURN STEP ANGLE", 1, 60, 0.5);
    addNumber(bodyYaw, bodyRig, "stationaryTurnStepInterval", "TURN STEP INTERVAL", 0.05, 2, 0.01);
    addNumber(bodyYaw, bodyRig, "headYawTranslation", "HEAD SIDE OFFSET", 0, 0.04, 0.0001);
    addNumber(bodyYaw, bodyRig, "headYawRollDegrees", "HEAD ROLL", 0, 4, 0.01);

    const weight = propertiesGui.addFolder("STRAFE / BODY WEIGHT");
    addNumber(weight, bodyRig, "strafeTranslation", "STRAFE SIDE OFFSET", 0, 0.06, 0.0005);
    addNumber(weight, bodyRig, "strafeRollDegrees", "STRAFE ROLL", 0, 5, 0.05);
    addNumber(weight, bodyRig, "strafeSpringFrequency", "STRAFE SPRING", 0.1, 20, 0.1);
    addNumber(weight, bodyRig, "strafeSpringDamping", "STRAFE DAMPING", 0.05, 2, 0.01);
    addNumber(weight, bodyRig, "forwardAccelerationScale", "FORWARD WEIGHT SCALE", 0, 0.02, 0.0001);
    addNumber(weight, bodyRig, "forwardWeightLimit", "FORWARD WEIGHT LIMIT", 0, 0.08, 0.001);
    addNumber(weight, bodyRig, "forwardWeightFrequency", "FORWARD SPRING", 0.1, 20, 0.1);
    addNumber(weight, bodyRig, "forwardWeightDamping", "FORWARD DAMPING", 0.05, 2, 0.01);
    addNumber(weight, bodyRig, "forwardWeightPitchDegreesPerMeter", "WEIGHT PITCH / M", 0, 80, 0.5);

    const look = propertiesGui.addFolder("MOUSE TURN REACTION");
    addNumber(look, bodyRig, "lookAngularVelocityLimit", "VELOCITY LIMIT", 0.1, 20, 0.1);
    addNumber(look, bodyRig, "lookAngularVelocityForFullSway", "FULL SWAY VELOCITY", 0.1, 20, 0.1);
    addNumber(look, bodyRig, "lookReactionFrequency", "REACTION SPRING", 0.1, 24, 0.1);
    addNumber(look, bodyRig, "lookReactionDamping", "REACTION DAMPING", 0.05, 2, 0.01);
    addNumber(look, bodyRig, "lookYawTranslation", "YAW SIDE OFFSET", 0, 0.05, 0.0005);
    addNumber(look, bodyRig, "lookYawRollDegrees", "YAW ROLL", 0, 5, 0.05);
    addNumber(look, bodyRig, "lookPitchReactionDegrees", "PITCH REACTION", 0, 4, 0.05);

    const gait = propertiesGui.addFolder("AUTHORED GAIT");
    addNumber(gait, bodyRig, "walkStrideLength", "WALK STRIDE", 0.2, 3, 0.01);
    addNumber(gait, bodyRig, "runStrideLength", "RUN STRIDE", 0.2, 4, 0.01);
    addNumber(gait, bodyRig, "crouchStrideLength", "CROUCH STRIDE", 0.2, 2, 0.01);
    addNumber(gait, bodyRig, "walkReferenceSpeed", "REFERENCE SPEED", 0.1, 5, 0.01);
    addNumber(gait, bodyRig, "bodyGaitSide", "BODY SIDE", 0, 0.06, 0.0005);
    addNumber(gait, bodyRig, "bodyGaitVertical", "BODY VERTICAL", 0, 0.06, 0.0005);
    addNumber(gait, bodyRig, "cameraGaitSide", "CAMERA SIDE", 0, 0.05, 0.0005);
    addNumber(gait, bodyRig, "cameraGaitVertical", "CAMERA VERTICAL", 0, 0.05, 0.0005);
    addNumber(gait, bodyRig, "cameraGaitRollDegrees", "CAMERA ROLL", 0, 4, 0.05);
    addNumber(gait, bodyRig, "cameraGaitPitchDegrees", "CAMERA PITCH", 0, 4, 0.05);

    const held = propertiesGui.addFolder("HELD ITEM / FLASHLIGHT");
    addNumber(held, bodyRig, "heldMassScale", "BODY MOTION SCALE", 0, 4, 0.05);
    addNumber(held, bodyRig, "heldGaitSide", "GAIT SIDE", 0, 0.08, 0.0005);
    addNumber(held, bodyRig, "heldGaitVertical", "GAIT VERTICAL", 0, 0.08, 0.0005);
    addNumber(held, bodyRig, "heldGaitRollDegrees", "GAIT ROLL", 0, 6, 0.05);
    addNumber(held, bodyRig, "heldGaitPitchDegrees", "GAIT PITCH", 0, 6, 0.05);
    addNumber(held, bodyRig, "heldTurnYawScale", "TURN INERTIA", 0, 0.08, 0.001);
    addNumber(held, bodyRig, "heldIdleSideAmplitude", "IDLE SIDE", 0, 0.01, 0.0001);
    addNumber(held, bodyRig, "heldIdleVerticalAmplitude", "IDLE VERTICAL", 0, 0.01, 0.0001);
    addNumber(held, bodyRig, "heldIdleRollDegrees", "IDLE ROLL", 0, 1, 0.01);
    addNumber(held, bodyRig, "heldIdlePitchDegrees", "IDLE PITCH", 0, 1, 0.01);
    addNumber(held, bodyRig, "heldIdleSwayFrequencyHz", "IDLE SWAY HZ", 0.01, 3, 0.01);
    addNumber(held, bodyRig, "heldIdleTremorTranslation", "TREMOR OFFSET", 0, 0.003, 0.00005);
    addNumber(held, bodyRig, "heldIdleTremorDegrees", "TREMOR ROTATION", 0, 0.5, 0.005);
    addNumber(held, bodyRig, "heldIdleTremorFrequencyHz", "TREMOR HZ", 0.1, 20, 0.1);

    const recovery = propertiesGui.addFolder("STANCE / STEPS / LANDING");
    addNumber(recovery, bodyRig, "walkHeelCompressionImpulse", "WALK HEEL IMPULSE", 0, 0.2, 0.001);
    addNumber(recovery, bodyRig, "runHeelCompressionImpulse", "RUN HEEL IMPULSE", 0, 0.3, 0.001);
    addNumber(recovery, bodyRig, "turnFootCompressionImpulse", "TURN FOOT IMPULSE", 0, 0.1, 0.001);
    addNumber(recovery, bodyRig, "turnWeightImpulse", "TURN WEIGHT IMPULSE", 0, 0.1, 0.001);
    addNumber(recovery, bodyRig, "heelSpringFrequency", "HEEL RECOVERY", 0.1, 20, 0.1);
    addNumber(recovery, bodyRig, "turnWeightFrequency", "TURN RECOVERY", 0.1, 20, 0.1);
    addNumber(recovery, bodyRig, "stanceSpringFrequency", "STANCE RECOVERY", 0.1, 20, 0.1);
    addNumber(recovery, bodyRig, "stepVerticalStabilization", "STEP STABILIZATION", 0, 2, 0.01);
    addNumber(recovery, bodyRig, "verticalRecoveryFrequency", "VERTICAL RECOVERY", 0.1, 20, 0.1);
    addNumber(recovery, bodyRig, "landingImpulseScale", "LANDING SCALE", 0, 0.1, 0.001);
    addNumber(recovery, bodyRig, "landingImpulseLimit", "LANDING LIMIT", 0, 0.5, 0.005);

    const collisionFolder = propertiesGui.addFolder("COLLISION / CAPSULE");
    addNumber(collisionFolder, gameConfig, "collisionRadius", "BODY RADIUS", 0.1, 0.6, 0.01, applyPlayerCollisionSettings);
    addNumber(collisionFolder, gameConfig, "collisionHeight", "BODY HEIGHT", 0.6, 2.2, 0.01, applyPlayerCollisionSettings);
    addNumber(collisionFolder, collision, "stepHeight", "STEP HEIGHT", 0, 0.8, 0.01, applyPlayerCollisionSettings);
    addNumber(collisionFolder, collision, "jumpSpeed", "JUMP SPEED", 0, 8, 0.1, applyPlayerCollisionSettings);
    action(propertiesGui, "SAVE CONFIGS TO PROJECT", saveProject);
  }

  function buildAudioProperties() {
    propertiesGui.title("PROPERTIES — AUDIO");
    const state = getAudioDebugState?.() ?? {};
    const keys = new Set(getSceneSoundKeys?.(activeLevelId) ?? state.soundKeys ?? []);
    addObjectFolder(propertiesGui.addFolder("MIX"), soundMix, applyAudioMix);
    const sounds = propertiesGui.addFolder(`SCENE SOUNDS — ${keys.size}`);
    [...keys].filter((key) => soundRegistry[key]).sort(naturalCompare).forEach((key) => {
      const folder = sounds.addFolder(key);
      ["volume", "refDistance", "maxDistance", "fadeDistance", "fadeSeconds"]
        .forEach((property) => addAutoController(folder, soundRegistry[key], property, applyAudioMix));
    });
  }

  function addObjectFolder(folder, object, onChange, omit = new Set()) {
    Object.entries(object ?? {}).forEach(([key, value]) => {
      if (omit.has(key)) return;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        addObjectFolder(folder.addFolder(labelize(key).toUpperCase()), value, onChange, omit);
      } else addAutoController(folder, object, key, onChange);
    });
  }

  function addAutoController(folder, object, key, onChange) {
    if (!object || object[key] === undefined) return null;
    const value = object[key];
    const label = labelize(key).toUpperCase();
    if (ENUMS[key]) return addSelect(folder, object, key, label, ENUMS[key], onChange);
    if (typeof value === "boolean") return addBoolean(folder, object, key, label, onChange);
    if (typeof value === "number") {
      const [min, max, step] = getAutoNumberRange(key, value);
      return addNumber(folder, object, key, label, min, max, step, onChange);
    }
    if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) return addColor(folder, object, key, label, onChange);
    return null;
  }

  function addNumber(folder, object, key, label, min, max, step, onChange) {
    if (!object || object[key] === undefined) return null;
    return folder.add(object, key, min, max, step).name(label).onChange(() => onChange?.());
  }

  function addBoolean(folder, object, key, label, onChange) {
    if (!object || object[key] === undefined) return null;
    return folder.add(object, key).name(label).onChange(() => onChange?.());
  }

  function addColor(folder, object, key, label, onChange) {
    if (!object || object[key] === undefined) return null;
    return folder.addColor(object, key).name(label).onChange(() => onChange?.());
  }

  function addSelect(folder, object, key, label, options, onChange) {
    if (!object || object[key] === undefined) return null;
    return folder.add(object, key, options).name(label).onChange(() => onChange?.());
  }

  function addVector(folder, label, vector, min, max, step, onChange, keys = ["x", "y", "z"]) {
    if (!vector) return null;
    const vectorFolder = folder.addFolder(label);
    keys.forEach((key) => addNumber(vectorFolder, vector, key, key.replace("_", "").toUpperCase(), min, max, step, onChange));
    return vectorFolder;
  }

  async function saveProject() {
    setStatus("saving project configs", "busy");
    try {
      const payload = createDebugProjectSavePayload({
        environment: getEnvironment(),
        materialConfigs,
        globalLightingConfig,
        decalConfig,
        cameraConfig,
        postProcessingConfig,
      });
      const response = await fetch("/__save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "save failed");
      setStatus(`saved ${result.paths?.length ?? 0} config files`, "ok");
      return result;
    } catch (error) {
      console.error("[Debug workspace] Project save failed", error);
      setStatus(error.message ?? "save failed", "error");
      return null;
    }
  }

  async function savePostProcessingToProject() {
    return saveProject();
  }

  async function copyPostProcessingConfig() {
    return copyJson(postProcessingConfig, "Post FX copied");
  }

  async function copyJson(value, message) {
    await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
    setStatus(message, "ok");
  }

  function setVisible(nextVisible) {
    visible = Boolean(nextVisible);
    [masterGui, propertiesGui].forEach((gui) => visible ? gui?.show() : gui?.hide());
    return visible;
  }

  function setActiveLevel(levelId) {
    if (activeLevelId && selectedId) lastSelectedByLevel.set(activeLevelId, selectedId);
    activeLevelId = levelId;
    selectedId = lastSelectedByLevel.get(levelId) ?? (levelId ? `level:${levelId}:world` : "global:player");
    rebuildMaster();
    rebuildProperties();
  }

  function destroy() {
    masterGui?.destroy();
    propertiesGui?.destroy();
  }

  rebuildMaster();
  rebuildProperties();

  return {
    destroy,
    setVisible,
    isVisible: () => visible,
    setActiveLevel,
    select,
    saveProject,
    savePostProcessingToProject,
    copyPostProcessingConfig,
    refresh: () => {
      rebuildMaster();
      rebuildProperties();
    },
  };

  function matchesFilter(value) {
    return !filter || String(value).toLowerCase().includes(filter);
  }
}

function getPrefabDisplayName(prefab) {
  return prefab.name.includes("__") ? prefab.name.split("__").slice(1).join("__") : prefab.name;
}

function labelize(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
}

function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function getAutoNumberRange(key, value) {
  if (/bias|temperature|tint|barrel|fisheye|brightness/i.test(key)) return [-2, 2, 0.001];
  if (/sample|spp|steps|iterations|maxTextureSize/i.test(key)) return [0, Math.max(64, value * 4), 1];
  if (/threshold|opacity|blend|radius|strength|amount|saturation|contrast|gamma|maxRoughness|scale|intensity/i.test(key)) {
    return [0, Math.max(2, Math.ceil(Math.max(value, 1) * 2)), 0.005];
  }
  if (/distance|thickness|power|length|spacing|kernel/i.test(key)) return [0, Math.max(10, Math.ceil(Math.max(value, 1) * 4)), 0.01];
  return [0, Math.max(10, Math.ceil(Math.max(value, 1) * 4)), 0.01];
}
