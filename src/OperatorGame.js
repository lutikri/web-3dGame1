import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createFusionCoreSimulation } from "./FusionCoreSimulation.js";
import {
  buildShiftReport,
  createShiftRecorder,
  getShiftRecorderDebugState,
  updateShiftRecorder as updateShiftRecorderState,
} from "./game/ShiftReport.js";
import { CONFIG, MATERIAL_COLORS } from "./OperatorGameConfig.js";
import {
  createTextureStreaming,
  getDeferredTexturePaths,
  getInitialTexturePaths,
} from "./scene/TextureStreaming.js";
import { PANEL1_GAUGE_RANGES, PANEL1_LAMP_WARNING_KEYS } from "./panels/Panel1Bindings.js";
import { createStatusScreen } from "./StatusScreen.js";
import { createLoadingOverlay } from "./ui/LoadingOverlay.js";

const canvas = document.querySelector("#scene");
const lockButton = document.querySelector("#lockButton");
const debugOverlay = document.querySelector("#debugOverlay");
const fpsMeter = document.querySelector("#fpsMeter");
const resultsOverlay = document.querySelector("#resultsOverlay");
const resultsOutcome = document.querySelector("#resultsOutcome");
const resultsProfile = document.querySelector("#resultsProfile");
const resultsSummary = document.querySelector("#resultsSummary");
const resultsStats = document.querySelector("#resultsStats");
const controlTooltip = document.createElement("div");
controlTooltip.className = "control-tooltip";
document.body.appendChild(controlTooltip);
const textureLoadingIndicator = document.createElement("div");
textureLoadingIndicator.className = "texture-loading-indicator";
textureLoadingIndicator.hidden = true;
textureLoadingIndicator.innerHTML = `<span class="texture-loading-spinner" aria-hidden="true"></span><span>Loading Textures 0 / 0</span>`;
document.body.appendChild(textureLoadingIndicator);

const loadingOverlay = createLoadingOverlay({
  overlay: document.querySelector("#loadingOverlay"),
  percent: document.querySelector("#loadingPercent"),
  status: document.querySelector("#loadingStatus"),
  shiftTitle: document.querySelector("#loadingShiftTitle"),
  barFill: document.querySelector("#loadingBarFill"),
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.world.backgroundColor);
scene.fog = new THREE.Fog(CONFIG.world.fogColor, CONFIG.world.fogNear, CONFIG.world.fogFar);

const playerSpawnPosition = CONFIG.player?.spawnPosition ?? new THREE.Vector3(0, CONFIG.playerEyeHeight, 4.8);
const playerFloorHeight = playerSpawnPosition.y ?? CONFIG.playerEyeHeight;
const playerPosition = playerSpawnPosition.clone();
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fovDegrees, window.innerWidth / window.innerHeight, 0.05, 80);
camera.position.copy(playerSpawnPosition);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = CONFIG.shadows.type;

const textureStreaming = createTextureStreaming({
  renderer,
  transcoderPath: "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/libs/basis/",
  onProgress: () => setLoadingProgress(18),
  onWarning: () => setLoadingStatus("TEXTURE MAP WARNING"),
});
const emptyMaskTexture = createSolidTexture(0, 0, 0, 255);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const worldUp = new THREE.Vector3(0, 1, 0);
const keys = new Set();
const interactive = [];
const lamps = [];
const needles = [];
const gaugeNeedles = new Map();
const controlKnobs = [];
const controlButtons = [];
const roomLightButtons = [];
const controlledLights = [];
const pointLightsByKey = new Map();
const interiorFans = [];
const statusScreen = createStatusScreen();
const fusionCore = createFusionCoreSimulation();

let panelModel = null;
let interiorModel = null;
let yaw = THREE.MathUtils.degToRad(CONFIG.player?.spawnYawDegrees ?? 0);
let pitch = THREE.MathUtils.degToRad(CONFIG.player?.spawnPitchDegrees ?? 0);
let testTime = 0;
let noclipEnabled = Boolean(CONFIG.camera.noclip?.enabled);
let noclipSpeed = CONFIG.camera.noclip?.speed ?? CONFIG.camera.walkSpeed;
let movementVelocity = new THREE.Vector3();
let headBobTime = 0;
let leanAmount = 0;
let freezeNeedles = false;
let composer = null;
let gtaoPass = null;
let ssrPass = null;
let ssrPassClass = null;
let ssrModulesPromise = null;
let postProcessingRevision = 0;
let bloomPass = null;
let chromaticAberrationPass = null;
let realismComposer = null;
let realismVelocityDepthNormalPass = null;
let realismSsgiEffect = null;
let realismScreenSpaceShadowEffect = null;
let realismBloomEffect = null;
let realismChromaticAberrationEffect = null;
let realismModulesPromise = null;
let realismPostProcessingRevision = 0;
let fpsFrameCount = 0;
let fpsElapsed = 0;
let currentFps = 0;
let frameTimeMs = 0;
let hoveredInteractive = null;
let hoveredKnob = null;
let hoveredTooltipTarget = null;
let forcedHoveredTarget = null;
let startupFeedbackTimer = 0;
let indicatorTestTimer = 0;
let latestSnapshot = fusionCore.getSnapshot();
let zoomActive = false;
let baseFovDegrees = CONFIG.camera.fovDegrees;
let shadowQuality = CONFIG.shadows.defaultQuality ?? "min";
let gtaoQuality = CONFIG.postProcessing.gtao.defaultQuality ?? "off";
let ssgiQuality = CONFIG.postProcessing.ssgi.defaultQuality ?? "off";
let ssrQuality = CONFIG.postProcessing.ssr.defaultQuality ?? "off";
let screenSpaceShadowQuality = CONFIG.postProcessing.screenSpaceShadows.defaultQuality ?? "off";
let loadingComplete = Boolean(CONFIG.loading?.skip);
let shiftRecorder = createShiftRecorder();
let previousGameMode = latestSnapshot.mode;
let resultsTimer = 0;
let resultsSnapshot = null;
let resultsVisible = false;
let activeLevelId = "intro-shift";
let activeLevelMode = "tutorial";
let roomLightsEnabled = CONFIG.interior.lightToggleButton?.initialOn ?? true;
let roomLightCurrentFactor = roomLightsEnabled ? 1 : 0;
let roomLightSwitchTimer = 0;
let roomLightSwitchMode = "off";
let roomLightBootTimer = 0;
const runtimeTextureLoading = {
  total: 0,
  completed: 0,
  active: 0,
  hideTimer: 0,
};

const interiorCustomTextureMaps = {};
const interiorCustomTextureMapPromises = loadInteriorCustomMaterialTextures();
let panelTextureMaps = null;
const panelTextureMapPromise = createPanelTextureMaps();
const chromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;

    void main() {
      vec2 offset = (vUv - 0.5) * amount;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

const materials = {
  panel: createPanelPbrMaterial("Panel1_PBR"),
  interiorCustom: createInteriorCustomMaterials(),
  interior: new THREE.MeshStandardMaterial({
    name: "Interior1_Material",
    color: CONFIG.interior.material?.color ?? "#3f4a43",
    roughness: CONFIG.interior.material?.roughness ?? 0.82,
    metalness: CONFIG.interior.material?.metalness ?? 0.08,
  }),
  wall: new THREE.MeshStandardMaterial({ color: MATERIAL_COLORS.wall, roughness: 0.72, metalness: 0.08 }),
  floor: new THREE.MeshStandardMaterial({ color: MATERIAL_COLORS.floor, roughness: 0.9, metalness: 0.04 }),
  trim: new THREE.MeshStandardMaterial({ color: MATERIAL_COLORS.trim, roughness: 0.42, metalness: 0.35 }),
  lampOff: new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS.lampOff,
    emissive: MATERIAL_COLORS.lampOffEmissive,
    roughness: 0.28,
  }),
  lampAmber: new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS.lampAmber,
    emissive: MATERIAL_COLORS.lampAmberEmissive,
    emissiveIntensity: 2.8,
    roughness: 0.2,
  }),
  lampGreen: new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS.lampGreen,
    emissive: MATERIAL_COLORS.lampGreenEmissive,
    emissiveIntensity: 2.5,
    roughness: 0.2,
  }),
  lampRed: new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS.lampRed,
    emissive: MATERIAL_COLORS.lampRedEmissive,
    emissiveIntensity: 3.6,
    roughness: 0.2,
  }),
};

Promise.all(interiorCustomTextureMapPromises)
  .then((entries) => {
    entries.forEach(([key, textureMaps, deferredPaths]) => {
      interiorCustomTextureMaps[key] = textureMaps;
      applyTextureMapsToMaterial(materials.interiorCustom[key], textureMaps, CONFIG.interior.specialMaterials?.[key]);
      materials.interiorCustom[key].userData.textureTier = deferredPaths ? "preview" : "full";
      if (deferredPaths) queueDeferredTextureLoad(key, deferredPaths);
    });
    Object.entries(materials.interiorCustom).forEach(([key, material]) => {
      const config = CONFIG.interior.specialMaterials?.[key];
      if (config?.roomLightControlled && !material.userData.fixtureFlicker) {
        material.userData.fixtureFlicker = createFixtureFlickerState();
      }
    });
    updateRoomLightMaterials();
  })
  .catch((error) => {
    console.error("[OperatorGame] Failed to load custom interior texture maps", error);
  });

panelTextureMapPromise
  .then((textureMaps) => {
    panelTextureMaps = textureMaps;
    applyPanelTextureMapsToMaterial(materials.panel, textureMaps);
    materials.panel.userData.textureTier = getDeferredTexturePaths(CONFIG.panel.maps) ? "preview" : "full";
    console.log("[OperatorGame] Loaded Panel1 PBR texture maps");
  })
  .catch((error) => {
    setLoadingStatus("PANEL TEXTURE WARNING");
    console.error("[OperatorGame] Failed to load Panel1 texture maps", error);
  });

const GAUGE_RANGES = PANEL1_GAUGE_RANGES;
const LAMP_WARNING_KEYS = PANEL1_LAMP_WARNING_KEYS;

async function createPanelTextureMaps() {
  const initialPaths = getInitialTexturePaths(CONFIG.panel.maps);
  const textureMaps = await loadInteriorTextureMaps(initialPaths);
  const deferredPaths = getDeferredTexturePaths(CONFIG.panel.maps);
  if (deferredPaths) queueDeferredPanelTextureLoad(deferredPaths);
  return textureMaps;
}

function loadInteriorCustomMaterialTextures() {
  return Object.entries(CONFIG.interior.specialMaterials ?? {}).map(async ([key, config]) => [
    key,
    await loadInteriorTextureMaps(getInitialTexturePaths(config.maps)),
    getDeferredTexturePaths(config.maps),
  ]);
}

function queueDeferredTextureLoad(key, paths) {
  const loadFullTextureMaps = async () => {
    try {
      const fullTextureMaps = await loadInteriorTextureMaps(paths, { trackRuntimeTextures: true });
      const previousTextureMaps = interiorCustomTextureMaps[key];
      interiorCustomTextureMaps[key] = fullTextureMaps;
      applyTextureMapsToMaterial(materials.interiorCustom[key], fullTextureMaps, CONFIG.interior.specialMaterials?.[key]);
      materials.interiorCustom[key].userData.textureTier = "full";
      textureStreaming.disposeTextureMaps(previousTextureMaps);
      console.log(`[OperatorGame] Upgraded ${key} textures to full resolution`);
    } catch (error) {
      console.warn(`[OperatorGame] Failed to upgrade ${key} textures`, error);
    }
  };

  const waitForSceneThenLoad = () => {
    if (!loadingComplete) {
      window.setTimeout(waitForSceneThenLoad, 250);
      return;
    }

    const delayMs = (CONFIG.textureStreaming?.fullLoadDelaySeconds ?? 4) * 1000;
    window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(loadFullTextureMaps, { timeout: 3000 });
      } else {
        loadFullTextureMaps();
      }
    }, delayMs);
  };

  waitForSceneThenLoad();
}

function queueDeferredPanelTextureLoad(paths) {
  const loadFullTextureMaps = async () => {
    try {
      const fullTextureMaps = await loadInteriorTextureMaps(paths, { trackRuntimeTextures: true });
      const previousTextureMaps = panelTextureMaps;
      panelTextureMaps = fullTextureMaps;
      applyPanelTextureMapsToMaterial(materials.panel, fullTextureMaps);
      materials.panel.userData.textureTier = "full";
      textureStreaming.disposeTextureMaps(previousTextureMaps);
      console.log("[OperatorGame] Upgraded Panel1 textures to full resolution");
    } catch (error) {
      console.warn("[OperatorGame] Failed to upgrade Panel1 textures", error);
    }
  };

  const waitForSceneThenLoad = () => {
    if (!loadingComplete) {
      window.setTimeout(waitForSceneThenLoad, 250);
      return;
    }

    const delayMs = (CONFIG.textureStreaming?.fullLoadDelaySeconds ?? 4) * 1000;
    window.setTimeout(() => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(loadFullTextureMaps, { timeout: 3000 });
      } else {
        loadFullTextureMaps();
      }
    }, delayMs);
  };

  waitForSceneThenLoad();
}

async function loadInteriorTextureMaps(paths, options = {}) {
  return textureStreaming.loadTextureMaps(paths, getTextureLoadTrackingOptions(options));
}

function getTextureLoadTrackingOptions(options = {}) {
  if (!options.trackRuntimeTextures) return {};
  return {
    onTextureStart: registerRuntimeTextureStart,
    onTextureComplete: registerRuntimeTextureComplete,
  };
}

