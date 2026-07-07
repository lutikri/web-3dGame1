import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { Octree } from "three/addons/math/Octree.js";
import { LUTCubeLoader } from "three/addons/loaders/LUTCubeLoader.js";
import { LUT3dlLoader } from "three/addons/loaders/LUT3dlLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { LUTPass } from "three/addons/postprocessing/LUTPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { createFusionCoreSimulation } from "./FusionCoreSimulation.js?v=20260707-tutorial2";
import {
  buildShiftReport,
  createShiftRecorder,
  getShiftRecorderDebugState,
  updateShiftRecorder as updateShiftRecorderState,
} from "./game/ShiftReport.js?v=20260707-tutorial2";
import { CONFIG, MATERIAL_COLORS } from "./OperatorGameConfig.js?v=20260707-tutorial2";
import { translate, translateControlLabel, translateRequired } from "./app/Localization.js?v=20260707-tutorial2";
import {
  applyGraphicsQualityProfileToConfig,
  getGraphicsQualityProfile,
} from "./config/GraphicsQualityProfiles.js?v=20260707-tutorial2";
import {
  createTextureStreaming,
  getDeferredTexturePaths,
  getInitialTexturePaths,
} from "./scene/TextureStreaming.js?v=20260707-tutorial2";
import { PANEL1_GAUGE_RANGES, PANEL1_LAMP_WARNING_KEYS } from "./panels/Panel1Bindings.js?v=20260707-tutorial2";
import { createStatusScreen } from "./StatusScreen.js?v=20260707-tutorial2";
import { createLoadingOverlay } from "./ui/LoadingOverlay.js?v=20260707-tutorial2";
import {
  createPostProcessingDebugPanel,
  restoreSavedPostProcessingConfig,
} from "./ui/PostProcessingDebugPanel.js?v=20260707-tutorial2";
import { createSceneDebugPanels, restoreSavedSceneConfig } from "./ui/SceneDebugPanels.js?v=20260707-tutorial2";
import { createPhysicsSystem } from "./physics/PhysicsSystem.js?v=20260707-tutorial2";
import { getFluorescentStarterFaultFactor } from "./lighting/FluorescentBehavior.js?v=20260707-tutorial2";
import { getLevelEnvironmentId } from "./levels/LevelRegistry.js?v=20260707-tutorial2";
import { LevelRuntimeManager } from "./runtime/LevelRuntimeManager.js?v=20260707-tutorial2";
import { AssetCache } from "./runtime/AssetCache.js?v=20260707-tutorial2";
import { LevelRuntime } from "./runtime/LevelRuntime.js?v=20260707-tutorial2";
import { LevelSession } from "./levels/LevelSession.js?v=20260707-tutorial2";
import { createLevelSceneBuilder } from "./scene/LevelSceneBuilder.js?v=20260707-tutorial2";
import { LightingRuntime } from "./lighting/LightingRuntime.js?v=20260707-tutorial2";
import { DoorInteractionSystem } from "./interactions/DoorInteractionSystem.js?v=20260707-tutorial2";
import { PlayerController } from "./player/PlayerController.js?v=20260707-tutorial2";
import { PostProcessingRuntime } from "./postprocessing/PostProcessingRuntime.js?v=20260707-tutorial2";
import { OperatorPanelRuntime } from "./panels/OperatorPanelRuntime.js?v=20260707-tutorial2";

const bootOptions = window.operatorGameBootOptions ?? {};
let physicsSystem = null;
try {
  physicsSystem = await createPhysicsSystem();
  console.log("[OperatorGame] Rapier physics initialized");
} catch (error) {
  console.error("[OperatorGame] Rapier initialization failed; using Octree fallback", error);
}
configureQualityProfile(bootOptions.qualityProfile ?? "high");
CONFIG.postProcessing.colorAdjustments.gamma = Number(bootOptions.displayGamma ?? 0.93);

function configureQualityProfile(profile) {
  return applyGraphicsQualityProfileToConfig(CONFIG, profile);
}

function getQualityProfilePixelRatio(profile) {
  return getGraphicsQualityProfile(profile).pixelRatio;
}

const defaultSceneDebugConfig = JSON.parse(
  JSON.stringify({
    materials: CONFIG.interior.specialMaterials,
    lighting: CONFIG.lighting,
    decals: CONFIG.interior.decals,
  }),
);
restoreSavedSceneConfig({
  levelId: CONFIG.sceneDebug?.levelId ?? "global",
  materials: CONFIG.interior.specialMaterials,
  lighting: CONFIG.lighting,
  decals: CONFIG.interior.decals,
});

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
textureLoadingIndicator.innerHTML = `<span class="texture-loading-spinner" aria-hidden="true"></span><span>${translate("loading.textures")} 0 / 0</span>`;
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
const playerPosition = playerSpawnPosition.clone();
let playerCollisionRadius = CONFIG.player?.collisionRadius ?? 0.28;
let playerCollisionHeight = Math.max(CONFIG.player?.collisionHeight ?? 1.7, playerCollisionRadius * 2);
const playerCapsule = new Capsule(
  new THREE.Vector3(
    playerPosition.x,
    playerPosition.y - CONFIG.playerEyeHeight + playerCollisionRadius,
    playerPosition.z,
  ),
  new THREE.Vector3(
    playerPosition.x,
    playerPosition.y - CONFIG.playerEyeHeight + playerCollisionHeight - playerCollisionRadius,
    playerPosition.z,
  ),
  playerCollisionRadius,
);
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fovDegrees, window.innerWidth / window.innerHeight, 0.05, 80);
camera.position.copy(playerSpawnPosition);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(getQualityProfilePixelRatio(bootOptions.qualityProfile ?? "high"));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.type = CONFIG.shadows.type;
const debugTransformControls = new TransformControls(camera, renderer.domElement);
debugTransformControls.setMode("translate");
debugTransformControls.setSize(0.85);
scene.add(debugTransformControls);

const textureStreaming = createTextureStreaming({
  renderer,
  transcoderPath: "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/libs/basis/",
  onProgress: () => setLoadingProgress(18),
  onWarning: () => setLoadingStatus("TEXTURE MAP WARNING"),
});
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/libs/draco/",
);
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
const emptyMaskTexture = createSolidTexture(0, 0, 0, 255);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
let collisionOctree = new Octree();
let cameraCollisionRadius = CONFIG.player?.collision?.cameraRadius ?? 0.12;
const cameraCollisionCapsule = new Capsule(new THREE.Vector3(), new THREE.Vector3(), cameraCollisionRadius);
const collisionDebugMaterial = new THREE.MeshBasicMaterial({
  color: 0x36f1ff,
  wireframe: true,
  transparent: true,
  opacity: 0.72,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
});
collisionDebugMaterial.visible = Boolean(CONFIG.player?.collision?.show);
const playerCollisionDebug = createPlayerCollisionDebug();
scene.add(playerCollisionDebug.group);
physicsSystem?.createCharacter({
  eyePosition: playerPosition,
  eyeHeight: CONFIG.playerEyeHeight,
  height: playerCollisionHeight,
  radius: playerCollisionRadius,
  config: CONFIG.player?.collision ?? {},
});
const pointer = new THREE.Vector2(0, 0);
const worldUp = new THREE.Vector3(0, 1, 0);
const keys = new Set();
let jumpQueued = false;
const interactive = [];
const lamps = [];
const needles = [];
const gaugeNeedles = new Map();
const controlKnobs = [];
const controlButtons = [];
const roomLightButtons = [];
const controlledLights = [];
const pointLightsByKey = new Map();
const levelLights = new Map();
const interiorFans = [];
let bulkheadHandle = null;
let bulkheadHandleHeld = false;
let bulkheadHandleProgress = 0;
let bulkheadLockedAttemptTime = -1;
let bulkheadExitPending = false;
let bulkheadExitComplete = false;
const statusScreen = createStatusScreen({
  brightness: CONFIG.feedback.panelIndicators.statusScreenBrightness,
});
const fusionCore = createFusionCoreSimulation();

let panelModel = null;
const panelCollisionMeshes = [];
const levelEnvironmentModels = new Map();
const levelCollisionModels = new Map();
const levelPrefabInstances = new Map();
const lightingRuntime = new LightingRuntime({
  scene,
  controlledLights,
  pointLightsByKey,
  levelLights,
  applyShadowSettings,
});
const doorInteractionSystem = new DoorInteractionSystem({
  prefabInstances: levelPrefabInstances,
  physics: physicsSystem,
  resolveEnvironmentId: getLevelEnvironmentId,
  applyVisualRotation: applyHingedDoorRotation,
  onDoorOpened: (prefabKey) => {
    activeLevelSession?.emit("doorOpened", {
      target: prefabKey?.split(":").slice(1).join(":"),
    });
  },
});
const levelSceneBuilder = createLevelSceneBuilder({
  scene,
  loadSceneAsset,
  collisionDebugMaterial,
  isCollisionVisible: () => Boolean(CONFIG.player?.collision?.show),
  registerEnvironmentObject: registerInteriorObject,
  createPrefabRuntime,
  registerPrefabInteraction,
  applyPrefabConfig: applyLevelPrefabConfig,
  appendPanelPhysics: (levelId, collisionModel) => {
    physicsSystem?.addStaticScene(levelId, collisionModel);
    appendPanelPhysics(levelId);
  },
  environmentModels: levelEnvironmentModels,
  collisionModels: levelCollisionModels,
  prefabInstances: levelPrefabInstances,
});
const levelAssetCache = new AssetCache({
  load: (assetPath) => gltfLoader.loadAsync(assetPath),
  instantiate: (gltf) => gltf.scene.clone(true),
});
let loadedRuntimeLevelId = null;
const levelRuntimeManager = new LevelRuntimeManager({
  load: createLevelEnvironmentRuntime,
  dispose: disposeLevelEnvironmentRuntime,
});
let collisionReady = false;
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
let lutPass = null;
let lutTexture = null;
let lutAssetPath = "";
let lutTexturePromise = null;
let lensDirtTexture = null;
let lensDirtAssetPath = "";
let lensDirtTexturePromise = null;
let colorAdjustmentPass = null;
let sharpenPass = null;
let lensDistortionPass = null;
let chromaticAberrationPass = null;
let lensEffectsPass = null;
let fxaaPass = null;
let smaaPass = null;
let postProcessingDebugPanel = null;
let sceneDebugPanels = null;
let debugPanelsVisible = false;
let debugToggleBuffer = "";
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
let hoveredHingedDoor = null;
let lastHoverSignal = "";
let draggedHingedDoor = null;
let forcedHoveredTarget = null;
let startupFeedbackTimer = 0;
let indicatorTestTimer = 0;
let latestSnapshot = fusionCore.getSnapshot();
let ignitionPulseFeedbackTimer = 0;
let observedIgnitionPulseCount = latestSnapshot.ignitionPulseCount ?? 0;
let appliedCameraFeedbackRoll = 0;
let zoomActive = false;
let baseFovDegrees = CONFIG.camera.fovDegrees;
let shadowQuality = CONFIG.shadows.defaultQuality ?? "min";
let gtaoQuality = CONFIG.postProcessing.gtao.defaultQuality ?? "off";
let ssgiQuality = CONFIG.postProcessing.ssgi.defaultQuality ?? "off";
let ssrQuality = CONFIG.postProcessing.ssr.defaultQuality ?? "off";
let screenSpaceShadowQuality = CONFIG.postProcessing.screenSpaceShadows.defaultQuality ?? "off";
const fastDebugBoot = Boolean(CONFIG.debug?.enabled && CONFIG.debug?.fastLoadLevel);
let loadingComplete = Boolean(CONFIG.loading?.skip || fastDebugBoot);
let inputLocked = false;
let debugTransformEdit = null;
let debugTransformInputLockBackup = false;
let shiftRecorder = createShiftRecorder();
let previousGameMode = latestSnapshot.mode;
let resultsTimer = 0;
let resultsSnapshot = null;
const playerController = new PlayerController({
  updateMovement,
  updateZoom: updateCameraZoom,
  updateCollisionDebug: updatePlayerCollisionDebug,
  resetView: resetOperatorView,
  applyCollisionSettings: applyPlayerCollisionSettings,
});
const postProcessingRuntime = new PostProcessingRuntime({
  setup: setupPostProcessing,
  render: (dt) => {
    if (realismComposer) renderRealismComposer(dt);
    else if (composer) composer.render();
    else renderer.render(scene, camera);
  },
  resize: resizeRendererTargets,
  dispose: () => {
    disposeStandardPostProcessing();
    disposeRealismPostProcessing();
  },
  inspect: () => ({
    composer: Boolean(composer),
    realismComposer: Boolean(realismComposer),
  }),
});
const operatorPanelRuntime = new OperatorPanelRuntime({
  load: loadPanelModel,
  update: updatePanel,
  reset: resetPanelControls,
  applyLevel: applyActivePanelTransform,
  hasModel: () => Boolean(panelModel),
});
let terminalSequenceElapsed = -1;
let resultsVisible = false;
const operatorThoughtsShown = new Set();
let activeLevelId = "intro-shift";
let activeLevelMode = "tutorial";
let activeLevelSession = null;
let previousLevelSessionStatus = "idle";
let operatorViewMode = "level";
let roomLightsEnabled = CONFIG.interior.lightToggleButton?.initialOn ?? true;
let roomLightCurrentFactor = roomLightsEnabled ? 1 : 0;
let roomLightSwitchTimer = 0;
let roomLightSwitchMode = "off";
let roomLightAfterglowTimer = 0;
let roomLightStarterFaultTimer = 0;
let roomLightStarterFaultElapsed = 0;
let roomLightToggleTimes = [];
let roomLightBootTimer = 0;
let roomLightStartupPattern = [];
let reactorStartupPattern = [];
let terminalStartupPattern = [];
let hemisphereLight = null;
const runtimeTextureLoading = {
  total: 0,
  completed: 0,
  active: 0,
  hideTimer: 0,
};
const defaultPostProcessingConfig = JSON.parse(JSON.stringify(CONFIG.postProcessing));

const interiorCustomTextureMaps = {};
const deferredTextureUpgradeQueue = [];
let deferredTextureUpgradeActive = false;
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

const colorAdjustmentShader = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 0 },
    contrast: { value: 1 },
    saturation: { value: 1 },
    gamma: { value: 1 },
    temperature: { value: 0 },
    tint: { value: 0 },
    emergency: { value: 0 },
    emergencyTint: { value: new THREE.Color("#ff4a2c") },
    emergencyTintStrength: { value: 0 },
    vignetteStrength: { value: 0 },
    vignetteRadius: { value: 0.78 },
    vignetteSoftness: { value: 0.38 },
    grainAmount: { value: 0 },
    time: { value: 0 },
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
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform float gamma;
    uniform float temperature;
    uniform float tint;
    uniform float emergency;
    uniform vec3 emergencyTint;
    uniform float emergencyTintStrength;
    uniform float vignetteStrength;
    uniform float vignetteRadius;
    uniform float vignetteSoftness;
    uniform float grainAmount;
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) {
      p += time;
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = source.rgb;

      color = (color - 0.5) * contrast + 0.5;
      color += brightness;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);

      color.r += temperature * 0.1;
      color.b -= temperature * 0.1;
      color.g += tint * 0.1;
      color = mix(color, emergencyTint, emergency * emergencyTintStrength);
      color = pow(max(color, vec3(0.0)), vec3(1.0 / max(gamma, 0.001)));

      float distanceFromCenter = distance(vUv, vec2(0.5));
      float vignette = smoothstep(vignetteRadius, vignetteRadius - max(vignetteSoftness, 0.001), distanceFromCenter);
      color *= mix(1.0 - vignetteStrength, 1.0, vignette);

      float grain = (hash(gl_FragCoord.xy) - 0.5) * grainAmount;
      color += grain;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), source.a);
    }
  `,
};

const sharpenShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
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
    uniform vec2 resolution;
    uniform float amount;
    varying vec2 vUv;

    void main() {
      vec2 texel = 1.0 / resolution;
      vec3 center = texture2D(tDiffuse, vUv).rgb;
      vec3 blur = vec3(0.0);
      blur += texture2D(tDiffuse, vUv + texel * vec2(-1.0, 0.0)).rgb;
      blur += texture2D(tDiffuse, vUv + texel * vec2(1.0, 0.0)).rgb;
      blur += texture2D(tDiffuse, vUv + texel * vec2(0.0, -1.0)).rgb;
      blur += texture2D(tDiffuse, vUv + texel * vec2(0.0, 1.0)).rgb;
      blur *= 0.25;
      vec3 color = center + (center - blur) * amount;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), texture2D(tDiffuse, vUv).a);
    }
  `,
};

const lensDistortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    barrelAmount: { value: 0 },
    fisheyeAmount: { value: 0 },
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
    uniform float barrelAmount;
    uniform float fisheyeAmount;
    varying vec2 vUv;

    void main() {
      vec2 centered = vUv * 2.0 - 1.0;
      float radius2 = dot(centered, centered);
      float radius = sqrt(radius2);
      float normalizedRadius = min(radius / 1.41421356, 1.0);

      float tangentRadius = tan(normalizedRadius * 1.15) / tan(1.15);
      float equidistantRadius = atan(normalizedRadius * 2.2) / atan(2.2);
      float projectedRadius = fisheyeAmount >= 0.0 ? tangentRadius : equidistantRadius;
      float fisheyeRadius = mix(normalizedRadius, projectedRadius, clamp(abs(fisheyeAmount), 0.0, 1.0));
      float fisheyeScale = radius > 0.00001 ? fisheyeRadius / max(normalizedRadius, 0.00001) : 1.0;
      float barrelScale = 1.0 + barrelAmount * radius2;
      vec2 uv = clamp(centered * fisheyeScale * barrelScale * 0.5 + 0.5, vec2(0.0), vec2(1.0));

      gl_FragColor = texture2D(tDiffuse, uv);
    }
  `,
};

const lensEffectsShader = {
  uniforms: {
    tDiffuse: { value: null },
    bloomTexture: { value: null },
    lensDirtTexture: { value: null },
    hasBloomTexture: { value: 0 },
    hasLensDirtTexture: { value: 0 },
    glareEnabled: { value: 0 },
    glareStrength: { value: 0 },
    glareThreshold: { value: 0.72 },
    glareLength: { value: 0.1 },
    glareTint: { value: new THREE.Color("#d8e8ff") },
    ghostsEnabled: { value: 0 },
    ghostStrength: { value: 0 },
    ghostThreshold: { value: 0.82 },
    ghostSpacing: { value: 0.72 },
    ghostTint: { value: new THREE.Color("#b7d8ff") },
    ghostChromaticAberration: { value: 0.006 },
    haloStrength: { value: 0.12 },
    haloRadius: { value: 0.42 },
    dirtEnabled: { value: 0 },
    dirtStrength: { value: 0 },
    dirtSpread: { value: 0 },
    dirtTint: { value: new THREE.Color("#ffffff") },
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
    uniform sampler2D bloomTexture;
    uniform sampler2D lensDirtTexture;
    uniform float hasBloomTexture;
    uniform float hasLensDirtTexture;
    uniform float glareEnabled;
    uniform float glareStrength;
    uniform float glareThreshold;
    uniform float glareLength;
    uniform vec3 glareTint;
    uniform float ghostsEnabled;
    uniform float ghostStrength;
    uniform float ghostThreshold;
    uniform float ghostSpacing;
    uniform vec3 ghostTint;
    uniform float ghostChromaticAberration;
    uniform float haloStrength;
    uniform float haloRadius;
    uniform float dirtEnabled;
    uniform float dirtStrength;
    uniform float dirtSpread;
    uniform vec3 dirtTint;
    varying vec2 vUv;

    float luminance(vec3 color) {
      return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }

    vec3 highlights(vec3 color, float threshold) {
      float contribution = smoothstep(threshold, min(1.0, threshold + 0.18), luminance(color));
      return color * contribution;
    }

    vec3 sampleBloom(vec2 uv) {
      return texture2D(bloomTexture, clamp(uv, 0.0, 1.0)).rgb * hasBloomTexture;
    }

    vec3 sampleBloomChromatic(vec2 uv, vec2 direction) {
      vec2 offset = direction * ghostChromaticAberration;
      return vec3(
        sampleBloom(uv + offset).r,
        sampleBloom(uv).g,
        sampleBloom(uv - offset).b
      );
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 glare = vec3(0.0);

      if (glareEnabled > 0.5) {
        for (int i = 1; i <= 6; i++) {
          float stepAmount = float(i) / 6.0;
          float weight = (1.0 - stepAmount) * 0.24 + 0.04;
          vec2 offset = vec2(glareLength * stepAmount, 0.0);
          glare += highlights(sampleBloom(vUv + offset), glareThreshold) * weight;
          glare += highlights(sampleBloom(vUv - offset), glareThreshold) * weight;
        }
      }

      glare *= glareTint * glareStrength * glareEnabled;

      vec3 ghosts = vec3(0.0);
      if (ghostsEnabled > 0.5) {
        vec2 uv = vec2(1.0) - vUv;
        vec2 ghostVector = (vec2(0.5) - uv) * ghostSpacing;
        for (int i = 1; i <= 4; i++) {
          float index = float(i);
          vec2 ghostUv = fract(uv + ghostVector * index);
          float edgeWeight = 1.0 - smoothstep(0.0, 0.72, distance(ghostUv, vec2(0.5)));
          vec2 direction = normalize(ghostUv - 0.5 + vec2(0.0001));
          ghosts += highlights(sampleBloomChromatic(ghostUv, direction), ghostThreshold) * edgeWeight;
        }

        vec2 haloDirection = normalize(ghostVector + vec2(0.0001));
        vec2 haloUv = fract(uv + haloDirection * haloRadius);
        float haloWeight = 1.0 - smoothstep(0.0, 0.72, distance(haloUv, vec2(0.5)));
        ghosts += highlights(sampleBloomChromatic(haloUv, haloDirection), ghostThreshold) * haloWeight * haloStrength;
      }
      ghosts *= ghostTint * ghostStrength * ghostsEnabled;

      vec3 dirt = vec3(0.0);
      if (dirtEnabled > 0.5 && hasLensDirtTexture > 0.5) {
        vec3 dirtMask = texture2D(lensDirtTexture, vUv).rgb;
        vec2 spread = vec2(dirtSpread);
        vec3 bloomIllumination = sampleBloom(vUv) * 0.28;
        bloomIllumination += sampleBloom(vUv + vec2(spread.x, 0.0)) * 0.09;
        bloomIllumination += sampleBloom(vUv - vec2(spread.x, 0.0)) * 0.09;
        bloomIllumination += sampleBloom(vUv + vec2(0.0, spread.y)) * 0.09;
        bloomIllumination += sampleBloom(vUv - vec2(0.0, spread.y)) * 0.09;
        bloomIllumination += sampleBloom(vUv + spread) * 0.09;
        bloomIllumination += sampleBloom(vUv - spread) * 0.09;
        bloomIllumination += sampleBloom(vUv + vec2(spread.x, -spread.y)) * 0.09;
        bloomIllumination += sampleBloom(vUv + vec2(-spread.x, spread.y)) * 0.09;
        dirt = bloomIllumination * dirtMask * dirtTint * dirtStrength;
      }

      gl_FragColor = vec4(clamp(source.rgb + glare + ghosts + dirt, 0.0, 1.0), source.a);
    }
  `,
};

const compatibleFxaaShader = {
  ...FXAAShader,
  name: "CompatibleFXAAShader",
  fragmentShader: FXAAShader.fragmentShader.replaceAll("-100.0", "-16.0"),
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
    emissiveIntensity: CONFIG.feedback.panelIndicators.amberEmissiveIntensity,
    roughness: 0.2,
  }),
  lampGreen: new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS.lampGreen,
    emissive: MATERIAL_COLORS.lampGreenEmissive,
    emissiveIntensity: CONFIG.feedback.panelIndicators.greenEmissiveIntensity,
    roughness: 0.2,
  }),
  lampRed: new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS.lampRed,
    emissive: MATERIAL_COLORS.lampRedEmissive,
    emissiveIntensity: CONFIG.feedback.panelIndicators.redEmissiveIntensity,
    roughness: 0.2,
  }),
};

Promise.all(interiorCustomTextureMapPromises)
  .then((entries) => {
    entries.forEach(([key, textureMaps, deferredPaths]) => {
      interiorCustomTextureMaps[key] = textureMaps;
      applyTextureMapsToMaterial(materials.interiorCustom[key], textureMaps, CONFIG.interior.specialMaterials?.[key]);
      materials.interiorCustom[key].userData.textureTier = deferredPaths ? "preview" : "full";
      syncLevelPrefabMaterialClones(key);
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
      syncLevelPrefabMaterialClones(key);
      textureStreaming.disposeTextureMaps(previousTextureMaps);
      console.log(`[OperatorGame] Upgraded ${key} textures to full resolution`);
    } catch (error) {
      console.warn(`[OperatorGame] Failed to upgrade ${key} textures`, error);
    }
  };

  const waitForSceneThenLoad = () => {
    if (bootOptions.disableFullTextures) return;
    if (bootOptions.deferFullTextures) {
      window.setTimeout(waitForSceneThenLoad, 250);
      return;
    }
    if (!loadingComplete) {
      window.setTimeout(waitForSceneThenLoad, 250);
      return;
    }

    const delayMs = (CONFIG.textureStreaming?.fullLoadDelaySeconds ?? 4) * 1000;
    window.setTimeout(() => enqueueDeferredTextureUpgrade(loadFullTextureMaps), delayMs);
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
    if (bootOptions.disableFullTextures) return;
    if (bootOptions.deferFullTextures) {
      window.setTimeout(waitForSceneThenLoad, 250);
      return;
    }
    if (!loadingComplete) {
      window.setTimeout(waitForSceneThenLoad, 250);
      return;
    }

    const delayMs = (CONFIG.textureStreaming?.fullLoadDelaySeconds ?? 4) * 1000;
    window.setTimeout(() => enqueueDeferredTextureUpgrade(loadFullTextureMaps), delayMs);
  };

  waitForSceneThenLoad();
}

function enqueueDeferredTextureUpgrade(task) {
  deferredTextureUpgradeQueue.push(task);
  processDeferredTextureUpgradeQueue();
}

function processDeferredTextureUpgradeQueue() {
  if (deferredTextureUpgradeActive || deferredTextureUpgradeQueue.length === 0) return;
  deferredTextureUpgradeActive = true;
  const task = deferredTextureUpgradeQueue.shift();
  const run = async () => {
    try {
      await task();
    } finally {
      deferredTextureUpgradeActive = false;
      window.setTimeout(processDeferredTextureUpgradeQueue, 250);
    }
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 3000 });
  } else {
    window.setTimeout(run, 0);
  }
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
    label.textContent = `${translate("loading.textures")} ${runtimeTextureLoading.completed} / ${runtimeTextureLoading.total}`;
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

await init();

async function init() {
  if (CONFIG.loading?.skip || fastDebugBoot) skipLoadingOverlay();
  restoreSavedPostProcessingConfig(CONFIG.postProcessing);
  configureQualityProfile(bootOptions.qualityProfile ?? "high");
  CONFIG.postProcessing.colorAdjustments.gamma = Number(bootOptions.displayGamma ?? 0.93);
  renderer.shadowMap.enabled = getShadowPreset(shadowQuality).enabled;
  setupLights();
  setupLightFixtures();
  buildRoom();
  postProcessingRuntime.setup();
  setupPostProcessingDebugPanel();
  setupSceneDebugPanels();
  if (CONFIG.debug?.enabled) setDebugPanelsVisible(true);
  const initialLevelLoad = loadLevelEnvironment("intro-shift");
  operatorPanelRuntime.load();
  await initialLevelLoad;
  if (CONFIG.loading?.skip || fastDebugBoot) triggerRoomLightBoot();
  animate();
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(
    CONFIG.lighting.ambientSky,
    CONFIG.lighting.ambientGround,
    CONFIG.lighting.ambientIntensity,
  );
  hemi.userData.levelId = "default";
  hemi.userData.baseIntensity = hemi.intensity;
  hemisphereLight = hemi;
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
    light.userData.levelId = "default";
    light.position.copy(lightConfig.position);
    light.userData.baseIntensity = light.intensity;
    light.userData.lightKey = name;
    light.userData.lightConfig = lightConfig;
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
  light.shadow.radius = lightConfig.shadowRadius ?? 1;
  light.shadow.camera.near = lightConfig.shadowNear ?? 0.1;
  light.shadow.camera.far = lightConfig.shadowFar ?? lightConfig.distance ?? 10;
  light.shadow.camera.updateProjectionMatrix();
}

function setupPostProcessing() {
  if (!CONFIG.postProcessing.enabled) {
    postProcessingRevision += 1;
    disposeStandardPostProcessing();
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
    setupRealismPostProcessing();
    return;
  }

  const revision = ++postProcessingRevision;
  disposeStandardPostProcessing();
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
  composer = createEffectComposer();
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));

  const gtaoConfig = getGtaoPreset(gtaoQuality);
  if (gtaoConfig.enabled) {
    const gtaoScale = gtaoConfig.resolutionScale ?? 1;
    gtaoPass = new GTAOPass(
      scene,
      camera,
      Math.max(1, Math.round(window.innerWidth * gtaoScale)),
      Math.max(1, Math.round(window.innerHeight * gtaoScale)),
    );
    gtaoPass.output = GTAOPass.OUTPUT.Default;
    applyGtaoPresetToPass(gtaoPass, gtaoConfig);
    composer.addPass(gtaoPass);
    gtaoPass.setSize(
      Math.max(1, Math.round(window.innerWidth * gtaoScale)),
      Math.max(1, Math.round(window.innerHeight * gtaoScale)),
    );
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

  const lutConfig = CONFIG.postProcessing.lut;
  const lutUsesLinearInput = lutConfig?.inputColorSpace === "linear";
  if (lutConfig?.enabled && lutConfig.assetPath && lutUsesLinearInput) {
    if (lutTexture && lutAssetPath === lutConfig.assetPath) {
      lutPass = new LUTPass({ lut: lutTexture, intensity: lutConfig.intensity ?? 1 });
      composer.addPass(lutPass);
    } else {
      loadLutTexture(lutConfig)
        .then(() => {
          if (revision === postProcessingRevision && CONFIG.postProcessing.lut?.enabled) setupPostProcessing();
        })
        .catch((error) => {
          console.warn("[OperatorGame] Failed to load LUT", error);
      });
    }
  }

  composer.addPass(new OutputPass());

  if (lutConfig?.enabled && lutConfig.assetPath && !lutUsesLinearInput) {
    if (lutTexture && lutAssetPath === lutConfig.assetPath) {
      lutPass = new LUTPass({ lut: lutTexture, intensity: lutConfig.intensity ?? 1 });
      composer.addPass(lutPass);
    } else {
      loadLutTexture(lutConfig)
        .then(() => {
          if (revision === postProcessingRevision && CONFIG.postProcessing.lut?.enabled) setupPostProcessing();
        })
        .catch((error) => {
          console.warn("[OperatorGame] Failed to load LUT", error);
        });
    }
  }

  if (CONFIG.postProcessing.colorAdjustments?.enabled) {
    colorAdjustmentPass = new ShaderPass(colorAdjustmentShader);
    applyColorAdjustmentConfig(colorAdjustmentPass, 0);
    composer.addPass(colorAdjustmentPass);
  }

  if (CONFIG.postProcessing.sharpen?.enabled) {
    sharpenPass = new ShaderPass(sharpenShader);
    sharpenPass.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
    sharpenPass.uniforms.amount.value = CONFIG.postProcessing.sharpen.amount ?? 0;
    composer.addPass(sharpenPass);
  }

  if (CONFIG.postProcessing.lensEffects?.enabled) {
    lensEffectsPass = new ShaderPass(lensEffectsShader);
    applyLensEffectsConfig(lensEffectsPass);
    composer.addPass(lensEffectsPass);

    const dirtConfig = CONFIG.postProcessing.lensEffects.lensDirt ?? {};
    if (dirtConfig.enabled && dirtConfig.assetPath) {
      loadLensDirtTexture(dirtConfig)
        .then(() => {
          if (revision === postProcessingRevision && lensEffectsPass) applyLensEffectsConfig(lensEffectsPass);
        })
        .catch((error) => {
          console.warn("[OperatorGame] Failed to load lens dirt texture", error);
        });
    }
  }

  if (CONFIG.postProcessing.lensDistortion?.enabled) {
    lensDistortionPass = new ShaderPass(lensDistortionShader);
    applyLensDistortionConfig(lensDistortionPass, 0);
    composer.addPass(lensDistortionPass);
  }

  if (CONFIG.postProcessing.chromaticAberration.enabled) {
    chromaticAberrationPass = new ShaderPass(chromaticAberrationShader);
    chromaticAberrationPass.uniforms.amount.value = CONFIG.postProcessing.chromaticAberration.amount;
    composer.addPass(chromaticAberrationPass);
  }

  const antiAliasingMethod = CONFIG.postProcessing.antiAliasing?.method ?? "off";
  if (antiAliasingMethod === "fxaa") {
    fxaaPass = new ShaderPass(compatibleFxaaShader);
    updateFxaaResolution();
    composer.addPass(fxaaPass);
  } else if (antiAliasingMethod === "smaa") {
    const pixelRatio = renderer.getPixelRatio();
    smaaPass = new SMAAPass(window.innerWidth * pixelRatio, window.innerHeight * pixelRatio);
    composer.addPass(smaaPass);
  }

  setupRealismPostProcessing();
}

function disposeStandardPostProcessing() {
  composer?.passes?.forEach((pass) => pass.dispose?.());
  composer?.dispose?.();
}

function createEffectComposer() {
  const requestedSamples = Number(CONFIG.postProcessing.antiAliasing?.msaaSamples ?? 0);
  if (!renderer.capabilities.isWebGL2 || requestedSamples <= 0) return new EffectComposer(renderer);

  const maxSamples = renderer.capabilities.maxSamples ?? requestedSamples;
  const samples = Math.min(requestedSamples, maxSamples);
  const pixelRatio = renderer.getPixelRatio();
  const renderTarget = new THREE.WebGLRenderTarget(
    Math.max(1, Math.round(window.innerWidth * pixelRatio)),
    Math.max(1, Math.round(window.innerHeight * pixelRatio)),
    { type: THREE.HalfFloatType },
  );
  renderTarget.samples = samples;
  return new EffectComposer(renderer, renderTarget);
}

function updateFxaaResolution() {
  if (!fxaaPass) return;
  const pixelRatio = renderer.getPixelRatio();
  fxaaPass.material.uniforms.resolution.value.set(
    1 / Math.max(1, window.innerWidth * pixelRatio),
    1 / Math.max(1, window.innerHeight * pixelRatio),
  );
}

function setupPostProcessingDebugPanel() {
  const panelConfig = CONFIG.postProcessing.debugPanel ?? {};
  if (!panelConfig.enabled || postProcessingDebugPanel) return;

  postProcessingDebugPanel = createPostProcessingDebugPanel({
    config: CONFIG.postProcessing,
    defaults: defaultPostProcessingConfig,
    rebuild: () => postProcessingRuntime.setup(),
    update: applyLivePostProcessingConfig,
  });
  if (panelConfig.startClosed) {
    window.setTimeout(() => postProcessingDebugPanel?.gui.close(), 0);
  }
  if (!debugPanelsVisible) postProcessingDebugPanel.hide();
}

function setupSceneDebugPanels() {
  const panelConfig = CONFIG.sceneDebug ?? {};
  if (!panelConfig.enabled || sceneDebugPanels) return;

  sceneDebugPanels = createSceneDebugPanels({
    levelId: panelConfig.levelId ?? "global",
    materialConfigs: CONFIG.interior.specialMaterials,
    materialInstances: materials.interiorCustom,
    lightingConfig: CONFIG.lighting,
    pointLights: pointLightsByKey,
    hemisphereLight,
    gameConfig: CONFIG.player,
    defaults: defaultSceneDebugConfig,
    startClosed: panelConfig.startClosed,
    applyShadowSettings,
    applyCollisionSettings,
    applyPlayerCollisionSettings,
    levelEnvironmentConfigs: CONFIG.levelEnvironments,
    applyLevelAmbient: applyLevelAmbientConfig,
    applyLevelPrefab: applyLevelPrefabConfig,
    applyLevelWorld: applyLevelWorldConfig,
    createLevelPointLight,
    togglePositionGizmo,
    applyMaterialOverlay: (key) => {
      updateMaskOverlayUniforms(materials.interiorCustom[key], CONFIG.interior.specialMaterials[key]);
    },
  });
  sceneDebugPanels.setActiveLevel(operatorViewMode === "menu" ? null : activeLevelId);
  if (!debugPanelsVisible) sceneDebugPanels.setVisible(false);
}

function rebuildSceneDebugPanels() {
  sceneDebugPanels?.destroy?.();
  sceneDebugPanels = null;
  setupSceneDebugPanels();
}

function setDebugPanelsVisible(visible) {
  debugPanelsVisible = Boolean(visible);
  if (!debugPanelsVisible) stopPositionGizmo();
  if (debugOverlay) debugOverlay.hidden = !debugPanelsVisible;
  if (fpsMeter) fpsMeter.hidden = !debugPanelsVisible;
  document.body.classList.toggle("debug-hidden", !debugPanelsVisible);
  if (postProcessingDebugPanel) {
    if (debugPanelsVisible) postProcessingDebugPanel.show();
    else postProcessingDebugPanel.hide();
  }
  sceneDebugPanels?.setVisible(debugPanelsVisible);
  return debugPanelsVisible;
}

function toggleDebugPanels() {
  return setDebugPanelsVisible(!debugPanelsVisible);
}

function applyLivePostProcessingConfig() {
  const postConfig = CONFIG.postProcessing;

  if (bloomPass) {
    bloomPass.strength = postConfig.bloom.strength;
    bloomPass.radius = postConfig.bloom.radius;
    bloomPass.threshold = postConfig.bloom.threshold;
  }
  if (realismBloomEffect) realismBloomEffect.intensity = postConfig.bloom.strength;
  if (lutPass) lutPass.intensity = postConfig.lut.intensity;
  if (colorAdjustmentPass) applyColorAdjustmentConfig(colorAdjustmentPass, 0);
  if (sharpenPass) sharpenPass.uniforms.amount.value = postConfig.sharpen.amount;
  if (lensDistortionPass) applyLensDistortionConfig(lensDistortionPass, 0);
  if (lensEffectsPass) applyLensEffectsConfig(lensEffectsPass);
  if (chromaticAberrationPass) {
    chromaticAberrationPass.uniforms.amount.value = postConfig.chromaticAberration.amount;
  }
  if (realismChromaticAberrationEffect?.offset) {
    const amount = postConfig.chromaticAberration.amount;
    realismChromaticAberrationEffect.offset.set(amount, amount);
  }
}

async function loadLutTexture(lutConfig) {
  if (lutTexture && lutAssetPath === lutConfig.assetPath) return lutTexture;
  if (lutTexturePromise && lutAssetPath === lutConfig.assetPath) return lutTexturePromise;

  const loader = lutConfig.format === "3dl" ? new LUT3dlLoader() : new LUTCubeLoader();
  lutAssetPath = lutConfig.assetPath;
  lutTexturePromise = new Promise((resolve, reject) => {
    loader.load(
      lutConfig.assetPath,
      (result) => {
        lutTexture = result.texture3D;
        resolve(lutTexture);
      },
      undefined,
      reject,
    );
  }).finally(() => {
    lutTexturePromise = null;
  });

  return lutTexturePromise;
}