function registerRuntimeTextureStart() {
  if (!loadingComplete) return;
  if (runtimeTextureLoading.active === 0 && runtimeTextureLoading.hideTimer <= 0) {
    runtimeTextureLoading.total = 0;
    runtimeTextureLoading.completed = 0;
  }
  runtimeTextureLoading.total += 1;
  runtimeTextureLoading.active += 1;
  runtimeTextureLoading.hideTimer = 0;
  updateTextureLoadingIndicator();
}

function registerRuntimeTextureComplete() {
  if (!loadingComplete) return;
  runtimeTextureLoading.completed = Math.min(runtimeTextureLoading.completed + 1, runtimeTextureLoading.total);
  runtimeTextureLoading.active = Math.max(0, runtimeTextureLoading.active - 1);
  if (runtimeTextureLoading.active === 0) runtimeTextureLoading.hideTimer = 1.6;
  updateTextureLoadingIndicator();
}

function updateRuntimeTextureLoading(dt) {
  if (runtimeTextureLoading.active > 0) {
    updateTextureLoadingIndicator();
    return;
  }
  if (runtimeTextureLoading.hideTimer <= 0) return;
  runtimeTextureLoading.hideTimer = Math.max(0, runtimeTextureLoading.hideTimer - dt);
  if (runtimeTextureLoading.hideTimer <= 0) updateTextureLoadingIndicator();
}

function updateTextureLoadingIndicator() {
  if (!textureLoadingIndicator) return;
  const shouldShow =
    loadingComplete &&
    runtimeTextureLoading.total > 0 &&
    (runtimeTextureLoading.active > 0 || runtimeTextureLoading.hideTimer > 0);
  textureLoadingIndicator.hidden = !shouldShow;
  textureLoadingIndicator.classList.toggle("is-active", shouldShow);
  const label = textureLoadingIndicator.querySelector("span:last-child");
  if (label) {
    label.textContent = `Loading Textures ${runtimeTextureLoading.completed} / ${runtimeTextureLoading.total}`;
  }
}

function createPanelPbrMaterial(name, overrides = {}) {
  const material = new THREE.MeshStandardMaterial({
    name,
    color: CONFIG.panel.placeholderColor ?? "#365247",
    roughness: 1,
    metalness: 1,
    aoMapIntensity: 1,
    ...overrides,
  });
  if (panelTextureMaps) applyPanelTextureMapsToMaterial(material, panelTextureMaps);
  return material;
}

function applyPanelTextureMapsToMaterial(material, textureMaps) {
  if (!material || !textureMaps) return;
  material.color.set("#ffffff");
  material.map = textureMaps.map;
  material.normalMap = textureMaps.normalMap;
  material.aoMap = textureMaps.ormMap;
  material.roughnessMap = textureMaps.ormMap;
  material.metalnessMap = textureMaps.ormMap;
  material.needsUpdate = true;
}

function createInteriorCustomMaterials() {
  return Object.fromEntries(
    Object.entries(CONFIG.interior.specialMaterials ?? {}).map(([key, config]) => [
      key,
      createInteriorCustomMaterial(key, config),
    ]),
  );
}

function createInteriorCustomMaterial(key, config) {
  const material = new THREE.MeshStandardMaterial({
    name: config.name ?? `${key}_PBR_Emissive`,
    normalScale: new THREE.Vector2(config.normalScale ?? 1, config.normalScale ?? 1),
    color: config.color ?? "#ffffff",
    roughness: config.roughness ?? 1,
    metalness: config.metalness ?? 1,
    aoMapIntensity: config.aoMapIntensity ?? 1,
    emissive: config.emissive ?? "#fff2b0",
    emissiveIntensity: config.emissiveIntensity ?? 1.35,
  });
  material.userData.baseEmissiveIntensity = material.emissiveIntensity;
  material.userData.roomLightControlled = Boolean(config.roomLightControlled);
  if (config.maskOverlay) setupMaskOverlayMaterial(material, config);
  return material;
}

function applyTextureMapsToMaterial(material, textureMaps, config = {}) {
  if (!material || !textureMaps) return;

  material.map = textureMaps.map ?? null;
  material.normalMap = textureMaps.normalMap ?? null;
  material.aoMap = textureMaps.ormMap ?? null;
  material.roughnessMap = textureMaps.ormMap ?? null;
  material.metalnessMap = textureMaps.ormMap ?? null;
  material.emissiveMap = textureMaps.emissiveMap ?? null;
  material.userData.maskMap = textureMaps.maskMap ?? null;
  applyTextureRepeat(textureMaps, config.textureRepeat);
  applyMaskTextureSettings(textureMaps.maskMap);
  updateMaskOverlayUniforms(material, config);
  material.needsUpdate = true;
}

function applyTextureRepeat(textureMaps, repeatConfig) {
  const repeat =
    Array.isArray(repeatConfig) || typeof repeatConfig === "object"
      ? {
          x: Number(repeatConfig.x ?? repeatConfig[0] ?? 1),
          y: Number(repeatConfig.y ?? repeatConfig[1] ?? repeatConfig.x ?? repeatConfig[0] ?? 1),
        }
      : { x: Number(repeatConfig ?? 1), y: Number(repeatConfig ?? 1) };

  [textureMaps.map, textureMaps.normalMap, textureMaps.ormMap, textureMaps.emissiveMap].forEach((texture) => {
    if (!texture) return;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat.x, repeat.y);
    texture.needsUpdate = true;
  });
}

function applyMaskTextureSettings(texture) {
  if (!texture) return;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.needsUpdate = true;
}

function setupMaskOverlayMaterial(material, config) {
  const uniforms = createMaskOverlayUniforms(config);
  material.userData.maskOverlayUniforms = uniforms;
  material.customProgramCacheKey = () => `${material.name}:mask-overlay`;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <uv_pars_vertex>",
        `#include <uv_pars_vertex>
varying vec2 interiorMaskUv;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
interiorMaskUv = uv;`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_pars_fragment>",
      `#include <map_pars_fragment>
uniform sampler2D interiorMaskMap;
uniform vec3 interiorMaskColorR;
uniform vec3 interiorMaskColorG;
uniform vec3 interiorMaskColorB;
uniform float interiorMaskOpacityR;
uniform float interiorMaskOpacityG;
uniform float interiorMaskOpacityB;
uniform vec3 interiorMaskThreshold;
uniform vec3 interiorMaskSoftness;
uniform vec3 interiorMaskBlendMode;
uniform float interiorMaskDebugView;
varying vec2 interiorMaskUv;
float getInteriorMaskChannel(float channel, float threshold, float softness) {
  return smoothstep(threshold, threshold + max(softness, 0.001), channel);
}
vec3 getInteriorOverlayBlend(vec3 baseColor, vec3 overlayColor) {
  return mix(
    2.0 * baseColor * overlayColor,
    1.0 - 2.0 * (1.0 - baseColor) * (1.0 - overlayColor),
    step(0.5, baseColor)
  );
}
vec3 applyInteriorMaskBlend(vec3 baseColor, vec3 overlayColor, float strength, float blendMode) {
  vec3 mixColor = mix(baseColor, overlayColor, strength);
  vec3 multiplyColor = mix(baseColor, baseColor * overlayColor, strength);
  vec3 overlayBlendColor = mix(baseColor, getInteriorOverlayBlend(baseColor, overlayColor), strength);
  vec3 mixOrMultiply = mix(mixColor, multiplyColor, step(0.5, blendMode));
  return mix(mixOrMultiply, overlayBlendColor, step(1.5, blendMode));
}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
  vec3 interiorMaskSample = texture2D(interiorMaskMap, interiorMaskUv).rgb;
  if (interiorMaskDebugView > 0.5) {
    diffuseColor.rgb = interiorMaskSample;
  } else {
  float interiorMaskR = getInteriorMaskChannel(interiorMaskSample.r, interiorMaskThreshold.r, interiorMaskSoftness.r);
  float interiorMaskG = getInteriorMaskChannel(interiorMaskSample.g, interiorMaskThreshold.g, interiorMaskSoftness.g);
  float interiorMaskB = getInteriorMaskChannel(interiorMaskSample.b, interiorMaskThreshold.b, interiorMaskSoftness.b);
  diffuseColor.rgb = applyInteriorMaskBlend(diffuseColor.rgb, interiorMaskColorR, clamp(interiorMaskR * interiorMaskOpacityR, 0.0, 1.0), interiorMaskBlendMode.r);
  diffuseColor.rgb = applyInteriorMaskBlend(diffuseColor.rgb, interiorMaskColorG, clamp(interiorMaskG * interiorMaskOpacityG, 0.0, 1.0), interiorMaskBlendMode.g);
  diffuseColor.rgb = applyInteriorMaskBlend(diffuseColor.rgb, interiorMaskColorB, clamp(interiorMaskB * interiorMaskOpacityB, 0.0, 1.0), interiorMaskBlendMode.b);
  }`,
    );
  };
}

function createMaskOverlayUniforms(config) {
  const overlay = config.maskOverlay ?? {};
  return {
    interiorMaskMap: { value: emptyMaskTexture },
    interiorMaskColorR: { value: new THREE.Color(overlay.red?.color ?? "#ffffff") },
    interiorMaskColorG: { value: new THREE.Color(overlay.green?.color ?? "#ffffff") },
    interiorMaskColorB: { value: new THREE.Color(overlay.blue?.color ?? "#ffffff") },
    interiorMaskOpacityR: { value: getMaskChannelStrength(overlay.red) },
    interiorMaskOpacityG: { value: getMaskChannelStrength(overlay.green) },
    interiorMaskOpacityB: { value: getMaskChannelStrength(overlay.blue) },
    interiorMaskThreshold: { value: getMaskChannelVector(overlay, "threshold", 0.45) },
    interiorMaskSoftness: { value: getMaskChannelVector(overlay, "softness", 0.08) },
    interiorMaskBlendMode: { value: getMaskBlendModeVector(overlay) },
    interiorMaskDebugView: { value: overlay.debugView ? 1 : 0 },
  };
}

function updateMaskOverlayUniforms(material, config = {}) {
  const uniforms = material.userData.maskOverlayUniforms;
  if (!uniforms) return;
  const overlay = config.maskOverlay ?? {};
  uniforms.interiorMaskMap.value = material.userData.maskMap ?? emptyMaskTexture;
  uniforms.interiorMaskColorR.value.set(overlay.red?.color ?? "#ffffff");
  uniforms.interiorMaskColorG.value.set(overlay.green?.color ?? "#ffffff");
  uniforms.interiorMaskColorB.value.set(overlay.blue?.color ?? "#ffffff");
  uniforms.interiorMaskOpacityR.value = getMaskChannelStrength(overlay.red);
  uniforms.interiorMaskOpacityG.value = getMaskChannelStrength(overlay.green);
  uniforms.interiorMaskOpacityB.value = getMaskChannelStrength(overlay.blue);
  uniforms.interiorMaskThreshold.value.copy(getMaskChannelVector(overlay, "threshold", 0.45));
  uniforms.interiorMaskSoftness.value.copy(getMaskChannelVector(overlay, "softness", 0.08));
  uniforms.interiorMaskBlendMode.value.copy(getMaskBlendModeVector(overlay));
  uniforms.interiorMaskDebugView.value = overlay.debugView ? 1 : 0;
  material.needsUpdate = true;
}

function setInteriorMaskDebug(materialKey, enabled) {
  const config = CONFIG.interior.specialMaterials?.[materialKey];
  const material = materials.interiorCustom?.[materialKey];
  if (!config?.maskOverlay || !material) return false;
  config.maskOverlay.debugView = Boolean(enabled);
  updateMaskOverlayUniforms(material, config);
  return config.maskOverlay.debugView;
}

function getMaskChannelStrength(channel = {}) {
  return Number(channel.opacity ?? 0) * Number(channel.intensity ?? 1);
}

function getMaskChannelVector(overlay, property, fallback) {
  return new THREE.Vector3(
    Number(overlay.red?.[property] ?? fallback),
    Number(overlay.green?.[property] ?? fallback),
    Number(overlay.blue?.[property] ?? fallback),
  );
}

function getMaskBlendModeVector(overlay) {
  return new THREE.Vector3(
    getMaskBlendModeValue(overlay.red?.blend),
    getMaskBlendModeValue(overlay.green?.blend),
    getMaskBlendModeValue(overlay.blue?.blend),
  );
}

function getMaskBlendModeValue(mode = "mix") {
  if (mode === "multiply") return 1;
  if (mode === "overlay") return 2;
  return 0;
}

function createSolidTexture(r, g, b, a = 255) {
  const texture = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

init();

function init() {
  if (CONFIG.loading?.skip) skipLoadingOverlay();
  renderer.shadowMap.enabled = getShadowPreset(shadowQuality).enabled;
  setupLights();
  setupLightFixtures();
  buildRoom();
  setupPostProcessing();
  loadInteriorModel();
  loadPanelModel();
  if (CONFIG.loading?.skip) triggerRoomLightBoot();
  animate();
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(
    CONFIG.lighting.ambientSky,
    CONFIG.lighting.ambientGround,
    CONFIG.lighting.ambientIntensity,
  );
  hemi.userData.baseIntensity = hemi.intensity;
  controlledLights.push(hemi);
  scene.add(hemi);

  for (const [name, lightConfig] of Object.entries(CONFIG.lighting.pointLights)) {
    const light = new THREE.PointLight(
      lightConfig.color,
      lightConfig.intensity,
      lightConfig.distance,
      lightConfig.decay,
    );
    light.name = `PointLight_${name}`;
    light.position.copy(lightConfig.position);
    light.userData.baseIntensity = light.intensity;
    light.userData.lightKey = name;
    light.userData.roomLightControlled = Boolean(lightConfig.roomLightControlled);
    if (light.userData.roomLightControlled) light.userData.fixtureFlicker = createFixtureFlickerState();
    pointLightsByKey.set(name, light);
    controlledLights.push(light);
    applyShadowSettings(light, lightConfig);
    scene.add(light);
  }
}

function setupLightFixtures() {
  Object.entries(CONFIG.lighting.fixtures ?? {}).forEach(([fixtureName, fixtureConfig]) => {
    const fixtureState = createFixtureFlickerState();
    const fixtureTargets = [
      ...(fixtureConfig.lightNames ?? []).map((lightName) => pointLightsByKey.get(lightName)),
      ...(fixtureConfig.materialKeys ?? []).map((materialKey) => materials.interiorCustom[materialKey]),
    ].filter(Boolean);

    fixtureTargets.forEach((target) => {
      target.userData.fixtureName = fixtureName;
      target.userData.fixtureFlicker = fixtureState;
      target.userData.roomLightControlled = true;
    });
  });
}

function applyShadowSettings(light, lightConfig) {
  const shadowPreset = getShadowPreset(shadowQuality);
  light.castShadow = shadowPreset.enabled && Boolean(lightConfig.castShadow);
  if (!light.castShadow) return;

  const mapSize = shadowPreset.mapSize ?? lightConfig.shadowMapSize ?? 512;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = lightConfig.shadowBias ?? -0.0005;
  light.shadow.normalBias = lightConfig.shadowNormalBias ?? 0.03;
  light.shadow.camera.near = lightConfig.shadowNear ?? 0.1;
  light.shadow.camera.far = lightConfig.shadowFar ?? lightConfig.distance ?? 10;
}

function setupPostProcessing() {
  if (!CONFIG.postProcessing.enabled) return;

  const revision = ++postProcessingRevision;
  ssrPass?.dispose?.();
  composer?.dispose?.();
  gtaoPass = null;
  ssrPass = null;
  bloomPass = null;
  chromaticAberrationPass = null;
  composer = new EffectComposer(renderer);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));

  const gtaoConfig = getGtaoPreset(gtaoQuality);
  if (gtaoConfig.enabled) {
    gtaoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
    gtaoPass.output = GTAOPass.OUTPUT.Default;
    applyGtaoPresetToPass(gtaoPass, gtaoConfig);
    composer.addPass(gtaoPass);
  }

  const ssrConfig = getSsrPreset(ssrQuality);
  if (ssrConfig.enabled) {
    if (ssrPassClass) {
      ssrPass = new ssrPassClass({
        renderer,
        scene,
        camera,
        width: Math.max(1, Math.round(window.innerWidth * (ssrConfig.resolutionScale ?? 1))),
        height: Math.max(1, Math.round(window.innerHeight * (ssrConfig.resolutionScale ?? 1))),
      });
      applySsrPresetToPass(ssrPass, ssrConfig);
      composer.addPass(ssrPass);
    } else {
      loadSsrPassClass()
        .then(() => {
          if (revision === postProcessingRevision && getSsrPreset(ssrQuality).enabled) setupPostProcessing();
        })
        .catch((error) => {
          console.warn("[OperatorGame] Failed to load SSRPass", error);
        });
    }
  }

  if (CONFIG.postProcessing.bloom.enabled) {
    const bloomConfig = CONFIG.postProcessing.bloom;
    bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      bloomConfig.strength,
      bloomConfig.radius,
      bloomConfig.threshold,
    );
    composer.addPass(bloomPass);
  }

  if (CONFIG.postProcessing.chromaticAberration.enabled) {
    chromaticAberrationPass = new ShaderPass(chromaticAberrationShader);
    chromaticAberrationPass.uniforms.amount.value = CONFIG.postProcessing.chromaticAberration.amount;
    composer.addPass(chromaticAberrationPass);
  }

  composer.addPass(new OutputPass());
  setupRealismPostProcessing();
}

function getShadowPreset(quality = shadowQuality) {
  return CONFIG.shadows.presets?.[quality] ?? CONFIG.shadows.presets?.min ?? { enabled: true, mapSize: 512 };
}

function getGtaoPreset(quality = gtaoQuality) {
  return CONFIG.postProcessing.gtao.presets?.[quality] ?? CONFIG.postProcessing.gtao.presets?.off ?? { enabled: false };
}

function getSsgiPreset(quality = ssgiQuality) {
  return CONFIG.postProcessing.ssgi.presets?.[quality] ?? CONFIG.postProcessing.ssgi.presets?.off ?? { enabled: false };
}

function getSsrPreset(quality = ssrQuality) {
  return CONFIG.postProcessing.ssr.presets?.[quality] ?? CONFIG.postProcessing.ssr.presets?.off ?? { enabled: false };
}

function getScreenSpaceShadowPreset(quality = screenSpaceShadowQuality) {
  return (
    CONFIG.postProcessing.screenSpaceShadows.presets?.[quality] ??
    CONFIG.postProcessing.screenSpaceShadows.presets?.off ?? { enabled: false }
  );
}

function applyGtaoPresetToPass(pass, gtaoConfig) {
  pass.blendIntensity = gtaoConfig.blendIntensity ?? 0;
  pass.updateGtaoMaterial({
    radius: gtaoConfig.radius ?? 0.35,
    distanceExponent: gtaoConfig.distanceExponent ?? 1.6,
    thickness: gtaoConfig.thickness ?? 0.75,
    distanceFallOff: gtaoConfig.distanceFallOff ?? 1,
    scale: gtaoConfig.scale ?? 1.5,
    samples: gtaoConfig.samples ?? 8,
  });
  pass.updatePdMaterial({
    radius: gtaoConfig.denoiseRadius ?? 2,
    samples: gtaoConfig.denoiseSamples ?? 4,
  });
}

async function loadSsrPassClass() {
  if (ssrPassClass) return ssrPassClass;
  ssrModulesPromise ??= import("three/addons/postprocessing/SSRPass.js").then(({ SSRPass }) => SSRPass);
  ssrPassClass = await ssrModulesPromise;
  return ssrPassClass;
}

function applySsrPresetToPass(pass, ssrConfig) {
  pass.opacity = ssrConfig.opacity ?? 0.35;
  pass.maxDistance = ssrConfig.maxDistance ?? 1.5;
  pass.thickness = ssrConfig.thickness ?? 0.025;
  pass.blur = ssrConfig.blur ?? true;
  pass.bouncing = ssrConfig.bouncing ?? false;
  pass.distanceAttenuation = ssrConfig.distanceAttenuation ?? true;
  pass.fresnel = ssrConfig.fresnel ?? true;
  pass.infiniteThick = ssrConfig.infiniteThick ?? false;
}

function setShadowQuality(quality = "min") {
  const presetKey = CONFIG.shadows.presets?.[quality] ? quality : CONFIG.shadows.defaultQuality ?? "min";
  const preset = getShadowPreset(presetKey);
  if (shadowQuality === presetKey && renderer.shadowMap.enabled === Boolean(preset.enabled)) return shadowQuality;
  shadowQuality = presetKey;
  renderer.shadowMap.enabled = Boolean(preset.enabled);
  renderer.shadowMap.type = CONFIG.shadows.type;

  pointLightsByKey.forEach((light) => {
    const lightKey = light.userData.lightKey;
    const lightConfig = CONFIG.lighting.pointLights?.[lightKey] ?? {};
    light.shadow?.map?.dispose?.();
    if (light.shadow) light.shadow.map = null;
    applyShadowSettings(light, lightConfig);
  });

  return shadowQuality;
}

function setGtaoQuality(quality = "off") {
  const presetKey = CONFIG.postProcessing.gtao.presets?.[quality] ? quality : CONFIG.postProcessing.gtao.defaultQuality ?? "off";
  const preset = getGtaoPreset(presetKey);
  if (gtaoQuality === presetKey && Boolean(gtaoPass) === Boolean(preset.enabled)) return gtaoQuality;
  gtaoQuality = presetKey;
  setupPostProcessing();
  return gtaoQuality;
}

function setSsgiQuality(quality = "off") {
  const presetKey = CONFIG.postProcessing.ssgi.presets?.[quality] ? quality : CONFIG.postProcessing.ssgi.defaultQuality ?? "off";
  const preset = getSsgiPreset(presetKey);
  if (ssgiQuality === presetKey && Boolean(realismSsgiEffect) === Boolean(preset.enabled)) return ssgiQuality;
  ssgiQuality = presetKey;
  setupRealismPostProcessing();
  return ssgiQuality;
}

function setSsrQuality(quality = "off") {
  const presetKey = CONFIG.postProcessing.ssr.presets?.[quality] ? quality : CONFIG.postProcessing.ssr.defaultQuality ?? "off";
  const preset = getSsrPreset(presetKey);
  if (ssrQuality === presetKey && Boolean(ssrPass) === Boolean(preset.enabled)) return ssrQuality;
  ssrQuality = presetKey;
  setupPostProcessing();
  return ssrQuality;
}

function setScreenSpaceShadowQuality(quality = "off") {
  const presetKey = CONFIG.postProcessing.screenSpaceShadows.presets?.[quality]
    ? quality
    : CONFIG.postProcessing.screenSpaceShadows.defaultQuality ?? "off";
  const preset = getScreenSpaceShadowPreset(presetKey);
  if (screenSpaceShadowQuality === presetKey && Boolean(realismScreenSpaceShadowEffect) === Boolean(preset.enabled)) {
    return screenSpaceShadowQuality;
  }
  screenSpaceShadowQuality = presetKey;
  setupRealismPostProcessing();
  return screenSpaceShadowQuality;
}

function isRealismPostProcessingEnabled() {
  return Boolean(getSsgiPreset().enabled || getScreenSpaceShadowPreset().enabled);
}

async function loadRealismModules() {
  realismModulesPromise ??= Promise.all([import("postprocessing"), import("realism-effects")]).then(
    ([postprocessing, realismEffects]) => ({ postprocessing, realismEffects }),
  );
  return realismModulesPromise;
}

async function setupRealismPostProcessing() {
  const revision = ++realismPostProcessingRevision;
  if (!CONFIG.postProcessing.enabled || !isRealismPostProcessingEnabled()) {
    disposeRealismPostProcessing();
    return;
  }

  try {
    const modules = await loadRealismModules();
    if (revision !== realismPostProcessingRevision || !isRealismPostProcessingEnabled()) return;
    buildRealismPostProcessing(modules);
  } catch (error) {
    console.warn("[OperatorGame] Failed to load experimental realism effects", error);
    disposeRealismPostProcessing();
  }
}

function buildRealismPostProcessing({ postprocessing, realismEffects }) {
  disposeRealismPostProcessing();

  const {
    EffectComposer: RealismComposer,
    EffectPass,
    RenderPass: RealismRenderPass,
    BloomEffect,
    ChromaticAberrationEffect,
    BlendFunction,
  } = postprocessing;
  const { SSGIEffect, HBAOEffect, VelocityDepthNormalPass } = realismEffects;
  const ssgiPreset = getSsgiPreset();
  const screenSpaceShadowPreset = getScreenSpaceShadowPreset();
  const effects = [];

  realismComposer = new RealismComposer(renderer, { depthBuffer: true });
  realismComposer.setSize(window.innerWidth, window.innerHeight);
  realismVelocityDepthNormalPass = new VelocityDepthNormalPass(scene, camera);
  realismComposer.addPass(realismVelocityDepthNormalPass);

  // Keep the ordinary lit scene as the source buffer so SSGI adds indirect light
  // instead of replacing direct point/ambient lighting with only screen-space hits.
  realismComposer.addPass(new RealismRenderPass(scene, camera));

  if (ssgiPreset.enabled) {
    realismSsgiEffect = new SSGIEffect(scene, camera, realismVelocityDepthNormalPass, {
      width: window.innerWidth,
      height: window.innerHeight,
      ...ssgiPreset,
    });
    effects.push(realismSsgiEffect);
  }

  if (screenSpaceShadowPreset.enabled) {
    realismScreenSpaceShadowEffect = new HBAOEffect(realismComposer, camera, scene, {
      ...screenSpaceShadowPreset,
      velocityDepthNormalPass: realismVelocityDepthNormalPass,
      normalTexture: realismVelocityDepthNormalPass.texture,
    });
    effects.push(realismScreenSpaceShadowEffect);
  }

  if (CONFIG.postProcessing.bloom.enabled) {
    const bloomConfig = CONFIG.postProcessing.bloom;
    realismBloomEffect = new BloomEffect({
      blendFunction: BlendFunction.SCREEN,
      luminanceThreshold: bloomConfig.threshold,
      intensity: bloomConfig.strength,
      radius: bloomConfig.radius,
    });
    effects.push(realismBloomEffect);
  }

  if (CONFIG.postProcessing.chromaticAberration.enabled) {
    realismChromaticAberrationEffect = new ChromaticAberrationEffect({
      offset: new THREE.Vector2(CONFIG.postProcessing.chromaticAberration.amount),
      radialModulation: true,
      modulationOffset: 0.18,
    });
    effects.push(realismChromaticAberrationEffect);
  }

  if (effects.length > 0) realismComposer.addPass(new EffectPass(camera, ...effects));
}