async function loadLensDirtTexture(dirtConfig) {
  const maxTextureSize = Math.max(256, Number(dirtConfig.maxTextureSize ?? 1024));
  const assetKey = `${dirtConfig.assetPath}:${maxTextureSize}`;
  if (lensDirtTexture && lensDirtAssetPath === assetKey) return lensDirtTexture;
  if (lensDirtTexturePromise && lensDirtAssetPath === assetKey) return lensDirtTexturePromise;

  lensDirtAssetPath = assetKey;
  lensDirtTexturePromise = new Promise((resolve, reject) => {
    new THREE.ImageLoader().load(
      dirtConfig.assetPath,
      (image) => {
        const scale = Math.min(1, maxTextureSize / Math.max(image.width, image.height));
        const canvasTexture = document.createElement("canvas");
        canvasTexture.width = Math.max(1, Math.round(image.width * scale));
        canvasTexture.height = Math.max(1, Math.round(image.height * scale));
        const context = canvasTexture.getContext("2d");
        context.drawImage(image, 0, 0, canvasTexture.width, canvasTexture.height);

        lensDirtTexture?.dispose?.();
        lensDirtTexture = new THREE.CanvasTexture(canvasTexture);
        lensDirtTexture.colorSpace = THREE.NoColorSpace;
        lensDirtTexture.minFilter = THREE.LinearFilter;
        lensDirtTexture.magFilter = THREE.LinearFilter;
        lensDirtTexture.generateMipmaps = false;
        lensDirtTexture.needsUpdate = true;
        resolve(lensDirtTexture);
      },
      undefined,
      reject,
    );
  }).finally(() => {
    lensDirtTexturePromise = null;
  });

  return lensDirtTexturePromise;
}

function applyColorAdjustmentConfig(pass, emergency) {
  const colorConfig = CONFIG.postProcessing.colorAdjustments ?? {};
  const vignetteConfig = colorConfig.vignette ?? {};
  const grainConfig = colorConfig.grain ?? {};

  pass.uniforms.brightness.value = colorConfig.brightness ?? 0;
  pass.uniforms.contrast.value = colorConfig.contrast ?? 1;
  pass.uniforms.saturation.value = colorConfig.saturation ?? 1;
  pass.uniforms.gamma.value = colorConfig.gamma ?? 1;
  pass.uniforms.temperature.value = colorConfig.temperature ?? 0;
  pass.uniforms.tint.value = colorConfig.tint ?? 0;
  pass.uniforms.emergency.value = emergency;
  pass.uniforms.emergencyTint.value.set(colorConfig.emergencyTint ?? "#ff4a2c").convertLinearToSRGB();
  pass.uniforms.emergencyTintStrength.value = colorConfig.emergencyTintStrength ?? 0;
  pass.uniforms.vignetteStrength.value =
    (vignetteConfig.enabled ? vignetteConfig.strength ?? 0 : 0) + emergency * (vignetteConfig.emergencyBoost ?? 0);
  pass.uniforms.vignetteRadius.value = vignetteConfig.radius ?? 0.78;
  pass.uniforms.vignetteSoftness.value = vignetteConfig.softness ?? 0.38;
  pass.uniforms.grainAmount.value =
    (grainConfig.enabled ? grainConfig.amount ?? 0 : 0) + emergency * (grainConfig.emergencyBoost ?? 0);
  pass.uniforms.time.value = testTime;
}

function applyLensDistortionConfig(pass, emergency) {
  const lensConfig = CONFIG.postProcessing.lensDistortion ?? {};
  pass.uniforms.barrelAmount.value =
    (lensConfig.barrelAmount ?? 0) + emergency * (lensConfig.emergencyBarrelBoost ?? 0);
  pass.uniforms.fisheyeAmount.value =
    (lensConfig.fisheyeAmount ?? 0) + emergency * (lensConfig.emergencyFisheyeBoost ?? 0);
}

function applyLensEffectsConfig(pass) {
  const config = CONFIG.postProcessing.lensEffects ?? {};
  const glare = config.anamorphicGlare ?? {};
  const ghosts = config.flareGhosts ?? {};
  const dirt = config.lensDirt ?? {};

  pass.uniforms.bloomTexture.value = bloomPass?.renderTargetsHorizontal?.[0]?.texture ?? null;
  pass.uniforms.hasBloomTexture.value = pass.uniforms.bloomTexture.value ? 1 : 0;
  pass.uniforms.lensDirtTexture.value = lensDirtTexture;
  pass.uniforms.hasLensDirtTexture.value = lensDirtTexture ? 1 : 0;
  pass.uniforms.glareEnabled.value = glare.enabled ? 1 : 0;
  pass.uniforms.glareStrength.value = glare.strength ?? 0;
  pass.uniforms.glareThreshold.value = glare.threshold ?? 0.72;
  pass.uniforms.glareLength.value = glare.length ?? 0.1;
  pass.uniforms.glareTint.value.set(glare.tint ?? "#d8e8ff").convertLinearToSRGB();
  pass.uniforms.ghostsEnabled.value = ghosts.enabled ? 1 : 0;
  pass.uniforms.ghostStrength.value = ghosts.strength ?? 0;
  pass.uniforms.ghostThreshold.value = ghosts.threshold ?? 0.82;
  pass.uniforms.ghostSpacing.value = ghosts.spacing ?? 0.72;
  pass.uniforms.ghostTint.value.set(ghosts.tint ?? "#b7d8ff").convertLinearToSRGB();
  pass.uniforms.ghostChromaticAberration.value = ghosts.chromaticAberration ?? 0.006;
  pass.uniforms.haloStrength.value = ghosts.haloStrength ?? 0.12;
  pass.uniforms.haloRadius.value = ghosts.haloRadius ?? 0.42;
  pass.uniforms.dirtEnabled.value = dirt.enabled ? 1 : 0;
  pass.uniforms.dirtStrength.value = dirt.strength ?? 0;
  pass.uniforms.dirtSpread.value = dirt.spread ?? 0;
  pass.uniforms.dirtTint.value.set(dirt.tint ?? "#ffffff").convertLinearToSRGB();
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
    const lightConfig = light.userData.lightConfig ?? {};
    light.shadow?.map?.dispose?.();
    if (light.shadow) light.shadow.map = null;
    applyShadowSettings(light, lightConfig);
  });
  levelPrefabInstances.forEach((runtime) => {
    if (!runtime.light) return;
    const lightConfig = runtime.light.userData.lightConfig ?? {};
    runtime.light.shadow?.map?.dispose?.();
    if (runtime.light.shadow) runtime.light.shadow.map = null;
    applyShadowSettings(runtime.light, lightConfig);
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
  updateBulkheadHandle(dt);
}

function updateBulkheadHandle(dt) {
  if (!bulkheadHandle) return;
  const config = CONFIG.interior.bulkheadExit;
  let angle = 0;

  if (bulkheadExitComplete) {
    angle = THREE.MathUtils.degToRad(config.unlockedTurnDegrees);
  } else if (bulkheadExitPending) {
    const direction = bulkheadHandleHeld ? 1 / config.unlockHoldSeconds : -1 / config.returnSeconds;
    bulkheadHandleProgress = THREE.MathUtils.clamp(bulkheadHandleProgress + direction * dt, 0, 1);
    const easedProgress = bulkheadHandleProgress * bulkheadHandleProgress * (3 - 2 * bulkheadHandleProgress);
    const jerkEnvelope = Math.sin(bulkheadHandleProgress * Math.PI);
    const mechanicalJerk =
      -Math.abs(Math.sin(bulkheadHandleProgress * Math.PI * config.turnJerkFrequency)) *
      THREE.MathUtils.degToRad(config.turnJerkDegrees) *
      jerkEnvelope;
    angle = THREE.MathUtils.degToRad(config.unlockedTurnDegrees) * easedProgress + mechanicalJerk;
    if (bulkheadHandleProgress >= 1 && !bulkheadExitComplete) {
      bulkheadExitComplete = true;
      bulkheadHandleHeld = false;
      if (resultsSnapshot) showShiftResults(resultsSnapshot);
    }
  } else if (bulkheadLockedAttemptTime >= 0) {
    bulkheadLockedAttemptTime += dt;
    const progress = THREE.MathUtils.clamp(bulkheadLockedAttemptTime / config.lockedAttemptSeconds, 0, 1);
    const stopAngle = THREE.MathUtils.degToRad(config.lockedStopDegrees);
    if (progress < 0.45) {
      const driveProgress = progress / 0.45;
      const easedDrive = driveProgress * driveProgress * (3 - 2 * driveProgress);
      const driveJerk =
        -Math.abs(Math.sin(driveProgress * Math.PI * 5)) *
        THREE.MathUtils.degToRad(config.lockedKnockDegrees * 0.45) *
        Math.sin(driveProgress * Math.PI);
      angle = stopAngle * easedDrive + driveJerk;
    } else if (progress < 0.65) {
      const knockProgress = (progress - 0.45) / 0.2;
      const knock =
        Math.sin(knockProgress * Math.PI * 7) *
        (1 - knockProgress) *
        THREE.MathUtils.degToRad(config.lockedKnockDegrees);
      angle = stopAngle + knock;
    } else {
      const returnProgress = (progress - 0.65) / 0.35;
      const easedReturn = returnProgress * returnProgress * (3 - 2 * returnProgress);
      angle = stopAngle * (1 - easedReturn);
    }
    if (progress >= 1) bulkheadLockedAttemptTime = -1;
  }

  bulkheadHandle.rotation.copy(bulkheadHandle.userData.initialRotation);
  applyAxisRotation(bulkheadHandle, config.rotationAxis, angle);
}

function beginBulkheadHandleInteraction() {
  if (!bulkheadHandle || bulkheadExitComplete) return;
  if ((bulkheadHandle.userData.lastHitDistance ?? Infinity) > CONFIG.interior.bulkheadExit.maxInteractionDistance) return;
  if (bulkheadExitPending) {
    bulkheadHandleHeld = true;
    return;
  }

  bulkheadLockedAttemptTime = 0;
  if (latestSnapshot.mode === "running") {
    emitOperatorThought("door-live-core", 1, 3.2);
  } else {
    emitOperatorThought("door-interlocked", 1, 3.2);
  }
}

function resetBulkheadExit() {
  bulkheadHandleHeld = false;
  bulkheadHandleProgress = 0;
  bulkheadLockedAttemptTime = -1;
  bulkheadExitPending = false;
  bulkheadExitComplete = false;
  if (!bulkheadHandle) return;
  bulkheadHandle.userData.controlLabel = CONFIG.interior.bulkheadExit.label;
  bulkheadHandle.rotation.copy(bulkheadHandle.userData.initialRotation);
}

function loadPanelModel() {
  gltfLoader.load(
    CONFIG.assetPath,
    (gltf) => {
      panelModel = gltf.scene;
      panelModel.name = "Panel1";

      panelModel.traverse((object) => {
        if (object.isMesh && /coll/i.test(object.name)) {
          object.material = collisionDebugMaterial;
          object.visible = Boolean(CONFIG.player?.collision?.show);
          object.renderOrder = 1000;
          panelCollisionMeshes.push(object);
          return;
        }
        registerPanelObject(object);
      });
      operatorPanelRuntime.applyLevel(activeLevelId, operatorViewMode);
      scene.add(panelModel);
      levelCollisionModels.forEach((_collision, levelId) => appendPanelPhysics(levelId));

      finishLoading();
      console.log(`[OperatorGame] Loaded SM_Panel1.glb: ${needles.length} arrows, ${lamps.length} lamps`);
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
      console.error("[OperatorGame] Failed to load SM_Panel1.glb", error);
    },
  );
}

async function loadSceneAsset(assetPath) {
  return levelAssetCache.instantiate(assetPath);
}

async function loadLevelEnvironment(requestedLevelId) {
  const levelId = getLevelEnvironmentId(requestedLevelId);
  const result = await levelRuntimeManager.request(levelId);
  loadedRuntimeLevelId = result.levelId;
  return result.status === "superseded" ? null : result.levelId;
}

async function createLevelEnvironmentRuntime(levelId) {
  const environmentConfig = CONFIG.levelEnvironments?.[levelId];
  if (!environmentConfig) throw new Error(`[LevelRuntime] Unknown environment: ${levelId}`);
  const levelRuntime = new LevelRuntime(levelId);
  levelRuntime.defer(() => disposeLevelOwnedObjects(levelId));
  lightingRuntime.createLevel(levelId, environmentConfig.lighting);

  try {
    const prefabCountBeforeBuild = environmentConfig.prefabs?.length ?? 0;
    await levelSceneBuilder.build(levelRuntime, levelId, environmentConfig);
    if ((environmentConfig.prefabs?.length ?? 0) !== prefabCountBeforeBuild) {
      rebuildSceneDebugPanels();
    }
    updateActiveLevelEnvironment();
    console.log(`[LevelRuntime] Loaded only: ${levelId}`);
    return levelRuntime.activate();
  } catch (error) {
    try {
      await levelRuntime.dispose();
    } catch (cleanupError) {
      console.error(`[LevelRuntime] Cleanup failed after loading "${levelId}"`, cleanupError);
    }
    throw error;
  }
}

function createPrefabRuntime(prefab, prefabConfig) {
  const emissiveMaterials = [];
  const collisionMeshes = [];
  const parts = new Map();
  prefab.traverse((object) => {
    if (object.name) {
      object.userData.prefabInitialRotation = object.rotation.clone();
      parts.set(object.name, object);
    }
    if (!object.isMesh) return;
    const isCollider = /(?:^|_)Coll(?:ider)?(?:$|[._])/i.test(object.name);
    object.userData.prefabCollider = isCollider;
    object.visible = isCollider ? Boolean(CONFIG.player?.collision?.show) : true;
    object.castShadow = !isCollider;
    object.receiveShadow = !isCollider;
    if (isCollider) {
      object.material = collisionDebugMaterial;
      object.renderOrder = 1000;
      collisionMeshes.push(object);
      return;
    }
    ensureSecondUvSet(object);
    const sourceMaterial = materials.interiorCustom[prefabConfig.materialKey] ?? materials.interior;
    object.material = prefabConfig.light ? sourceMaterial.clone() : sourceMaterial;
    if (prefabConfig.light) {
      object.material.userData.baseEmissiveIntensity = sourceMaterial.userData.baseEmissiveIntensity;
      emissiveMaterials.push(object.material);
    }
  });
  const runtime = {
    root: prefab,
    light: null,
    emissiveMaterials,
    materialKey: prefabConfig.materialKey,
    collisionMeshes,
    parts,
    flickerTime: Math.random() * 100,
    flickerSeed: Math.random() * 1000,
    startupPattern: prefabConfig.light?.fluorescentStartup ? createFluorescentStartupPattern() : [],
    startupElapsed: 0,
    faultyStarterElapsed: 0,
    afterglowRemaining: 0,
    wasLightEnabled: prefabConfig.light?.enabled !== false,
    fixtureFlicker: createFixtureFlickerState(prefabConfig.light?.flicker),
    wasFlickerEnabled: Boolean(prefabConfig.light?.flicker?.enabled),
  };
  if (prefabConfig.light) {
    const lightConfig = prefabConfig.light;
    const light = new THREE.PointLight(
      lightConfig.color,
      lightConfig.intensity,
      lightConfig.distance,
      lightConfig.decay,
    );
    light.name = `${prefabConfig.name}_PointLight`;
    light.position.copy(lightConfig.localOffset ?? new THREE.Vector3());
    light.userData.baseIntensity = lightConfig.intensity;
    light.userData.lightConfig = lightConfig;
    light.userData.fixtureFlicker = runtime.fixtureFlicker;
    applyShadowSettings(light, lightConfig);
    prefab.add(light);
    runtime.light = light;
  }
  return runtime;
}

function disposeLevelEnvironmentRuntime(runtime) {
  return runtime.dispose();
}

function disposeLevelOwnedObjects(levelId) {
  stopPositionGizmo();
  physicsSystem?.resetWorld(playerPosition);
  [levelId, `${levelId}:prefabs`].forEach((key) => {
    const model = levelEnvironmentModels.get(key);
    if (model) scene.remove(model);
    levelEnvironmentModels.delete(key);
  });
  const collision = levelCollisionModels.get(levelId);
  if (collision) scene.remove(collision);
  levelCollisionModels.delete(levelId);

  [...levelPrefabInstances.entries()].forEach(([key, runtime]) => {
    if (!key.startsWith(`${levelId}:`)) return;
    runtime.emissiveMaterials.forEach((material) => material.dispose());
    runtime.light?.shadow?.dispose?.();
    levelPrefabInstances.delete(key);
  });
  for (let index = interactive.length - 1; index >= 0; index -= 1) {
    if (interactive[index]?.userData.levelId === levelId) interactive.splice(index, 1);
  }
  for (let index = roomLightButtons.length - 1; index >= 0; index -= 1) {
    if (roomLightButtons[index]?.userData.levelId === levelId) roomLightButtons.splice(index, 1);
  }
  for (let index = interiorFans.length - 1; index >= 0; index -= 1) {
    if (interiorFans[index]?.userData.levelId === levelId) interiorFans.splice(index, 1);
  }
  lightingRuntime.disposeLevel(levelId);
  loadedRuntimeLevelId = null;
  collisionOctree = new Octree();
  collisionReady = false;
  console.log(`[LevelRuntime] Unloaded: ${levelId}`);
}

function updateActiveLevelEnvironment() {
  const requestedLevelId = operatorViewMode === "menu" ? "intro-shift" : activeLevelId;
  const displayedLevelId = getLevelEnvironmentId(requestedLevelId);
  applyLevelWorldConfig(requestedLevelId);

  levelEnvironmentModels.forEach((model, key) => {
    const levelId = key.split(":")[0];
    model.visible = levelId === displayedLevelId;
  });
  levelCollisionModels.forEach((model, levelId) => {
    model.visible = levelId === displayedLevelId && Boolean(CONFIG.player?.collision?.show);
  });
  levelPrefabInstances.forEach((runtime, key) => {
    const levelId = key.split(":")[0];
    runtime.collisionMeshes.forEach((mesh) => {
      mesh.visible = levelId === displayedLevelId && Boolean(CONFIG.player?.collision?.show);
    });
  });
  controlledLights.forEach((light) => {
    const lightLevelId = light.userData.levelId ?? "default";
    light.visible = lightLevelId === displayedLevelId;
  });
  operatorPanelRuntime.applyLevel(displayedLevelId, operatorViewMode);
  sceneDebugPanels?.setActiveLevel?.(displayedLevelId);

  const activeCollision = displayedLevelId && levelCollisionModels.get(displayedLevelId);
  physicsSystem?.setActiveScene(displayedLevelId);
  if (!activeCollision) return;
  activeCollision.updateMatrixWorld(true);
  collisionOctree = new Octree();
  collisionOctree.fromGraphNode(activeCollision);
  if (displayedLevelId) {
    if (getLevelPanelConfig(displayedLevelId)) {
      panelCollisionMeshes.forEach((mesh) => {
        mesh.visible = Boolean(CONFIG.player?.collision?.show);
        collisionOctree.fromGraphNode(mesh);
      });
    }
    levelPrefabInstances.forEach((runtime, key) => {
      if (!key.startsWith(`${displayedLevelId}:`)) return;
      if (runtime.collisionDisabled || runtime.physicsDoorKey) return;
      runtime.collisionMeshes.forEach((mesh) => collisionOctree.fromGraphNode(mesh));
    });
  }
  collisionReady = true;
  syncPlayerCapsule();
  resolvePlayerCollisions();
}

function appendPanelPhysics(levelId) {
  if (!panelModel || !levelCollisionModels.has(levelId)) return;
  const panelConfig = CONFIG.levelEnvironments?.[levelId]?.prefabs?.find(
    (prefab) => prefab.behavior === "operatorPanel",
  );
  if (!panelConfig) return;

  panelModel.position.copy(panelConfig.position);
  panelModel.rotation.copy(panelConfig.rotation);
  panelModel.scale.copy(panelConfig.scale);
  panelModel.updateMatrixWorld(true);
  const collisionRoot = new THREE.Group();
  panelCollisionMeshes.forEach((source) => {
    const mesh = new THREE.Mesh(source.geometry);
    source.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
    collisionRoot.add(mesh);
  });
  physicsSystem?.appendStaticScene(levelId, collisionRoot);
  operatorPanelRuntime.applyLevel(levelId, operatorViewMode);
}

function applyLevelWorldConfig(levelId) {
  const worldConfig = CONFIG.levelEnvironments?.[levelId]?.world;
  if (!worldConfig) throw new Error(`[LevelRuntime] Missing world config for "${levelId}"`);
  scene.background.set(worldConfig.backgroundColor);
  if (!scene.fog) {
    scene.fog = new THREE.Fog(
      worldConfig.fogColor,
      worldConfig.fogNear,
      worldConfig.fogFar,
    );
  }
  scene.fog.color.set(worldConfig.fogColor);
  scene.fog.near = worldConfig.fogNear;
  scene.fog.far = Math.max(scene.fog.near + 0.01, worldConfig.fogFar);
}

function createLevelPointLight(levelId, lightKey, lightConfig) {
  const environmentConfig = CONFIG.levelEnvironments?.[levelId];
  if (!environmentConfig?.lighting) return null;
  environmentConfig.lighting.pointLights ??= {};
  environmentConfig.lighting.pointLights[lightKey] = lightConfig;
  const light = lightingRuntime.createPointLight(levelId, lightKey, lightConfig);
  light.visible = operatorViewMode !== "menu" && activeLevelId === levelId;
  return light;
}

function togglePositionGizmo(descriptor) {
  if (debugTransformEdit?.id === descriptor?.id) {
    stopPositionGizmo();
    return false;
  }
  stopPositionGizmo();
  const edit = resolvePositionGizmoTarget(descriptor);
  if (!edit) return false;

  debugTransformEdit = edit;
  debugTransformInputLockBackup = inputLocked;
  inputLocked = true;
  keys.clear();
  movementVelocity.set(0, 0, 0);
  document.exitPointerLock?.();
  debugTransformControls.attach(edit.object);
  return true;
}

function stopPositionGizmo() {
  if (!debugTransformEdit) return;
  debugTransformControls.detach();
  if (debugTransformEdit.temporary) scene.remove(debugTransformEdit.object);
  debugTransformEdit = null;
  inputLocked = debugTransformInputLockBackup;
}

function resolvePositionGizmoTarget(descriptor) {
  if (!descriptor?.id || !descriptor.position) return null;
  let object = null;

  if (descriptor.type === "prefab") {
    const prefabConfig = CONFIG.levelEnvironments?.[descriptor.levelId]?.prefabs?.find(
      (prefab) => prefab.name === descriptor.key,
    );
    object =
      prefabConfig?.behavior === "operatorPanel"
        ? panelModel
        : levelPrefabInstances.get(`${descriptor.levelId}:${descriptor.key}`)?.root ?? null;
  } else if (descriptor.type === "prefabLightOffset") {
    object = levelPrefabInstances.get(`${descriptor.levelId}:${descriptor.key}`)?.light ?? null;
  } else if (descriptor.type === "levelPointLight") {
    object = pointLightsByKey.get(`${descriptor.levelId}:${descriptor.key}`) ?? null;
  } else if (descriptor.type === "globalPointLight") {
    object = pointLightsByKey.get(descriptor.key) ?? null;
  }

  let temporary = false;
  if (!object) {
    object = new THREE.Object3D();
    object.name = `DebugPositionGizmo_${descriptor.id}`;
    object.position.copy(descriptor.position);
    scene.add(object);
    temporary = true;
  }

  const edit = {
    ...descriptor,
    object,
    temporary,
  };
  const sync = () => {
    descriptor.position.copy?.(object.position);
    if (!descriptor.position.copy) {
      descriptor.position.x = object.position.x;
      descriptor.position.y = object.position.y;
      descriptor.position.z = object.position.z;
    }
    descriptor.onChange?.();
  };
  edit.sync = sync;
  return edit;
}

debugTransformControls.addEventListener("objectChange", () => {
  debugTransformEdit?.sync?.();
});

function applyLevelAmbientConfig(levelId) {
  const lightingConfig = CONFIG.levelEnvironments?.[levelId]?.lighting;
  lightingRuntime.applyAmbient(levelId, lightingConfig);
}

function syncLevelPrefabMaterialClones(materialKey) {
  const textureMaps = interiorCustomTextureMaps[materialKey];
  const materialConfig = CONFIG.interior.specialMaterials?.[materialKey];
  if (!textureMaps || !materialConfig) return;
  levelPrefabInstances.forEach((runtime) => {
    if (runtime.materialKey !== materialKey) return;
    runtime.emissiveMaterials.forEach((material) => {
      applyTextureMapsToMaterial(material, textureMaps, materialConfig);
      material.userData.baseEmissiveIntensity = materialConfig.emissiveIntensity ?? 0;
    });
  });
}

function applyLevelPrefabConfig(levelId, prefabName, structural = false) {
  const environmentConfig = CONFIG.levelEnvironments?.[levelId];
  const prefabConfig = environmentConfig?.prefabs?.find((entry) => entry.name === prefabName);
  if (prefabConfig?.behavior === "operatorPanel") {
    applyActivePanelTransform();
    if (structural && activeLevelId === levelId) updateActiveLevelEnvironment();
    return;
  }
  const runtime = levelPrefabInstances.get(`${levelId}:${prefabName}`);
  if (!prefabConfig || !runtime) return;

  runtime.root.position.copy(prefabConfig.position ?? new THREE.Vector3());
  runtime.root.rotation.copy(prefabConfig.rotation ?? new THREE.Euler());
  runtime.root.scale.copy(prefabConfig.scale ?? new THREE.Vector3(1, 1, 1));
  Object.entries(prefabConfig.parts ?? {}).forEach(([partName, partConfig]) => {
    const part = runtime.parts.get(partName);
    if (!part) return;
    part.rotation.copy(part.userData.prefabInitialRotation);
    const rotation = partConfig.rotationDegrees ?? {};
    part.rotateX(THREE.MathUtils.degToRad(rotation.x ?? 0));
    part.rotateY(THREE.MathUtils.degToRad(rotation.y ?? 0));
    part.rotateZ(THREE.MathUtils.degToRad(rotation.z ?? 0));
  });
  runtime.root.updateMatrixWorld(true);
  if (runtime.door) applyHingedDoorRotation(runtime);
  const lightConfig = prefabConfig.light;
  if (!lightConfig || !runtime.light) {
    if (structural && activeLevelId === levelId) updateActiveLevelEnvironment();
    return;
  }
  runtime.light.visible = lightConfig.enabled !== false;
  runtime.light.color.set(lightConfig.color);
  runtime.light.userData.baseIntensity = lightConfig.intensity;
  runtime.light.distance = lightConfig.distance;
  runtime.light.decay = lightConfig.decay;
  runtime.light.position.copy(lightConfig.localOffset ?? new THREE.Vector3());
  if (lightConfig.enabled !== false && !runtime.wasLightEnabled && lightConfig.fluorescentStartup) {
    runtime.startupPattern = createFluorescentStartupPattern();
    runtime.startupElapsed = 0;
  }
  if (lightConfig.enabled === false && runtime.wasLightEnabled && lightConfig.afterglow?.enabled !== false) {
    runtime.afterglowRemaining = lightConfig.afterglow?.durationSeconds ?? 3;
  }
  runtime.wasLightEnabled = lightConfig.enabled !== false;
  runtime.light.visible = lightConfig.enabled !== false || runtime.afterglowRemaining > 0;
  if (structural) applyShadowSettings(runtime.light, lightConfig);
  if (structural && activeLevelId === levelId) updateActiveLevelEnvironment();
}

function registerPrefabInteraction(levelId, prefabConfig, runtime) {
  const interaction = prefabConfig.interaction;
  if (interaction?.type !== "hingedDoor") return;
  const doorMesh = runtime.parts.get(interaction.meshName);
  const colliderMesh = runtime.parts.get(interaction.colliderName);
  if (!doorMesh) return;

  doorMesh.userData.kind = "hingedDoor";
  doorMesh.userData.levelId = levelId;
  const doorMaterials = Array.isArray(doorMesh.material) ? doorMesh.material : [doorMesh.material];
  doorMaterials.filter(Boolean).forEach((material) => {
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
  });
  doorMesh.userData.maxInteractionDistance = interaction.maxDistance ?? 2.8;
  doorMesh.userData.levelPrefabKey = `${levelId}:${prefabConfig.name}`;
  interactive.push(doorMesh);
  runtime.root.updateMatrixWorld(true);
  doorMesh.updateWorldMatrix(true, false);
  colliderMesh?.updateWorldMatrix(true, false);
  runtime.door = {
    mesh: doorMesh,
    collider: colliderMesh,
    interaction,
    degrees: interaction.initialDegrees ?? 0,
    commandedOpen: false,
    releaseAngularVelocity: 0,
    colliderFromDoor: colliderMesh
      ? new THREE.Matrix4().copy(doorMesh.matrixWorld).invert().multiply(colliderMesh.matrixWorld)
      : null,
  };
  applyHingedDoorRotation(runtime);
  if (physicsSystem && colliderMesh) {
    runtime.physicsDoorKey = `${levelId}:${prefabConfig.name}`;
    physicsSystem.createHingedDoor({
      key: runtime.physicsDoorKey,
      sceneKey: levelId,
      doorMesh,
      colliderMesh,
      initialDegrees: interaction.initialDegrees ?? 0,
      minDegrees: interaction.minDegrees ?? -105,
      maxDegrees: interaction.maxDegrees ?? 5,
      density: interaction.density,
      angularDamping: interaction.angularDamping,
      maxAngularVelocity: interaction.maxAngularVelocity,
      initialHoldSeconds: interaction.initialHoldSeconds,
      motorStiffness: interaction.motorStiffness,
      motorDamping: interaction.motorDamping,
    });
  }
}

function applyHingedDoorRotation(runtime) {
  const door = runtime?.door;
  if (!door) return;
  door.mesh.rotation.copy(door.mesh.userData.prefabInitialRotation);
  applyAxisRotation(door.mesh, door.interaction.axis ?? "y", THREE.MathUtils.degToRad(door.degrees));
  runtime.root.updateMatrixWorld(true);
  if (door.collider && door.colliderFromDoor) {
    door.mesh.updateWorldMatrix(true, false);
    door.collider.parent?.updateWorldMatrix(true, false);
    const colliderWorld = new THREE.Matrix4().multiplyMatrices(door.mesh.matrixWorld, door.colliderFromDoor);
    const parentInverse = new THREE.Matrix4().copy(door.collider.parent.matrixWorld).invert();
    const colliderLocal = new THREE.Matrix4().multiplyMatrices(parentInverse, colliderWorld);
    colliderLocal.decompose(door.collider.position, door.collider.quaternion, door.collider.scale);
  }
  runtime.root.updateMatrixWorld(true);
}

function setHoveredHingedDoor(doorMesh) {
  if (hoveredHingedDoor === doorMesh) return;
  hoveredHingedDoor = doorMesh;
  document.body.classList.toggle("door-interactive-hover", Boolean(hoveredHingedDoor));
}

function toggleHingedDoor(doorMesh) {
  return doorInteractionSystem.toggle(doorMesh);
}

function resetLevelDoors(levelId = null) {
  return doorInteractionSystem.reset(levelId);
}

function beginHingedDoorDrag(doorMesh) {
  const runtime = levelPrefabInstances.get(doorMesh?.userData.levelPrefabKey);
  if (!runtime?.door) return;
  draggedHingedDoor = runtime;
  const door = runtime.door;
  door.releaseAngularVelocity = 0;
  door.grabPoint =
    doorMesh.userData.lastHitPoint?.clone() ??
    doorMesh.localToWorld(new THREE.Vector3(0.5, 0, 0));
  door.grabLocalPoint = doorMesh.worldToLocal(door.grabPoint.clone());
  door.grabStartDegrees =
    physicsSystem?.getDoorDegrees(runtime.physicsDoorKey) ?? door.degrees;
  door.degrees = door.grabStartDegrees;
  door.grabLastDegrees = door.degrees;
  if (runtime.physicsDoorKey) {
    physicsSystem?.setDoorDragTarget(runtime.physicsDoorKey, door.degrees, true);
    return;
  }
  runtime.collisionDisabled = true;
  updateActiveLevelEnvironment();
}

function updateHingedDoorDrag() {
  const door = draggedHingedDoor?.door;
  if (!door) return;
  const interaction = door.interaction;
  const physicalDegrees = physicsSystem?.getDoorDegrees(draggedHingedDoor.physicsDoorKey);
  if (physicalDegrees != null) door.degrees = physicalDegrees;
  door.mesh.updateWorldMatrix(true, false);
  const hinge = door.mesh.getWorldPosition(new THREE.Vector3());
  const grabbedPoint = door.mesh.localToWorld(door.grabLocalPoint.clone());
  const screenPoint = grabbedPoint.clone().project(camera);
  const axis = new THREE.Vector3(0, 1, 0);
  const sampleRadians = 0.01;
  const sampledPoint = grabbedPoint
    .clone()
    .sub(hinge)
    .applyAxisAngle(axis, sampleRadians)
    .add(hinge)
    .project(camera);
  const derivativeX = (sampledPoint.x - screenPoint.x) / sampleRadians;
  const derivativeY = (sampledPoint.y - screenPoint.y) / sampleRadians;
  const derivativeLengthSq = derivativeX * derivativeX + derivativeY * derivativeY;
  if (derivativeLengthSq < 0.000001) return;
  const correctionRadians = THREE.MathUtils.clamp(
    -(screenPoint.x * derivativeX + screenPoint.y * derivativeY) / derivativeLengthSq,
    -0.08,
    0.08,
  );
  const nextDegrees = THREE.MathUtils.clamp(
    door.degrees + THREE.MathUtils.radToDeg(correctionRadians),
    interaction.minDegrees ?? -105,
    interaction.maxDegrees ?? 105,
  );
  const deltaRadians = THREE.MathUtils.degToRad(nextDegrees - door.grabLastDegrees);
  door.degrees = nextDegrees;
  door.grabLastDegrees = nextDegrees;
  door.releaseAngularVelocity = THREE.MathUtils.lerp(
    door.releaseAngularVelocity ?? 0,
    THREE.MathUtils.clamp(deltaRadians * 60, -1.5, 1.5),
    0.25,
  );
  if (draggedHingedDoor.physicsDoorKey) {
    physicsSystem?.setDoorDragTarget(draggedHingedDoor.physicsDoorKey, door.degrees, true);
    return;
  }
  applyHingedDoorRotation(draggedHingedDoor);
}

function endHingedDoorDrag() {
  if (!draggedHingedDoor) return;
  if (draggedHingedDoor.physicsDoorKey) {
    physicsSystem?.setDoorDragTarget(
      draggedHingedDoor.physicsDoorKey,
      draggedHingedDoor.door.degrees,
      false,
      draggedHingedDoor.door.releaseAngularVelocity ?? 0,
    );
    draggedHingedDoor.door.releaseAngularVelocity = 0;
    draggedHingedDoor = null;
    return;
  }
  draggedHingedDoor.collisionDisabled = false;
  applyHingedDoorRotation(draggedHingedDoor);
  draggedHingedDoor = null;
  updateActiveLevelEnvironment();
}

function applyCollisionSettings() {
  const collisionConfig = CONFIG.player?.collision;
  collisionDebugMaterial.visible = Boolean(collisionConfig?.show);
  playerCollisionDebug.group.visible = Boolean(collisionConfig?.show);
  updateActiveLevelEnvironment();
}

function applyPlayerCollisionSettings() {
  playerCollisionRadius = CONFIG.player?.collisionRadius ?? 0.28;
  playerCollisionHeight = Math.max(CONFIG.player?.collisionHeight ?? 1.7, playerCollisionRadius * 2);
  cameraCollisionRadius = CONFIG.player?.collision?.cameraRadius ?? 0.12;
  playerCapsule.radius = playerCollisionRadius;
  cameraCollisionCapsule.radius = cameraCollisionRadius;
  syncPlayerCapsule();
  resolvePlayerCollisions();
  physicsSystem?.createCharacter({
    eyePosition: playerPosition,
    eyeHeight: CONFIG.playerEyeHeight,
    height: playerCollisionHeight,
    radius: playerCollisionRadius,
    config: CONFIG.player?.collision ?? {},
  });
  updatePlayerCollisionDebug();
}

function createPlayerCollisionDebug() {
  const bodyMaterial = new THREE.MeshBasicMaterial({
    color: 0x36f1ff,
    wireframe: true,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });
  const stepMaterial = new THREE.MeshBasicMaterial({
    color: 0x56ff72,
    wireframe: true,
    transparent: true,
    opacity: 0.8,
    depthTest: false,
  });
  const leanMaterial = new THREE.MeshBasicMaterial({
    color: 0xff4de1,
    wireframe: true,
    transparent: true,
    opacity: 0.9,
    depthTest: false,
  });
  const group = new THREE.Group();
  group.name = "PlayerCollisionDebug";
  group.renderOrder = 1100;
  group.visible = Boolean(CONFIG.player?.collision?.show);

  const bottom = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), bodyMaterial);
  const top = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), bodyMaterial);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), bodyMaterial);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), stepMaterial);
  const lean = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), leanMaterial);
  bottom.name = "PlayerCapsule_Bottom";
  top.name = "PlayerCapsule_Top";
  body.name = "PlayerCapsule_Body";
  step.name = "PlayerStepHeight";
  lean.name = "PlayerLeanCollision";
  [bottom, top, body, step, lean].forEach((mesh) => {
    mesh.renderOrder = 1100;
    group.add(mesh);
  });
  return { group, bottom, top, body, step, lean };
}

function updatePlayerCollisionDebug() {
  if (!playerCollisionDebug.group.visible) return;
  const radius = playerCapsule.radius;
  const segmentHeight = Math.max(0.001, playerCapsule.end.y - playerCapsule.start.y);
  playerCollisionDebug.bottom.position.copy(playerCapsule.start);
  playerCollisionDebug.top.position.copy(playerCapsule.end);
  playerCollisionDebug.bottom.scale.setScalar(radius);
  playerCollisionDebug.top.scale.setScalar(radius);
  playerCollisionDebug.body.position.copy(playerCapsule.start).add(playerCapsule.end).multiplyScalar(0.5);
  playerCollisionDebug.body.scale.set(radius, segmentHeight, radius);

  const feetY = playerCapsule.start.y - radius;
  const stepHeight = Math.max(0.001, CONFIG.player?.collision?.stepHeight ?? 0);
  playerCollisionDebug.step.position.set(playerCapsule.start.x, feetY + stepHeight * 0.5, playerCapsule.start.z);
  playerCollisionDebug.step.scale.set(radius * 1.35, stepHeight, radius * 1.35);

  playerCollisionDebug.lean.position.copy(camera.position);
  playerCollisionDebug.lean.scale.setScalar(cameraCollisionRadius);
}

function registerInteriorObject(object, environmentConfig = null, levelId = null) {
  if (object.userData.hitProxyFor) return;
  if (levelId) object.userData.levelId = levelId;

  const fanConfigs = environmentConfig?.behaviors?.fans ?? CONFIG.interior.fans ?? {};
  const fanConfig = Object.entries(fanConfigs).find(
    ([name]) => normalizeMatchName(name) === normalizeMatchName(object.name),
  )?.[1];
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
  if (object.name === CONFIG.interior.bulkheadExit?.meshName) registerBulkheadHandle(object);

  const levelBindings = (environmentConfig?.session?.bindings ?? []).filter(
    (binding) => binding.source === object.name,
  );
  if (
    CONFIG.interior.lightToggleButton &&
    (levelBindings.length > 0 || interiorMaterialMatches(object, CONFIG.interior.lightToggleButton))
  ) {
    registerRoomLightButton(object, CONFIG.interior.lightToggleButton, levelBindings);
  }
}