function disposeRealismPostProcessing() {
  realismComposer?.dispose?.();
  realismVelocityDepthNormalPass?.dispose?.();
  realismSsgiEffect?.dispose?.();
  realismScreenSpaceShadowEffect?.dispose?.();
  realismBloomEffect?.dispose?.();
  realismChromaticAberrationEffect?.dispose?.();
  realismComposer = null;
  realismVelocityDepthNormalPass = null;
  realismSsgiEffect = null;
  realismScreenSpaceShadowEffect = null;
  realismBloomEffect = null;
  realismChromaticAberrationEffect = null;
}

function buildRoom() {
  if (!CONFIG.room.floorVisible) return;

  const { width, depth } = CONFIG.room;
  addBox("Floor", [width, 0.12, depth], [0, -0.06, 0], materials.floor, { receiveShadow: true });
}

function updateInterior(dt) {
  interiorFans.forEach((fan) => {
    fan.userData.fanAngle = (fan.userData.fanAngle + fan.userData.fanSpeed * dt) % (Math.PI * 2);
    fan.rotation.copy(fan.userData.initialRotation);
    applyAxisRotation(fan, fan.userData.fanAxis, fan.userData.fanAngle);
  });
}

function loadPanelModel() {
  const loader = new GLTFLoader();
  loader.load(
    CONFIG.assetPath,
    (gltf) => {
      panelModel = gltf.scene;
      panelModel.name = "Panel1";

      panelModel.traverse(registerPanelObject);
      applyPanelTransform(panelModel);
      scene.add(panelModel);

      finishLoading();
      console.log(`[OperatorGame] Loaded Panel1.glb: ${needles.length} arrows, ${lamps.length} lamps`);
    },
    (event) => {
      if (!event.lengthComputable) {
        setLoadingProgress(62);
        return;
      }
      const assetProgress = event.loaded / event.total;
      setLoadingProgress(20 + assetProgress * 74);
    },
    (error) => {
      setLoadingStatus("PANEL LOAD FAILURE");
      console.error("[OperatorGame] Failed to load Panel1.glb", error);
    },
  );
}

function loadInteriorModel() {
  if (!CONFIG.interior?.assetPath) return;

  const loader = new GLTFLoader();
  loader.load(
    CONFIG.interior.assetPath,
    (gltf) => {
      interiorModel = gltf.scene;
      interiorModel.name = "Interior1_Panel1";
      interiorModel.position.copy(CONFIG.interior.position);
      interiorModel.rotation.copy(CONFIG.interior.rotation);
      interiorModel.scale.copy(CONFIG.interior.scale);
      interiorModel.traverse(registerInteriorObject);
      scene.add(interiorModel);
      console.log("[OperatorGame] Loaded Interior1_Panel1.glb");
    },
    undefined,
    (error) => {
      console.error("[OperatorGame] Failed to load Interior1_Panel1.glb", error);
    },
  );
}

function registerInteriorObject(object) {
  if (object.userData.hitProxyFor) return;

  const fanConfig = CONFIG.interior.fans?.[object.name];
  if (fanConfig?.enabled) {
    object.userData.initialRotation = object.rotation.clone();
    object.userData.fanAxis = fanConfig.axis ?? "z";
    object.userData.fanSpeed = THREE.MathUtils.degToRad(fanConfig.speedDegreesPerSecond ?? 360);
    object.userData.fanAngle = 0;
    interiorFans.push(object);
  }

  if (!object.isMesh) return;
  object.castShadow = true;
  object.receiveShadow = true;
  ensureSecondUvSet(object);
  object.material = getInteriorMaterial(object);

  if (CONFIG.interior.lightToggleButton && interiorMaterialMatches(object, CONFIG.interior.lightToggleButton)) {
    registerRoomLightButton(object, CONFIG.interior.lightToggleButton);
  }
}

function registerRoomLightButton(object, buttonConfig) {
  if (object.userData.roomLightButtonRegistered) return;

  object.userData.kind = "roomLightButton";
  object.userData.controlLabel = buttonConfig.label ?? "ROOM LIGHTS";
  object.userData.roomLightButtonRegistered = true;
  object.userData.initialPosition = object.position.clone();
  object.userData.pressAxis = buttonConfig.pressAxis ?? "y";
  object.userData.pressDistance = buttonConfig.pressDistance ?? -0.012;
  object.userData.pressSpeed = buttonConfig.pressSpeed ?? 16;
  object.userData.pressed = false;
  object.userData.pressProgress = 0;
  roomLightButtons.push(object);
  interactive.push(object);

  const hitRadius = buttonConfig.hitRadius ?? 0;
  if (hitRadius <= 0) return;

  const proxy = new THREE.Mesh(
    new THREE.SphereGeometry(hitRadius, 16, 8),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  proxy.name = `${object.name}_HitProxy`;
  proxy.userData.kind = "roomLightButton";
  proxy.userData.controlLabel = object.userData.controlLabel;
  proxy.userData.hitProxyFor = object.name;
  object.add(proxy);
  interactive.push(proxy);
}

function registerPanelObject(object) {
  if (!object.isMesh) return;

  object.castShadow = true;
  object.receiveShadow = true;

  applyPanelPbrMaterial(object);

  if (object.name.includes("_Arrow_") || object.name.includes("_Arrrow_")) {
    object.userData.initialRotation = object.rotation.clone();
    object.userData.needleAngle = THREE.MathUtils.degToRad(CONFIG.needleAnimation.inactiveDegrees);
    object.userData.needleSpeed = getRandomNeedleSpeed();
    object.userData.needleSpeedTimer = 0;
    object.userData.needleJitterOffset = 0;
    object.userData.needleJitterTarget = 0;
    object.userData.needleJitterTimer = Math.random() * CONFIG.needleAnimation.jitterRetargetInterval;
    object.userData.needleNoiseSeed = Math.random() * 100;
    object.userData.gaugeKey = getGaugeKey(object.name);
    needles.push(object);
    if (object.userData.gaugeKey) gaugeNeedles.set(object.userData.gaugeKey, object);
  }

  if (object.name.startsWith("LightCase1_Light_")) {
    object.material = materials.lampOff;
    object.userData.initialScale = object.scale.clone();
    lamps.push(object);
  }

  if (CONFIG.controls.knobs[object.name]) {
    registerControlKnob(object, CONFIG.controls.knobs[object.name]);
  }

  if (CONFIG.controls.buttons[object.name]) {
    registerControlButton(object, CONFIG.controls.buttons[object.name]);
  }

  if (object.name === "DisplaySmall1_ScreenMesh") {
    statusScreen.attachToMesh(object);
  }
}

function registerControlKnob(object, knobConfig) {
  const percent = THREE.MathUtils.clamp(knobConfig.initialPercent ?? 0, 0, 100);
  object.userData.kind = "controlKnob";
  object.userData.controlId = object.name;
  object.userData.controlLabel = knobConfig.label;
  object.userData.controlPercent = percent;
  object.userData.initialPercent = percent;
  object.userData.initialRotation = object.rotation.clone();

  controlKnobs.push(object);
  interactive.push(object);
  applyControlKnobRotation(object);
}

function registerControlButton(object, buttonConfig) {
  object.userData.kind = "controlButton";
  object.userData.controlId = object.name;
  object.userData.controlLabel = buttonConfig.label;
  object.userData.controlAction = buttonConfig.action ?? "";
  object.userData.initialPosition = object.position.clone();
  object.userData.pressAxis = buttonConfig.pressAxis ?? "y";
  object.userData.pressDistance = buttonConfig.pressDistance ?? -0.02;
  object.userData.pressSpeed = buttonConfig.pressSpeed ?? 16;
  object.userData.pressed = false;
  object.userData.pressProgress = 0;

  controlButtons.push(object);
  interactive.push(object);
}

function getGaugeKey(name) {
  if (name.includes("PlasmaTemp")) return "plasmaTemp";
  if (name.includes("ContainmentStability")) return "containment";
  if (name.includes("PowerOutput")) return "powerOutput";
  if (name.includes("TargetOutput")) return "targetOutput";
  if (name.includes("FuelReserve")) return "fuelReserve";
  if (name.includes("HeatSinkCapacity")) return "heatSinkCapacity";
  if (name.includes("ReactorDamage")) return "coreStress";
  if (name.includes("ReactionEfficiency")) return "reactionEfficiency";
  return null;
}

function applyPanelPbrMaterial(object) {
  ensureSecondUvSet(object);
  object.material = materials.panel;
}

function getInteriorMaterial(object) {
  const customMaterialKey = getInteriorCustomMaterialKey(object);
  if (customMaterialKey) return materials.interiorCustom[customMaterialKey] ?? materials.interior;
  return materials.interior;
}

function getInteriorCustomMaterialKey(object) {
  return (
    Object.entries(CONFIG.interior.specialMaterials ?? {}).find(([, config]) => interiorMaterialMatches(object, config))?.[0] ??
    null
  );
}

function interiorMaterialMatches(object, config) {
  const matchNames = [...(config.meshNames ?? []), config.meshName].filter(Boolean);
  const objectNames = getInteriorObjectMatchNames(object);
  const normalizedObjectNames = objectNames.map(normalizeMatchName);

  return matchNames.some((name) => {
    const normalizedName = normalizeMatchName(name);
    return objectNames.includes(name) || normalizedObjectNames.includes(normalizedName);
  });
}

function getInteriorObjectMatchNames(object) {
  const names = [];
  let current = object;

  while (current) {
    if (current.name) names.push(current.name);
    if (current === interiorModel) break;
    current = current.parent;
  }

  if (object.geometry?.name) names.push(object.geometry.name);
  return [...new Set(names)];
}

function normalizeMatchName(name) {
  return String(name).replace(/[._\-\s]/g, "").toLowerCase();
}

function getCustomInteriorMaterialDebugState() {
  return Object.fromEntries(
    Object.entries(materials.interiorCustom).map(([key, material]) => [
      key,
      {
        meshName: material.name,
        assignedTo: CONFIG.interior.specialMaterials?.[key]?.meshNames ?? [],
        mapsLoaded: Boolean(interiorCustomTextureMaps[key]),
        maskLoaded: Boolean(interiorCustomTextureMaps[key]?.maskMap),
        maskOverlay: Boolean(CONFIG.interior.specialMaterials?.[key]?.maskOverlay),
        maskOverlaySettings: CONFIG.interior.specialMaterials?.[key]?.maskOverlay ?? null,
        color: `#${material.color.getHexString()}`,
        roughness: material.roughness,
        metalness: material.metalness,
        emissive: `#${material.emissive.getHexString()}`,
        emissiveIntensity: material.emissiveIntensity,
        fixtureName: material.userData.fixtureName ?? "",
        textureRepeat: CONFIG.interior.specialMaterials?.[key]?.textureRepeat ?? 1,
        textureTier: material.userData.textureTier ?? "",
      },
    ]),
  );
}

function ensureSecondUvSet(object) {
  if (!object.geometry?.attributes.uv2 && object.geometry?.attributes.uv) {
    object.geometry.setAttribute("uv2", object.geometry.attributes.uv.clone());
  }
}

function applyPanelTransform(model) {
  model.position.copy(CONFIG.panel.position);
  model.rotation.copy(CONFIG.panel.rotation);
  model.scale.copy(CONFIG.panel.scale);
}

function addBox(name, size, position, material, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  mesh.castShadow = Boolean(options.castShadow);
  mesh.receiveShadow = Boolean(options.receiveShadow);
  scene.add(mesh);
  return mesh;
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  updateLoadingOverlay(dt);
  updateFpsMeter(dt);
  testTime += dt;
  updateMovement(dt);
  updateCameraZoom(dt);
  updateHoverTarget();
  updateControlLabels();
  updateInterior(dt);
  updatePanel(dt);
  updateFeedback(dt);
  updateRuntimeTextureLoading(dt);
  updateDebugOverlay();
  if (realismComposer) {
    renderRealismComposer(dt);
  } else if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

function renderRealismComposer(dt) {
  const originalWarn = console.warn;
  console.warn = (message, ...args) => {
    if (typeof message === "string" && message.includes("copyFramebufferToTexture function signature has changed")) return;
    originalWarn.call(console, message, ...args);
  };
  try {
    realismComposer.render(dt);
  } finally {
    console.warn = originalWarn;
  }
}

function setLoadingProgress(value) {
  loadingOverlay.setProgress(value);
}

function setLoadingStatus(text) {
  loadingOverlay.setStatus(text);
}

function finishLoading() {
  if (CONFIG.loading?.skip) {
    skipLoadingOverlay();
    return;
  }

  loadingOverlay.finish(() => {
    loadingComplete = true;
    window.dispatchEvent(new CustomEvent("operatorgame:loading-complete"));
    triggerRoomLightBoot();
  });
}

function skipLoadingOverlay() {
  loadingComplete = true;
  loadingOverlay.skip();
  window.dispatchEvent(new CustomEvent("operatorgame:loading-complete"));
}

function showRouteLoading({ title = "LOADING SHIFT", status = "PREPARING OPERATOR CONSOLE", progress = 0 } = {}) {
  loadingComplete = false;
  loadingOverlay.show({
    title,
    statusText: status,
    progressValue: progress,
  });
}

function finishRouteLoading(onComplete) {
  loadingOverlay.finish(() => {
    loadingComplete = true;
    onComplete?.();
  });
}

function updateLoadingOverlay(dt) {
  loadingOverlay.update(dt, !panelModel);
}

function updateFpsMeter(dt) {
  fpsFrameCount += 1;
  fpsElapsed += dt;
  frameTimeMs = dt * 1000;

  if (fpsElapsed < 0.25) return;

  currentFps = fpsFrameCount / fpsElapsed;
  fpsFrameCount = 0;
  fpsElapsed = 0;

  if (fpsMeter) {
    fpsMeter.textContent = `FPS ${Math.round(currentFps)}`;
    fpsMeter.title = `${frameTimeMs.toFixed(1)} ms/frame`;
  }
}

function updateDebugOverlay() {
  if (!debugOverlay) return;
  const eulerDegrees = {
    x: THREE.MathUtils.radToDeg(camera.rotation.x),
    y: THREE.MathUtils.radToDeg(camera.rotation.y),
    z: THREE.MathUtils.radToDeg(camera.rotation.z),
  };
  debugOverlay.textContent = [
    "CAMERA",
    `pos x: ${camera.position.x.toFixed(2)}`,
    `pos y: ${camera.position.y.toFixed(2)}`,
    `pos z: ${camera.position.z.toFixed(2)}`,
    `rot x: ${eulerDegrees.x.toFixed(1)}deg`,
    `rot y: ${eulerDegrees.y.toFixed(1)}deg`,
    `rot z: ${eulerDegrees.z.toFixed(1)}deg`,
    "",
    "LIGHTS: src/OperatorGameConfig.js",
    "CONFIG.lighting.pointLights",
    "",
    `shadows: ${renderer.shadowMap.enabled ? shadowQuality : "off"}`,
    `gtao: ${gtaoPass ? gtaoQuality : "off"}`,
    `ssgi: ${realismSsgiEffect ? ssgiQuality : "off"}`,
    `ssr: ${ssrPass ? ssrQuality : "off"}`,
    `contact shadows: ${realismScreenSpaceShadowEffect ? screenSpaceShadowQuality : "off"}`,
    "",
    `noclip: ${noclipEnabled ? "on" : "off"}`,
    `noclip speed: ${noclipSpeed.toFixed(2)}`,
    "",
    `hover: ${hoveredInteractive?.name ?? "none"}`,
  ].join("\n");
}

function updateHoverTarget() {
  if (forcedHoveredTarget) {
    hoveredInteractive = forcedHoveredTarget;
    setHoveredKnob(forcedHoveredTarget.userData.kind === "controlKnob" ? forcedHoveredTarget : null);
    setHoveredTooltipTarget(forcedHoveredTarget);
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactive, true)[0];
  hoveredInteractive = hit ? findInteractiveRoot(hit.object) : null;
  setHoveredKnob(hoveredInteractive?.userData.kind === "controlKnob" ? hoveredInteractive : null);
  setHoveredTooltipTarget(getTooltipTarget(hoveredInteractive));
}

function findInteractiveRoot(object) {
  let current = object;
  while (current) {
    if (current.userData.hitProxyFor && current.parent?.userData.kind) return current.parent;
    if (current.userData.kind) return current;
    current = current.parent;
  }
  return null;
}

function setHoveredKnob(knob) {
  if (hoveredKnob === knob) return;
  hoveredKnob = knob;
  updateControlTooltip();
}

function getTooltipTarget(object) {
  if (!object) return null;
  return object.userData.kind === "controlKnob" ||
    object.userData.kind === "controlButton" ||
    object.userData.kind === "roomLightButton"
    ? object
    : null;
}

function setHoveredTooltipTarget(target) {
  if (hoveredTooltipTarget === target) return;
  hoveredTooltipTarget = target;
  updateControlTooltip();
}

function updateControlLabels() {
  updateControlTooltip();
}

function updateControlTooltip() {
  if (!hoveredTooltipTarget) {
    controlTooltip.hidden = true;
    return;
  }

  const worldPosition = new THREE.Vector3();
  hoveredTooltipTarget.updateWorldMatrix(true, false);
  hoveredTooltipTarget.getWorldPosition(worldPosition);
  worldPosition.y += CONFIG.controls.labelYOffset;

  const screenPosition = worldPosition.project(camera);
  if (screenPosition.z < -1 || screenPosition.z > 1) {
    controlTooltip.hidden = true;
    return;
  }

  controlTooltip.hidden = false;
  controlTooltip.textContent = getTooltipText(hoveredTooltipTarget);
  controlTooltip.style.left = `${(screenPosition.x * 0.5 + 0.5) * window.innerWidth}px`;
  controlTooltip.style.top = `${(-screenPosition.y * 0.5 + 0.5) * window.innerHeight}px`;
}

function getTooltipText(target) {
  if (target.userData.kind === "controlKnob") {
    return `${target.userData.controlLabel} ${Math.round(target.userData.controlPercent)}%`;
  }
  if (target.userData.kind === "roomLightButton") {
    return `${target.userData.controlLabel} ${roomLightsEnabled ? "ON" : "OFF"}`;
  }
  return target.userData.controlLabel;
}

function updatePanel(dt) {
  const controlInputs = getControlInputs();
  const snapshot = fusionCore.update(dt, controlInputs);
  latestSnapshot = snapshot;
  updateShiftRecorder(dt, snapshot, controlInputs);
  updateShiftCompletion(dt, snapshot);
  statusScreen.setSnapshot(snapshot);
  statusScreen.update(dt);
  updateControlButtons(dt);

  needles.forEach((needle) => {
    if (!freezeNeedles) updateGaugeNeedle(needle, snapshot, dt);
    needle.rotation.copy(needle.userData.initialRotation);
    applyNeedleAxisRotation(needle, needle.userData.needleDebugAxis ?? "z", needle.userData.needleAngle);
  });

  lamps.forEach((lamp) => {
    lamp.material = getStartupLampMaterial(lamps.indexOf(lamp)) ?? getLampMaterial(lamp, snapshot);
    lamp.scale.copy(lamp.userData.initialScale);
  });
}

function getLampMaterial(lamp, snapshot) {
  if (indicatorTestTimer > 0) return getIndicatorTestMaterial(lamps.indexOf(lamp));

  if (lamp.name === "LightCase1_Light_UnderDemand") {
    if (snapshot.warning?.underDemandCritical) return materials.lampRed;
    if (snapshot.warning?.underDemand) return materials.lampAmber;
    return materials.lampOff;
  }

  if (lamp.name === "LightCase1_Light_OverDemand") {
    if (snapshot.warning?.overDemandCritical) return materials.lampRed;
    if (snapshot.warning?.overDemand) return materials.lampAmber;
    return materials.lampOff;
  }

  if (lamp.name === "LightCase1_Light_ReactionEfficiency") {
    if (snapshot.mode === "standby") return materials.lampOff;
    if (snapshot.warning?.outputSurge && flickerWave(13, 2.4) < 0.38) return materials.lampOff;
    if (snapshot.reactionEfficiency >= 72) return materials.lampGreen;
    if (snapshot.reactionEfficiency >= 45) return materials.lampAmber;
    if (snapshot.reactionEfficiency >= 20) return materials.lampRed;
    return flickerWave(7, 2.4) > 0.42 ? materials.lampRed : materials.lampOff;
  }

  if (lamp.name === "LightCase1_Light_FuelQuality") {
    return snapshot.mode === "standby" ? materials.lampOff : materials.lampGreen;
  }

  const warningKey = LAMP_WARNING_KEYS[lamp.name];
  if (!warningKey) return materials.lampOff;
  const warningActive = Boolean(snapshot.warning?.[warningKey]);
  if (!warningActive) return materials.lampOff;

  const emergencyBlink = shouldFastBlinkWarning(warningKey, snapshot);
  if (emergencyBlink && flickerWave(CONFIG.feedback.thermalEmergency.lampFlickerFrequency, lamps.indexOf(lamp)) < 0.48) {
    return materials.lampOff;
  }

  const outputLowFlicker =
    warningKey === "outputLow" ? flickerWave(CONFIG.feedback.outputLow.lampFlickerFrequency, 1.8) > 0.22 : true;
  if (!outputLowFlicker) return materials.lampOff;

  if (warningKey === "coreStall") return snapshot.warning?.coreStallCritical ? materials.lampRed : materials.lampAmber;
  return warningKey === "coreStress" || warningKey === "tempHigh" ? materials.lampRed : materials.lampAmber;
}

function getIndicatorTestMaterial(index) {
  const ratio = THREE.MathUtils.clamp(indicatorTestTimer / CONFIG.feedback.indicatorTest.duration, 0, 1);
  if (ratio < 1 / 3) return materials.lampRed;
  if (ratio < 2 / 3) return materials.lampGreen;
  return materials.lampAmber;
}

function getStartupLampMaterial(index) {
  if (startupFeedbackTimer <= 0) return null;

  const elapsed = CONFIG.feedback.startup.duration - startupFeedbackTimer;
  if (elapsed < 0.2) return materials.lampRed;
  if (elapsed < 0.4) return materials.lampAmber;
  if (elapsed < 0.62) return materials.lampGreen;

  const blinkWindow = elapsed - 0.62;
  if (blinkWindow < 0.7) {
    const blinkOn = Math.floor(blinkWindow / 0.175) % 2 === 0;
    return blinkOn ? materials.lampGreen : materials.lampOff;
  }

  return null;
}

function shouldFastBlinkWarning(warningKey, snapshot) {
  if (warningKey === "tempHigh") return Boolean(snapshot.warning?.tempCritical || snapshot.warning?.thermalSoak);
  if (warningKey === "coreStress") return Boolean(snapshot.warning?.coreStress);
  if (warningKey === "instability") return Boolean(snapshot.warning?.tempCritical || snapshot.warning?.outputSurge);
  if (warningKey === "coreStall") return Boolean(snapshot.warning?.coreStallCritical);
  return false;
}

function resetShiftRecorder() {
  shiftRecorder = createShiftRecorder();
}

function updateShiftRecorder(dt, snapshot, controls) {
  updateShiftRecorderState(shiftRecorder, dt, snapshot, controls);
}

function updateShiftCompletion(dt, snapshot) {
  const finishedNow = previousGameMode === "running" && (snapshot.mode === "complete" || snapshot.mode === "failed");
  previousGameMode = snapshot.mode;

  if (finishedNow) {
    resultsTimer = 5;
    resultsSnapshot = snapshot;
  }

  if (resultsTimer <= 0 || resultsVisible) return;
  resultsTimer = Math.max(0, resultsTimer - dt);
  if (resultsTimer === 0 && resultsSnapshot) showShiftResults(resultsSnapshot);
}

function showShiftResults(snapshot) {
  document.exitPointerLock?.();
  zoomActive = false;
  releaseAllControlButtons();

  const report = buildShiftReport(shiftRecorder, snapshot);
  if (resultsOutcome) resultsOutcome.textContent = snapshot.mode === "complete" ? "COMPLETE" : "FAILED";
  if (resultsProfile) resultsProfile.textContent = report.profile;
  if (resultsSummary) resultsSummary.textContent = report.summary;
  if (resultsStats) {
    resultsStats.innerHTML = "";
    report.stats.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "results-stat";
      item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      resultsStats.appendChild(item);
    });
  }
  resultsOverlay.hidden = false;
  resultsOverlay.classList.add("is-visible");
  resultsVisible = true;
  window.dispatchEvent(
    new CustomEvent("operatorgame:shift-results", {
      detail: { levelId: activeLevelId, mode: activeLevelMode, snapshot, report },
    }),
  );
}

function hideShiftResults() {
  if (!resultsOverlay) return;
  resultsOverlay.classList.remove("is-visible");
  window.setTimeout(() => {
    if (!resultsOverlay.classList.contains("is-visible")) resultsOverlay.hidden = true;
  }, 1200);
  resultsVisible = false;
}

function updateFeedback(dt) {
  startupFeedbackTimer = Math.max(0, startupFeedbackTimer - dt);
  roomLightBootTimer = Math.max(0, roomLightBootTimer - dt);
  updateIndicatorTest(dt);
  updateLongTermLightFlicker(dt);
  updateRoomLightFade(dt);
  updateSceneLightFeedback();
  applyCameraFeedback();
}

function triggerStartupFeedback() {
  startupFeedbackTimer = CONFIG.feedback.startup.duration;
}

function triggerRoomLightBoot() {
  const wasEnabled = roomLightsEnabled;
  roomLightsEnabled = true;
  roomLightCurrentFactor = 0;
  roomLightSwitchTimer = 0;
  roomLightSwitchMode = "on";
  roomLightBootTimer = CONFIG.feedback.startup.tubeOnPattern?.at(-1)?.time ?? 1.2;
  if (!wasEnabled) updateControlTooltip();
}

function updateIndicatorTest(dt) {
  const active = controlButtons.some(
    (button) => button.userData.controlAction === "indicatorTest" && button.userData.pressed,
  );
  indicatorTestTimer = active ? Math.min(indicatorTestTimer + dt, CONFIG.feedback.indicatorTest.duration) : 0;
}

function updateLongTermLightFlicker(dt) {
  [...controlledLights, ...Object.values(materials.interiorCustom)].forEach((target) => {
    const state = target.userData.fixtureFlicker;
    if (!state) return;
    updateFixtureFlickerState(state, dt);
  });
}

function createFixtureFlickerState() {
  const flickerConfig = CONFIG.feedback.longTermLightFlicker;
  return {
    seed: Math.random() * 1000,
    nextIn: getRandomRangeValue(flickerConfig?.minIntervalSeconds ?? 45, flickerConfig?.maxIntervalSeconds ?? 140),
    elapsed: 0,
    duration: 0,
    pulses: [],
  };
}