function registerRoomLightButton(object, buttonConfig, levelBindings = []) {
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
  object.userData.levelBindings = levelBindings;
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
  proxy.userData.levelId = object.userData.levelId;
  object.add(proxy);
  interactive.push(proxy);
}

function registerPanelObject(object) {
  if (!object.isMesh) return;

  object.castShadow = true;
  object.receiveShadow = true;

  applyPanelPbrMaterial(object);

  if (object.name.includes("_Arrow_") || object.name.includes("_Arrrow_")) {
    object.castShadow = CONFIG.shadows.castNeedleShadows;
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
  const normalizedPrefixes = (config.namePrefixes ?? []).map(normalizeMatchName);
  const materialNames = Array.isArray(object.material)
    ? object.material.map((material) => material?.name).filter(Boolean)
    : [object.material?.name].filter(Boolean);
  const normalizedMaterialNames = materialNames.map(normalizeMatchName);
  const configuredMaterialNames = (config.materialNames ?? []).map(normalizeMatchName);

  return configuredMaterialNames.some((name) => normalizedMaterialNames.includes(name)) ||
    normalizedPrefixes.some((prefix) => normalizedObjectNames.some((name) => name.startsWith(prefix))) ||
    matchNames.some((name) => {
    const normalizedName = normalizeMatchName(name);
    return objectNames.includes(name) || normalizedObjectNames.includes(normalizedName);
  });
}

function getInteriorObjectMatchNames(object) {
  const names = [];
  let current = object;

  while (current) {
    if (current.name) names.push(current.name);
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

function applyActivePanelTransform() {
  if (!panelModel) return;
  applyPanelTransform(panelModel);
  const panelLevelId = operatorViewMode === "menu" ? "intro-shift" : activeLevelId;
  const panelConfig = getLevelPanelConfig(panelLevelId);
  panelModel.visible = Boolean(panelConfig);
  panelCollisionMeshes.forEach((mesh) => {
    mesh.visible = Boolean(panelConfig) && Boolean(CONFIG.player?.collision?.show);
  });
  if (!panelConfig) return;
  if (panelConfig?.position) panelModel.position.copy(panelConfig.position);
  if (panelConfig?.rotation) panelModel.rotation.copy(panelConfig.rotation);
  if (panelConfig?.scale) panelModel.scale.copy(panelConfig.scale);
  panelModel.updateMatrixWorld(true);
}

function getLevelPanelConfig(levelId) {
  return CONFIG.levelEnvironments?.[getLevelEnvironmentId(levelId)]?.prefabs?.find(
    (prefab) => prefab.behavior === "operatorPanel",
  ) ?? null;
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
  playerController.update(dt);
  updateHoverTarget();
  updateControlLabels();
  updateInterior(dt);
  operatorPanelRuntime.update(dt);
  updateActiveLevelSession(dt);
  updateFeedback(dt);
  updateLevelPrefabLights(dt);
  physicsSystem?.step(dt);
  playerController.updateAfterPhysics();
  updateRuntimeTextureLoading(dt);
  updateDebugOverlay();
  postProcessingRuntime.render(dt);
  const isBackground = document.hidden || !document.hasFocus();
  if (isBackground) {
    setTimeout(animate, 1000); // approximately 1 FPS
  } else {
    requestAnimationFrame(animate);
  }
}

function updateLevelPrefabLights(dt) {
  levelPrefabInstances.forEach((runtime, key) => {
    if (!runtime.light) return;
    const [levelId, prefabName] = key.split(":");
    const prefabConfig = CONFIG.levelEnvironments?.[levelId]?.prefabs?.find((entry) => entry.name === prefabName);
    const lightConfig = prefabConfig?.light;
    if (!lightConfig) return;

    runtime.startupElapsed += dt;
    runtime.afterglowRemaining = Math.max(0, (runtime.afterglowRemaining ?? 0) - dt);
    const startupDelay = Math.max(0, lightConfig.startupDelaySeconds ?? 0);
    const poweredElapsed = runtime.startupElapsed - startupDelay;
    let factor = poweredElapsed < 0 ? 0 : 1;

    if (poweredElapsed >= 0 && lightConfig.faultyStarterLoop) {
      runtime.faultyStarterElapsed += dt;
      factor = getFluorescentStarterFaultFactor({
        elapsed: runtime.faultyStarterElapsed,
        visualTime: testTime,
        config: CONFIG.feedback.roomLightSwitch,
        seed: runtime.flickerSeed,
      });
    } else if (poweredElapsed >= 0) {
      runtime.flickerTime += dt;
      const flicker = lightConfig.flicker ?? {};
      if (flicker.enabled && !runtime.wasFlickerEnabled) {
        runtime.fixtureFlicker.nextIn = THREE.MathUtils.randFloat(0.12, 0.45);
      }
      runtime.wasFlickerEnabled = Boolean(flicker.enabled);
      updateFixtureFlickerState(runtime.fixtureFlicker, dt, flicker);
      factor = flicker.enabled ? getFixtureFlickerFactor(runtime.light) : 1;
    }

    if (
      poweredElapsed >= 0 &&
      !lightConfig.faultyStarterLoop &&
      lightConfig.fluorescentStartup &&
      runtime.startupPattern.length
    ) {
      const startupDuration = getFluorescentStartupDuration(runtime.startupPattern);
      if (poweredElapsed <= startupDuration) {
        factor *= getFluorescentStartupFactor(runtime.startupPattern, poweredElapsed);
      }
    }

    const afterglowConfig = lightConfig.afterglow ?? {};
    const afterglowDuration = Math.max(0.001, afterglowConfig.durationSeconds ?? 3);
    const afterglowProgress = THREE.MathUtils.clamp(runtime.afterglowRemaining / afterglowDuration, 0, 1);
    const localAfterglowFactor =
      afterglowConfig.enabled === false
        ? 0
        : (afterglowConfig.initialFactor ?? 0.2) *
          Math.pow(afterglowProgress, afterglowConfig.exponent ?? 2.4);
    const enabledFactor = lightConfig.enabled === false ? localAfterglowFactor : factor;
    const roomFactor = lightConfig.roomLightControlled
      ? Math.max(getRoomLightVisualFactor(), getRoomLightAfterglowFactor())
      : 1;
    const sceneFactor = getStartupLightFactor() * getTerminalLightFactor();
    const finalFactor = enabledFactor * roomFactor * sceneFactor;
    runtime.light.visible = lightConfig.enabled !== false || runtime.afterglowRemaining > 0;
    runtime.light.intensity = lightConfig.intensity * finalFactor;
    runtime.emissiveMaterials.forEach((material) => {
      const baseIntensity =
        CONFIG.interior.specialMaterials?.[prefabConfig.materialKey]?.emissiveIntensity ??
        material.userData.baseEmissiveIntensity ??
        1;
      material.emissiveIntensity = baseIntensity * finalFactor;
    });
  });
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

function applyCameraPose(position, rotationDegrees) {
  camera.position.copy(position);
  camera.rotation.order = "YXZ";
  camera.rotation.x = THREE.MathUtils.degToRad(rotationDegrees.x ?? 0);
  camera.rotation.y = THREE.MathUtils.degToRad(rotationDegrees.y ?? 0);
  camera.rotation.z = THREE.MathUtils.degToRad(rotationDegrees.z ?? 0);
}

function setLoadingProgress(value) {
  loadingOverlay.setProgress(value);
}

function setLoadingStatus(text) {
  loadingOverlay.setStatus(text);
}

function finishLoading() {
  if (CONFIG.loading?.skip || fastDebugBoot) {
    skipLoadingOverlay();
    return;
  }

  loadingOverlay.finish(() => {
    loadingComplete = true;
    window.dispatchEvent(new CustomEvent("operatorgame:loading-complete"));
    if (operatorViewMode !== "menu") triggerRoomLightBoot();
  });
}

function skipLoadingOverlay() {
  loadingComplete = true;
  loadingOverlay.skip();
  window.dispatchEvent(new CustomEvent("operatorgame:loading-complete"));
}

function showRouteLoading({
  title = "LOADING SHIFT",
  status = "PREPARING OPERATOR CONSOLE",
  progress = 0,
} = {}) {
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
    document.body.classList.toggle("interactive-hover", Boolean(hoveredInteractive));
    setHoveredKnob(forcedHoveredTarget.userData.kind === "controlKnob" ? forcedHoveredTarget : null);
    setHoveredHingedDoor(forcedHoveredTarget.userData.kind === "hingedDoor" ? forcedHoveredTarget : null);
    setHoveredTooltipTarget(forcedHoveredTarget);
    dispatchHoverSignal(hoveredInteractive);
    return;
  }

  raycaster.setFromCamera(pointer, camera);
  const interactionLevelId = getLevelEnvironmentId(
    operatorViewMode === "menu" ? "intro-shift" : activeLevelId,
  );
  const hit = raycaster
    .intersectObjects(interactive, true)
    .find((candidate) => {
      if (candidate.object.userData.prefabCollider) return false;
      if (!isObjectHierarchyVisible(candidate.object)) return false;
      const root = findInteractiveRoot(candidate.object);
      return !root?.userData.levelId || root.userData.levelId === interactionLevelId;
    });
  hoveredInteractive = hit ? findInteractiveRoot(hit.object) : null;
  if (
    hoveredInteractive?.userData.maxInteractionDistance &&
    hit?.distance > hoveredInteractive.userData.maxInteractionDistance
  ) {
    hoveredInteractive = null;
  }
  document.body.classList.toggle("interactive-hover", Boolean(hoveredInteractive));
  if (hoveredInteractive && hit) {
    hoveredInteractive.userData.lastHitDistance = hit.distance;
    hoveredInteractive.userData.lastHitPoint = hit.point.clone();
  }
  setHoveredKnob(hoveredInteractive?.userData.kind === "controlKnob" ? hoveredInteractive : null);
  setHoveredHingedDoor(hoveredInteractive?.userData.kind === "hingedDoor" ? hoveredInteractive : null);
  setHoveredTooltipTarget(getTooltipTarget(hoveredInteractive));
  dispatchHoverSignal(hoveredInteractive);
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
    object.userData.kind === "roomLightButton" ||
    object.userData.kind === "bulkheadHandle"
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
  const label = translateControlLabel(target.userData.controlLabel);
  if (target.userData.kind === "controlKnob") {
    return `${label} ${Math.round(target.userData.controlPercent)}%`;
  }
  if (target.userData.kind === "roomLightButton") {
    return `${label} ${roomLightsEnabled ? translate("controls.on") : translate("controls.off")}`;
  }
  return label;
}

function dispatchHoverSignal(target) {
  const kind = target?.userData.kind ?? "none";
  const name = target?.name ?? "";
  const signal = `${activeLevelId}:${kind}:${name}`;
  if (signal === lastHoverSignal) return;
  lastHoverSignal = signal;
  window.dispatchEvent(
    new CustomEvent("operatorgame:hover-target", {
      detail: {
        levelId: activeLevelId,
        kind,
        name,
        controlLabel: target?.userData.controlLabel ?? "",
      },
    }),
  );
}

function updatePanel(dt) {
  const controlInputs = getControlInputs();
  const previousSnapshot = latestSnapshot;
  const snapshot = fusionCore.update(dt, controlInputs);
  const ignitionPulseCount = snapshot.ignitionPulseCount ?? 0;
  if (ignitionPulseCount > observedIgnitionPulseCount) {
    ignitionPulseFeedbackTimer = CONFIG.feedback.ignitionPulse.duration;
  }
  observedIgnitionPulseCount = ignitionPulseCount;
  latestSnapshot = snapshot;
  updateOperatorThoughts(previousSnapshot, snapshot, controlInputs);
  updateShiftRecorder(dt, snapshot, controlInputs);
  updateShiftCompletion(dt, snapshot);
  const panelSnapshot = getTerminalPresentationSnapshot(snapshot);
  statusScreen.setSnapshot(panelSnapshot);
  statusScreen.update(dt);
  updateControlButtons(dt);

  needles.forEach((needle) => {
    if (!freezeNeedles) updateGaugeNeedle(needle, panelSnapshot, dt);
    needle.rotation.copy(needle.userData.initialRotation);
    applyNeedleAxisRotation(needle, needle.userData.needleDebugAxis ?? "z", needle.userData.needleAngle);
  });

  lamps.forEach((lamp) => {
    lamp.material = getStartupLampMaterial(lamps.indexOf(lamp)) ?? getLampMaterial(lamp, panelSnapshot);
    lamp.scale.copy(lamp.userData.initialScale);
  });
}

function isObjectHierarchyVisible(object) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    if (current === scene) return true;
    current = current.parent;
  }
  return false;
}

function registerBulkheadHandle(object) {
  if (bulkheadHandle) return;
  bulkheadHandle = object;
  object.userData.kind = "bulkheadHandle";
  object.userData.controlLabel = CONFIG.interior.bulkheadExit.label;
  object.userData.initialRotation = object.rotation.clone();
  interactive.push(object);
}

function updateOperatorThoughts(previousSnapshot, snapshot, controls) {
  if (snapshot.mode !== "running") return;
  if (!previousSnapshot.warning?.fieldWeak && snapshot.warning?.fieldWeak && snapshot.elapsed > 3) {
    emitOperatorThought("field-weak");
  }
  if (!previousSnapshot.reactionStalled && snapshot.reactionStalled) {
    emitOperatorThought("first-quench", 2, 4.2);
  }
  if (snapshot.reactionStalled && controls.fuelInjection >= 30 && controls.coolantFlow <= 58) {
    emitOperatorThought("pulse-ready", 1, 2.8);
  }
  if (previousSnapshot.reactionStalled && !snapshot.reactionStalled) {
    emitOperatorThought("restart-success", 2, 2.4);
  }
  if (!previousSnapshot.warning?.tempCritical && snapshot.warning?.tempCritical) {
    emitOperatorThought("first-redline", 2, 3);
  }
  if (previousSnapshot.phase?.name !== snapshot.phase?.name && snapshot.phase?.name === "SUSTAINED HIGH LOAD") {
    emitOperatorThought("high-load", 1, 3.6);
  }
}

function emitOperatorThought(id, priority = 0, duration = 3.4) {
  if (operatorThoughtsShown.has(id)) return;
  operatorThoughtsShown.add(id);
  const subtitleKey = `subtitles.${id}`;
  const localizedText = translateRequired(subtitleKey);
  window.dispatchEvent(
    new CustomEvent("operatorgame:subtitle", {
      detail: { id, text: localizedText, priority, duration },
    }),
  );
}

function resetOperatorThoughts() {
  operatorThoughtsShown.clear();
  window.dispatchEvent(new CustomEvent("operatorgame:subtitle-clear", { detail: { resetSeen: true } }));
}

function getLampMaterial(lamp, snapshot) {
  if (snapshot.mode === "startupFault") {
    const faultConfig = CONFIG.feedback.startupFault;
    const faultAge = Math.max(0, faultConfig.resetSeconds - (snapshot.resetPending ?? 0));
    if (faultAge < faultConfig.greenLampSeconds) return materials.lampGreen;
    if (faultAge < faultConfig.greenLampSeconds + faultConfig.redLampSeconds) return materials.lampRed;
    return materials.lampOff;
  }
  if (indicatorTestTimer > 0) return getIndicatorTestMaterial(lamps.indexOf(lamp));
  if (snapshot.terminalElapsed != null) {
    if (snapshot.terminalBlackout) return materials.lampOff;
    if (snapshot.mode === "complete") {
      return lamp.name === "LightCase1_Light_ReactionEfficiency" || lamp.name === "LightCase1_Light_FuelQuality"
        ? materials.lampGreen
        : materials.lampOff;
    }
    const warningKey = LAMP_WARNING_KEYS[lamp.name];
    if (snapshot.failureType === "coreDestroyed") {
      if (warningKey === "coreStress" || warningKey === "tempHigh") return materials.lampRed;
      if (warningKey === "instability") return materials.lampAmber;
      return materials.lampOff;
    }
    return warningKey === "coreStall" || warningKey === "outputLow" ? materials.lampAmber : materials.lampOff;
  }

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
    terminalStartupPattern =
      snapshot.failureType === "coreDestroyed" ? createFluorescentStartupPattern() : [];
    resultsTimer = getTerminalResultsDelay(snapshot);
    resultsSnapshot = snapshot;
    terminalSequenceElapsed = 0;
  }
  if (terminalSequenceElapsed >= 0) terminalSequenceElapsed += dt;
  const thoughtDelay =
    snapshot.failureType === "coreDestroyed" ? CONFIG.feedback.terminal.destroyedBlackoutSeconds : 0.8;
  if (terminalSequenceElapsed >= thoughtDelay) {
    if (snapshot.mode === "complete") {
      emitOperatorThought("shift-complete", 3, 4);
    } else if (snapshot.failureType === "coreDestroyed") {
      emitOperatorThought("core-destroyed", 4, 4);
    } else if (snapshot.mode === "failed") {
      emitOperatorThought("fail-safe", 3, 4);
    }
  }

  if (
    bulkheadHandle &&
    !bulkheadExitPending &&
    !bulkheadExitComplete &&
    terminalSequenceElapsed >= getBulkheadUnlockDelay(snapshot)
  ) {
    bulkheadExitPending = true;
    bulkheadHandle.userData.controlLabel = "HOLD TO OPEN BULKHEAD";
    updateControlTooltip();
  }

  if (bulkheadHandle && resultsSnapshot) return;

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
      detail: {
        levelId: activeLevelId,
        mode: activeLevelMode,
        snapshot,
        report,
        levelSession: activeLevelSession?.snapshot() ?? null,
      },
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
  ignitionPulseFeedbackTimer = Math.max(0, ignitionPulseFeedbackTimer - dt);
  roomLightBootTimer = Math.max(0, roomLightBootTimer - dt);
  updateIndicatorTest(dt);
  updateLongTermLightFlicker(dt);
  updateRoomLightFade(dt);
  updateSceneLightFeedback();
  applyCameraFeedback();
}

function triggerStartupFeedback() {
  startupFeedbackTimer = CONFIG.feedback.startup.duration;
  reactorStartupPattern = createFluorescentStartupPattern();
}

function triggerRoomLightBoot() {
  const wasEnabled = roomLightsEnabled;
  roomLightStartupPattern = createFluorescentStartupPattern();
  roomLightsEnabled = true;
  roomLightCurrentFactor = 0;
  roomLightAfterglowTimer = 0;
  roomLightSwitchTimer = 0;
  roomLightSwitchMode = "on";
  roomLightBootTimer = getFluorescentStartupDuration(roomLightStartupPattern);
  if (!wasEnabled) updateControlTooltip();
}

function updateIndicatorTest(dt) {
  const active = controlButtons.some(
    (button) => button.userData.controlAction === "indicatorTest" && button.userData.pressed,
  );
  indicatorTestTimer = active ? Math.min(indicatorTestTimer + dt, CONFIG.feedback.indicatorTest.duration) : 0;
}

function updateLongTermLightFlicker(dt) {
  const updatedStates = new Set();
  [...controlledLights, ...Object.values(materials.interiorCustom)].forEach((target) => {
    const state = target.userData.fixtureFlicker;
    if (!state || updatedStates.has(state)) return;
    updatedStates.add(state);
    updateFixtureFlickerState(state, dt);
  });
}

function getBulkheadUnlockDelay(snapshot) {
  const terminalConfig = CONFIG.feedback.terminal;
  if (snapshot.failureType === "coreDestroyed") {
    const fluorescentBootSeconds = getFluorescentStartupDuration(terminalStartupPattern);
    return (
      terminalConfig.destroyedBlackoutSeconds +
      fluorescentBootSeconds +
      terminalConfig.emergencyLightSettleSeconds
    );
  }
  return terminalConfig.instrumentShutdownSeconds;
}

function getTerminalResultsDelay(snapshot) {
  const terminalConfig = CONFIG.feedback.terminal;
  if (snapshot.failureType === "coreDestroyed") {
    const fluorescentBootSeconds = getFluorescentStartupDuration(terminalStartupPattern);
    return (
      terminalConfig.destroyedBlackoutSeconds +
      fluorescentBootSeconds +
      terminalConfig.emergencyLightSettleSeconds +
      terminalConfig.resultsHoldSeconds
    );
  }
  return terminalConfig.instrumentShutdownSeconds + terminalConfig.resultsHoldSeconds;
}