function updateFixtureFlickerState(state, dt) {
  const flickerConfig = CONFIG.feedback.longTermLightFlicker;
  if (!flickerConfig?.enabled) return;

  if (state.duration > 0) {
    state.elapsed += dt;
    if (state.elapsed >= state.duration) {
      state.elapsed = 0;
      state.duration = 0;
      state.pulses = [];
    }
    return;
  }

  state.nextIn -= dt;
  if (state.nextIn > 0) return;

  state.duration = getRandomConfigRange(flickerConfig.durationSeconds, 0.08, 0.42);
  state.elapsed = 0;
  state.pulses = createFixtureFlickerPulses(state.duration, flickerConfig);
  const retrySoon = Math.random() < (flickerConfig.retryChance ?? 0.35);
  state.nextIn = retrySoon
    ? THREE.MathUtils.randFloat(0.8, 3.5)
    : getRandomRangeValue(flickerConfig.minIntervalSeconds ?? 45, flickerConfig.maxIntervalSeconds ?? 140);
}

function triggerFixtureFlicker(targetName = "") {
  const flickerConfig = CONFIG.feedback.longTermLightFlicker;
  const triggered = [];
  [...controlledLights, ...Object.values(materials.interiorCustom)].forEach((target) => {
    const state = target.userData.fixtureFlicker;
    const fixtureName = target.userData.fixtureName ?? target.userData.lightKey ?? target.name ?? target.name;
    if (!state || (targetName && fixtureName !== targetName)) return;
    state.duration = getRandomConfigRange(flickerConfig.durationSeconds, 0.08, 0.42);
    state.elapsed = 0;
    state.pulses = createFixtureFlickerPulses(state.duration, flickerConfig);
    triggered.push(fixtureName);
  });
  return [...new Set(triggered)];
}

function createFixtureFlickerPulses(duration, flickerConfig) {
  const pulseCount = Math.round(getRandomConfigRange(flickerConfig.pulseCount, 1, 4));
  return Array.from({ length: pulseCount }, () => {
    const center = Math.random();
    const width = THREE.MathUtils.randFloat(0.035, 0.16);
    return {
      center,
      width,
      depth: 1 - getRandomConfigRange(flickerConfig.minFactor, 0.72, 0.92),
      wobble: THREE.MathUtils.randFloat(0.75, 1.25),
      duration,
    };
  });
}

function getFixtureFlickerFactor(target) {
  const state = target.userData.fixtureFlicker;
  if (!state || state.duration <= 0) return 1;

  const progress = THREE.MathUtils.clamp(state.elapsed / Math.max(state.duration, 0.001), 0, 1);
  const factor = state.pulses.reduce((currentFactor, pulse) => {
    const distance = Math.abs(progress - pulse.center) / pulse.width;
    if (distance >= 1) return currentFactor;
    const dip = Math.pow(1 - distance, 2) * pulse.depth * pulse.wobble;
    return Math.min(currentFactor, 1 - dip);
  }, 1);
  return THREE.MathUtils.clamp(factor, 0, 1.08);
}

function getRandomConfigRange(value, fallbackMin, fallbackMax) {
  if (Array.isArray(value)) return getRandomRangeValue(value[0] ?? fallbackMin, value[1] ?? fallbackMax);
  if (Number.isFinite(value)) return value;
  return getRandomRangeValue(fallbackMin, fallbackMax);
}

function getRandomRangeValue(min, max) {
  return THREE.MathUtils.randFloat(Number(min), Number(max));
}

function updateSceneLightFeedback() {
  const startup = getStartupFeedbackAmount();
  const outputLow = latestSnapshot.mode === "running" && latestSnapshot.warning?.outputLow ? 1 : 0;
  const emergency = getThermalEmergencyAmount();
  const outputConfig = CONFIG.feedback.outputLow;
  const startupLightFactor = getStartupLightFactor();
  const outputPulse = outputLow
    ? THREE.MathUtils.lerp(1 - outputConfig.lightFlicker, 1 - outputConfig.lightFlicker * 0.42, flickerWave(9, 0.4))
    : 1;
  const emergencyPulse = emergency ? THREE.MathUtils.lerp(0.72, 1.18, flickerWave(18, 2.7)) : 1;
  const roomLightFactor = getRoomLightVisualFactor();
  const sceneFactor = startupLightFactor * outputPulse * emergencyPulse;

  controlledLights.forEach((light) => {
    const fixtureFactor = light.userData.roomLightControlled ? getFixtureFlickerFactor(light) : 1;
    const factor = light.userData.roomLightControlled ? sceneFactor * roomLightFactor * fixtureFactor : sceneFactor;
    light.intensity = light.userData.baseIntensity * factor;
  });

  updateRoomLightMaterials();

  if (bloomPass) {
    const bloomConfig = CONFIG.postProcessing.bloom;
    bloomPass.strength = bloomConfig.strength + emergency * CONFIG.feedback.thermalEmergency.bloomBoost;
  }
  if (realismBloomEffect) {
    const bloomConfig = CONFIG.postProcessing.bloom;
    realismBloomEffect.intensity = bloomConfig.strength + emergency * CONFIG.feedback.thermalEmergency.bloomBoost;
  }

  if (chromaticAberrationPass) {
    const chromaConfig = CONFIG.postProcessing.chromaticAberration;
    chromaticAberrationPass.uniforms.amount.value =
      chromaConfig.amount + emergency * CONFIG.feedback.thermalEmergency.chromaticBoost * flickerWave(10, 1.1);
  }
  if (realismChromaticAberrationEffect?.offset) {
    const chromaConfig = CONFIG.postProcessing.chromaticAberration;
    const amount = chromaConfig.amount + emergency * CONFIG.feedback.thermalEmergency.chromaticBoost * flickerWave(10, 1.1);
    realismChromaticAberrationEffect.offset.set(amount, amount);
  }
}

function getStartupLightFactor() {
  if (startupFeedbackTimer <= 0) return 1;

  const startupConfig = CONFIG.feedback.startup;
  const elapsed = startupConfig.duration - startupFeedbackTimer;
  return getTubePatternFactor(elapsed);
}

function getTubePatternFactor(elapsed) {
  const startupConfig = CONFIG.feedback.startup;
  const pattern = startupConfig.tubeOnPattern ?? [];
  if (pattern.length === 0) return 1;

  let factor = pattern[pattern.length - 1].factor;
  for (let index = 0; index < pattern.length - 1; index += 1) {
    const current = pattern[index];
    const next = pattern[index + 1];
    if (elapsed < current.time || elapsed > next.time) continue;
    const ratio = THREE.MathUtils.smoothstep(elapsed, current.time, next.time);
    factor = THREE.MathUtils.lerp(current.factor, next.factor, ratio);
    break;
  }
  return factor;
}

function applyCameraFeedback() {
  const startup = getStartupFeedbackAmount();
  const outputLow = latestSnapshot.mode === "running" && latestSnapshot.warning?.outputLow ? 1 : 0;
  const emergency = getThermalEmergencyAmount();
  const shake =
    startup * CONFIG.feedback.startup.cameraShake +
    outputLow * CONFIG.feedback.outputLow.cameraShake * flickerWave(11, 0.7) +
    emergency * CONFIG.feedback.thermalEmergency.cameraShake * flickerWave(14, 1.9);
  if (shake <= 0) return;

  camera.position.x += Math.sin(testTime * 39.1) * shake;
  camera.position.y += Math.sin(testTime * 53.7) * shake * 0.45;
  camera.rotation.z += Math.sin(testTime * 31.3) * shake * 0.6;
}

function getStartupFeedbackAmount() {
  if (startupFeedbackTimer <= 0) return 0;
  return THREE.MathUtils.clamp(startupFeedbackTimer / CONFIG.feedback.startup.duration, 0, 1);
}

function getThermalEmergencyAmount() {
  if (latestSnapshot.mode !== "running") return 0;
  const temp = THREE.MathUtils.clamp((latestSnapshot.plasmaTemp - 158) / 34, 0, 1);
  const soak = THREE.MathUtils.clamp(((latestSnapshot.thermalSoak ?? 0) - 55) / 45, 0, 1);
  const stress = THREE.MathUtils.clamp((latestSnapshot.coreStress - 72) / 28, 0, 1);
  const surge = THREE.MathUtils.clamp(((latestSnapshot.outputSurge ?? 0) - 34) / 55, 0, 1) * 0.7;
  return Math.max(temp, soak, stress, surge);
}

function flickerWave(frequency, seed = 0) {
  const a = Math.sin(testTime * frequency + seed) * 0.5 + 0.5;
  const b = Math.sin(testTime * frequency * 2.37 + seed * 3.1) * 0.5 + 0.5;
  return Math.pow(a * 0.65 + b * 0.35, 1.8);
}

function getControlInputs() {
  return {
    fuelInjection: getControlPercent("Control_Knob_FuelInjection"),
    magneticField: getControlPercent("Control_Knob_MagneticField"),
    coolantFlow: getControlPercent("Control_Knob_CoolantFlow"),
    ventActive: isControlButtonPressed("Control_Btn_Vent"),
    pulseActive: isControlButtonPressed("Control_Btn_Reset") || isControlButtonPressed("Buttun_Reset"),
  };
}

function getControlPercent(name) {
  return controlKnobs.find((knob) => knob.name === name)?.userData.controlPercent ?? 0;
}

function isControlButtonPressed(name) {
  return Boolean(controlButtons.find((button) => button.name === name)?.userData.pressed);
}

function updateGaugeNeedle(needle, snapshot, dt) {
  const key = needle.userData.gaugeKey;
  const range = GAUGE_RANGES[key];
  if (!range) return;

  if (indicatorTestTimer > 0) {
    const phase = THREE.MathUtils.smoothstep(
      indicatorTestTimer,
      CONFIG.feedback.indicatorTest.duration * 0.18,
      CONFIG.feedback.indicatorTest.duration,
    );
    const testAngle = THREE.MathUtils.degToRad(
      THREE.MathUtils.lerp(CONFIG.needleAnimation.inactiveDegrees, CONFIG.needleAnimation.activeDegrees, phase),
    );
    needle.userData.needleAngle = THREE.MathUtils.damp(needle.userData.needleAngle ?? testAngle, testAngle, 10, dt);
    return;
  }

  const value = snapshot[key] ?? 0;
  const ratio = THREE.MathUtils.clamp((value - range[0]) / (range[1] - range[0]), 0, 1);
  const targetAngle = THREE.MathUtils.degToRad(
    THREE.MathUtils.lerp(CONFIG.needleAnimation.inactiveDegrees, CONFIG.needleAnimation.activeDegrees, ratio),
  );
  const currentAngle = needle.userData.needleAngle ?? targetAngle;
  const operationalJitter = getOperationalNeedleJitter(needle, snapshot, dt);
  const dangerJitter = getDangerNeedleJitter(needle, snapshot);
  const startupJitter =
    getStartupFeedbackAmount() *
    THREE.MathUtils.degToRad(CONFIG.feedback.startup.needleJitterDegrees) *
    Math.sin(testTime * (18 + needle.userData.needleNoiseSeed));
  needle.userData.needleAngle = THREE.MathUtils.damp(
    currentAngle,
    targetAngle + operationalJitter + dangerJitter + startupJitter,
    8,
    dt,
  );
}

function getDangerNeedleJitter(needle, snapshot) {
  const key = needle.userData.gaugeKey;
  if (snapshot.mode !== "running" || (key !== "plasmaTemp" && key !== "coreStress")) return 0;

  const tempDanger = THREE.MathUtils.clamp((snapshot.plasmaTemp - 145) / 28, 0, 1);
  const soakDanger = THREE.MathUtils.clamp((snapshot.thermalSoak ?? 0) / 100, 0, 1);
  const stressDanger = THREE.MathUtils.clamp((snapshot.coreStress - 45) / 55, 0, 1);
  const amountDegrees =
    key === "plasmaTemp"
      ? 1.5 + tempDanger * 10 + soakDanger * 7
      : 1 + stressDanger * 8 + soakDanger * 9;

  return (
    THREE.MathUtils.degToRad(amountDegrees) *
    (Math.sin(testTime * 47 + needle.userData.needleNoiseSeed) * 0.65 +
      Math.sin(testTime * 91 + needle.userData.needleNoiseSeed * 0.7) * 0.35)
  );
}

function getOperationalNeedleJitter(needle, snapshot, dt) {
  if (snapshot.mode !== "running") {
    needle.userData.needleJitterOffset = THREE.MathUtils.damp(needle.userData.needleJitterOffset ?? 0, 0, 10, dt);
    return needle.userData.needleJitterOffset ?? 0;
  }

  needle.userData.needleJitterTimer = (needle.userData.needleJitterTimer ?? 0) - dt;
  if (needle.userData.needleJitterTimer <= 0) {
    const interval = CONFIG.needleAnimation.jitterRetargetInterval;
    needle.userData.needleJitterTimer = THREE.MathUtils.randFloat(interval * 0.65, interval * 1.45);
    needle.userData.needleJitterTarget = THREE.MathUtils.degToRad(
      THREE.MathUtils.randFloatSpread(CONFIG.needleAnimation.jitterDegrees * 2),
    );
  }

  const vibration =
    THREE.MathUtils.degToRad(CONFIG.needleAnimation.jitterDegrees * 0.28) *
    Math.sin(testTime * CONFIG.needleAnimation.jitterFrequency + needle.userData.needleNoiseSeed);
  needle.userData.needleJitterOffset = THREE.MathUtils.damp(
    needle.userData.needleJitterOffset ?? 0,
    needle.userData.needleJitterTarget ?? 0,
    18,
    dt,
  );

  return (needle.userData.needleJitterOffset ?? 0) + vibration;
}

function updateControlButtons(dt) {
  [...controlButtons, ...roomLightButtons].forEach((button) => {
    const target = button.userData.pressed ? 1 : 0;
    button.userData.pressProgress = THREE.MathUtils.damp(
      button.userData.pressProgress ?? 0,
      target,
      button.userData.pressSpeed ?? 16,
      dt,
    );
    applyControlButtonPress(button);
  });
}

function applyControlButtonPress(button) {
  const distance = button.userData.pressDistance * (button.userData.pressProgress ?? 0);
  button.position.copy(button.userData.initialPosition);
  applyPositionAxisOffset(button, button.userData.pressAxis, distance);
}

function applyNeedleAxisRotation(needle, axis, angle) {
  if (axis === "x") {
    needle.rotateX(angle);
  } else if (axis === "y") {
    needle.rotateY(angle);
  } else {
    needle.rotateZ(angle);
  }
}

function adjustControlKnob(knob, deltaPercent) {
  const current = knob.userData.controlPercent ?? 0;
  const next = THREE.MathUtils.clamp(current + deltaPercent, 0, 100);
  if (next === current) return;

  knob.userData.controlPercent = next;
  applyControlKnobRotation(knob);
  updateControlTooltip();
}

function applyControlKnobRotation(knob) {
  const percent = knob.userData.controlPercent ?? 0;
  const dialPercent = THREE.MathUtils.lerp(
    CONFIG.controls.knobValue0DialPercent ?? 0,
    CONFIG.controls.knobValue100DialPercent ?? 100,
    percent / 100,
  );
  const angle = THREE.MathUtils.degToRad(CONFIG.controls.knobDialDegrees ?? 360) * (dialPercent / 100);
  knob.rotation.copy(knob.userData.initialRotation);
  applyAxisRotation(knob, CONFIG.controls.knobRotationAxis, angle);
}

function applyAxisRotation(object, axis, angle) {
  if (axis === "x") {
    object.rotateX(angle);
  } else if (axis === "y") {
    object.rotateY(angle);
  } else {
    object.rotateZ(angle);
  }
}

function applyPositionAxisOffset(object, axis, distance) {
  if (axis === "x") {
    object.position.x += distance;
  } else if (axis === "z") {
    object.position.z += distance;
  } else {
    object.position.y += distance;
  }
}

function adjustNoclipSpeed(direction) {
  const noclipConfig = CONFIG.camera.noclip ?? {};
  const step = noclipConfig.wheelStep ?? 0.35;
  const minSpeed = noclipConfig.minSpeed ?? 0.25;
  const maxSpeed = noclipConfig.maxSpeed ?? 30;
  noclipSpeed = THREE.MathUtils.clamp(noclipSpeed + direction * step, minSpeed, maxSpeed);
}

function toggleRoomLights() {
  roomLightsEnabled = !roomLightsEnabled;
  roomLightSwitchMode = roomLightsEnabled ? "on" : "off";
  roomLightSwitchTimer = roomLightsEnabled
    ? CONFIG.feedback.startup.tubeOnPattern?.at(-1)?.time ?? 1.2
    : CONFIG.interior.lightToggleButton?.fadeSeconds ?? 0.3;
  if (roomLightsEnabled) roomLightCurrentFactor = 0;
  updateControlTooltip();
  console.log(`[OperatorGame] Room lights ${roomLightsEnabled ? "enabled" : "disabled"}`);
}

function updateRoomLightFade(dt) {
  const buttonConfig = CONFIG.interior.lightToggleButton ?? {};
  const target = roomLightsEnabled ? 1 : 0;
  const fadeSeconds = Math.max(0.001, buttonConfig.fadeSeconds ?? 0.3);
  roomLightSwitchTimer = Math.max(0, roomLightSwitchTimer - dt);
  if (roomLightSwitchMode === "on" && roomLightSwitchTimer > 0) {
    roomLightCurrentFactor = getRoomLightVisualFactor();
  } else {
    roomLightCurrentFactor = THREE.MathUtils.damp(roomLightCurrentFactor, target, 4 / fadeSeconds, dt);
  }
  updateRoomLightMaterials();
}

function getRoomLightVisualFactor() {
  if (roomLightBootTimer > 0) {
    const bootDuration = CONFIG.feedback.startup.tubeOnPattern?.at(-1)?.time ?? 1.2;
    const elapsed = bootDuration - roomLightBootTimer;
    return getTubePatternFactor(elapsed);
  }

  if (roomLightSwitchTimer > 0 && roomLightSwitchMode === "on") {
    const bootDuration = CONFIG.feedback.startup.tubeOnPattern?.at(-1)?.time ?? 1.2;
    const elapsed = bootDuration - roomLightSwitchTimer;
    return getTubePatternFactor(elapsed);
  }

  return roomLightCurrentFactor;
}

function updateRoomLightMaterials() {
  const visualFactor = getRoomLightVisualFactor();
  Object.values(materials.interiorCustom).forEach((material) => {
    if (!material.userData.roomLightControlled) return;
    material.emissiveIntensity =
      (material.userData.baseEmissiveIntensity ?? 1) * visualFactor * getFixtureFlickerFactor(material);
    material.needsUpdate = true;
  });
}

function setControlButtonPressed(button, pressed) {
  if (!button || button.userData.kind !== "controlButton") return;
  if (button.userData.pressed === pressed) return;
  button.userData.pressed = pressed;
  if (pressed) runControlButtonAction(button);
  if (!pressed && button.userData.controlAction === "indicatorTest") indicatorTestTimer = 0;
  console.log(`[OperatorGame] ${button.userData.controlLabel} ${pressed ? "PRESSED" : "RELEASED"}`);
}

function setRoomLightButtonPressed(button, pressed) {
  if (!button || button.userData.kind !== "roomLightButton") return;
  if (button.userData.pressed === pressed) return;
  button.userData.pressed = pressed;
  if (pressed) toggleRoomLights();
}

function startShift() {
  resetShiftRecorder();
  hideShiftResults();
  fusionCore.start();
  previousGameMode = "running";
  resultsTimer = 0;
  resultsSnapshot = null;
  triggerStartupFeedback();
  indicatorTestTimer = 0;
  statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
}

function resetShift() {
  resetShiftRecorder();
  hideShiftResults();
  fusionCore.reset();
  previousGameMode = "standby";
  resultsTimer = 0;
  resultsSnapshot = null;
  startupFeedbackTimer = 0;
  indicatorTestTimer = 0;
  statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
}

function resetOperatorView() {
  document.exitPointerLock?.();
  keys.clear();
  movementVelocity.set(0, 0, 0);
  headBobTime = 0;
  leanAmount = 0;
  zoomActive = false;
  playerPosition.copy(playerSpawnPosition);
  camera.position.copy(playerSpawnPosition);
  yaw = THREE.MathUtils.degToRad(CONFIG.player?.spawnYawDegrees ?? 0);
  pitch = THREE.MathUtils.degToRad(CONFIG.player?.spawnPitchDegrees ?? 0);
  pointer.set(0, 0);
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function resetPanelControls() {
  releaseAllControlButtons();
  controlKnobs.forEach((knob) => {
    knob.userData.controlPercent = knob.userData.initialPercent ?? 0;
    applyControlKnobRotation(knob);
  });
  setHoveredKnob(null);
  setHoveredTooltipTarget(null);
  forcedHoveredTarget = null;
  hoveredInteractive = null;
  indicatorTestTimer = 0;
}

function resetLevelSession() {
  hideShiftResults();
  resetOperatorView();
  resetPanelControls();
  freezeNeedles = false;
  needles.forEach((needle) => {
    needle.userData.needleDebugAxis = null;
  });
  resultsTimer = 0;
  resultsSnapshot = null;
}

function resetForMenu() {
  resetLevelSession();
  resetShift();
}

function enterLevelSession({ levelId = activeLevelId, mode = activeLevelMode } = {}) {
  activeLevelId = levelId;
  activeLevelMode = mode;
  resetLevelSession();
  resetShiftRecorder();
  fusionCore.reset();
  previousGameMode = "standby";
  statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
}

function runControlButtonAction(button) {
  if (button.userData.controlAction === "start") {
    startShift();
    console.log("[OperatorGame] Fusion core run started");
  } else if (button.userData.controlAction === "reset") {
    resetForMenu();
    console.log("[OperatorGame] Fusion core reset");
  } else if (button.userData.controlAction === "pulse") {
    console.log("[OperatorGame] Ignition pulse armed");
  } else if (button.userData.controlAction === "indicatorTest") {
    indicatorTestTimer = 0;
    console.log("[OperatorGame] Indicator test started");
  }
}

function releaseAllControlButtons() {
  controlButtons.forEach((button) => setControlButtonPressed(button, false));
  roomLightButtons.forEach((button) => setRoomLightButtonPressed(button, false));
}

function getRandomNeedleSpeed() {
  const speedConfig = CONFIG.needleAnimation.speedDegreesPerSecond;
  return THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(speedConfig.min, speedConfig.max));
}

function updateMovement(dt) {
  const movementConfig = CONFIG.camera.operatorMovement ?? {};
  const baseSpeed = noclipEnabled
    ? noclipSpeed
    : keys.has("ShiftLeft") || keys.has("ShiftRight")
      ? CONFIG.camera.runSpeed
      : CONFIG.camera.walkSpeed;
  const speed = baseSpeed * (zoomActive && !noclipEnabled ? movementConfig.zoomSpeedMultiplier ?? 0.62 : 1);

  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  if (!noclipEnabled) {
    forward.y = 0;
    forward.normalize();
  }
  const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
  const move = new THREE.Vector3();

  if (keys.has("KeyW")) move.add(forward);
  if (keys.has("KeyS")) move.sub(forward);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.sub(right);
  if (noclipEnabled && keys.has("Space")) move.y += 1;
  if (noclipEnabled && (keys.has("ControlLeft") || keys.has("ControlRight"))) move.y -= 1;

  const targetVelocity = new THREE.Vector3();
  if (move.lengthSq() > 0) {
    targetVelocity.copy(move.normalize().multiplyScalar(speed));
  }

  const damping = targetVelocity.lengthSq() > 0 ? movementConfig.acceleration ?? 13 : movementConfig.deceleration ?? 18;
  movementVelocity.x = THREE.MathUtils.damp(movementVelocity.x, targetVelocity.x, damping, dt);
  movementVelocity.y = THREE.MathUtils.damp(movementVelocity.y, targetVelocity.y, damping, dt);
  movementVelocity.z = THREE.MathUtils.damp(movementVelocity.z, targetVelocity.z, damping, dt);
  playerPosition.addScaledVector(movementVelocity, dt);

  if (!noclipEnabled) {
    // Only floor collision for now: keep the player on a constant eye height.
    playerPosition.y = playerFloorHeight;
  }

  applyOperatorCameraOffsets(forward, right, dt);
}

function applyOperatorCameraOffsets(forward, right, dt) {
  const movementConfig = CONFIG.camera.operatorMovement ?? {};
  camera.position.copy(playerPosition);

  if (noclipEnabled) {
    leanAmount = THREE.MathUtils.damp(leanAmount, 0, movementConfig.leanDamping ?? 11, dt);
    return;
  }

  const horizontalSpeed = Math.hypot(movementVelocity.x, movementVelocity.z);
  const speedRatio = THREE.MathUtils.clamp(horizontalSpeed / Math.max(CONFIG.camera.runSpeed, 0.001), 0, 1);
  headBobTime += horizontalSpeed * (movementConfig.headBobFrequency ?? 9.5) * dt;

  const bobFade = THREE.MathUtils.smoothstep(speedRatio, 0.03, 0.45);
  const bobY = Math.sin(headBobTime * 2) * (movementConfig.headBobAmplitude ?? 0.018) * bobFade;
  const bobX = Math.sin(headBobTime) * (movementConfig.headBobSway ?? 0.009) * bobFade;
  camera.position.y += bobY;
  camera.position.addScaledVector(right, bobX);

  const targetLean = zoomActive ? 1 : 0;
  leanAmount = THREE.MathUtils.damp(leanAmount, targetLean, movementConfig.leanDamping ?? 11, dt);
  camera.position.addScaledVector(forward, leanAmount * (movementConfig.leanForward ?? 0.16));
  camera.position.y -= leanAmount * (movementConfig.leanDown ?? 0.025);
}

function updateCameraZoom(dt) {
  const targetFov = zoomActive ? Math.min(CONFIG.camera.zoomFovDegrees, baseFovDegrees) : baseFovDegrees;
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, CONFIG.camera.zoomDamping, dt);
  camera.updateProjectionMatrix();
}

function findSceneObject(name) {
  let match = null;
  scene.traverse((object) => {
    if (!match && object.name === name) match = object;
  });
  return match;
}

function getObjectTransform(name) {
  const object = findSceneObject(name);
  if (!object) return null;

  const worldPosition = new THREE.Vector3();
  const worldQuaternion = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();
  object.updateWorldMatrix(true, false);
  object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);

  return {
    name: object.name,
    type: object.type,
    parent: object.parent?.name ?? "",
    localPosition: object.position.toArray().map(roundTransformNumber),
    localRotationDegrees: [
      THREE.MathUtils.radToDeg(object.rotation.x),
      THREE.MathUtils.radToDeg(object.rotation.y),
      THREE.MathUtils.radToDeg(object.rotation.z),
    ].map(roundTransformNumber),
    localScale: object.scale.toArray().map(roundTransformNumber),
    worldPosition: worldPosition.toArray().map(roundTransformNumber),
    worldRotationDegrees: new THREE.Euler().setFromQuaternion(worldQuaternion).toArray().slice(0, 3).map((value) =>
      roundTransformNumber(THREE.MathUtils.radToDeg(value)),
    ),
    worldScale: worldScale.toArray().map(roundTransformNumber),
  };
}

function roundTransformNumber(value) {
  return Number(value.toFixed(3));
}