function getTerminalPresentationSnapshot(snapshot) {
  if (terminalSequenceElapsed < 0 || (snapshot.mode !== "complete" && snapshot.mode !== "failed")) return snapshot;
  const terminalConfig = CONFIG.feedback.terminal;
  const shutdownProgress = THREE.MathUtils.smoothstep(
    terminalSequenceElapsed,
    0.12,
    terminalConfig.instrumentShutdownSeconds,
  );
  const instrumentFactor = 1 - shutdownProgress;
  const destroyed = snapshot.failureType === "coreDestroyed";
  return {
    ...snapshot,
    plasmaTemp: snapshot.plasmaTemp * instrumentFactor,
    containment: snapshot.containment * instrumentFactor,
    powerOutput: snapshot.powerOutput * instrumentFactor,
    burnRate: snapshot.burnRate * instrumentFactor,
    coreStress: snapshot.coreStress * instrumentFactor,
    outputSurge: snapshot.outputSurge * instrumentFactor,
    reactionEfficiency: snapshot.reactionEfficiency * instrumentFactor,
    shutdownLevel: Math.max(snapshot.shutdownLevel ?? 0, shutdownProgress),
    terminalElapsed: terminalSequenceElapsed,
    terminalBlackout: destroyed && terminalSequenceElapsed < terminalConfig.destroyedBlackoutSeconds,
  };
}

function createFixtureFlickerState(overrides = null) {
  const flickerConfig = {
    ...(CONFIG.feedback.longTermLightFlicker ?? {}),
    ...(overrides ?? {}),
  };
  return {
    seed: Math.random() * 1000,
    nextIn: getRandomRangeValue(flickerConfig?.minIntervalSeconds ?? 45, flickerConfig?.maxIntervalSeconds ?? 140),
    elapsed: 0,
    duration: 0,
    pulses: [],
  };
}

function updateFixtureFlickerState(state, dt, overrides = null) {
  const flickerConfig = {
    ...(CONFIG.feedback.longTermLightFlicker ?? {}),
    ...(overrides ?? {}),
  };
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
  const pulseCount = Math.max(3, Math.round(getRandomConfigRange(flickerConfig.pulseCount, 4, 9)));
  const clusterEnd = THREE.MathUtils.randFloat(0.72, 0.94);

  return Array.from({ length: pulseCount }, (_, index) => {
    const sequenceProgress = pulseCount > 1 ? index / (pulseCount - 1) : 0;
    const center = THREE.MathUtils.clamp(
      0.035 + sequenceProgress * clusterEnd + THREE.MathUtils.randFloatSpread(0.075),
      0.015,
      0.98,
    );
    const pulseSeconds = THREE.MathUtils.randFloat(0.025, index === pulseCount - 1 ? 0.075 : 0.13);
    const width = THREE.MathUtils.clamp(pulseSeconds / Math.max(duration, 0.001), 0.018, 0.19);
    const minimumFactor = getRandomConfigRange(flickerConfig.minFactor, 0.04, 0.3);
    const strikeStrength = index === 0 || index === pulseCount - 1 ? 1 : THREE.MathUtils.randFloat(0.72, 1);

    return {
      center,
      width,
      depth: (1 - minimumFactor) * strikeStrength,
      edgePower: THREE.MathUtils.randFloat(0.85, 1.35),
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
    // A glow starter drops out and restrikes abruptly; a broad smooth sine dip reads more like a candle.
    const dip = Math.pow(1 - distance, pulse.edgePower ?? 0.3) * pulse.depth;
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
  const terminalLightFactor = getTerminalLightFactor();
  const sceneFactor = startupLightFactor * outputPulse * emergencyPulse * terminalLightFactor;

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

  if (lutPass) {
    lutPass.intensity = CONFIG.postProcessing.lut?.intensity ?? 1;
  }
  if (colorAdjustmentPass) {
    applyColorAdjustmentConfig(colorAdjustmentPass, emergency);
  }
  if (sharpenPass) {
    const sharpenConfig = CONFIG.postProcessing.sharpen ?? {};
    sharpenPass.uniforms.amount.value = (sharpenConfig.amount ?? 0) + (zoomActive ? sharpenConfig.zoomBoost ?? 0 : 0);
  }
  if (lensDistortionPass) {
    applyLensDistortionConfig(lensDistortionPass, emergency);
  }
}

function getStartupLightFactor() {
  if (startupFeedbackTimer <= 0) return 1;

  const startupConfig = CONFIG.feedback.startup;
  const elapsed = startupConfig.duration - startupFeedbackTimer;
  return getFluorescentStartupFactor(reactorStartupPattern, elapsed);
}

function createFluorescentStartupPattern() {
  const config = CONFIG.feedback.startup.fluorescentStartup ?? {};
  const warmupSeconds = getRandomConfigRange(config.warmupSeconds, 0.12, 0.32);
  const attemptCount = Math.max(2, Math.round(getRandomConfigRange(config.attemptCount, 3, 6)));
  const pattern = [
    { time: 0, factor: 0 },
    { time: warmupSeconds * 0.55, factor: getRandomConfigRange(config.dimFactor, 0.04, 0.18) * 0.45 },
    { time: warmupSeconds, factor: getRandomConfigRange(config.dimFactor, 0.04, 0.18) },
  ];
  let time = warmupSeconds;

  for (let index = 0; index < attemptCount; index += 1) {
    const finalAttempt = index === attemptCount - 1;
    time += getRandomConfigRange(config.attemptOnSeconds, 0.055, 0.16);
    pattern.push({
      time,
      factor: finalAttempt
        ? getRandomConfigRange(config.finalOvershoot, 1, 1.06)
        : getRandomConfigRange(config.strikeFactor, 0.42, 0.92),
    });
    if (finalAttempt) break;
    time += getRandomConfigRange(config.attemptOffSeconds, 0.045, 0.13);
    pattern.push({ time, factor: getRandomConfigRange(config.dimFactor, 0.04, 0.18) });
  }

  time += getRandomConfigRange(config.settleSeconds, 0.16, 0.34);
  pattern.push({ time, factor: 1 });
  return pattern;
}

function getFluorescentStartupDuration(pattern) {
  return pattern?.at(-1)?.time ?? 1.2;
}

function getFluorescentStartupFactor(pattern, elapsed) {
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
  camera.rotation.z -= appliedCameraFeedbackRoll;
  appliedCameraFeedbackRoll = 0;
  const startup = getStartupFeedbackAmount();
  const ignitionPulse = getIgnitionPulseFeedbackAmount();
  const startupFault =
    latestSnapshot.mode === "startupFault"
      ? Math.exp(
          -Math.max(0, CONFIG.feedback.startupFault.resetSeconds - (latestSnapshot.resetPending ?? 0)) * 2,
        )
      : 0;
  const outputLow = latestSnapshot.mode === "running" && latestSnapshot.warning?.outputLow ? 1 : 0;
  const emergency = getThermalEmergencyAmount();
  const shake =
    startup * CONFIG.feedback.startup.cameraShake +
    ignitionPulse * CONFIG.feedback.ignitionPulse.cameraShake +
    startupFault * CONFIG.feedback.startupFault.cameraShake +
    outputLow * CONFIG.feedback.outputLow.cameraShake * flickerWave(11, 0.7) +
    emergency * CONFIG.feedback.thermalEmergency.cameraShake * flickerWave(14, 1.9);
  if (shake <= 0) return;

  camera.position.x += Math.sin(testTime * 39.1) * shake;
  camera.position.y += Math.sin(testTime * 53.7) * shake * 0.45;
  appliedCameraFeedbackRoll = Math.sin(testTime * 31.3) * shake * 0.6;
  camera.rotation.z += appliedCameraFeedbackRoll;
}

function getIgnitionPulseFeedbackAmount() {
  const duration = CONFIG.feedback.ignitionPulse.duration;
  if (ignitionPulseFeedbackTimer <= 0 || duration <= 0) return 0;
  const progress = 1 - ignitionPulseFeedbackTimer / duration;
  return Math.pow(1 - progress, 1.7) * (0.72 + flickerWave(31, 4.2) * 0.28);
}

function getStartupFeedbackAmount() {
  if (startupFeedbackTimer <= 0) return 0;
  return THREE.MathUtils.clamp(startupFeedbackTimer / CONFIG.feedback.startup.duration, 0, 1);
}

function getThermalEmergencyAmount() {
  const temp = THREE.MathUtils.clamp((latestSnapshot.plasmaTemp - 158) / 34, 0, 1);
  const soak = THREE.MathUtils.clamp(((latestSnapshot.thermalSoak ?? 0) - 55) / 45, 0, 1);
  const stress = THREE.MathUtils.clamp((latestSnapshot.coreStress - 72) / 28, 0, 1);
  const surge = THREE.MathUtils.clamp(((latestSnapshot.outputSurge ?? 0) - 34) / 55, 0, 1) * 0.7;
  const amount = Math.max(temp, soak, stress, surge);
  if (latestSnapshot.mode === "running") return amount;
  if (terminalSequenceElapsed >= 0) {
    return (
      amount *
      THREE.MathUtils.clamp(1 - terminalSequenceElapsed / CONFIG.feedback.terminal.emergencyEffectFadeSeconds, 0, 1)
    );
  }
  return 0;
}

function getTerminalLightFactor() {
  if (terminalSequenceElapsed < 0) return 1;
  const terminalConfig = CONFIG.feedback.terminal;
  if (latestSnapshot.mode === "complete") {
    return THREE.MathUtils.lerp(
      1,
      terminalConfig.completeLightFactor,
      THREE.MathUtils.smoothstep(terminalSequenceElapsed, 0.2, 2),
    );
  }
  if (latestSnapshot.failureType === "coreDestroyed") {
    if (terminalSequenceElapsed < terminalConfig.destroyedBlackoutSeconds) return 0;
    const bootElapsed = terminalSequenceElapsed - terminalConfig.destroyedBlackoutSeconds;
    const bootDuration = getFluorescentStartupDuration(terminalStartupPattern);
    if (bootElapsed <= bootDuration) return getFluorescentStartupFactor(terminalStartupPattern, bootElapsed);
    return THREE.MathUtils.lerp(
      1,
      terminalConfig.destroyedLightFactor,
      THREE.MathUtils.smoothstep(
        bootElapsed,
        bootDuration,
        bootDuration + terminalConfig.emergencyLightSettleSeconds,
      ),
    );
  }
  return THREE.MathUtils.lerp(
    1,
    terminalConfig.failedLightFactor,
    THREE.MathUtils.smoothstep(terminalSequenceElapsed, 0.1, 1.6),
  );
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
  let ratio = THREE.MathUtils.clamp((value - range[0]) / (range[1] - range[0]), 0, 1);
  if (snapshot.mode === "startupFault" && CONFIG.feedback.startupFault.sweepGaugeKeys.includes(key)) {
    ratio = getStartupFaultNeedleRatio(snapshot, ratio);
  }
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
    (1 - (snapshot.shutdownLevel ?? 0)) *
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

  const pulseKick =
    getIgnitionPulseFeedbackAmount() *
    THREE.MathUtils.degToRad(CONFIG.feedback.ignitionPulse.needleKickDegrees) *
    Math.sin(testTime * 64 + needle.userData.needleNoiseSeed);
  return (
    ((needle.userData.needleJitterOffset ?? 0) + vibration) * (1 - (snapshot.shutdownLevel ?? 0)) +
    pulseKick
  );
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
  const switchConfig = CONFIG.feedback.roomLightSwitch ?? {};
  const now = clock.elapsedTime;
  const abuseWindowSeconds = switchConfig.abuseWindowSeconds ?? 4;

  roomLightToggleTimes = roomLightToggleTimes.filter((time) => now - time <= abuseWindowSeconds);
  roomLightToggleTimes.push(now);

  if (roomLightStarterFaultTimer > 0) return;
  if (roomLightToggleTimes.length >= (switchConfig.abuseToggleCount ?? 6)) {
    triggerRoomLightStarterFault();
    console.warn("[OperatorGame] Fluorescent starter fault triggered by rapid switching");
    return;
  }

  setRoomLightsEnabled(!roomLightsEnabled);
  console.log(`[OperatorGame] Room lights ${roomLightsEnabled ? "enabled" : "disabled"}`);
}

function triggerRoomLightStarterFault() {
  const switchConfig = CONFIG.feedback.roomLightSwitch ?? {};
  roomLightsEnabled = true;
  roomLightSwitchMode = "fault";
  roomLightCurrentFactor = 0;
  roomLightSwitchTimer = 0;
  roomLightBootTimer = 0;
  roomLightAfterglowTimer = 0;
  roomLightStarterFaultTimer = switchConfig.starterFaultSeconds ?? 20;
  roomLightStarterFaultElapsed = 0;
  roomLightToggleTimes = [];
  updateControlTooltip();
}

function updateRoomLightFade(dt) {
  const buttonConfig = CONFIG.interior.lightToggleButton ?? {};
  const target = roomLightsEnabled ? 1 : 0;
  const switchConfig = CONFIG.feedback.roomLightSwitch ?? {};
  const fadeSeconds = Math.max(
    0.001,
    roomLightsEnabled ? buttonConfig.fadeSeconds ?? 0.3 : switchConfig.lightFadeOutSeconds ?? 0.14,
  );
  roomLightSwitchTimer = Math.max(0, roomLightSwitchTimer - dt);
  roomLightAfterglowTimer = Math.max(0, roomLightAfterglowTimer - dt);
  if (roomLightStarterFaultTimer > 0) {
    roomLightStarterFaultTimer = Math.max(0, roomLightStarterFaultTimer - dt);
    roomLightStarterFaultElapsed += dt;
    roomLightCurrentFactor = getRoomLightStarterFaultFactor();
    if (roomLightStarterFaultTimer <= 0) {
      roomLightStartupPattern = createFluorescentStartupPattern();
      roomLightSwitchMode = "on";
      roomLightSwitchTimer = getFluorescentStartupDuration(roomLightStartupPattern);
      roomLightCurrentFactor = 0;
    }
  } else if (roomLightSwitchMode === "on" && roomLightSwitchTimer > 0) {
    roomLightCurrentFactor = getRoomLightVisualFactor();
  } else {
    roomLightCurrentFactor = THREE.MathUtils.damp(roomLightCurrentFactor, target, 4 / fadeSeconds, dt);
  }
  updateRoomLightMaterials();
}

function getRoomLightVisualFactor() {
  if (roomLightStarterFaultTimer > 0) return getRoomLightStarterFaultFactor();

  if (roomLightBootTimer > 0) {
    const bootDuration = getFluorescentStartupDuration(roomLightStartupPattern);
    const elapsed = bootDuration - roomLightBootTimer;
    return getFluorescentStartupFactor(roomLightStartupPattern, elapsed);
  }

  if (roomLightSwitchTimer > 0 && roomLightSwitchMode === "on") {
    const bootDuration = getFluorescentStartupDuration(roomLightStartupPattern);
    const elapsed = bootDuration - roomLightSwitchTimer;
    return getFluorescentStartupFactor(roomLightStartupPattern, elapsed);
  }

  return roomLightCurrentFactor;
}

function getRoomLightAfterglowFactor() {
  const switchConfig = CONFIG.feedback.roomLightSwitch ?? {};
  const duration = Math.max(0.001, switchConfig.afterglowSeconds ?? 3);
  const progress = THREE.MathUtils.clamp(roomLightAfterglowTimer / duration, 0, 1);
  return (
    (switchConfig.afterglowInitialFactor ?? 0.2) *
    Math.pow(progress, switchConfig.afterglowExponent ?? 2.4)
  );
}

function getRoomLightStarterFaultFactor() {
  return getFluorescentStarterFaultFactor({
    elapsed: roomLightStarterFaultElapsed,
    visualTime: testTime,
    config: CONFIG.feedback.roomLightSwitch,
  });
}

function updateRoomLightMaterials() {
  const switchConfig = CONFIG.feedback.roomLightSwitch ?? {};
  const afterglowSeconds = Math.max(0.001, switchConfig.afterglowSeconds ?? 3);
  const afterglowProgress = THREE.MathUtils.clamp(roomLightAfterglowTimer / afterglowSeconds, 0, 1);
  const afterglowFactor =
    (switchConfig.afterglowInitialFactor ?? 0.2) *
    Math.pow(afterglowProgress, switchConfig.afterglowExponent ?? 2.4);
  const emissiveExponent = CONFIG.feedback.longTermLightFlicker.emissiveExponent ?? 1;
  const startupEmissiveFactor = Math.pow(getStartupLightFactor(), emissiveExponent);
  const visualFactor =
    Math.max(getRoomLightVisualFactor(), afterglowFactor) *
    startupEmissiveFactor *
    getTerminalLightFactor();
  Object.values(materials.interiorCustom).forEach((material) => {
    if (!material.userData.roomLightControlled) return;
    const fixtureFactor = getFixtureFlickerFactor(material);
    const emissiveFlickerFactor = Math.pow(fixtureFactor, emissiveExponent);
    material.emissiveIntensity =
      (material.userData.baseEmissiveIntensity ?? 1) * visualFactor * emissiveFlickerFactor;
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
  if (!pressed) return;
  const bindings = button.userData.levelBindings ?? [];
  if (bindings.length === 0) {
    toggleRoomLights();
    return;
  }
  bindings.forEach(executeLevelBinding);
  activeLevelSession?.emit("buttonPressed", { target: button.name });
}

function executeLevelBinding(binding) {
  const environmentId = getLevelEnvironmentId(activeLevelId);
  if (binding.action === "togglePrefabLight") {
    const prefabConfig = CONFIG.levelEnvironments?.[environmentId]?.prefabs?.find(
      (prefab) => prefab.name === binding.target,
    );
    const runtime = levelPrefabInstances.get(`${environmentId}:${binding.target}`);
    if (!prefabConfig?.light || !runtime?.light) return false;
    const wasEnabled = prefabConfig.light.enabled !== false;
    prefabConfig.light.enabled = !wasEnabled;
    if (wasEnabled) {
      runtime.afterglowRemaining = prefabConfig.light.afterglow?.durationSeconds ?? 3;
    } else {
      runtime.startupElapsed = 0;
      runtime.faultyStarterElapsed = 0;
      runtime.startupPattern = prefabConfig.light.fluorescentStartup
        ? createFluorescentStartupPattern()
        : [];
    }
    return true;
  }
  if (binding.action === "toggleRoomLights") {
    toggleRoomLights();
    return true;
  }
  console.warn("[LevelSession] Unknown binding action", binding);
  return false;
}

function startShift() {
  if (latestSnapshot.mode === "running") {
    fusionCore.triggerStartupFault();
    emitOperatorThought("startup-command-fault", 4, 3.6);
    return;
  }
  if (latestSnapshot.mode !== "standby") return;
  resetShiftRecorder();
  hideShiftResults();
  resetBulkheadExit();
  resetOperatorThoughts();
  fusionCore.start();
  previousGameMode = "running";
  resultsTimer = 0;
  resultsSnapshot = null;
  terminalSequenceElapsed = -1;
  triggerStartupFeedback();
  emitOperatorThought("shift-start", 1, 3.6);
  indicatorTestTimer = 0;
  statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
}

function resetShift() {
  resetShiftRecorder();
  hideShiftResults();
  resetBulkheadExit();
  resetOperatorThoughts();
  fusionCore.reset();
  previousGameMode = "standby";
  resultsTimer = 0;
  resultsSnapshot = null;
  terminalSequenceElapsed = -1;
  startupFeedbackTimer = 0;
  indicatorTestTimer = 0;
  statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
}

function resetOperatorView() {
  operatorViewMode = "level";
  document.exitPointerLock?.();
  keys.clear();
  jumpQueued = false;
  movementVelocity.set(0, 0, 0);
  headBobTime = 0;
  leanAmount = 0;
  zoomActive = false;
  const levelPlayerConfig = CONFIG.levelEnvironments?.[activeLevelId]?.player;
  const spawnPosition = levelPlayerConfig?.spawnPosition ?? playerSpawnPosition;
  const spawnRotation = levelPlayerConfig?.rotationDegrees;
  playerPosition.copy(spawnPosition);
  physicsSystem?.teleportCharacter(playerPosition);
  syncPlayerCapsule();
  camera.position.copy(spawnPosition);
  yaw = THREE.MathUtils.degToRad(spawnRotation?.y ?? CONFIG.player?.spawnYawDegrees ?? 0);
  pitch = THREE.MathUtils.degToRad(spawnRotation?.x ?? CONFIG.player?.spawnPitchDegrees ?? 0);
  pointer.set(0, 0);
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  camera.rotation.z = THREE.MathUtils.degToRad(spawnRotation?.z ?? 0);
}

function setRoomLightsEnabled(enabled, { instant = false } = {}) {
  const wasEnabled = roomLightsEnabled;
  roomLightStarterFaultTimer = 0;
  roomLightStarterFaultElapsed = 0;
  if (instant) roomLightToggleTimes = [];
  roomLightsEnabled = Boolean(enabled);
  if (!instant && roomLightsEnabled) roomLightStartupPattern = createFluorescentStartupPattern();
  roomLightSwitchMode = roomLightsEnabled ? "on" : "off";
  roomLightSwitchTimer = instant
    ? 0
    : roomLightsEnabled
      ? getFluorescentStartupDuration(roomLightStartupPattern)
      : CONFIG.interior.lightToggleButton?.fadeSeconds ?? 0.3;
  roomLightBootTimer = 0;
  roomLightAfterglowTimer =
    !instant && wasEnabled && !roomLightsEnabled ? CONFIG.feedback.roomLightSwitch?.afterglowSeconds ?? 3 : 0;
  if (instant) roomLightCurrentFactor = roomLightsEnabled ? 1 : 0;
  updateControlTooltip();
}

async function enterMenuView() {
  const loadedLevelId = await loadLevelEnvironment("intro-shift");
  if (loadedLevelId !== "intro-shift") return false;
  resetLevelDoors();
  operatorViewMode = "menu";
  updateActiveLevelEnvironment();
  document.exitPointerLock?.();
  keys.clear();
  movementVelocity.set(0, 0, 0);
  headBobTime = 0;
  leanAmount = 0;
  zoomActive = false;
  pointer.set(0, 0);

  const menuView = CONFIG.camera.menuView;
  if (menuView?.position && menuView?.rotationDegrees) {
    playerPosition.copy(menuView.position);
    applyCameraPose(menuView.position, menuView.rotationDegrees);
    yaw = THREE.MathUtils.degToRad(menuView.rotationDegrees.y ?? 0);
    pitch = THREE.MathUtils.degToRad(menuView.rotationDegrees.x ?? 0);
  }

  setRoomLightsEnabled(Boolean(menuView?.roomLightsOn), { instant: true });
  return true;
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
  playerController.reset();
  operatorPanelRuntime.reset();
  resetBulkheadExit();
  freezeNeedles = false;
  needles.forEach((needle) => {
    needle.userData.needleDebugAxis = null;
  });
  resultsTimer = 0;
  resultsSnapshot = null;
  terminalSequenceElapsed = -1;
}

function updateActiveLevelSession(dt) {
  if (!activeLevelSession || operatorViewMode !== "level") return;
  const state = activeLevelSession.update(dt, {
    shiftMode: latestSnapshot.mode,
    shiftElapsed: latestSnapshot.elapsed,
    createCheckpoint: () => ({
      fusionCore: fusionCore.exportState(),
      controls: Object.fromEntries(
        controlKnobs.map((knob) => [knob.name, knob.userData.controlPercent ?? 0]),
      ),
    }),
  });
  if (state.status === previousLevelSessionStatus) return;
  previousLevelSessionStatus = state.status;
  if (state.status === "complete") {
    window.dispatchEvent(
      new CustomEvent("operatorgame:level-objectives-complete", {
        detail: { levelId: activeLevelId, session: state },
      }),
    );
  }
}

async function resetForMenu() {
  activeLevelSession?.reset({ clearSaved: true });
  activeLevelSession = null;
  previousLevelSessionStatus = "idle";
  resetLevelSession();
  resetShift();
  await enterMenuView();
}

async function enterLevelSession({ levelId = activeLevelId, mode = activeLevelMode } = {}) {
  stopPositionGizmo();
  const loadedLevelId = await loadLevelEnvironment(levelId);
  if (loadedLevelId !== getLevelEnvironmentId(levelId)) return false;
  activeLevelId = levelId;
  activeLevelMode = mode;
  activeLevelSession?.reset({ clearSaved: true });
  activeLevelSession = new LevelSession({
    levelId,
    config: CONFIG.levelEnvironments?.[loadedLevelId]?.session ?? {},
  });
  const levelSessionState = activeLevelSession.start({ resume: true });
  const runtimeCheckpoint = activeLevelSession.getCheckpoint("runtime");
  previousLevelSessionStatus = levelSessionState.status;
  operatorViewMode = "level";
  resetLevelDoors(activeLevelId);
  updateActiveLevelEnvironment();
  levelPrefabInstances.forEach((runtime, key) => {
    if (!key.startsWith(`${activeLevelId}:`) || !runtime.light?.userData.lightConfig?.fluorescentStartup) return;
    runtime.startupPattern = createFluorescentStartupPattern();
    runtime.startupElapsed = 0;
    runtime.faultyStarterElapsed = 0;
  });
  setRoomLightsEnabled(true, { instant: false });
  resetLevelSession();
  resetShiftRecorder();
  fusionCore.reset();
  if (runtimeCheckpoint?.fusionCore) fusionCore.restoreState(runtimeCheckpoint.fusionCore);
  if (runtimeCheckpoint?.controls) {
    controlKnobs.forEach((knob) => {
      const savedPercent = runtimeCheckpoint.controls[knob.name];
      if (!Number.isFinite(savedPercent)) return;
      knob.userData.controlPercent = savedPercent;
      applyControlKnobRotation(knob);
    });
  }
  previousGameMode = fusionCore.getSnapshot().mode;
  statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
  return true;
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
  if (operatorViewMode === "menu") return;

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
  if (!noclipEnabled) {
    if (jumpQueued) physicsSystem?.jump(CONFIG.player?.collision?.jumpSpeed ?? 3.2);
    jumpQueued = false;
    movePlayerWithCollisions(movementVelocity.clone().multiplyScalar(dt), dt);
    syncPlayerCapsule();
  } else {
    playerPosition.addScaledVector(movementVelocity, dt);
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
  const leanOffset = forward
    .clone()
    .multiplyScalar(leanAmount * (movementConfig.leanForward ?? 0.16));
  leanOffset.y -= leanAmount * (movementConfig.leanDown ?? 0.025);
  applyCollisionLimitedCameraOffset(leanOffset);
}

function movePlayerWithCollisions(delta, dt = 1 / 60) {
  const physicsSceneKey =
    operatorViewMode !== "menu" && CONFIG.levelEnvironments?.[activeLevelId]
      ? getLevelEnvironmentId(activeLevelId)
      : "default";
  if (physicsSystem?.hasCharacter() && physicsSystem.hasScene(physicsSceneKey)) {
    const nextPosition = physicsSystem.moveCharacter(delta, dt);
    if (nextPosition) {
      playerPosition.copy(nextPosition);
      syncPlayerCapsule();
      return;
    }
  }

  const originalStart = playerCapsule.start.clone();
  const originalEnd = playerCapsule.end.clone();
  const originalVelocity = movementVelocity.clone();
  playerCapsule.translate(delta);
  resolvePlayerCollisions();

  const desiredHorizontalDistance = Math.hypot(delta.x, delta.z);
  const normalHorizontalDistance = Math.hypot(
    playerCapsule.start.x - originalStart.x,
    playerCapsule.start.z - originalStart.z,
  );
  const stepHeight = Math.max(0, CONFIG.player?.collision?.stepHeight ?? 0);
  if (
    stepHeight > 0 &&
    desiredHorizontalDistance > 0.0001 &&
    normalHorizontalDistance < desiredHorizontalDistance * 0.7
  ) {
    const normalStart = playerCapsule.start.clone();
    const normalEnd = playerCapsule.end.clone();
    const normalVelocity = movementVelocity.clone();

    playerCapsule.start.copy(originalStart);
    playerCapsule.end.copy(originalEnd);
    movementVelocity.copy(originalVelocity);
    playerCapsule.translate(new THREE.Vector3(0, stepHeight, 0));
    const blockedAbove = collisionOctree.capsuleIntersect(playerCapsule);
    if (!blockedAbove) {
      playerCapsule.translate(delta);
      resolvePlayerCollisions();
      playerCapsule.translate(new THREE.Vector3(0, -stepHeight, 0));
      resolvePlayerCollisions();
      const steppedHorizontalDistance = Math.hypot(
        playerCapsule.start.x - originalStart.x,
        playerCapsule.start.z - originalStart.z,
      );
      const acceptableFloor = playerCapsule.start.y >= originalStart.y - 0.02;
      if (steppedHorizontalDistance <= normalHorizontalDistance + 0.001 || !acceptableFloor) {
        playerCapsule.start.copy(normalStart);
        playerCapsule.end.copy(normalEnd);
        movementVelocity.copy(normalVelocity);
      }
    } else {
      playerCapsule.start.copy(normalStart);
      playerCapsule.end.copy(normalEnd);
      movementVelocity.copy(normalVelocity);
    }
  }

  playerPosition.set(
    playerCapsule.start.x,
    playerCapsule.start.y + CONFIG.playerEyeHeight - playerCollisionRadius,
    playerCapsule.start.z,
  );
}

function getStartupFaultNeedleRatio(snapshot, fallbackRatio) {
  const config = CONFIG.feedback.startupFault;
  const age = Math.max(0, config.resetSeconds - (snapshot.resetPending ?? 0));
  const upEnd = config.needleSweepUpSeconds;
  const holdEnd = upEnd + config.needleSweepHoldSeconds;
  const downEnd = holdEnd + config.needleSweepDownSeconds;
  if (age < upEnd) return THREE.MathUtils.smoothstep(age, 0, upEnd);
  if (age < holdEnd) return 1;
  if (age < downEnd) return 1 - THREE.MathUtils.smoothstep(age, holdEnd, downEnd);
  return fallbackRatio;
}

function resolvePlayerCollisions() {
  if (!collisionReady) return;

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const collision = collisionOctree.capsuleIntersect(playerCapsule);
    if (!collision) break;
    const floorThreshold = CONFIG.player?.collision?.floorNormalThreshold ?? 0.55;
    const collisionNormal = collision.normal.clone();
    const correction =
      collisionNormal.y >= floorThreshold
        ? new THREE.Vector3(0, collision.depth / Math.max(collisionNormal.y, 0.001), 0)
        : collisionNormal.multiplyScalar(collision.depth);
    playerCapsule.translate(correction);
    const velocityIntoSurface = movementVelocity.dot(collision.normal);
    if (velocityIntoSurface < 0) {
      movementVelocity.addScaledVector(collision.normal, -velocityIntoSurface);
    }
  }
}

function syncPlayerCapsule() {
  const feetY = playerPosition.y - CONFIG.playerEyeHeight;
  playerCapsule.start.set(playerPosition.x, feetY + playerCollisionRadius, playerPosition.z);
  playerCapsule.end.set(
    playerPosition.x,
    feetY + playerCollisionHeight - playerCollisionRadius,
    playerPosition.z,
  );
}

function applyCollisionLimitedCameraOffset(offset) {
  const distance = offset.length();
  if (!collisionReady || distance <= 0.0001) {
    camera.position.add(offset);
    return;
  }

  const origin = camera.position.clone();
  const probePosition = new THREE.Vector3();
  const stepLength = Math.max(cameraCollisionRadius * 0.5, 0.01);
  const stepCount = Math.max(1, Math.ceil(distance / stepLength));
  let safeFraction = 0;

  for (let step = 1; step <= stepCount; step += 1) {
    const testFraction = step / stepCount;
    probePosition.copy(origin).addScaledVector(offset, testFraction);
    cameraCollisionCapsule.start.copy(probePosition);
    cameraCollisionCapsule.end.copy(probePosition);

    if (!collisionOctree.capsuleIntersect(cameraCollisionCapsule)) {
      safeFraction = testFraction;
      continue;
    }

    let low = safeFraction;
    let high = testFraction;
    for (let iteration = 0; iteration < 6; iteration += 1) {
      const middle = (low + high) * 0.5;
      probePosition.copy(origin).addScaledVector(offset, middle);
      cameraCollisionCapsule.start.copy(probePosition);
      cameraCollisionCapsule.end.copy(probePosition);
      if (collisionOctree.capsuleIntersect(cameraCollisionCapsule)) high = middle;
      else low = middle;
    }
    safeFraction = low;
    break;
  }

  camera.position.copy(origin).addScaledVector(offset, safeFraction);
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
  if (inputLocked || document.body.classList.contains("app-ui-open")) return;
  canvas.requestPointerLock?.();
}

function setInputLocked(locked) {
  inputLocked = Boolean(locked);
  if (inputLocked) {
    endHingedDoorDrag();
    setHoveredHingedDoor(null);
    document.exitPointerLock?.();
    keys.clear();
    jumpQueued = false;
    movementVelocity.set(0, 0, 0);
    zoomActive = false;
    releaseAllControlButtons();
    setHoveredKnob(null);
    setHoveredTooltipTarget(null);
  }
  return inputLocked;
}

function resizeRendererTargets() {
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
  if (gtaoPass) {
    const gtaoScale = getGtaoPreset(gtaoQuality).resolutionScale ?? 1;
    gtaoPass.setSize(
      Math.max(1, Math.round(window.innerWidth * gtaoScale)),
      Math.max(1, Math.round(window.innerHeight * gtaoScale)),
    );
  }
  bloomPass?.setSize(window.innerWidth, window.innerHeight);
  sharpenPass?.uniforms.resolution.value.set(window.innerWidth, window.innerHeight);
  updateFxaaResolution();
}

window.addEventListener("resize", resizeRendererTargets);

document.addEventListener("keydown", (event) => {
  const toggleSequence = String(CONFIG.sceneDebug?.toggleSequence ?? "debug3").toLowerCase();
  const target = event.target;
  const isEditing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable;
  if (isEditing || event.ctrlKey || event.altKey || event.metaKey || event.repeat || event.key.length !== 1) return;

  debugToggleBuffer = `${debugToggleBuffer}${event.key.toLowerCase()}`.slice(-toggleSequence.length);
  if (debugToggleBuffer !== toggleSequence) return;
  debugToggleBuffer = "";
  event.preventDefault();
  toggleDebugPanels();
});

document.addEventListener("keydown", (event) => {
  if (inputLocked) {
    if (
      ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight", "Space", "ControlLeft", "ControlRight"].includes(
        event.code,
      )
    ) {
      event.preventDefault();
    }
    return;
  }

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
  if (event.code === "Space" && !event.repeat && !noclipEnabled) jumpQueued = true;
  keys.add(event.code);
});
document.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

document.addEventListener("mousemove", (event) => {
  if (inputLocked) return;

  if (draggedHingedDoor) {
    updateCameraLook(event.movementX, event.movementY);
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.updateMatrixWorld(true);
    updateHingedDoorDrag();
    return;
  }

  if (document.pointerLockElement !== canvas) {
    updatePointerFromEvent(event);
    return;
  }

  pointer.set(0, 0);
  updateCameraLook(event.movementX, event.movementY);
});

function updateCameraLook(movementX, movementY) {
  const movementConfig = CONFIG.camera.operatorMovement ?? {};
  const sensitivity =
    CONFIG.camera.mouseSensitivity *
    (zoomActive ? movementConfig.zoomSensitivityMultiplier ?? 0.48 : 1);
  yaw -= movementX * sensitivity;
  pitch -= movementY * sensitivity;
  const pitchLimitDegrees = zoomActive
    ? CONFIG.camera.leanPitchLimitDegrees ?? CONFIG.camera.pitchLimitDegrees ?? 88
    : CONFIG.camera.pitchLimitDegrees ?? 72;
  const pitchLimit = THREE.MathUtils.degToRad(pitchLimitDegrees);
  pitch = THREE.MathUtils.clamp(pitch, -pitchLimit, pitchLimit);
}

canvas.addEventListener(
  "wheel",
  (event) => {
    if (inputLocked) return;

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
    window.dispatchEvent(
      new CustomEvent("operatorgame:knob-adjusted", {
        detail: {
          levelId: activeLevelId,
          name: hoveredKnob.name,
          percent: hoveredKnob.userData.controlPercent,
        },
      }),
    );
  },
  { passive: false },
);

canvas.addEventListener("mousedown", (event) => {
  if (debugTransformEdit) return;
  if (inputLocked) {
    event.preventDefault();
    return;
  }

  if (event.button === 2) {
    event.preventDefault();
    zoomActive = true;
    window.dispatchEvent(
      new CustomEvent("operatorgame:input-action", {
        detail: { action: "lean", levelId: activeLevelId },
      }),
    );
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
  } else if (hoveredInteractive?.userData.kind === "bulkheadHandle") {
    beginBulkheadHandleInteraction();
  } else if (hoveredInteractive?.userData.kind === "hingedDoor") {
    toggleHingedDoor(hoveredInteractive);
  }
});

window.addEventListener("mouseup", (event) => {
  if (event.button === 2) zoomActive = false;
  if (event.button === 0) {
    bulkheadHandleHeld = false;
    endHingedDoorDrag();
  }
  releaseAllControlButtons();
});

canvas.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("blur", () => {
  zoomActive = false;
  bulkheadHandleHeld = false;
  endHingedDoorDrag();
  releaseAllControlButtons();
});

function updatePointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener("click", () => {
  if (inputLocked) return;
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

let performanceBenchmarkPromise = null;
let lastPerformanceBenchmark = null;

function runPerformanceBenchmark(options = {}) {
  if (performanceBenchmarkPromise) return performanceBenchmarkPromise;

  performanceBenchmarkPromise = executePerformanceBenchmark(options).finally(() => {
    performanceBenchmarkPromise = null;
  });
  return performanceBenchmarkPromise;
}

async function executePerformanceBenchmark(options = {}) {
  const benchmarkConfig = CONFIG.debug?.performanceBenchmark ?? {};
  const warmupMs = Math.max(0, Number(options.warmupSeconds ?? benchmarkConfig.warmupSeconds ?? 0.75) * 1000);
  const sampleMs = Math.max(500, Number(options.sampleSeconds ?? benchmarkConfig.sampleSeconds ?? 2) * 1000);
  const textureWaitTimeoutMs = Math.max(
    5000,
    Number(options.textureWaitTimeoutSeconds ?? benchmarkConfig.textureWaitTimeoutSeconds ?? 45) * 1000,
  );
  const postProcessingBackup = structuredClone(CONFIG.postProcessing);
  const pixelRatioBackup = renderer.getPixelRatio();
  const qualityBackup = {
    shadows: shadowQuality,
    gtao: gtaoQuality,
    ssgi: ssgiQuality,
    ssr: ssrQuality,
    screenSpaceShadows: screenSpaceShadowQuality,
  };
  const inputLockedBackup = inputLocked;
  const results = [];
  const screenshots = [];

  const presets = options.quick
    ? ["low", "medium", "high"].map((profile) => {
        const quality = getGraphicsQualityProfile(profile);
        return {
          name: `PROFILE ${profile.toUpperCase()}`,
          post: true,
          dpr: quality.pixelRatio,
          msaa: 0,
          shadows: quality.shadowQuality,
          gtao: quality.gtaoQuality,
          effects: quality.effects,
        };
      })
    : [
    { name: "RAW DPR 0.50", post: false, dpr: 0.5 },
    { name: "RAW DPR 0.75", post: false, dpr: 0.75 },
    { name: "RAW DPR 1.00", post: false, dpr: 1 },
    { name: "COMPOSER MSAA 0", post: true, dpr: 1, msaa: 0 },
    { name: "COMPOSER MSAA 4", post: true, dpr: 1, msaa: 4 },
    { name: "BLOOM", post: true, dpr: 1, effects: ["bloom"] },
    { name: "BLOOM + LENS FX", post: true, dpr: 1, effects: ["bloom", "lensEffects"] },
    { name: "LUT", post: true, dpr: 1, effects: ["lut"] },
    { name: "COLOR + VIGNETTE", post: true, dpr: 1, effects: ["colorAdjustments"] },
    { name: "SHARPEN", post: true, dpr: 1, effects: ["sharpen"] },
    { name: "CHROMATIC", post: true, dpr: 1, effects: ["chromaticAberration"] },
    { name: "SHADOWS 512", post: false, dpr: 1, shadows: "min" },
    { name: "SHADOWS 2K", post: false, dpr: 1, shadows: "max" },
    { name: "GTAO MIN", post: true, dpr: 1, gtao: "min" },
    { name: "FULL DPR 0.50 / MSAA 0", restore: true, dpr: 0.5, msaa: 0 },
    { name: "FULL DPR 0.75 / MSAA 0", restore: true, dpr: 0.75, msaa: 0 },
    { name: "FULL DPR 1.00 / MSAA 0", restore: true, dpr: 1, msaa: 0 },
    { name: "FULL DPR 1.00 / MSAA 4", restore: true, dpr: 1, msaa: 4 },
      ];

  inputLocked = true;
  const loadingProfile = options.skipTextureWait
    ? { durationSeconds: 0, textureCount: 0, completedTextures: 0, worstFrameMs: 0, p95FrameMs: 0 }
    : await profileTextureStreaming(textureWaitTimeoutMs);
  console.info(
    `[OperatorGame benchmark] Textures settled after ${loadingProfile.durationSeconds}s; ` +
      `worst frame ${loadingProfile.worstFrameMs} ms, p95 ${loadingProfile.p95FrameMs} ms`,
  );
  console.info(`[OperatorGame benchmark] Starting ${presets.length} presets at ${window.innerWidth}x${window.innerHeight}`);

  try {
    for (const preset of presets) {
      applyBenchmarkPreset(preset, postProcessingBackup, qualityBackup);

      await waitForBenchmarkTime(warmupMs);
      const sample = await measureBenchmarkFrames(sampleMs);
      const row = {
        preset: preset.name,
        avgFps: Number(sample.avgFps.toFixed(1)),
        avgFrameMs: Number(sample.avgFrameMs.toFixed(2)),
        p95FrameMs: Number(sample.p95FrameMs.toFixed(2)),
        dpr: renderer.getPixelRatio(),
        buffer: `${renderer.domElement.width}x${renderer.domElement.height}`,
        msaa: composer?.renderTarget1?.samples ?? 0,
      };
      results.push(row);
      if (options.showReport !== false) {
        screenshots.push({ name: preset.name, image: captureBenchmarkThumbnail() });
      }
      console.info(`[OperatorGame benchmark] ${preset.name}: ${row.avgFps} FPS, ${row.avgFrameMs} ms/frame`);
    }
  } finally {
    restoreBenchmarkPostProcessingConfig(postProcessingBackup);
    renderer.setPixelRatio(pixelRatioBackup);
    gtaoQuality = qualityBackup.gtao;
    ssgiQuality = qualityBackup.ssgi;
    ssrQuality = qualityBackup.ssr;
    screenSpaceShadowQuality = qualityBackup.screenSpaceShadows;
    setShadowQuality(qualityBackup.shadows);
    setupPostProcessing();
    resizeRendererTargets();
    inputLocked = inputLockedBackup;
  }

  lastPerformanceBenchmark = {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    drawingBuffer: `${renderer.domElement.width}x${renderer.domElement.height}`,
    canvasAntialias: renderer.getContext().getContextAttributes()?.antialias ?? null,
    loadingProfile,
    results,
  };
  if (options.showReport !== false) showPerformanceBenchmarkReport(lastPerformanceBenchmark, screenshots);
  console.table(results);
  console.info(
    `[OperatorGame benchmark result] ${JSON.stringify({
      ...lastPerformanceBenchmark,
    })}`,
  );
  return lastPerformanceBenchmark;
}

function applyBenchmarkPreset(preset, postProcessingBackup, qualityBackup) {
  restoreBenchmarkPostProcessingConfig(preset.restore ? postProcessingBackup : defaultPostProcessingConfig);
  CONFIG.postProcessing.enabled = Boolean(preset.post || preset.restore);
  for (const key of ["bloom", "lut", "colorAdjustments", "sharpen", "lensEffects", "lensDistortion", "chromaticAberration"]) {
    if (CONFIG.postProcessing[key] && !preset.restore) {
      CONFIG.postProcessing[key].enabled = preset.effects?.includes(key) ?? false;
    }
  }
  CONFIG.postProcessing.antiAliasing.method = "off";
  CONFIG.postProcessing.antiAliasing.msaaSamples = preset.msaa ?? 0;
  gtaoQuality = preset.restore ? qualityBackup.gtao : preset.gtao ?? "off";
  ssgiQuality = preset.restore ? qualityBackup.ssgi : "off";
  ssrQuality = preset.restore ? qualityBackup.ssr : "off";
  screenSpaceShadowQuality = preset.restore ? qualityBackup.screenSpaceShadows : "off";
  renderer.setPixelRatio(preset.dpr ?? 1);
  setShadowQuality(preset.restore ? qualityBackup.shadows : preset.shadows ?? "off");
  setupPostProcessing();
  resizeRendererTargets();
}

async function profileTextureStreaming(timeoutMs) {
  const frameTimes = [];
  const startedAt = performance.now();
  let previousFrame = startedAt;
  let lastSignature = "";
  let lastChangeAt = startedAt;
  const earliestSettleAt =
    startedAt + (Number(CONFIG.textureStreaming?.fullLoadDelaySeconds ?? 4) + 3.5) * 1000;

  while (performance.now() - startedAt < timeoutMs) {
    await new Promise((resolve) =>
      requestAnimationFrame((time) => {
        frameTimes.push(time - previousFrame);
        previousFrame = time;
        resolve();
      }),
    );
    const signature = `${runtimeTextureLoading.total}:${runtimeTextureLoading.completed}:${runtimeTextureLoading.active}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      lastChangeAt = performance.now();
    }
    const quiet = performance.now() - lastChangeAt >= 2500;
    const finished = runtimeTextureLoading.active === 0 && runtimeTextureLoading.completed === runtimeTextureLoading.total;
    if (performance.now() >= earliestSettleAt && quiet && finished) break;
  }

  const sorted = [...frameTimes].sort((a, b) => a - b);
  return {
    durationSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(2)),
    textureCount: runtimeTextureLoading.total,
    completedTextures: runtimeTextureLoading.completed,
    worstFrameMs: Number((sorted.at(-1) ?? 0).toFixed(2)),
    p95FrameMs: Number((sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] ?? 0).toFixed(2)),
  };
}

function captureBenchmarkThumbnail() {
  const source = renderer.domElement;
  const width = Math.min(720, source.width);
  const height = Math.max(1, Math.round((source.height / Math.max(1, source.width)) * width));
  const thumbnail = document.createElement("canvas");
  thumbnail.width = width;
  thumbnail.height = height;
  thumbnail.getContext("2d").drawImage(source, 0, 0, width, height);
  return thumbnail.toDataURL("image/jpeg", 0.82);
}

function showPerformanceBenchmarkReport(report, screenshots) {
  document.querySelector("#performanceBenchmarkReport")?.remove();
  const overlay = document.createElement("section");
  overlay.id = "performanceBenchmarkReport";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:100000;overflow:auto;background:#07100df2;color:#d7eadf;" +
    "font:13px/1.4 ui-monospace,monospace;padding:24px;";
  const title = document.createElement("h2");
  title.textContent = `GPU BENCHMARK · ${report.viewport} · canvas AA ${report.canvasAntialias ? "ON" : "OFF"}`;
  overlay.append(title);
  const loading = document.createElement("p");
  loading.textContent =
    `Texture streaming: ${report.loadingProfile.durationSeconds}s, ` +
    `${report.loadingProfile.completedTextures}/${report.loadingProfile.textureCount} textures, ` +
    `worst frame ${report.loadingProfile.worstFrameMs}ms`;
  overlay.append(loading);
  const table = document.createElement("table");
  table.style.cssText = "border-collapse:collapse;width:100%;margin-bottom:20px";
  table.innerHTML =
    "<thead><tr><th>Preset</th><th>FPS</th><th>Avg ms</th><th>P95 ms</th><th>DPR</th><th>Buffer</th><th>MSAA</th></tr></thead>";
  const body = document.createElement("tbody");
  report.results.forEach((row) => {
    const tr = document.createElement("tr");
    [row.preset, row.avgFps, row.avgFrameMs, row.p95FrameMs, row.dpr, row.buffer, row.msaa].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = String(value);
      td.style.cssText = "border:1px solid #365044;padding:5px 8px";
      tr.append(td);
    });
    body.append(tr);
  });
  table.append(body);
  overlay.append(table);
  const gallery = document.createElement("div");
  gallery.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px";
  screenshots.forEach(({ name, image }) => {
    const card = document.createElement("a");
    card.href = image;
    card.download = `${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.jpg`;
    card.style.cssText = "color:inherit;text-decoration:none;border:1px solid #365044;padding:8px";
    const label = document.createElement("div");
    label.textContent = name;
    const img = document.createElement("img");
    img.src = image;
    img.alt = `${name} benchmark screenshot`;
    img.style.cssText = "display:block;width:100%;margin-top:6px";
    card.append(label, img);
    gallery.append(card);
  });
  overlay.append(gallery);
  document.body.append(overlay);
}

function restoreBenchmarkPostProcessingConfig(source) {
  Object.keys(CONFIG.postProcessing).forEach((key) => delete CONFIG.postProcessing[key]);
  Object.assign(CONFIG.postProcessing, structuredClone(source));
}

function waitForBenchmarkTime(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function measureBenchmarkFrames(durationMs) {
  return new Promise((resolve) => {
    const frameTimes = [];
    let startTime = 0;
    let previousTime = 0;

    function sampleFrame(time) {
      if (!startTime) {
        startTime = time;
        previousTime = time;
      } else {
        frameTimes.push(time - previousTime);
        previousTime = time;
      }

      if (time - startTime < durationMs) {
        requestAnimationFrame(sampleFrame);
        return;
      }

      const elapsedSeconds = Math.max(0.001, (time - startTime) / 1000);
      const sortedFrameTimes = [...frameTimes].sort((a, b) => a - b);
      const p95Index = Math.min(sortedFrameTimes.length - 1, Math.floor(sortedFrameTimes.length * 0.95));
      resolve({
        avgFps: frameTimes.length / elapsedSeconds,
        avgFrameMs: frameTimes.length ? frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length : 0,
        p95FrameMs: sortedFrameTimes[Math.max(0, p95Index)] ?? 0,
      });
    }

    requestAnimationFrame(sampleFrame);
  });
}

function applyQualityProfile(profile = "low") {
  const normalized = configureQualityProfile(profile);
  const quality = getGraphicsQualityProfile(normalized);
  bootOptions.qualityProfile = normalized;
  bootOptions.deferFullTextures = false;
  bootOptions.disableFullTextures = !quality.fullTextures;
  renderer.setPixelRatio(quality.pixelRatio);
  gtaoQuality = quality.gtaoQuality;
  ssgiQuality = "off";
  ssrQuality = "off";
  screenSpaceShadowQuality = "off";
  setShadowQuality(quality.shadowQuality);
  setupPostProcessing();
  resizeRendererTargets();
  return normalized;
}

function setDisplayGamma(gamma = 0.93) {
  const value = THREE.MathUtils.clamp(Number(gamma) || 0.93, 0.75, 1.25);
  CONFIG.postProcessing.colorAdjustments.gamma = value;
  if (colorAdjustmentPass) applyColorAdjustmentConfig(colorAdjustmentPass, 0);
  return value;
}

window.operatorGameDebug = {
  scene,
  camera,
  renderer,
  physics: physicsSystem,
  config: CONFIG,
  startGame: startShift,
  resetGame: resetForMenu,
  restartGame: enterLevelSession,
  startLevel: enterLevelSession,
  loadLevel: enterLevelSession,
  resetForMenu,
  showLoadingScreen: showRouteLoading,
  finishLoadingScreen: finishRouteLoading,
  isLoadingComplete: () => loadingComplete,
  hideShiftResults,
  requestPointerLock,
  releasePointerLock: () => document.exitPointerLock?.(),
  setInputLocked,
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
    return setDebugPanelsVisible(visible);
  },
  setShadowQuality,
  setGtaoQuality,
  setSsgiQuality,
  setSsrQuality,
  setScreenSpaceShadowQuality,
  setDebugPanelsVisible,
  toggleDebugPanels,
  saveSceneDebugPreset: () => sceneDebugPanels?.save(),
  saveSceneDebugToProject: () => sceneDebugPanels?.saveProject(),
  loadSceneDebugPreset: () => sceneDebugPanels?.load(),
  resetSceneDebugPreset: () => sceneDebugPanels?.reset(),
  copySceneDebugConfig: () => sceneDebugPanels?.copyConfig(),
  rebuildPostProcessing: () => postProcessingRuntime.setup(),
  showPostProcessingPanel: () => postProcessingDebugPanel?.show(),
  hidePostProcessingPanel: () => postProcessingDebugPanel?.hide(),
  togglePostProcessingPanel: () => postProcessingDebugPanel?.toggle(),
  savePostProcessingPreset: () => postProcessingDebugPanel?.save(),
  savePostProcessingToProject: () => postProcessingDebugPanel?.saveProject(),
  loadPostProcessingPreset: () => postProcessingDebugPanel?.load(),
  resetPostProcessingPreset: () => postProcessingDebugPanel?.reset(),
  copyPostProcessingConfig: () => postProcessingDebugPanel?.copyConfig(),
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
      setRoomLightsEnabled(nextEnabled);
    }
    return roomLightsEnabled;
  },
  inspectRuntime: () => ({
    activeLevelId,
    activeLevelMode,
    loadedRuntimeLevelId,
    operatorViewMode,
    transition: levelRuntimeManager.snapshot().status,
    cachedAssets: [...levelAssetCache.keys()],
    environmentRoots: [...levelEnvironmentModels.keys()],
    collisionLevels: [...levelCollisionModels.keys()],
    prefabInstances: [...levelPrefabInstances.keys()],
    levelLights: Object.fromEntries(
      [...levelLights.entries()].map(([levelId, lights]) => [levelId, lights.map((light) => light.name)]),
    ),
    physics: physicsSystem?.getStats?.() ?? null,
    levelSession: activeLevelSession?.snapshot() ?? null,
  }),
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
  runPerformanceBenchmark,
  getPerformanceBenchmark: () => lastPerformanceBenchmark,
  applyQualityProfile,
  setDisplayGamma,
  resumeNeedles: () => {
    freezeNeedles = false;
    needles.forEach((needle) => {
      needle.userData.needleDebugAxis = null;
    });
  },
  getState: () => ({
    freezeNeedles,
    inputLocked,
    zoomActive,
    noclipEnabled,
    noclipSpeed: Number(noclipSpeed.toFixed(2)),
    roomLightsEnabled,
    roomLightFactor: Number(roomLightCurrentFactor.toFixed(2)),
    roomLightSwitchTimer: Number(roomLightSwitchTimer.toFixed(2)),
    roomLightSwitchMode,
    roomLightStarterFaultTimer: Number(roomLightStarterFaultTimer.toFixed(2)),
    roomLightBootTimer: Number(roomLightBootTimer.toFixed(2)),
    operatorViewMode,
    movementSpeed: Number(movementVelocity.length().toFixed(2)),
    leanAmount: Number(leanAmount.toFixed(2)),
    indicatorTestActive: indicatorTestTimer > 0,
    resultsVisible,
    resultsTimer: Number(resultsTimer.toFixed(2)),
    activeLevelId,
    activeLevelMode,
    recorder: getShiftRecorderDebugState(shiftRecorder),
    levelSession: activeLevelSession?.snapshot() ?? null,
    cameraFov: Number(camera.fov.toFixed(2)),
    modelLoaded: Boolean(panelModel),
    panelTransform: panelModel ? getObjectTransform(panelModel.name) : null,
    panelTextureTier: materials.panel.userData.textureTier ?? (panelTextureMaps ? "loaded" : "placeholder"),
    interiorLoaded: Boolean(loadedRuntimeLevelId && levelEnvironmentModels.has(loadedRuntimeLevelId)),
    interiorTransform: loadedRuntimeLevelId
      ? getObjectTransform(`${loadedRuntimeLevelId}_Environment`)
      : null,
    loadedRuntimeLevelId,
    cachedLevelAssets: [...levelAssetCache.keys()],
    interiorFans: interiorFans.map((fan) => fan.name),
    doors: Object.fromEntries(
      [...levelPrefabInstances.entries()]
        .filter(([, runtime]) => runtime.door)
        .map(([key, runtime]) => [
          key,
          {
            currentDegrees: Number(
              (physicsSystem?.getDoorDegrees(runtime.physicsDoorKey) ?? runtime.door.degrees).toFixed(2),
            ),
            commandedOpen: runtime.door.commandedOpen,
            initialDegrees: runtime.door.interaction.initialDegrees,
            openDegrees: runtime.door.interaction.openDegrees,
            limits: [
              runtime.door.interaction.minDegrees,
              runtime.door.interaction.maxDegrees,
            ],
            physicsDoorKey: runtime.physicsDoorKey ?? null,
          },
        ]),
    ),
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
      antiAliasingMethod: fxaaPass ? "fxaa" : smaaPass ? "smaa" : "off",
      msaaSamples: composer?.renderTarget1?.samples ?? 0,
      lensEffects: Boolean(lensEffectsPass),
      anamorphicGlare: Boolean(lensEffectsPass?.uniforms.glareEnabled.value),
      anamorphicGlareStrength: lensEffectsPass?.uniforms.glareStrength.value ?? 0,
      flareGhosts: Boolean(lensEffectsPass?.uniforms.ghostsEnabled.value),
      flareGhostStrength: lensEffectsPass?.uniforms.ghostStrength.value ?? 0,
      lensDirt: Boolean(lensEffectsPass?.uniforms.dirtEnabled.value),
      lensDirtStrength: lensEffectsPass?.uniforms.dirtStrength.value ?? 0,
      lensDirtTextureLoaded: Boolean(lensDirtTexture),
      lensDirtAssetPath,
      lensEffectsUseBloomTexture: Boolean(lensEffectsPass?.uniforms.hasBloomTexture.value),
      realismBloom: Boolean(realismBloomEffect),
      realismBloomStrength: realismBloomEffect?.intensity ?? 0,
      lut: Boolean(lutPass),
      lutAssetPath,
      lutIntensity: lutPass?.intensity ?? 0,
      colorAdjustments: Boolean(colorAdjustmentPass),
      sharpen: Boolean(sharpenPass),
      sharpenAmount: sharpenPass?.uniforms.amount.value ?? 0,
      lensDistortion: Boolean(lensDistortionPass),
      barrelAmount: lensDistortionPass?.uniforms.barrelAmount.value ?? 0,
      fisheyeAmount: lensDistortionPass?.uniforms.fisheyeAmount.value ?? 0,
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

if (CONFIG.debug?.enabled && CONFIG.debug?.performanceBenchmark?.autoRun) {
  const delayMs = Math.max(0, Number(CONFIG.debug.performanceBenchmark.startDelaySeconds ?? 6) * 1000);
  window.setTimeout(() => {
    runPerformanceBenchmark().catch((error) => console.error("[OperatorGame benchmark] Failed", error));
  }, delayMs);
}