function listSceneObjects(pattern = "") {
  const matcher = pattern ? new RegExp(pattern, "i") : null;
  const names = [];
  scene.traverse((object) => {
    if (!object.name) return;
    if (!matcher || matcher.test(object.name)) names.push(object.name);
  });
  return names;
}

function setNeedleDebugRotation(index = 0, axis = "z", degrees = 0) {
  const needle = needles[index];
  if (!needle) return null;

  freezeNeedles = true;
  const cleanAxis = String(axis).toLowerCase();
  needle.rotation.copy(needle.userData.initialRotation);
  applyNeedleAxisRotation(needle, cleanAxis, THREE.MathUtils.degToRad(degrees));
  needle.userData.needleDebugAxis = cleanAxis;
  needle.userData.needleAngle = THREE.MathUtils.degToRad(degrees);
  return getObjectTransform(needle.name);
}

function requestPointerLock() {
  canvas.requestPointerLock?.();
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer?.setSize(window.innerWidth, window.innerHeight);
  realismComposer?.setSize(window.innerWidth, window.innerHeight);
  realismSsgiEffect?.setSize?.(window.innerWidth, window.innerHeight);
  if (ssrPass) {
    const ssrConfig = getSsrPreset(ssrQuality);
    ssrPass.setSize(
      Math.max(1, Math.round(window.innerWidth * (ssrConfig.resolutionScale ?? 1))),
      Math.max(1, Math.round(window.innerHeight * (ssrConfig.resolutionScale ?? 1))),
    );
  }
  realismScreenSpaceShadowEffect?.setSize?.(window.innerWidth, window.innerHeight);
  gtaoPass?.setSize(window.innerWidth, window.innerHeight);
  bloomPass?.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener("keydown", (event) => {
  if (
    ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space", "ControlLeft", "ControlRight"].includes(
      event.code,
    )
  ) {
    event.preventDefault();
  }
  if (event.code === "KeyN" && !event.repeat) {
    noclipEnabled = !noclipEnabled;
    console.log(`[OperatorGame] Noclip ${noclipEnabled ? "enabled" : "disabled"}`);
  }
  keys.add(event.code);
});
document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) {
    updatePointerFromEvent(event);
    return;
  }

  pointer.set(0, 0);
  const movementConfig = CONFIG.camera.operatorMovement ?? {};
  const sensitivity =
    CONFIG.camera.mouseSensitivity *
    (zoomActive ? movementConfig.zoomSensitivityMultiplier ?? 0.48 : 1);
  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;
  const pitchLimitDegrees = zoomActive
    ? CONFIG.camera.leanPitchLimitDegrees ?? CONFIG.camera.pitchLimitDegrees ?? 88
    : CONFIG.camera.pitchLimitDegrees ?? 72;
  const pitchLimit = THREE.MathUtils.degToRad(pitchLimitDegrees);
  pitch = THREE.MathUtils.clamp(pitch, -pitchLimit, pitchLimit);
});

canvas.addEventListener(
  "wheel",
  (event) => {
    if (event.shiftKey) {
      event.preventDefault();
      adjustNoclipSpeed(-Math.sign(event.deltaY));
      return;
    }

    if (!hoveredKnob) return;
    event.preventDefault();
    const rawDelta = -event.deltaY * CONFIG.controls.wheelPercentPerDelta;
    const clampedDelta = THREE.MathUtils.clamp(
      rawDelta,
      -CONFIG.controls.wheelMaxStepPercent,
      CONFIG.controls.wheelMaxStepPercent,
    );
    adjustControlKnob(hoveredKnob, clampedDelta);
  },
  { passive: false },
);

canvas.addEventListener("mousedown", (event) => {
  if (event.button === 2) {
    event.preventDefault();
    zoomActive = true;
    if (document.pointerLockElement !== canvas) requestPointerLock();
    return;
  }

  if (event.button !== 0) return;
  if (document.pointerLockElement !== canvas) updatePointerFromEvent(event);
  updateHoverTarget();
  if (hoveredInteractive?.userData.kind === "controlButton") {
    setControlButtonPressed(hoveredInteractive, true);
  } else if (hoveredInteractive?.userData.kind === "roomLightButton") {
    setRoomLightButtonPressed(hoveredInteractive, true);
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 2) zoomActive = false;
  releaseAllControlButtons();
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("blur", () => {
  zoomActive = false;
  releaseAllControlButtons();
});

function updatePointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener("click", () => {
  if (document.body.classList.contains("app-ui-open")) return;
  if (document.pointerLockElement !== canvas) {
    requestPointerLock();
  }
});

lockButton.addEventListener("click", requestPointerLock);

document.addEventListener("pointerlockchange", () => {
  lockButton.textContent = document.pointerLockElement === canvas ? "Pointer Locked" : "Enter First Person";
  if (document.pointerLockElement === canvas) pointer.set(0, 0);
  zoomActive = false;
  releaseAllControlButtons();
});

window.operatorGameDebug = {
  scene,
  camera,
  renderer,
  config: CONFIG,
  startGame: startShift,
  resetGame: resetForMenu,
  restartGame: enterLevelSession,
  startLevel: enterLevelSession,
  resetForMenu,
  showLoadingScreen: showRouteLoading,
  finishLoadingScreen: finishRouteLoading,
  isLoadingComplete: () => loadingComplete,
  hideShiftResults,
  requestPointerLock,
  releasePointerLock: () => document.exitPointerLock?.(),
  setBaseFov: (degrees) => {
    baseFovDegrees = THREE.MathUtils.clamp(Number(degrees), 50, 105);
    CONFIG.camera.fovDegrees = baseFovDegrees;
    if (!zoomActive) {
      camera.fov = baseFovDegrees;
      camera.updateProjectionMatrix();
    }
    return baseFovDegrees;
  },
  setDebugVisible: (visible) => {
    if (debugOverlay) debugOverlay.hidden = !visible;
    return Boolean(visible);
  },
  setShadowQuality,
  setGtaoQuality,
  setSsgiQuality,
  setSsrQuality,
  setScreenSpaceShadowQuality,
  showShiftResults: () => showShiftResults(fusionCore.getSnapshot()),
  startIndicatorTest: () => {
    indicatorTestTimer = CONFIG.feedback.indicatorTest.duration;
  },
  setInteriorMaskDebug,
  triggerFixtureFlicker,
  setNoclip: (enabled) => {
    noclipEnabled = Boolean(enabled);
    return noclipEnabled;
  },
  setNoclipSpeed: (speed) => {
    const noclipConfig = CONFIG.camera.noclip ?? {};
    noclipSpeed = THREE.MathUtils.clamp(
      Number(speed),
      noclipConfig.minSpeed ?? 0.25,
      noclipConfig.maxSpeed ?? 30,
    );
    return noclipSpeed;
  },
  setRoomLights: (enabled) => {
    const nextEnabled = Boolean(enabled);
    if (roomLightsEnabled !== nextEnabled) {
      roomLightsEnabled = nextEnabled;
      roomLightSwitchMode = roomLightsEnabled ? "on" : "off";
      roomLightSwitchTimer = roomLightsEnabled
        ? CONFIG.feedback.startup.tubeOnPattern?.at(-1)?.time ?? 1.2
        : CONFIG.interior.lightToggleButton?.fadeSeconds ?? 0.3;
      if (roomLightsEnabled) roomLightCurrentFactor = 0;
    }
    return roomLightsEnabled;
  },
  findObject: findSceneObject,
  getObjectTransform,
  listObjects: listSceneObjects,
  listNeedles: () => needles.map((needle, index) => ({ index, name: needle.name })),
  setNeedleRotation: setNeedleDebugRotation,
  showControlTooltip: (name) => {
    const target =
      controlKnobs.find((controlKnob) => controlKnob.name === name) ??
      controlButtons.find((controlButton) => controlButton.name === name);
    forcedHoveredTarget = target ?? null;
    setHoveredKnob(target?.userData.kind === "controlKnob" ? target : null);
    setHoveredTooltipTarget(target ?? null);
    return Boolean(target);
  },
  hideControlTooltip: () => {
    forcedHoveredTarget = null;
    setHoveredKnob(null);
    setHoveredTooltipTarget(null);
  },
  setControlValue: (name, percent) => {
    const knob = controlKnobs.find((controlKnob) => controlKnob.name === name);
    if (!knob) return null;
    knob.userData.controlPercent = THREE.MathUtils.clamp(percent, 0, 100);
    applyControlKnobRotation(knob);
    updateControlTooltip();
    return getObjectTransform(knob.name);
  },
  setButtonPressed: (name, pressed) => {
    const button =
      controlButtons.find((controlButton) => controlButton.name === name) ??
      roomLightButtons.find((roomLightButton) => roomLightButton.name === name);
    if (!button) return null;
    if (button.userData.kind === "roomLightButton") {
      setRoomLightButtonPressed(button, Boolean(pressed));
    } else {
      setControlButtonPressed(button, Boolean(pressed));
    }
    return getObjectTransform(button.name);
  },
  getPerformance: () => ({
    fps: Number(currentFps.toFixed(1)),
    frameTimeMs: Number(frameTimeMs.toFixed(2)),
    renderCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    points: renderer.info.render.points,
    lines: renderer.info.render.lines,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  }),
  resumeNeedles: () => {
    freezeNeedles = false;
    needles.forEach((needle) => {
      needle.userData.needleDebugAxis = null;
    });
  },
  getState: () => ({
    freezeNeedles,
    zoomActive,
    noclipEnabled,
    noclipSpeed: Number(noclipSpeed.toFixed(2)),
    roomLightsEnabled,
    roomLightFactor: Number(roomLightCurrentFactor.toFixed(2)),
    roomLightSwitchTimer: Number(roomLightSwitchTimer.toFixed(2)),
    roomLightSwitchMode,
    roomLightBootTimer: Number(roomLightBootTimer.toFixed(2)),
    movementSpeed: Number(movementVelocity.length().toFixed(2)),
    leanAmount: Number(leanAmount.toFixed(2)),
    indicatorTestActive: indicatorTestTimer > 0,
    resultsVisible,
    resultsTimer: Number(resultsTimer.toFixed(2)),
    activeLevelId,
    activeLevelMode,
    recorder: getShiftRecorderDebugState(shiftRecorder),
    cameraFov: Number(camera.fov.toFixed(2)),
    modelLoaded: Boolean(panelModel),
    panelTransform: panelModel ? getObjectTransform(panelModel.name) : null,
    panelTextureTier: materials.panel.userData.textureTier ?? (panelTextureMaps ? "loaded" : "placeholder"),
    interiorLoaded: Boolean(interiorModel),
    interiorTransform: interiorModel ? getObjectTransform(interiorModel.name) : null,
    interiorFans: interiorFans.map((fan) => fan.name),
    customInteriorMaterials: getCustomInteriorMaterialDebugState(),
    lightFixtures: Object.fromEntries(
      Object.entries(CONFIG.lighting.fixtures ?? {}).map(([name, fixture]) => [
        name,
        {
          lightNames: fixture.lightNames ?? [],
          materialKeys: fixture.materialKeys ?? [],
        },
      ]),
    ),
    screen: statusScreen.getState(),
    game: fusionCore.getSnapshot(),
    postProcessing: {
      composer: Boolean(composer),
      gtao: Boolean(gtaoPass),
      gtaoQuality,
      gtaoBlendIntensity: gtaoPass?.blendIntensity ?? 0,
      realismComposer: Boolean(realismComposer),
      ssgi: Boolean(realismSsgiEffect),
      ssgiQuality,
      ssr: Boolean(ssrPass),
      ssrQuality,
      screenSpaceShadows: Boolean(realismScreenSpaceShadowEffect),
      screenSpaceShadowQuality,
      bloom: Boolean(bloomPass),
      bloomStrength: bloomPass?.strength ?? 0,
      realismBloom: Boolean(realismBloomEffect),
      realismBloomStrength: realismBloomEffect?.intensity ?? 0,
      chromaticAberration: Boolean(chromaticAberrationPass),
      chromaticAberrationAmount: chromaticAberrationPass?.uniforms.amount.value ?? 0,
      realismChromaticAberration: Boolean(realismChromaticAberrationEffect),
    },
    shadows: {
      enabled: renderer.shadowMap.enabled,
      quality: shadowQuality,
      mapSize: getShadowPreset(shadowQuality).mapSize ?? 0,
      lights: [...pointLightsByKey.values()].filter((light) => light.castShadow).length,
    },
    textureLoading: { ...runtimeTextureLoading },
    lampCount: lamps.length,
    needleCount: needles.length,
    interactive: interactive.map((object) => ({
      name: object.name,
      kind: object.userData.kind,
      label: object.userData.controlLabel ?? "",
    })),
    controls: Object.fromEntries(
      controlKnobs.map((knob) => [knob.name, Math.round(knob.userData.controlPercent ?? 0)]),
    ),
    buttons: Object.fromEntries(
      [...controlButtons, ...roomLightButtons].map((button) => [
        button.name,
        {
          pressed: Boolean(button.userData.pressed),
          progress: Number((button.userData.pressProgress ?? 0).toFixed(2)),
        },
      ]),
    ),
    lampMaterials: lamps.map((lamp) =>
      lamp.material === materials.lampOff
        ? "off"
        : lamp.material === materials.lampRed
          ? "red"
          : lamp.material === materials.lampGreen
            ? "green"
            : "amber",
    ),
    needleAngles: needles.map((needle) => Number(THREE.MathUtils.radToDeg(needle.userData.needleAngle ?? 0).toFixed(1))),
  }),
};
