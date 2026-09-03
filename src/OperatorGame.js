import * as THREE from "three";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { Capsule } from "three/addons/math/Capsule.js";
import { Octree } from "three/addons/math/Octree.js";
import { createFusionCoreSimulation } from "./FusionCoreSimulation.js?v=route-progress-reporting";
import {
  buildShiftReport,
  createShiftRecorder,
  getShiftRecorderDebugState,
  updateShiftRecorder as updateShiftRecorderState,
} from "./game/ShiftReport.js?v=route-progress-reporting";
import { ShiftCompletionRuntime } from "./game/ShiftCompletionRuntime.js?v=route-progress-reporting";
import { ShiftLifecycleRuntime } from "./game/ShiftLifecycleRuntime.js?v=route-progress-reporting";
import { AnimationLoop } from "./runtime/AnimationLoop.js?v=route-progress-reporting";
import { AdaptiveQualityRuntime } from "./runtime/AdaptiveQualityRuntime.js?v=route-progress-reporting";
import { FrameSchedulingPolicy } from "./runtime/FrameSchedulingPolicy.js?v=route-progress-reporting";
import { LevelRouteCoordinator } from "./runtime/LevelRouteCoordinator.js?v=route-progress-reporting";
import { RenderWarmupRuntime } from "./runtime/RenderWarmupRuntime.js?v=route-progress-reporting";
import { LevelTriggerSequenceRuntime } from "./runtime/LevelTriggerSequenceRuntime.js?v=route-progress-reporting";
import { LevelStaticPhysicsRuntime } from "./runtime/LevelStaticPhysicsRuntime.js?v=route-progress-reporting";
import { SceneAudioRuntime } from "./audio/SceneAudioRuntime.js?v=route-progress-reporting";
import { MenuAudioRuntime } from "./audio/MenuAudioRuntime.js?v=route-progress-reporting";
import { CoreAudioRuntime } from "./audio/CoreAudioRuntime.js?v=route-progress-reporting";
import { collectLevelSoundKeys } from "./audio/LevelSoundCatalog.js?v=route-progress-reporting";
import { createRuntimeDebugSnapshot } from "./ui/debug/RuntimeDebugSnapshot.js?v=route-progress-reporting";
import { installOperatorGameApi } from "./runtime/OperatorGameApi.js?v=route-progress-reporting";
import { LevelPrefabUpdateRuntime } from "./prefabs/LevelPrefabUpdateRuntime.js?v=route-progress-reporting";
import { requestBarrierGateUnlock } from "./prefabs/behaviors/BarrierGateBehavior.js?v=route-progress-reporting";
import { BulkheadExitRuntime } from "./interactions/BulkheadExitRuntime.js?v=route-progress-reporting";
import { createItemInteractionRuntime } from "./interactions/ItemInteractionRuntime.js?v=route-progress-reporting";
import { createInventorySelectorView } from "./interactions/InventorySelectorView.js?v=route-progress-reporting";
import { OperatorThoughtRuntime } from "./game/OperatorThoughtRuntime.js?v=route-progress-reporting";
import { LoadingCoordinator } from "./ui/LoadingCoordinator.js?v=route-progress-reporting";
import { FpsMeterRuntime } from "./ui/debug/FpsMeterRuntime.js?v=route-progress-reporting";
import { DebugOverlayRuntime } from "./ui/debug/DebugOverlayRuntime.js?v=route-progress-reporting";
import { DebugTransformRuntime } from "./ui/debug/DebugTransformRuntime.js?v=route-progress-reporting";
import { DebugTransformTargetResolver } from "./ui/debug/DebugTransformTargetResolver.js?v=route-progress-reporting";
import { LevelPrefabConfigRuntime } from "./prefabs/LevelPrefabConfigRuntime.js?v=route-progress-reporting";
import { CONFIG, MATERIAL_COLORS } from "./OperatorGameConfig.js?v=route-progress-reporting";
import { translate, translateControlLabel, translateRequired } from "./app/Localization.js?v=route-progress-reporting";
import {
  applyGraphicsQualityProfileToConfig,
  getGraphicsQualityProfile,
  resolveGraphicsPixelRatio,
} from "./config/GraphicsQualityProfiles.js?v=route-progress-reporting";
import {
  createTextureStreaming,
} from "./scene/TextureStreaming.js?v=route-progress-reporting";
import { PANEL1_GAUGE_RANGES, PANEL1_LAMP_WARNING_KEYS } from "./panels/Panel1Bindings.js?v=route-progress-reporting";
import { createStatusScreen } from "./StatusScreen.js?v=route-progress-reporting";
import { createLoadingOverlay } from "./ui/LoadingOverlay.js?v=route-progress-reporting";
import { RuntimeTextureLoadingIndicator } from "./ui/RuntimeTextureLoadingIndicator.js?v=route-progress-reporting";
import { ShiftResultsController } from "./ui/ShiftResultsController.js?v=route-progress-reporting";
import { restoreSavedPostProcessingConfig } from "./ui/debug/panels/PostProcessingDebugPanel.js?v=route-progress-reporting";
import { restoreSavedSceneConfig } from "./ui/debug/panels/SceneDebugPanels.js?v=route-progress-reporting";
import { DebugToolsRuntime } from "./ui/debug/DebugToolsRuntime.js?v=route-progress-reporting";
import { createPerformanceBenchmark } from "./ui/debug/PerformanceBenchmark.js?v=route-progress-reporting";
import {
  createRuntimeMemoryProfiler,
  formatMemoryMiB,
  formatTextureLabel,
} from "./ui/debug/RuntimeMemoryProfiler.js?v=route-progress-reporting";
import { createSceneInspector } from "./ui/debug/SceneInspector.js?v=route-progress-reporting";
import { createPhysicsSystem } from "./physics/PhysicsSystem.js?v=route-progress-reporting";
import {
  createFluorescentStartupPattern as createFluorescentStartupPatternFromConfig,
  getFluorescentStarterFaultFactor,
  getFluorescentStartupDuration,
  getFluorescentStartupFactor,
} from "./lighting/FluorescentBehavior.js?v=route-progress-reporting";
import { getLevelEnvironmentId } from "./levels/LevelRegistry.js?v=route-progress-reporting";
import { LevelRuntimeManager } from "./runtime/LevelRuntimeManager.js?v=route-progress-reporting";
import { AssetCache } from "./runtime/AssetCache.js?v=route-progress-reporting";
import { LevelEnvironmentLifecycle } from "./runtime/LevelEnvironmentLifecycle.js?v=route-progress-reporting";
import { LevelOwnedState } from "./runtime/LevelOwnedState.js?v=route-progress-reporting";
import { createLevelEnvironmentActivation } from "./runtime/LevelEnvironmentActivation.js?v=route-progress-reporting";
import { DeferredTextureUpgradeQueue } from "./runtime/DeferredTextureUpgradeQueue.js?v=route-progress-reporting";
import { createInteriorMaterialFactory } from "./materials/InteriorMaterialFactory.js?v=route-progress-reporting";
import { InteriorMaterialRuntime } from "./materials/InteriorMaterialRuntime.js?v=route-progress-reporting";
import { createMaskOverlayRuntime } from "./materials/MaskOverlayMaterial.js?v=route-progress-reporting";
import { MaterialTextureRuntime } from "./materials/MaterialTextureRuntime.js?v=route-progress-reporting";
import { ActiveLevelSessionRuntime } from "./levels/ActiveLevelSessionRuntime.js?v=route-progress-reporting";
import { LevelBindingRuntime } from "./levels/LevelBindingRuntime.js?v=route-progress-reporting";
import { createLevelSceneBuilder } from "./scene/LevelSceneBuilder.js?v=route-progress-reporting";
import { buildPrimitiveRoom } from "./scene/PrimitiveRoomBuilder.js?v=route-progress-reporting";
import {
  InteriorObjectRegistry,
  ensureSecondUvSet as ensureInteriorSecondUvSet,
  getInteriorObjectMatchNames as collectInteriorObjectMatchNames,
  isCollisionHelperMesh,
  normalizeObjectName,
} from "./scene/InteriorObjectRegistry.js?v=route-progress-reporting";
import { LightingRuntime, applyLightShadowSettings } from "./lighting/LightingRuntime.js?v=route-progress-reporting";
import { createSceneFeedbackMath } from "./lighting/SceneFeedbackMath.js?v=route-progress-reporting";
import { RoomLightingRuntime } from "./lighting/RoomLightingRuntime.js?v=route-progress-reporting";
import { SceneFeedbackRuntime } from "./lighting/SceneFeedbackRuntime.js?v=route-progress-reporting";
import { FixtureFlickerRuntime } from "./lighting/FixtureFlickerRuntime.js?v=route-progress-reporting";
import { createPhotometricPointLightRuntime } from "./lighting/PhotometricPointLightRuntime.js?v=route-progress-reporting";
import { createPointLightPoolRuntime } from "./lighting/PointLightPoolRuntime.js?v=route-progress-reporting";
import { LightingZoneRuntime } from "./lighting/LightingZoneRuntime.js?v=route-progress-reporting";
import { createPrefabRuntimeFactory } from "./prefabs/PrefabRuntimeFactory.js?v=route-progress-reporting";
import { createPrefabPhysicsRegistrar } from "./prefabs/PrefabPhysicsRegistrar.js?v=route-progress-reporting";
import { DoorInteractionSystem } from "./interactions/DoorInteractionSystem.js?v=route-progress-reporting";
import { DoorStateRuntime } from "./interactions/DoorStateRuntime.js?v=route-progress-reporting";
import { createInteractionHoverRuntime, createInteractionTooltipPolicy, isObjectHierarchyVisible as isVisibleInSceneHierarchy } from "./interactions/InteractionHoverRuntime.js?v=route-progress-reporting";
import { PlayerController } from "./player/PlayerController.js?v=route-progress-reporting";
import { createPlayerCollisionRuntime } from "./player/PlayerCollisionRuntime.js?v=route-progress-reporting";
import { PlayerCollisionDebugRuntime } from "./player/PlayerCollisionDebugRuntime.js?v=route-progress-reporting";
import { createOperatorMovementRuntime } from "./player/OperatorMovementRuntime.js?v=route-progress-reporting";
import { OperatorViewRuntime } from "./player/OperatorViewRuntime.js?v=route-progress-reporting";
import { MenuCameraRuntime } from "./player/MenuCameraRuntime.js?v=route-progress-reporting";
import { InputLockRuntime } from "./player/InputLockRuntime.js?v=route-progress-reporting";
import { createOperatorInputRuntime } from "./player/OperatorInputRuntime.js?v=route-progress-reporting";
import { PostProcessingRuntime } from "./postprocessing/PostProcessingRuntime.js?v=route-progress-reporting";
import { RealismPostProcessingRuntime } from "./postprocessing/RealismPostProcessingRuntime.js?v=route-progress-reporting";
import { PostProcessingAssets } from "./postprocessing/PostProcessingAssets.js?v=route-progress-reporting";
import { PostProcessingPolicy } from "./postprocessing/PostProcessingPolicy.js?v=route-progress-reporting";
import { createPostProcessingPresets } from "./postprocessing/PostProcessingPresets.js?v=route-progress-reporting";
import { OperatorPanelRuntime } from "./panels/OperatorPanelRuntime.js?v=route-progress-reporting";
import { OperatorPanelAssetRuntime } from "./panels/OperatorPanelAssetRuntime.js?v=route-progress-reporting";
import { PanelLampRuntime } from "./panels/PanelLampRuntime.js?v=route-progress-reporting";
import { PanelGaugeRuntime } from "./panels/PanelGaugeRuntime.js?v=route-progress-reporting";
import { PanelControlRuntime } from "./panels/PanelControlRuntime.js?v=route-progress-reporting";
import { DiagnosticRuntime } from "./incidents/DiagnosticRuntime.js?v=route-progress-reporting";
import { FuelBlendRuntime } from "./incidents/FuelBlendRuntime.js?v=route-progress-reporting";
import { AudioRuntime } from "./audio/AudioRuntime.js?v=route-progress-reporting";
import { createNarrationRuntime } from "./audio/NarrationRuntime.js?v=route-progress-reporting";
import { SOUND_GROUPS, SOUND_MIX, SOUND_REGISTRY } from "./audio/SoundRegistry.js?v=route-progress-reporting";
import {
  resetNarratorRadioRuntime,
  startNarratorRadioSpeech,
  updateNarratorRadioRuntime,
} from "./prefabs/behaviors/NarratorRadioBehavior.js?v=route-progress-reporting";

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
  return resolveGraphicsPixelRatio(
    getGraphicsQualityProfile(profile),
    window.innerWidth,
    window.innerHeight,
  );
}

function guardPointerCapture(element) {
  const setPointerCapture = element?.setPointerCapture?.bind(element);
  if (setPointerCapture) {
    element.setPointerCapture = (pointerId) => {
      try {
        setPointerCapture(pointerId);
      } catch (error) {
        if (error?.name !== "InvalidStateError") throw error;
      }
    };
  }

  const releasePointerCapture = element?.releasePointerCapture?.bind(element);
  if (releasePointerCapture) {
    element.releasePointerCapture = (pointerId) => {
      try {
        releasePointerCapture(pointerId);
      } catch (error) {
        if (error?.name !== "InvalidStateError" && error?.name !== "NotFoundError") throw error;
      }
    };
  }
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
const controlTooltip = document.createElement("div");
controlTooltip.className = "control-tooltip";
document.body.appendChild(controlTooltip);

const loadingOverlay = createLoadingOverlay({
  overlay: document.querySelector("#loadingOverlay"),
  percent: document.querySelector("#loadingPercent"),
  status: document.querySelector("#loadingStatus"),
  shiftTitle: document.querySelector("#loadingShiftTitle"),
  barFill: document.querySelector("#loadingBarFill"),
  finishStatusText: translate("loading.coreOnline"),
});

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.world.backgroundColor);
scene.fog = new THREE.Fog(CONFIG.world.fogColor, CONFIG.world.fogNear, CONFIG.world.fogFar);

const playerSpawnPosition = CONFIG.player?.spawnPosition ?? new THREE.Vector3(0, CONFIG.playerEyeHeight, 4.8);
const playerPosition = playerSpawnPosition.clone();
let playerCollisionRadius = CONFIG.player?.collisionRadius ?? 0.28;
let playerCollisionHeight = Math.max(CONFIG.player?.collisionHeight ?? 1.7, playerCollisionRadius * 2);
let playerEyeHeight = CONFIG.playerEyeHeight;
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
guardPointerCapture(renderer.domElement);
const debugTransformTargetResolver = new DebugTransformTargetResolver({
  config: CONFIG,
  getPanelModel: () => panelModel,
  getPrefabInstance: (levelId, key) => levelPrefabInstances.get(`${levelId}:${key}`),
  getPointLight: (levelId, key) => pointLightsByKey.get(levelId ? `${levelId}:${key}` : key),
});
const debugTransformRuntime = new DebugTransformRuntime({
  camera,
  renderer,
  scene,
  resolveObject: debugTransformTargetResolver.resolve,
  suspendInput: () => inputLockRuntime.suspend(),
  restoreInput: (wasLocked) => inputLockRuntime.restore(wasLocked),
});

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
const bootGraphicsQuality = getGraphicsQualityProfile(bootOptions.qualityProfile ?? "high");
const photometricPointLightRuntime = createPhotometricPointLightRuntime({
  camera,
  maxLights: bootGraphicsQuality.photometricLightSlots
    ?? CONFIG.lighting.photometricPointLights?.maxLights
    ?? 4,
  maxProfiles: CONFIG.lighting.photometricPointLights?.maxProfiles ?? 2,
  selectionRadius: CONFIG.lighting.photometricPointLights?.selectionRadius ?? 15,
  selectionHysteresis: CONFIG.lighting.photometricPointLights?.selectionHysteresis ?? 2,
  transitionSeconds: CONFIG.lighting.photometricPointLights?.transitionSeconds ?? 0.6,
});
const lightingZoneRuntime = new LightingZoneRuntime({
  adjacencyMargin: CONFIG.lighting.pointLightPool?.zoneAdjacencyMargin ?? 0.35,
  exitPadding: CONFIG.lighting.pointLightPool?.zoneExitPadding ?? 0.6,
});
const pointLightPoolRuntime = createPointLightPoolRuntime({
  scene,
  camera,
  photometricLights: photometricPointLightRuntime,
  lightingZones: lightingZoneRuntime,
  maxLights: bootGraphicsQuality.pointLightSlots ?? 6,
  maxFixtureLights: bootGraphicsQuality.photometricLightSlots ?? 2,
  fixtureRadius: CONFIG.lighting.pointLightPool?.fixtureRadius ?? 10,
  simpleRadius: CONFIG.lighting.pointLightPool?.simpleRadius ?? 20,
  selectionHysteresis: CONFIG.lighting.pointLightPool?.selectionHysteresis ?? 2,
  transitionSeconds: CONFIG.lighting.pointLightPool?.transitionSeconds ?? 0.5,
});

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
const playerCollisionDebugRuntime = new PlayerCollisionDebugRuntime({
  scene,
  capsule: playerCapsule,
  camera,
  config: CONFIG.player?.collision,
  getCameraRadius: () => cameraCollisionRadius,
});
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
const bulkheadExitRuntime = new BulkheadExitRuntime({
  config: {
    ...CONFIG.interior.bulkheadExit,
    maxInteractionDistance:
      CONFIG.interior.bulkheadExit.maxInteractionDistance ?? CONFIG.interaction?.maxDistance ?? 1.85,
  },
  interactive,
  playSound: playSoundAtObject,
  getGameMode: () => latestSnapshot.mode,
  emitThought: (...args) => emitOperatorThought(...args),
  getResults: () => shiftCompletionRuntime.resultsSnapshot,
  showResults: (snapshot) => showShiftResults(snapshot),
  refreshTooltip: () => updateControlTooltip(),
});
const updateBulkheadHandle = bulkheadExitRuntime.update;
const beginBulkheadHandleInteraction = bulkheadExitRuntime.begin;
const resetBulkheadExit = bulkheadExitRuntime.reset;
const registerBulkheadHandle = bulkheadExitRuntime.register;
const initialStatusScreenConfig = CONFIG.levelEnvironments?.["intro-shift"]?.prefabs
  ?.find((prefab) => prefab.behavior === "operatorPanel")?.screen;
const statusScreen = createStatusScreen({
  brightness: CONFIG.feedback.panelIndicators.statusScreenBrightness,
  config: initialStatusScreenConfig,
});
const fusionCore = createFusionCoreSimulation();
const diagnosticRuntime = new DiagnosticRuntime();
const panelControlRuntime = new PanelControlRuntime({
  config: CONFIG,
  knobs: controlKnobs,
  buttons: controlButtons,
  auxiliaryButtons: roomLightButtons,
  diagnostics: diagnosticRuntime,
  onChanged: () => updateControlTooltip(),
  playSound: (group, object) => object
    ? audioRuntime.playRandomAttached(object, group, camera.position)
    : audioRuntime.playRandom(group),
  runAction: runControlButtonAction,
  toggleRoomLights: () => toggleRoomLights(),
  executeLevelBinding,
  emitLevelEvent: (...args) => activeLevelSessionRuntime.emit(...args),
  log: (...args) => console.log(...args),
});
const getControlPercent = panelControlRuntime.getPercent;
const isControlButtonPressed = panelControlRuntime.isPressed;
const adjustControlKnob = panelControlRuntime.adjustKnob;
const applyControlKnobRotation = panelControlRuntime.applyKnobTransform;
const fuelBlendRuntime = new FuelBlendRuntime();
const audioRuntime = new AudioRuntime({
  sounds: SOUND_REGISTRY,
  groups: SOUND_GROUPS,
  mix: SOUND_MIX,
  masterVolume: 1,
});
const menuAudioRuntime = new MenuAudioRuntime({ audio: audioRuntime });
let activeShiftProfile = null;

let panelModel = null;
const panelCollisionMeshes = [];
const levelEnvironmentModels = new Map();
const levelCollisionModels = new Map();
const levelPrefabInstances = new Map();
let levelPrefabConfigRuntime = null;
const lightingRuntime = new LightingRuntime({
  scene,
  controlledLights,
  pointLightsByKey,
  levelLights,
  applyShadowSettings,
});
const doorStateRuntime = new DoorStateRuntime({
  instances: levelPrefabInstances,
  physics: physicsSystem,
  resolveEnvironmentId: getLevelEnvironmentId,
  getSessionConfig: () => activeLevelSessionRuntime.config,
  getGameMode: () => latestSnapshot.mode,
  emitThought: (...args) => emitOperatorThought(...args),
  emitSessionEvent: (...args) => activeLevelSessionRuntime.emit(...args),
  getResults: () => shiftCompletionRuntime.resultsSnapshot,
  shouldWaitForExit: shouldWaitForDoorExitBeforeResults,
  showResults: (snapshot) => showShiftResults(snapshot),
  refreshTooltip: () => updateControlTooltip(),
  playSound: playSoundAtObject,
  setHoverClass: (hovered) => document.body.classList.toggle("door-interactive-hover", hovered),
});
const doorInteractionSystem = new DoorInteractionSystem({
  prefabInstances: levelPrefabInstances,
  interactive,
  physics: physicsSystem,
  resolveEnvironmentId: getLevelEnvironmentId,
  applyVisualRotation: doorStateRuntime.applyRotation,
  applyLatchRotation: doorStateRuntime.applyLatchRotation,
  setLatched: doorStateRuntime.setLatched,
  toggleDoor: doorStateRuntime.toggle,
  playSound: playSoundAtObject,
  canOperateLatch: doorStateRuntime.canOperateLatch,
  onCollisionOwnershipChanged: () => updateActiveLevelEnvironment(),
  onDoorOpened: doorStateRuntime.onDoorOpened,
});
doorStateRuntime.attach(doorInteractionSystem);
const levelSceneBuilder = createLevelSceneBuilder({
  scene,
  loadSceneAsset,
  collisionDebugMaterial,
  isCollisionVisible: () => Boolean(CONFIG.player?.collision?.show),
  registerEnvironmentObject: registerInteriorObject,
  createPrefabRuntime: (...args) => createPrefabRuntime(...args),
  registerPrefabInteraction,
  applyPrefabConfig: applyLevelPrefabConfig,
  appendPanelPhysics: (levelId, collisionModel) => {
    physicsSystem?.addStaticScene(levelId, collisionModel);
    appendPanelPhysics(levelId);
    appendLevelPrefabPhysics(levelId);
  },
  environmentModels: levelEnvironmentModels,
  collisionModels: levelCollisionModels,
  prefabInstances: levelPrefabInstances,
  lightingZones: lightingZoneRuntime,
  getLanguage: () => document.documentElement.lang,
});
const levelAssetCache = new AssetCache({
  load: async (assetPath, reportTiming) => {
    const sourceUrl = new URL(assetPath, document.baseURI).href;
    const fetchStarted = performance.now();
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`Failed to load GLB ${assetPath}: HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    reportTiming?.({
      fetchMs: performance.now() - fetchStarted,
      bytes: data.byteLength,
    });
    const parseStarted = performance.now();
    const gltf = await gltfLoader.parseAsync(data, THREE.LoaderUtils.extractUrlBase(response.url));
    reportTiming?.({ parseMs: performance.now() - parseStarted });
    return gltf;
  },
  instantiate: (gltf) => gltf.scene.clone(true),
});
let loadedRuntimeLevelId = null;
const levelEnvironmentActivation = createLevelEnvironmentActivation({
  config: CONFIG,
  scene,
  resolveEnvironmentId: getLevelEnvironmentId,
  getRequestedLevelId: () => operatorViewMode === "menu" ? "intro-shift" : activeLevelId,
  getViewMode: () => operatorViewMode,
  environmentModels: levelEnvironmentModels,
  collisionModels: levelCollisionModels,
  prefabInstances: levelPrefabInstances,
  controlledLights,
  panelCollisionMeshes,
  getPanelRuntime: () => operatorPanelRuntime,
  audio: audioRuntime,
  physics: physicsSystem,
  getDebugHub: () => debugHub,
  getPanelConfig: getLevelPanelConfig,
  setCollisionState: (octree, ready) => {
    collisionOctree = octree;
    collisionReady = ready;
  },
  syncPlayerCapsule: (...args) => syncPlayerCapsule(...args),
  resolvePlayerCollisions: (...args) => resolvePlayerCollisions(...args),
});
const updateActiveLevelEnvironment = levelEnvironmentActivation.activate;
const levelOwnedState = new LevelOwnedState({
  scene,
  environmentModels: levelEnvironmentModels,
  collisionModels: levelCollisionModels,
  prefabInstances: levelPrefabInstances,
  interactive,
  roomLightButtons,
  interiorFans,
  physics: physicsSystem,
  playerPosition,
  photometricLights: photometricPointLightRuntime,
  pointLightPool: pointLightPoolRuntime,
  lightingZones: lightingZoneRuntime,
  lighting: lightingRuntime,
  audio: audioRuntime,
  stopEditing: stopPositionGizmo,
  clearNarration: clearNarratorTimers,
  clearLoadedLevel: () => { loadedRuntimeLevelId = null; },
  resetCollision: () => {
    collisionOctree = new Octree();
    collisionReady = false;
  },
});
const updateDoorLatchHandles = (dt) => doorInteractionSystem.update(dt);
const levelEnvironmentLifecycle = new LevelEnvironmentLifecycle({
  environments: CONFIG.levelEnvironments,
  lighting: lightingRuntime,
  sceneBuilder: levelSceneBuilder,
  disposeOwned: (levelId) => {
    itemInteractionRuntime.unregisterLevel(levelId);
    levelOwnedState.disposeLevel(levelId);
  },
  rebuildStaticPhysics: rebuildLevelStaticPhysics,
  rebuildDebugPanels: rebuildSceneDebugPanels,
  updateActiveEnvironment: () => levelEnvironmentActivation.activate(),
});
const levelRuntimeManager = new LevelRuntimeManager({
  load: (levelId, context) => levelEnvironmentLifecycle.load(levelId, context),
  dispose: (runtime) => levelEnvironmentLifecycle.dispose(runtime),
});
let collisionReady = false;
let yaw = THREE.MathUtils.degToRad(CONFIG.player?.spawnYawDegrees ?? 0);
let pitch = THREE.MathUtils.degToRad(CONFIG.player?.spawnPitchDegrees ?? 0);
let testTime = 0;
let noclipEnabled = Boolean(CONFIG.camera.noclip?.enabled);
let movementVelocity = new THREE.Vector3();
const movingPlatformDelta = new THREE.Vector3();
let freezeNeedles = false;
const postProcessingAssets = new PostProcessingAssets();
let debugHub = null;
const fpsMeterRuntime = new FpsMeterRuntime(fpsMeter);
const updateFpsMeter = fpsMeterRuntime.update;
let adaptiveQualityRuntime = null;
let latestSnapshot = fusionCore.getSnapshot();
let zoomActive = false;

const playerCollisionRuntime = createPlayerCollisionRuntime({
  config: CONFIG,
  playerPosition,
  playerCapsule,
  camera,
  cameraCollisionCapsule,
  movementVelocity,
  getPhysicsSystem: () => physicsSystem,
  getPhysicsSceneKey: () =>
    operatorViewMode !== "menu" && CONFIG.levelEnvironments?.[activeLevelId]
      ? getLevelEnvironmentId(activeLevelId)
      : "default",
  getCollisionOctree: () => collisionOctree,
  isCollisionReady: () => collisionReady,
  getPlayerRadius: () => playerCollisionRadius,
  getPlayerHeight: () => playerCollisionHeight,
  getPlayerEyeHeight: () => playerEyeHeight,
  getCameraRadius: () => cameraCollisionRadius,
  setDimensions: ({ radius, height, cameraRadius, eyeHeight = playerEyeHeight }) => {
    playerCollisionRadius = radius;
    playerCollisionHeight = height;
    cameraCollisionRadius = cameraRadius;
    playerEyeHeight = eyeHeight;
  },
  updateDebug: () => playerCollisionDebugRuntime.update(),
});
const movePlayerWithCollisions = playerCollisionRuntime.move;
const resolvePlayerCollisions = playerCollisionRuntime.resolveCollisions;
const syncPlayerCapsule = playerCollisionRuntime.syncCapsule;
const applyCollisionLimitedCameraOffset = playerCollisionRuntime.applyCameraOffset;
const operatorMovementRuntime = createOperatorMovementRuntime({
  config: CONFIG,
  camera,
  keys,
  playerPosition,
  movementVelocity,
  movingPlatformDelta,
  worldUp,
  getViewMode: () => operatorViewMode,
  getControlMode: () => playerControlMode,
  getNoclipEnabled: () => noclipEnabled,
  getZoomActive: () => zoomActive,
  getJumpQueued: () => jumpQueued,
  setJumpQueued: (value) => { jumpQueued = Boolean(value); },
  getPhysicsSystem: () => physicsSystem,
  moveWithCollisions: movePlayerWithCollisions,
  syncCapsule: syncPlayerCapsule,
  setCrouched: playerCollisionRuntime.setCrouched,
  getPlayerEyeHeight: () => playerEyeHeight,
  applyCameraOffset: applyCollisionLimitedCameraOffset,
  limitCameraOffset: (origin, offset, clearance) => interactionHoverRuntime.limitViewOffset(origin, offset, clearance),
  getYaw: () => yaw,
  setYaw: (value) => { yaw = value; },
  getPitch: () => pitch,
  setPitch: (value) => { pitch = value; },
  getBaseFov: () => baseFovDegrees,
});
const updateMovement = operatorMovementRuntime.update;
const updateCameraZoom = operatorMovementRuntime.updateZoom;
const updateCameraLook = operatorMovementRuntime.updateLook;
let baseFovDegrees = CONFIG.camera.fovDegrees;
const defaultMouseSensitivity = CONFIG.camera.mouseSensitivity;
const postProcessingPresets = createPostProcessingPresets({ config: CONFIG });
const postProcessingPolicy = new PostProcessingPolicy({
  config: CONFIG,
  renderer,
  presets: postProcessingPresets,
  assets: postProcessingAssets,
  pointLights: pointLightsByKey,
  prefabInstances: levelPrefabInstances,
  applyShadowSettings,
  getTime: () => testTime,
});
const fastDebugBoot = Boolean(CONFIG.debug?.enabled && CONFIG.debug?.fastLoadLevel);
let deferredTextureUpgradeQueue = null;
const loadingCoordinator = new LoadingCoordinator({
  overlay: loadingOverlay,
  initialComplete: Boolean(CONFIG.loading?.skip || fastDebugBoot),
  shouldSkipBoot: () => Boolean(CONFIG.loading?.skip || fastDebugBoot),
  onBootComplete: () => {
    if (operatorViewMode !== "menu") triggerRoomLightBoot();
  },
  onRouteStart: () => deferredTextureUpgradeQueue?.pause(),
  onRouteComplete: () => deferredTextureUpgradeQueue?.resume(),
  isModelPending: () => !panelModel,
});
const setLoadingProgress = loadingCoordinator.setProgress;
const setLoadingStatus = loadingCoordinator.setStatus;
const finishLoading = loadingCoordinator.finishBoot;
const skipLoadingOverlay = loadingCoordinator.skip;
const showRouteLoading = ({
  title = translate("loading.loadingShift"),
  status = translate("loading.preparing"),
  progress = 0,
} = {}) => loadingCoordinator.showRoute({ title, status, progress });
const finishRouteLoading = loadingCoordinator.finishRoute;
const updateLoadingOverlay = loadingCoordinator.update;
const inputLockRuntime = new InputLockRuntime({
  keys,
  movementVelocity,
  endDoorDrag: endHingedDoorDrag,
  releaseDoorLatches: releaseDoorLatchHandles,
  clearHoveredDoor: () => setHoveredHingedDoor(null),
  exitPointerLock: () => document.exitPointerLock?.(),
  setJumpQueued: (queued) => { jumpQueued = Boolean(queued); },
  setZoomActive: (active) => { zoomActive = Boolean(active); },
  releaseControls: releaseAllControlButtons,
  clearHoveredKnob: () => setHoveredKnob(null),
  clearHoveredTooltip: () => setHoveredTooltipTarget(null),
});
let playerControlMode = "walk";
let shiftRecorder = createShiftRecorder();
const activeRuntimeTextureSets = new Map();
const playerController = new PlayerController({
  updateMovement,
  updateZoom: updateCameraZoom,
  updateCollisionDebug: updatePlayerCollisionDebug,
  resetView: resetOperatorView,
  applyCollisionSettings: applyPlayerCollisionSettings,
});
const realismPostProcessingRuntime = new RealismPostProcessingRuntime({
  config: CONFIG,
  renderer,
  scene,
  camera,
  presets: postProcessingPresets,
  getQuality: () => postProcessingPolicy.snapshot(),
});
const postProcessingRuntime = new PostProcessingRuntime({
  config: CONFIG,
  renderer,
  scene,
  camera,
  assets: postProcessingAssets,
  presets: postProcessingPresets,
  getQuality: () => postProcessingPolicy.snapshot(),
  applyColorAdjustments: postProcessingPolicy.applyColorAdjustments,
  applyLensDistortion: postProcessingPolicy.applyLensDistortion,
  applyLensEffects: postProcessingPolicy.applyLensEffects,
  setupRealism: () => realismPostProcessingRuntime.setup(),
  renderRealism: (dt) => realismPostProcessingRuntime.render(dt),
  resizeRealism: (width, height) => realismPostProcessingRuntime.resize(width, height),
  disposeRealism: () => realismPostProcessingRuntime.dispose(),
  inspectRealism: () => realismPostProcessingRuntime.inspect(),
});
postProcessingPolicy.attach({ runtime: postProcessingRuntime, realism: realismPostProcessingRuntime });
const performanceBenchmark = createPerformanceBenchmark({
  config: CONFIG,
  renderer,
  getComposerSamples: () => postProcessingRuntime.composer?.renderTarget1?.samples ?? 0,
  getQualityState: postProcessingPolicy.snapshot,
  setQualityState: postProcessingPolicy.replace,
  getInputLocked: inputLockRuntime.isLocked,
  setInputLocked: (locked) => inputLockRuntime.setLocked(locked),
  setShadowQuality,
  rebuildPostProcessing: setupPostProcessing,
  resizeRendererTargets,
  getTextureLoadingState: () => ({ ...runtimeTextureLoading }),
});
const runtimeMemoryProfiler = createRuntimeMemoryProfiler({
  renderer,
  getTextureSets: () => activeRuntimeTextureSets,
});
const debugOverlayRuntime = new DebugOverlayRuntime({
  element: debugOverlay,
  camera,
  renderer,
  postProcessing: postProcessingRuntime,
  realismPostProcessing: realismPostProcessingRuntime,
  memoryProfiler: runtimeMemoryProfiler,
  getQuality: postProcessingPolicy.snapshot,
  formatMemory: formatMemoryMiB,
  formatTexture: formatTextureLabel,
  isNoclipEnabled: () => noclipEnabled,
  getNoclipSpeed: operatorMovementRuntime.getNoclipSpeed,
  getHoveredObject: () => interactionHoverRuntime.getHoveredInteractive(),
});
const updateDebugOverlay = debugOverlayRuntime.update;
const sceneInspector = createSceneInspector({ scene });
const interactionTooltipPolicy = createInteractionTooltipPolicy({
  translateControlLabel, translate, prefabInstances: levelPrefabInstances, config: CONFIG,
  getActiveLevelId: () => activeLevelId, getLevelEnvironmentId,
  getRoomLightsEnabled: () => roomLightingRuntime.state.enabled,
});
const interactionHoverRuntime = createInteractionHoverRuntime({
  raycaster,
  pointer,
  camera,
  interactive,
  controlTooltip,
  config: CONFIG,
  getInteractionLevelId: () =>
    getLevelEnvironmentId(operatorViewMode === "menu" ? "intro-shift" : activeLevelId),
  getActiveLevelId: () => activeLevelId,
  prefabInstances: levelPrefabInstances,
  config: CONFIG,
  getLevelEnvironmentId,
  getLanguage: () => document.documentElement.lang,
  isObjectVisible: isObjectHierarchyVisible,
  getTooltipText,
  setHoveredDoor: setHoveredHingedDoor,
  getOcclusionRoots: () => {
    const environmentId = getLevelEnvironmentId(operatorViewMode === "menu" ? "intro-shift" : activeLevelId);
    return [
      levelEnvironmentModels.get(environmentId),
      levelEnvironmentModels.get(`${environmentId}:prefabs`),
      panelModel,
    ];
  },
});
let briefingSheetOpener = null;
const inventorySelectorView = createInventorySelectorView();
const itemInteractionRuntime = createItemInteractionRuntime({
  interactive,
  physics: physicsSystem,
  camera,
  getLocomotionPresentation: operatorMovementRuntime.getLocomotionPresentation,
  openBriefingSheet: (request) => briefingSheetOpener?.(request),
  onSpecialViewOpened: (item) => activeLevelSessionRuntime.emit("briefOpened", {
    target: "brief",
    sheetIndex: item.briefingRequest?.sheetIndex ?? 0,
  }),
  presentSelector: inventorySelectorView.present,
  onStored: (item, slotIndex) => activeLevelSessionRuntime.emit("itemStored", {
    target: item.target?.userData.kind === "briefSheet" ? "brief" : item.icon,
    slotIndex,
  }),
  playSoundGroup: playSoundGroupAtObject,
  setHoldProgress: (progress, active) => {
    document.body.style.setProperty("--hold-progress", String(progress * 100));
    document.body.classList.toggle("hold-interaction-active", active);
  },
});
const updateHoverTarget = interactionHoverRuntime.update;
const setHoveredKnob = interactionHoverRuntime.setHoveredKnob;
const setHoveredTooltipTarget = interactionHoverRuntime.setHoveredTooltipTarget;
const updateControlTooltip = interactionHoverRuntime.refreshTooltip;
const updateControlLabels = interactionHoverRuntime.refreshTooltip;
const shiftResultsController = new ShiftResultsController({
  translate,
  buildReport: buildShiftReport,
  getRecorder: () => shiftRecorder,
  getContext: () => ({
    levelId: activeLevelId,
    mode: activeLevelMode,
    levelSession: activeLevelSessionRuntime.snapshot(),
  }),
  releaseControls: releaseAllControlButtons,
  clearZoom: () => { zoomActive = false; },
});
const showShiftResults = shiftResultsController.show;
const hideShiftResults = shiftResultsController.hide;
const shiftCompletionRuntime = new ShiftCompletionRuntime({
  config: CONFIG,
  initialMode: latestSnapshot.mode,
  createStartupPattern: createFluorescentStartupPattern,
  getStartupDuration: getFluorescentStartupDuration,
  stopCoreLoop: () => {},
  emitThought: (...args) => emitOperatorThought(...args),
  playOutcomeNarration: (line) => narrationRuntime.playNarration(line, activeLevelId),
  canUnlockBulkhead: bulkheadExitRuntime.canUnlock,
  unlockBulkhead: bulkheadExitRuntime.unlock,
  shouldWaitForDoorExit: shouldWaitForDoorExitBeforeResults,
  hasBulkhead: bulkheadExitRuntime.hasHandle,
  resultsController: shiftResultsController,
});
const updateShiftCompletion = shiftCompletionRuntime.update;
const getTerminalPresentationSnapshot = shiftCompletionRuntime.getPresentationSnapshot;
let activeLevelId = "intro-shift";
let activeLevelMode = "tutorial";
let operatorViewMode = "level";
const operatorViewRuntime = new OperatorViewRuntime({
  config: CONFIG, camera, keys, pointer, playerPosition, playerSpawnPosition, movementVelocity,
  movementRuntime: operatorMovementRuntime,
  getActiveLevelId: () => activeLevelId,
  setViewMode: (mode) => { operatorViewMode = mode; },
  setControlMode: (mode) => { playerControlMode = mode; },
  setJumpQueued: (queued) => { jumpQueued = queued; },
  setZoomActive: (active) => { zoomActive = active; },
  setYaw: (value) => { yaw = value; },
  setPitch: (value) => { pitch = value; },
  teleportCharacter: (position) => physicsSystem?.teleportCharacter(position),
  syncPlayerCapsule, loadLevelEnvironment, resetLevelDoors, updateActiveLevelEnvironment,
  setRoomLightsEnabled: (...args) => setRoomLightsEnabled(...args),
});
const menuCameraRuntime = new MenuCameraRuntime({
  camera,
  config: CONFIG,
  getViewMode: () => operatorViewMode,
  eventTarget: window,
});
menuCameraRuntime.wire();
const levelBindingRuntime = new LevelBindingRuntime({
  config: CONFIG,
  levelPrefabInstances,
  getLevelEnvironmentId,
  toggleRoomLights: (...args) => toggleRoomLights(...args),
  playSoundAtObject,
  createFixtureFlickerState: (...args) => createFixtureFlickerState(...args),
  createFluorescentStartupPattern,
  applyLevelPrefabConfig,
  updateControlTooltip,
  warn: (...args) => console.warn(...args),
});
const levelStaticPhysicsRuntime = new LevelStaticPhysicsRuntime({
  config: CONFIG, levelCollisionModels, levelPrefabInstances, panelCollisionMeshes,
  getPanelModel: () => panelModel,
  getPhysicsSystem: () => physicsSystem,
  applyOperatorPanelLevel: (levelId) => operatorPanelRuntime.applyLevel(levelId, operatorViewMode),
});
const activeLevelSessionRuntime = new ActiveLevelSessionRuntime({
  onEvent: (event, levelId) => {
    operatorThoughtRuntime.handleLevelEvent(event, latestSnapshot);
    window.dispatchEvent(new CustomEvent("operatorgame:level-event", {
      detail: { levelId, ...event },
    }));
  },
  onComplete: (levelId, session) => {
    window.dispatchEvent(new CustomEvent("operatorgame:level-objectives-complete", {
      detail: { levelId, session },
    }));
  },
});
const operatorThoughtRuntime = new OperatorThoughtRuntime({
  getActiveLevelId: () => activeLevelId,
  translate: translateRequired,
});
const updateOperatorThoughts = operatorThoughtRuntime.update;
const emitOperatorThought = operatorThoughtRuntime.emit;
const resetOperatorThoughts = operatorThoughtRuntime.reset;
const shiftLifecycleRuntime = new ShiftLifecycleRuntime({
  config: CONFIG,
  simulation: fusionCore,
  fuelBlend: fuelBlendRuntime,
  completion: shiftCompletionRuntime,
  diagnostics: diagnosticRuntime,
  getSnapshot: () => latestSnapshot,
  resetRecorder: resetShiftRecorder,
  hideResults: hideShiftResults,
  resetBulkhead: resetBulkheadExit,
  resetThoughts: resetOperatorThoughts,
  emitThought: emitOperatorThought,
  playIgnition: () => {},
  stopCoreLoop: () => {},
  triggerStartupFeedback,
  setStartupTimer: (value) => sceneFeedbackRuntime.setStartupTimer(value),
  setIndicatorTimer: (value) => sceneFeedbackRuntime.setIndicatorTimer(value),
  updateStatus: (snapshot, force) => statusScreen.setSnapshot(snapshot, force),
  log: (...args) => console.log(...args),
});
const roomLightingRuntime = new RoomLightingRuntime({
  config: CONFIG,
  getTime: () => clock.elapsedTime,
  createStartupPattern: createFluorescentStartupPattern,
  getStartupDuration: getFluorescentStartupDuration,
  getStartupFactor: getFluorescentStartupFactor,
  getStarterFaultFactor: getFluorescentStarterFaultFactor,
  playTurnOn: () => playSoundAtObject(panelModel, "LampTurnOn1", { maxDistance: 12 }),
  onVisualChanged: updateRoomLightMaterials,
  onStateChanged: updateControlTooltip,
});
const triggerRoomLightBoot = roomLightingRuntime.triggerBoot;
const toggleRoomLights = roomLightingRuntime.toggle;
const setRoomLightsEnabled = roomLightingRuntime.setEnabled;
const getRoomLightVisualFactor = roomLightingRuntime.getVisualFactor;
const getRoomLightAfterglowFactor = roomLightingRuntime.getAfterglowFactor;
const narrationRuntime = createNarrationRuntime({
  getActiveLevelId: () => activeLevelId,
  prefabInstances: levelPrefabInstances,
  config: CONFIG,
  getLevelEnvironmentId,
  isPlaybackAllowed: (levelId) =>
    activeLevelId === levelId &&
    operatorViewMode === "level" &&
    !inputLockRuntime.isLocked() &&
    !document.body.classList.contains("app-ui-open"),
  playLine: (runtime, line, levelId) =>
    playSoundAtObject(runtime.root, line.soundKey, {
      levelId,
      refDistance: runtime.radio.refDistance ?? 1,
      maxDistance: runtime.radio.maxDistance ?? 16,
    }),
  startRadioSpeech: startNarratorRadioSpeech,
  resetRadio: resetNarratorRadioRuntime,
  onStarted: (detail) => activeLevelSessionRuntime.emit("narrationStarted", detail),
  onEnded: (detail) => {
    activeLevelSessionRuntime.emit("narrationEnded", detail);
    shiftCompletionRuntime.onNarrationEnded(detail.line);
  },
});
const sceneFeedbackMath = createSceneFeedbackMath({
  config: CONFIG,
  getTime: () => testTime,
  getSnapshot: () => latestSnapshot,
  getTerminalElapsed: () => shiftCompletionRuntime.terminalElapsed,
  getIgnitionPulseTimer: () => sceneFeedbackRuntime.getIgnitionPulseTimer(),
  getStartupTimer: () => sceneFeedbackRuntime.getStartupTimer(),
  getTerminalStartupPattern: () => shiftCompletionRuntime.terminalStartupPattern,
  getStartupDuration: getFluorescentStartupDuration,
  getStartupFactor: getFluorescentStartupFactor,
});
const flickerWave = sceneFeedbackMath.flickerWave;
const getIgnitionPulseFeedbackAmount = sceneFeedbackMath.getIgnitionPulseAmount;
const getStartupFeedbackAmount = sceneFeedbackMath.getStartupAmount;
const getThermalEmergencyAmount = sceneFeedbackMath.getThermalEmergencyAmount;
const getTerminalLightFactor = sceneFeedbackMath.getTerminalLightFactor;
const getDangerNeedleJitter = sceneFeedbackMath.getDangerNeedleJitter;
const getOperationalNeedleJitter = sceneFeedbackMath.getOperationalNeedleJitter;
const coreAudioRuntime = new CoreAudioRuntime({
  audio: audioRuntime,
  getCoreAnchor: () => panelModel,
  getPanel: () => panelModel,
  playSound: playSoundAtObject,
});
const sceneAudioRuntime = new SceneAudioRuntime({
  config: CONFIG,
  audio: audioRuntime,
  camera,
  getPanel: () => panelModel,
  keys,
  prefabInstances: levelPrefabInstances,
  getViewMode: () => operatorViewMode,
  getActiveLevelId: () => activeLevelId,
  resolveEnvironmentId: getLevelEnvironmentId,
  hasPanel: (levelId) => Boolean(getLevelPanelConfig(levelId)),
  getMovementVelocity: () => movementVelocity,
  isNoclipEnabled: () => noclipEnabled,
  getLightFactor: () =>
    getStartupLightFactor() * getTerminalLightFactor() * diagnosticRuntime.getBlackoutFactor(),
  getSnapshot: () => latestSnapshot,
  coreAudio: coreAudioRuntime,
  playSound: playSoundAtObject,
});
const updateAudioState = sceneAudioRuntime.update;
const fixtureFlickerRuntime = new FixtureFlickerRuntime({
  config: CONFIG.feedback.longTermLightFlicker,
  getTargets: () => [...controlledLights, ...Object.values(materials.interiorCustom)],
});
const createFixtureFlickerState = fixtureFlickerRuntime.create;
const updateLongTermLightFlicker = fixtureFlickerRuntime.update;
const updateFixtureFlickerState = fixtureFlickerRuntime.updateState;
const triggerFixtureFlicker = fixtureFlickerRuntime.trigger;
const getFixtureFlickerFactor = fixtureFlickerRuntime.getFactor;
const sceneFeedbackRuntime = new SceneFeedbackRuntime({
  config: CONFIG,
  camera,
  controlledLights,
  postProcessing: postProcessingRuntime,
  realism: realismPostProcessingRuntime,
  diagnostics: diagnosticRuntime,
  roomLighting: roomLightingRuntime,
  getSnapshot: () => latestSnapshot,
  getTime: () => testTime,
  getZoomActive: () => zoomActive,
  getStartupAmount: getStartupFeedbackAmount,
  getIgnitionPulseAmount: getIgnitionPulseFeedbackAmount,
  getEmergencyAmount: getThermalEmergencyAmount,
  getTerminalLightFactor,
  getFixtureFactor: getFixtureFlickerFactor,
  flickerWave,
  getRoomMaterials: () => Object.values(materials.interiorCustom),
  applyColorAdjustments: postProcessingPolicy.applyColorAdjustments,
  applyLensDistortion: postProcessingPolicy.applyLensDistortion,
  createStartupPattern: createFluorescentStartupPattern,
  getStartupPatternFactor: getFluorescentStartupFactor,
  updateFixtureFlicker: updateLongTermLightFlicker,
});
let hemisphereLight = null;
const runtimeTextureLoadingIndicator = new RuntimeTextureLoadingIndicator({
  isBootComplete: loadingCoordinator.isComplete,
  getLabel: () => translate("loading.textures"),
});
const runtimeTextureLoading = runtimeTextureLoadingIndicator.state;
const defaultPostProcessingConfig = JSON.parse(JSON.stringify(CONFIG.postProcessing));

deferredTextureUpgradeQueue = new DeferredTextureUpgradeQueue({
  canStart: () => !bootOptions.deferFullTextures && loadingCoordinator.isComplete(),
  isDisabled: () => Boolean(bootOptions.disableFullTextures),
  delayMs: (CONFIG.textureStreaming?.fullLoadDelaySeconds ?? 4) * 1000,
});
let materialTextureRuntime = null;
const maskOverlayRuntime = createMaskOverlayRuntime({
  specialMaterials: CONFIG.interior.specialMaterials,
  getMaterials: () => materials?.interiorCustom,
});
const interiorMaterialFactory = createInteriorMaterialFactory({
  panelConfig: CONFIG.panel,
  specialMaterials: CONFIG.interior.specialMaterials,
  getPanelTextureMaps: () => materialTextureRuntime?.panelMaps,
  setupMaskOverlay: maskOverlayRuntime.setup,
  updateMaskOverlay: maskOverlayRuntime.update,
  patchMaterial: (material) => photometricPointLightRuntime.patchMaterial(material),
});
const createPanelPbrMaterial = interiorMaterialFactory.createPanelMaterial;
const applyPanelTextureMapsToMaterial = interiorMaterialFactory.applyPanelTextureMaps;
const createInteriorCustomMaterials = interiorMaterialFactory.createCustomMaterials;
const applyTextureMapsToMaterial = interiorMaterialFactory.applyCustomTextureMaps;
const updateMaskOverlayUniforms = maskOverlayRuntime.update;
const setInteriorMaskDebug = maskOverlayRuntime.setDebug;
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
const interiorObjectRegistry = new InteriorObjectRegistry({
  config: CONFIG,
  materials,
  audio: audioRuntime,
  statusScreen,
  registerBulkheadHandle,
  applyControlKnobRotation,
  collections: {
    interiorFans,
    needles,
    gaugeNeedles,
    lamps,
    controlKnobs,
    controlButtons,
    roomLightButtons,
    interactive,
  },
});
const panelLampRuntime = new PanelLampRuntime({
  config: CONFIG,
  materials,
  warningKeys: PANEL1_LAMP_WARNING_KEYS,
  diagnostics: diagnosticRuntime,
  getIndicatorTimer: () => sceneFeedbackRuntime.getIndicatorTimer(),
  getStartupTimer: () => sceneFeedbackRuntime.getStartupTimer(),
  getTime: () => testTime,
  flickerWave,
});
const panelGaugeRuntime = new PanelGaugeRuntime({
  config: CONFIG,
  ranges: PANEL1_GAUGE_RANGES,
  diagnostics: diagnosticRuntime,
  getIndicatorTimer: () => sceneFeedbackRuntime.getIndicatorTimer(),
  getTime: () => testTime,
  getStartupAmount: getStartupFeedbackAmount,
  getOperationalJitter: getOperationalNeedleJitter,
  getDangerJitter: getDangerNeedleJitter,
});
const operatorPanelAssetRuntime = new OperatorPanelAssetRuntime({
  config: CONFIG,
  loader: gltfLoader,
  assetPath: CONFIG.assetPath,
  scene,
  collisionDebugMaterial,
  panelCollisionMeshes,
  getCollisionVisible: () => CONFIG.player?.collision?.show,
  getLevelEnvironmentId,
  registerPanelObject,
  onModelLoaded: (model) => { panelModel = model; },
  applyActiveLevel: () => operatorPanelRuntime.applyLevel(activeLevelId, operatorViewMode),
  getCollisionLevelIds: () => levelCollisionModels.keys(),
  rebuildLevelStaticPhysics,
  finishLoading,
  setLoadingProgress,
  setLoadingStatus,
  reportError: (...args) => console.error(...args),
  logLoaded: () => console.log(`[OperatorGame] Loaded SM_Panel1.glb: ${needles.length} arrows, ${lamps.length} lamps`),
});
const operatorPanelRuntime = new OperatorPanelRuntime({
  load: () => operatorPanelAssetRuntime.load(),
  reset: resetPanelControls,
  applyLevel: () => applyActivePanelTransform(),
  hasModel: () => Boolean(panelModel),
  tick: {
    simulation: fusionCore,
    fuelBlend: fuelBlendRuntime,
    diagnostics: diagnosticRuntime,
    statusScreen,
    controls: panelControlRuntime,
    gauges: panelGaugeRuntime,
    lampResolver: panelLampRuntime,
    needles,
    lamps,
    getSnapshot: () => latestSnapshot,
    setSnapshot: (snapshot) => { latestSnapshot = snapshot; },
    getControlInputs,
    getPresentationSnapshot: getTerminalPresentationSnapshot,
    areNeedlesFrozen: () => freezeNeedles,
    onIgnitionPulse: () => {
      sceneFeedbackRuntime.triggerIgnitionPulse();
      playSoundAtObject(panelModel, "Core1_Pulse", { maxDistance: 20 });
    },
    onLightRestart: triggerRoomLightBoot,
    updateThoughts: updateOperatorThoughts,
    updateRecorder: updateShiftRecorder,
    updateCompletion: updateShiftCompletion,
  },
});
materialTextureRuntime = new MaterialTextureRuntime({
  config: CONFIG,
  textureStreaming,
  upgradeQueue: deferredTextureUpgradeQueue,
  loadingIndicator: runtimeTextureLoadingIndicator,
  textureSets: activeRuntimeTextureSets,
  getMaterials: () => materials,
  applyCustomMaps: applyTextureMapsToMaterial,
  applyPanelMaps: applyPanelTextureMapsToMaterial,
  syncMaterialClones: syncLevelPrefabMaterialClones,
  updateRoomLightMaterials,
  createFixtureFlickerState,
  setLoadingStatus,
  reportTextureTiming: (label, timing) => {
    if (timing.textureCount === 0) return;
    console.info(`[TextureLoadTiming] ${label}: total=${timing.wallMs.toFixed(1)}ms`
      + ` textures=${timing.textureCount}`
      + ` summed=${timing.sumTextureMs.toFixed(1)}ms`
      + ` slowest=${timing.slowestTextureMs.toFixed(1)}ms`
      + ` failed=${timing.failedCount}`);
  },
});
const interiorCustomTextureMaps = materialTextureRuntime.customMaps;
const interiorMaterialRuntime = new InteriorMaterialRuntime({
  configs: CONFIG.interior.specialMaterials,
  materials: materials.interiorCustom,
  textureMaps: interiorCustomTextureMaps,
  prefabInstances: levelPrefabInstances,
  applyTextureMaps: applyTextureMapsToMaterial,
});

Object.values(materials).forEach((entry) => {
  if (entry?.isMaterial) photometricPointLightRuntime.patchMaterial(entry);
  else if (entry && typeof entry === "object") Object.values(entry).forEach((material) => {
    if (material?.isMaterial) photometricPointLightRuntime.patchMaterial(material);
  });
});

const prefabRuntimeFactory = createPrefabRuntimeFactory({
  config: CONFIG,
  materials,
  collisionDebugMaterial,
  photometricLights: photometricPointLightRuntime,
  pointLightPool: pointLightPoolRuntime,
  isCollisionHelper: isCollisionHelperMesh,
  ensureSecondUvSet,
  getObjectMatchNames: getInteriorObjectMatchNames,
  getCustomMaterialKey: getInteriorCustomMaterialKey,
  createStartupPattern: createFluorescentStartupPattern,
  createFixtureFlickerState,
  applyShadowSettings,
  loadRuntimeTexture: textureStreaming.loadRuntimeTexture,
});
const createPrefabRuntime = prefabRuntimeFactory.create;
const prefabPhysicsRegistrar = createPrefabPhysicsRegistrar({
  physics: physicsSystem,
  normalizeName: normalizeMatchName,
  getMatchNames: getInteriorObjectMatchNames,
  doorInteractions: doorInteractionSystem,
  interactive,
  playSound: playSoundAtObject,
});
const levelPrefabUpdateRuntime = new LevelPrefabUpdateRuntime({
  config: CONFIG,
  instances: levelPrefabInstances,
  physics: physicsSystem,
  getTime: () => testTime,
  getStarterFaultFactor: getFluorescentStarterFaultFactor,
  updateFlicker: updateFixtureFlickerState,
  getFlickerFactor: getFixtureFlickerFactor,
  getStartupDuration: getFluorescentStartupDuration,
  getStartupFactor: getFluorescentStartupFactor,
  getRoomLightVisualFactor,
  getRoomLightAfterglowFactor,
  getSceneLightFactor: () =>
    getStartupLightFactor() * getTerminalLightFactor() * diagnosticRuntime.getBlackoutFactor(),
  getDisplayedLevelId,
  isArrivalControlLocked: () => playerControlMode === "lookOnlyUntilElevatorArrival",
  releaseArrivalControl: () => {
    playerControlMode = "walk";
    movementVelocity.set(0, 0, 0);
    movingPlatformDelta.set(0, 0, 0);
    physicsSystem?.teleportCharacter(playerPosition);
    syncPlayerCapsule();
  },
  isLevelView: () => operatorViewMode === "level",
  getPlayerPosition: () => playerPosition,
  addMovingPlatformDelta: (delta) => movingPlatformDelta.add(delta),
  rebuildStaticPhysics: rebuildLevelStaticPhysics,
  playSound: playSoundAtObject,
  getCoreSnapshot: () => latestSnapshot,
});
const updateLevelPrefabLights = levelPrefabUpdateRuntime.updateLights;
const updateLevelPrefabClocks = levelPrefabUpdateRuntime.updateClocks;
const updateLevelPrefabElevators = levelPrefabUpdateRuntime.updateElevators;
const updateLevelPrefabBehaviors = levelPrefabUpdateRuntime.updateBehaviors;
const levelTriggerSequenceRuntime = new LevelTriggerSequenceRuntime({
  environmentModels: levelEnvironmentModels,
  prefabInstances: levelPrefabInstances,
  getActiveLevelId: () => activeLevelId,
  resolveEnvironmentId: getLevelEnvironmentId,
  getLevelConfig: (levelId) => CONFIG.levelEnvironments?.[getLevelEnvironmentId(levelId)],
  getPlayerPosition: () => playerPosition,
  isLevelView: () => operatorViewMode === "level",
  playNarration: (levelId, line) => narrationRuntime.playNarration(line, levelId),
  requestBarrierUnlock: requestBarrierGateUnlock,
  emitEvent: (type, detail) => activeLevelSessionRuntime.emit(type, detail),
});
const frameSchedulingPolicy = new FrameSchedulingPolicy();
adaptiveQualityRuntime = new AdaptiveQualityRuntime({
  applyPixelRatio: (ratio) => {
    renderer.setPixelRatio(ratio);
    resizeRendererTargets();
  },
  shouldSample: () => Boolean(
    loadingCoordinator.isComplete()
      && !document.hidden
      && document.hasFocus(),
  ),
});
adaptiveQualityRuntime.configure(bootOptions.qualityProfile ?? "high");
const renderWarmupRuntime = new RenderWarmupRuntime({
  renderer,
  scene,
  camera,
  acquireForegroundLease: frameSchedulingPolicy.acquireForegroundLease,
  prepare: async () => {
    await photometricPointLightRuntime.prepare();
    pointLightPoolRuntime.prepare();
    photometricPointLightRuntime.updateUniforms(1);
  },
  renderFrame: (dt) => {
    photometricPointLightRuntime.updateUniforms(dt);
    postProcessingRuntime.render(dt);
  },
});
const levelRouteCoordinator = new LevelRouteCoordinator({
  sessions: activeLevelSessionRuntime,
  stopEditing: stopPositionGizmo,
  loadEnvironment: loadLevelEnvironment,
  resolveEnvironmentId: getLevelEnvironmentId,
  getLevelConfig: (levelId, loadedLevelId) =>
    CONFIG.levelEnvironments?.[levelId] ?? CONFIG.levelEnvironments?.[loadedLevelId] ?? {},
  setActiveRoute: (levelId, mode) => {
    activeLevelId = levelId;
    activeLevelMode = mode;
  },
  setLevelView: () => { operatorViewMode = "level"; },
  resetDoors: resetLevelDoors,
  activateEnvironment: updateActiveLevelEnvironment,
  warmupRendering: renderWarmupRuntime.warmup,
  restartPrefabLights: (loadedLevelId) => {
    levelPrefabInstances.forEach((runtime, key) => {
      if (!key.startsWith(`${loadedLevelId}:`) || !runtime.light?.userData.lightConfig?.fluorescentStartup) return;
      runtime.startupPattern = createFluorescentStartupPattern();
      runtime.startupElapsed = 0;
      runtime.faultyStarterElapsed = 0;
    });
  },
  resetThoughts: resetOperatorThoughts,
  setRoomLights: setRoomLightsEnabled,
  resetDiagnostics: (options) => diagnosticRuntime.reset(options),
  resetFuelBlend: (options) => fuelBlendRuntime.reset(options),
  setShiftProfile: (profile) => { activeShiftProfile = profile; },
  resetLevelRuntime: resetLevelSession,
  resetRecorder: resetShiftRecorder,
  resetCore: () => fusionCore.reset(),
  stopFuelBlend: () => fuelBlendRuntime.stop(),
  getCoreSnapshot: () => fusionCore.getSnapshot(),
  resetCompletion: (mode) => shiftCompletionRuntime.reset(mode),
  updateStatus: (snapshot, force) => statusScreen.setSnapshot(snapshot, force),
  scheduleNarration: scheduleWelcomeNarration,
  resetShift,
  enterMenuView,
});
materialTextureRuntime.start();

const debugToolsRuntime = new DebugToolsRuntime({
  config: CONFIG,
  defaultPostProcessingConfig,
  defaultSceneDebugConfig,
  materialInstances: materials.interiorCustom,
  pointLights: pointLightsByKey,
  getHemisphereLight: () => hemisphereLight,
  debugOverlay,
  fpsMeter,
  soundRegistry: SOUND_REGISTRY,
  soundMix: SOUND_MIX,
  getPostProcessingQualities: () => ({
    gtao: postProcessingPolicy.quality.gtao,
    ssgi: postProcessingPolicy.quality.ssgi,
    ssr: postProcessingPolicy.quality.ssr,
    screenSpaceShadows: postProcessingPolicy.quality.screenSpaceShadows,
  }),
  setPostProcessingQuality: (key, quality) => ({
    gtao: setGtaoQuality,
    ssgi: setSsgiQuality,
    ssr: setSsrQuality,
    screenSpaceShadows: setScreenSpaceShadowQuality,
  })[key]?.(quality) ?? null,
  getAudioDebugState: () => audioRuntime.getDebugState(getDisplayedLevelId()),
  getSceneSoundKeys: (levelId) => getLevelSceneSoundKeys(levelId ?? getDisplayedLevelId()),
  applyLevelAmbient: applyLevelAmbientConfig,
  applyLevelPrefab: applyLevelPrefabConfig,
  applyLevelPointLight: (levelId, key, structural = false) => {
    const lightConfig = CONFIG.levelEnvironments?.[levelId]?.lighting?.pointLights?.[key];
    return lightingRuntime.applyPointLight(levelId, key, lightConfig, structural);
  },
  applyLevelWorld: (levelId) => levelEnvironmentActivation.applyWorldConfig(levelId),
  applyPlayerCollisionSettings,
  applyPostProcessing: applyLivePostProcessingConfig,
  rebuildPostProcessing: () => postProcessingRuntime.setup(),
  applyAudioMix: () => audioRuntime.refreshMix(),
  applyMaterialConfig: (materialKey) => interiorMaterialRuntime.applyConfig(materialKey),
  togglePositionGizmo,
  stopPositionGizmo,
  getActiveDebugLevel: () => operatorViewMode === "menu" ? null : activeLevelId,
  applyShadowSettings,
  applyCollisionSettings,
  createLevelPointLight,
  applyMaterialOverlay: (key) => updateMaskOverlayUniforms(
    materials.interiorCustom[key],
    CONFIG.interior.specialMaterials[key],
  ),
  defer: (callback) => window.setTimeout(callback, 0),
});

const updateRuntimeTextureLoading = runtimeTextureLoadingIndicator.update;
const animationLoop = new AnimationLoop({
  clock,
  schedulingPolicy: frameSchedulingPolicy,
  steps: [
    updateLoadingOverlay,
    updateFpsMeter,
    adaptiveQualityRuntime.update,
    (dt) => { testTime += dt; },
    updateLevelPrefabElevators,
    updateLevelPrefabBehaviors,
    levelTriggerSequenceRuntime.update,
    (dt) => playerController.update(dt),
    updateHoverTarget,
    (dt) => itemInteractionRuntime.update(dt),
    updateControlLabels,
    updateInterior,
    (dt) => operatorPanelRuntime.update(dt),
    updateActiveLevelSession,
    updateFeedback,
    updateLevelPrefabLights,
    (dt) => pointLightPoolRuntime.update(dt),
    updateLevelPrefabClocks,
    updateAudioState,
    updateNarratorRadios,
    (dt) => physicsSystem?.step(dt),
    () => playerController.updateAfterPhysics(),
    menuCameraRuntime.update,
    (dt) => photometricPointLightRuntime.updateUniforms(dt),
    updateRuntimeTextureLoading,
    updateDebugOverlay,
    (dt) => postProcessingRuntime.render(dt),
  ],
});

await init();

async function init() {
  if (CONFIG.loading?.skip || fastDebugBoot) skipLoadingOverlay();
  restoreSavedPostProcessingConfig(CONFIG.postProcessing);
  configureQualityProfile(bootOptions.qualityProfile ?? "high");
  CONFIG.postProcessing.colorAdjustments.gamma = Number(bootOptions.displayGamma ?? 0.93);
  renderer.shadowMap.enabled = getShadowPreset().enabled;
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
  animationLoop.start();
}

function setupLights() {
  hemisphereLight = lightingRuntime.createDefault(CONFIG.lighting, createFixtureFlickerState);
}

function setupLightFixtures() {
  lightingRuntime.configureFixtures(CONFIG.lighting.fixtures, materials.interiorCustom, createFixtureFlickerState);
}

function applyShadowSettings(light, lightConfig) {
  return applyLightShadowSettings(light, lightConfig, getShadowPreset());
}

function setupPostProcessing() {
  return postProcessingRuntime.setup();
}

function setupPostProcessingDebugPanel() {
  debugToolsRuntime.setupConfiguredTools();
  debugHub = debugToolsRuntime.getHub();
}

function setupSceneDebugPanels() {
  setupPostProcessingDebugPanel();
}

function getDisplayedLevelId() {
  return operatorViewMode === "menu" ? "intro-shift" : getLevelEnvironmentId(activeLevelId);
}

function getLevelSceneSoundKeys(levelId = getDisplayedLevelId()) {
  const environmentId = getLevelEnvironmentId(levelId);
  return collectLevelSoundKeys({
    levelId: environmentId,
    environment: CONFIG.levelEnvironments?.[environmentId],
    runtimeSoundKeys: audioRuntime.getDebugState(environmentId).soundKeys,
    hasOperatorPanel: Boolean(getLevelPanelConfig(environmentId)),
    soundRegistry: SOUND_REGISTRY,
  });
}

function setupDebugHub() {
  debugHub = debugToolsRuntime.setupHub();
  return debugHub;
}

function rebuildSceneDebugPanels() {
  debugToolsRuntime.rebuildScenePanels();
  debugHub = debugToolsRuntime.getHub();
}

function setDebugPanelsVisible(visible) {
  const result = debugToolsRuntime.setVisible(visible);
  debugHub = debugToolsRuntime.getHub();
  return result;
}

function toggleDebugPanels() {
  const result = debugToolsRuntime.toggle();
  debugHub = debugToolsRuntime.getHub();
  return result;
}

function applyLivePostProcessingConfig() {
  return postProcessingPolicy.applyLiveConfig();
}

function applyColorAdjustmentConfig(pass, emergency) {
  return postProcessingPolicy.applyColorAdjustments(pass, emergency);
}

function applyLensDistortionConfig(pass, emergency) {
  return postProcessingPolicy.applyLensDistortion(pass, emergency);
}

function applyLensEffectsConfig(pass) {
  return postProcessingPolicy.applyLensEffects(pass);
}

function getShadowPreset(quality) {
  return postProcessingPolicy.getShadowPreset(quality);
}

function getGtaoPreset(quality) {
  return postProcessingPolicy.getGtaoPreset(quality);
}

function getSsgiPreset(quality) {
  return postProcessingPolicy.getSsgiPreset(quality);
}

function getSsrPreset(quality) {
  return postProcessingPolicy.getSsrPreset(quality);
}

function getScreenSpaceShadowPreset(quality) {
  return postProcessingPolicy.getScreenSpaceShadowPreset(quality);
}

function setShadowQuality(quality = "min") {
  return postProcessingPolicy.setShadowQuality(quality);
}

function setGtaoQuality(quality = "off") {
  return postProcessingPolicy.setGtaoQuality(quality);
}

function setSsgiQuality(quality = "off") {
  return postProcessingPolicy.setSsgiQuality(quality);
}

function setSsrQuality(quality = "off") {
  return postProcessingPolicy.setSsrQuality(quality);
}

function setScreenSpaceShadowQuality(quality = "off") {
  return postProcessingPolicy.setScreenSpaceShadowQuality(quality);
}

function setCinematicPostProcessingQuality(quality = "off") {
  return postProcessingPolicy.setCinematicQuality(quality);
}

function buildRoom() {
  return buildPrimitiveRoom({ scene, roomConfig: CONFIG.room, floorMaterial: materials.floor });
}

function updateInterior(dt) {
  interiorObjectRegistry.updateFans(dt);
  updateBulkheadHandle(dt);
  updateDoorLatchHandles(dt);
}

async function loadSceneAsset(assetPath, context) {
  return levelAssetCache.instantiate(assetPath, context);
}

async function loadLevelEnvironment(requestedLevelId, context) {
  const levelId = getLevelEnvironmentId(requestedLevelId);
  const result = await levelRuntimeManager.request(levelId, context);
  loadedRuntimeLevelId = result.levelId;
  return result.status === "superseded" ? null : result.levelId;
}

function appendPanelPhysics(levelId) {
  return levelStaticPhysicsRuntime.appendPanel(levelId);
}

function appendLevelPrefabPhysics(levelId) {
  return levelStaticPhysicsRuntime.appendPrefabs(levelId);
}

function rebuildLevelStaticPhysics(levelId) {
  return levelStaticPhysicsRuntime.rebuild(levelId);
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
  return debugTransformRuntime.toggle(descriptor);
}

function stopPositionGizmo() {
  return debugTransformRuntime.stop();
}

function applyLevelAmbientConfig(levelId) {
  const lightingConfig = CONFIG.levelEnvironments?.[levelId]?.lighting;
  lightingRuntime.applyAmbient(levelId, lightingConfig);
}

function syncLevelPrefabMaterialClones(materialKey) {
  return interiorMaterialRuntime.syncPrefabClones(materialKey);
}

function applyLevelPrefabConfig(levelId, prefabName, structural = false) {
  return levelPrefabConfigRuntime?.apply(levelId, prefabName, structural);
}

levelPrefabConfigRuntime = new LevelPrefabConfigRuntime({
  config: CONFIG,
  instances: levelPrefabInstances,
  physics: physicsSystem,
  getActiveLevelId: () => activeLevelId,
  applyPanelTransform: () => applyActivePanelTransform(),
  updateActivation: () => updateActiveLevelEnvironment(),
  rebuildStaticPhysics: (levelId) => rebuildLevelStaticPhysics(levelId),
  setDoorLatched: (runtime, latched) => setDoorLatched(runtime, latched),
  applyDoorRotation: (runtime) => applyHingedDoorRotation(runtime),
  applyShadowSettings,
  createStartupPattern: createFluorescentStartupPattern,
});

function registerPrefabInteraction(...args) {
  const physicsRuntime = prefabPhysicsRegistrar.register(...args);
  itemInteractionRuntime.register(...args);
  return physicsRuntime;
}

function applyHingedDoorRotation(runtime) {
  return doorStateRuntime.applyRotation(runtime);
}

function setHoveredHingedDoor(doorMesh) {
  return doorStateRuntime.setHovered(doorMesh);
}

function toggleHingedDoor(doorMesh) {
  return doorStateRuntime.toggle(doorMesh);
}

function resetLevelDoors(levelId = null) {
  return doorStateRuntime.reset(levelId);
}

function beginHingedDoorDrag(doorMesh) {
  return doorInteractionSystem.beginDrag(doorMesh);
}

function toggleDoorLatchHandle(handle) {
  return doorInteractionSystem.beginLatchInteraction(handle);
}

function releaseDoorLatchHandles() {
  doorInteractionSystem.releaseLatches();
}

function canOperateDoorLatch(runtime) {
  return doorStateRuntime.canOperateLatch(runtime);
}

function setDoorLatched(runtime, latched, options = {}) {
  return doorStateRuntime.setLatched(runtime, latched, options);
}

function updateHingedDoorDrag() {
  return doorInteractionSystem.updateDrag(camera);
}

function endHingedDoorDrag() {
  return doorInteractionSystem.endDrag();
}

function applyCollisionSettings() {
  const collisionConfig = CONFIG.player?.collision;
  collisionDebugMaterial.visible = Boolean(collisionConfig?.show);
  playerCollisionDebugRuntime.setVisible(collisionConfig?.show);
  updateActiveLevelEnvironment();
}

function applyPlayerCollisionSettings() {
  return playerCollisionRuntime.applySettings();
}

function updatePlayerCollisionDebug() {
  playerCollisionDebugRuntime.update();
}

function registerInteriorObject(object, environmentConfig = null, levelId = null) {
  return interiorObjectRegistry.registerEnvironmentObject(object, environmentConfig, levelId);
}

function registerPanelObject(object) {
  return interiorObjectRegistry.registerPanelObject(object);
}

function getInteriorCustomMaterialKey(object) {
  return interiorObjectRegistry.getInteriorCustomMaterialKey(object);
}

function getInteriorObjectMatchNames(object) {
  return collectInteriorObjectMatchNames(object);
}

function normalizeMatchName(name) {
  return normalizeObjectName(name);
}

function getCustomInteriorMaterialDebugState() {
  return interiorMaterialRuntime.getDebugSnapshot();
}

function ensureSecondUvSet(object) {
  return ensureInteriorSecondUvSet(object);
}

function applyPanelTransform(model) {
  return operatorPanelAssetRuntime.applyBaseTransform(model);
}

function applyActivePanelTransform() {
  const applied = operatorPanelAssetRuntime.applyActiveTransform(activeLevelId, operatorViewMode);
  const panelLevelId = operatorViewMode === "menu" ? "intro-shift" : activeLevelId;
  const panelConfig = operatorPanelAssetRuntime.getLevelConfig(panelLevelId);
  if (panelConfig?.screen) statusScreen.applyConfig(panelConfig.screen);
  return applied;
}

function getLevelPanelConfig(levelId) {
  return operatorPanelAssetRuntime.getLevelConfig(levelId);
}

function playSoundAtObject(object, soundKey, options = {}) {
  return audioRuntime.playAttached(object, soundKey, camera.position, options);
}

function playSoundGroupAtObject(object, groupKey, options = {}) {
  return audioRuntime.playRandomAttached(object, groupKey, camera.position, options);
}

function updateNarratorRadios(dt) {
  levelPrefabInstances.forEach((runtime) => {
    updateNarratorRadioRuntime(runtime.radio, dt);
  });
}

function clearNarratorTimers() {
  narrationRuntime.clear(levelPrefabInstances.values());
}

function getLevelNarratorRadioRuntime(levelId = activeLevelId) {
  return narrationRuntime.getRadioRuntime(levelId);
}

function getLevelNarrationLine(levelId = activeLevelId, language = document.documentElement.lang) {
  return narrationRuntime.getConfiguredLine(levelId, language);
}

function scheduleWelcomeNarration(levelId = activeLevelId) {
  return narrationRuntime.scheduleWelcome(levelId);
}

async function playWelcomeNarration(levelId = activeLevelId) {
  return narrationRuntime.playWelcome(levelId);
}

function getTooltipText(target) {
  return interactionTooltipPolicy.getText(target);
}

function getRoomLightButtonState(button) {
  return interactionTooltipPolicy.getRoomLightState(button);
}

function isObjectHierarchyVisible(object) {
  return isVisibleInSceneHierarchy(object, scene);
}

function resetShiftRecorder() {
  shiftRecorder = createShiftRecorder();
}

function updateShiftRecorder(dt, snapshot, controls) {
  updateShiftRecorderState(shiftRecorder, dt, snapshot, controls);
}

function shouldWaitForDoorExitBeforeResults() {
  const waitsForDoorUnlock = (CONFIG.levelEnvironments?.[activeLevelId]?.session?.objectives ?? []).some(
    (objective) => objective.type === "event" && objective.event === "doorUnlocked",
  );
  return waitsForDoorUnlock && Boolean(shiftCompletionRuntime.resultsSnapshot) && !shiftResultsController.visible;
}

function updateFeedback(dt) {
  sceneFeedbackRuntime.update(dt);
}

function triggerStartupFeedback() {
  sceneFeedbackRuntime.triggerStartup();
}

function getStartupLightFactor() {
  return sceneFeedbackRuntime.getStartupLightFactor();
}

function createFluorescentStartupPattern() {
  return createFluorescentStartupPatternFromConfig(CONFIG.feedback.startup.fluorescentStartup);
}

function getControlInputs(fuelBlend = null) {
  return panelControlRuntime.getSimulationInputs({ fuelBlend, shiftProfile: activeShiftProfile });
}

function updateRoomLightMaterials() {
  return sceneFeedbackRuntime.updateRoomMaterials();
}

function setControlButtonPressed(button, pressed) {
  return panelControlRuntime.setControlButtonPressed(button, pressed);
}

function setRoomLightButtonPressed(button, pressed) {
  return panelControlRuntime.setAuxiliaryButtonPressed(button, pressed);
}

function executeLevelBinding(binding) {
  return levelBindingRuntime.execute(binding, activeLevelId);
}

function toggleLevelPrefabLight(levelId, prefabName) {
  return levelBindingRuntime.togglePrefabLight(levelId, prefabName);
}

function setLevelPrefabLightEnabled(levelId, prefabName, enabled) {
  return levelBindingRuntime.setPrefabLightEnabled(levelId, prefabName, enabled);
}

function startShift() {
  return shiftLifecycleRuntime.start();
}

function resetShift() {
  return shiftLifecycleRuntime.reset();
}

function resetOperatorView() {
  operatorViewRuntime.resetLevelView();
}

async function enterMenuView() {
  return operatorViewRuntime.enterMenuView();
}

function resetPanelControls() {
  releaseAllControlButtons();
  controlKnobs.forEach((knob) => {
    knob.userData.controlPercent = knob.userData.initialPercent ?? 0;
    applyControlKnobRotation(knob);
  });
  setHoveredKnob(null);
  setHoveredTooltipTarget(null);
  interactionHoverRuntime.clear();
  sceneFeedbackRuntime.setIndicatorTimer(0);
  diagnosticRuntime.stopSelfTest();
  fuelBlendRuntime.stop();
}

function resetLevelSession() {
  levelTriggerSequenceRuntime.reset();
  hideShiftResults();
  playerController.reset();
  operatorPanelRuntime.reset();
  resetBulkheadExit();
  freezeNeedles = false;
  needles.forEach((needle) => {
    needle.userData.needleDebugAxis = null;
  });
  shiftCompletionRuntime.reset(latestSnapshot.mode);
}

function updateActiveLevelSession(dt) {
  if (operatorViewMode !== "level") return;
  activeLevelSessionRuntime.update(dt, {
    shiftMode: latestSnapshot.mode,
    shiftElapsed: latestSnapshot.elapsed,
    createCheckpoint: () => ({
      fusionCore: fusionCore.exportState(),
      controls: Object.fromEntries(
        controlKnobs.map((knob) => [knob.name, knob.userData.controlPercent ?? 0]),
      ),
    }),
  });
}

async function resetForMenu() {
  return levelRouteCoordinator.resetForMenu();
}

async function enterLevelSession({ levelId = activeLevelId, mode = activeLevelMode, onProgress } = {}) {
  return levelRouteCoordinator.enterLevel({ levelId, mode, onProgress });
}

function runControlButtonAction(button) {
  if (button.userData.controlAction === "start") {
    activeLevelSessionRuntime.emit("coreStarted", { target: button.name });
    startShift();
    console.log("[OperatorGame] Fusion core run started");
  } else if (button.userData.controlAction === "reset") {
    resetForMenu();
    console.log("[OperatorGame] Fusion core reset");
  } else if (button.userData.controlAction === "pulse") {
    console.log("[OperatorGame] Ignition pulse armed");
  } else if (button.userData.controlAction === "indicatorTest") {
    startDiagnosticSelfTest();
  }
}

function startDiagnosticSelfTest() {
  return shiftLifecycleRuntime.startDiagnosticSelfTest();
}

function releaseAllControlButtons() {
  return panelControlRuntime.releaseAll();
}

const findSceneObject = sceneInspector.findObject;
const getObjectTransform = sceneInspector.getObjectTransform;
const listSceneObjects = sceneInspector.listObjects;

function setNeedleDebugRotation(index = 0, axis = "z", degrees = 0) {
  const needle = needles[index];
  if (!needle) return null;
  freezeNeedles = true;
  panelGaugeRuntime.setDebugRotation(needle, axis, degrees);
  return getObjectTransform(needle);
}

function requestPointerLock() {
  if (inputLockRuntime.isLocked() || document.body.classList.contains("app-ui-open")) return;
  canvas.requestPointerLock?.();
}

function isLookOnlyControlMode() {
  return playerControlMode === "lookOnlyUntilElevatorArrival";
}

function setInputLocked(locked) {
  return inputLockRuntime.setLocked(locked);
}

function resizeRendererTargets() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  postProcessingRuntime.resize(window.innerWidth, window.innerHeight);
}

function handleRendererResize() {
  if (!adaptiveQualityRuntime?.resize()) resizeRendererTargets();
}

window.addEventListener("resize", handleRendererResize);

const operatorInputRuntime = createOperatorInputRuntime({
  config: CONFIG,
  canvas,
  lockButton,
  camera,
  pointer,
  keys,
  unlockAudio: () => audioRuntime.unlock(),
  isInputLocked: inputLockRuntime.isLocked,
  isLookOnly: isLookOnlyControlMode,
  isUiOpen: () => document.body.classList.contains("app-ui-open"),
  isDebugTransformEditing: debugTransformRuntime.isEditing,
  getNoclipEnabled: () => noclipEnabled,
  setNoclipEnabled: (enabled) => {
    noclipEnabled = Boolean(enabled);
  },
  setJumpQueued: (queued) => {
    jumpQueued = Boolean(queued);
  },
  getZoomActive: () => zoomActive,
  setZoomActive: (active) => {
    zoomActive = Boolean(active);
  },
  getDraggedDoor: doorInteractionSystem.getDraggedRuntime,
  updateCameraLook,
  syncCameraLook: () => {
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;
    camera.updateMatrixWorld(true);
  },
  updateDoorDrag: updateHingedDoorDrag,
  adjustNoclipSpeed: operatorMovementRuntime.adjustNoclipSpeed,
  getHoveredKnob: interactionHoverRuntime.getHoveredKnob,
  adjustControlKnob,
  getActiveLevelId: () => activeLevelId,
  updateHoverTarget,
  getHoveredInteractive: interactionHoverRuntime.getHoveredInteractive,
  canLean: () => !interactionHoverRuntime.isViewObstructed(
    (CONFIG.camera.operatorMovement?.leanForward ?? 0.16) + (CONFIG.player?.collision?.cameraRadius ?? 0.12),
  ),
  beginItemPrimary: (target) => itemInteractionRuntime.beginPrimary(target),
  releaseItemPrimary: () => itemInteractionRuntime.releasePrimary(),
  cancelItemPrimary: () => itemInteractionRuntime.cancelPrimary(),
  activateRelevantItem: (target) => itemInteractionRuntime.activateRelevant(target),
  dropHandledItem: (options) => itemInteractionRuntime.dropHandled(options),
  beginInventorySelection: () => itemInteractionRuntime.beginSelection(),
  isInventorySelectionOpen: () => itemInteractionRuntime.getSnapshot().selectorOpen,
  moveInventorySelection: (direction) => itemInteractionRuntime.moveSelection(direction),
  commitInventorySelection: () => itemInteractionRuntime.commitSelection(),
  cancelInventorySelection: () => itemInteractionRuntime.cancelSelection(),
  activateInteractive: (target) => {
    if (target?.userData.kind === "controlButton") setControlButtonPressed(target, true);
    else if (target?.userData.kind === "roomLightButton") setRoomLightButtonPressed(target, true);
    else if (target?.userData.kind === "bulkheadHandle") beginBulkheadHandleInteraction();
    else if (target?.userData.kind === "doorLatchHandle") toggleDoorLatchHandle(target);
    else if (target?.userData.kind === "hingedDoor") toggleHingedDoor(target);
    else if (target?.userData.kind === "slidingDrawer") prefabPhysicsRegistrar.toggleDeskDrawer(target);
  },
  releasePrimaryInteractions: () => {
    bulkheadExitRuntime.release();
    releaseDoorLatchHandles();
    endHingedDoorDrag();
  },
  releaseAllControls: releaseAllControlButtons,
  requestPointerLock,
  toggleDebugPanels,
});
operatorInputRuntime.wire();

function runPerformanceBenchmark(options = {}) {
  return performanceBenchmark.run(options);
}

function applyQualityProfile(profile = "low") {
  const normalized = configureQualityProfile(profile);
  const quality = getGraphicsQualityProfile(normalized);
  bootOptions.qualityProfile = normalized;
  bootOptions.deferFullTextures = false;
  bootOptions.disableFullTextures = !quality.fullTextures;
  adaptiveQualityRuntime?.configure(normalized);
  postProcessingPolicy.replace({
    gtao: quality.gtaoQuality,
    ssgi: "off",
    ssr: "off",
    screenSpaceShadows: "off",
  });
  setShadowQuality(quality.shadowQuality);
  setupPostProcessing();
  resizeRendererTargets();
  return normalized;
}

function setDisplayGamma(gamma = 0.93) {
  const value = THREE.MathUtils.clamp(Number(gamma) || 0.93, 0.75, 1.25);
  CONFIG.postProcessing.colorAdjustments.gamma = value;
  if (postProcessingRuntime.colorAdjustmentPass) {
    applyColorAdjustmentConfig(postProcessingRuntime.colorAdjustmentPass, 0);
  }
  return value;
}

const getRuntimeDebugState = () => createRuntimeDebugSnapshot(() => ({
  config: CONFIG,
  renderer,
  camera,
  materials,
  materialTextureRuntime,
  levelEnvironmentModels,
  levelAssetCache,
  levelPrefabInstances,
  physicsSystem,
  pointLightsByKey,
  postProcessingRuntime,
  realismPostProcessingRuntime,
  postProcessingAssets,
  runtimeTextureLoading,
  roomLightingState: roomLightingRuntime.state,
  freezeNeedles,
  inputLocked: inputLockRuntime.isLocked(),
  zoomActive,
  noclipEnabled,
  noclipSpeed: operatorMovementRuntime.getNoclipSpeed(),
  operatorViewMode,
  movementVelocity,
  leanAmount: operatorMovementRuntime.getLeanAmount(),
  indicatorTestTimer: sceneFeedbackRuntime.getIndicatorTimer(),
  diagnostics: diagnosticRuntime.getDebugState(),
  fuelBlend: fuelBlendRuntime.snapshot(),
  activeShiftProfile,
  resultsVisible: shiftResultsController.visible,
  resultsTimer: shiftCompletionRuntime.resultsTimer,
  activeLevelId,
  activeLevelMode,
  recorder: getShiftRecorderDebugState(shiftRecorder),
  levelSession: activeLevelSessionRuntime.snapshot(),
  panelModel,
  getObjectTransform,
  loadedRuntimeLevelId,
  photometricPointLights: photometricPointLightRuntime.getDebugState(),
  pointLightPool: pointLightPoolRuntime.getDebugState(),
  lightingZones: lightingZoneRuntime.getDebugState(),
  inventory: itemInteractionRuntime.getSnapshot(),
  adaptiveQuality: adaptiveQualityRuntime.snapshot(),
  interiorFans,
  customInteriorMaterials: getCustomInteriorMaterialDebugState(),
  screen: statusScreen.getState(),
  game: fusionCore.getSnapshot(),
  gtaoQuality: postProcessingPolicy.quality.gtao,
  ssgiQuality: postProcessingPolicy.quality.ssgi,
  ssrQuality: postProcessingPolicy.quality.ssr,
  screenSpaceShadowQuality: postProcessingPolicy.quality.screenSpaceShadows,
  shadowQuality: postProcessingPolicy.quality.shadows,
  getShadowPreset,
  lamps,
  needles,
  interactive,
  controlKnobs,
  controlButtons,
  roomLightButtons,
}));

installOperatorGameApi(window, {
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
  isLoadingComplete: loadingCoordinator.isComplete,
  hideShiftResults,
  requestPointerLock,
  releasePointerLock: () => document.exitPointerLock?.(),
  setInputLocked,
  unlockAudio: () => audioRuntime.unlock(),
  isAudioUnlocked: () => audioRuntime.unlocked,
  setMenuAudioActive: (active) => menuAudioRuntime.setActive(active),
  setBriefingSheetOpener: (callback) => {
    briefingSheetOpener = typeof callback === "function" ? callback : null;
  },
  playSoundGroup: (groupKey, options) => audioRuntime.playRandom(groupKey, options),
  finishHoldInteraction: () => itemInteractionRuntime.cancelPrimary(),
  finishSpecialItemView: () => itemInteractionRuntime.closeSpecialView(),
  dropSpecialItem: () => itemInteractionRuntime.closeSpecialView({ drop: true }),
  getInventoryState: () => itemInteractionRuntime.getSnapshot(),
  emitThought: (id) => emitOperatorThought(id),
  getTutorialAnchor: ({ prefab, role } = {}) => {
    const environmentId = getLevelEnvironmentId(activeLevelId);
    const runtime = levelPrefabInstances.get(`${environmentId}:${prefab}`);
    const authoredSocket = role === "latchHandle"
      ? runtime?.parts?.get(runtime?.door?.interaction?.tutorialHintSocketName)
      : null;
    const target = role === "latchHandle"
      ? authoredSocket ?? runtime?.door?.latchHandles?.[0] ?? runtime?.door?.latchHandle
      : runtime?.root;
    if (!target) return null;
    const position = new THREE.Vector3();
    target.getWorldPosition(position);
    if (!authoredSocket && role === "latchHandle") position.y += 0.18;
    position.project(camera);
    return {
      visible: position.z >= -1 && position.z <= 1
        && Math.abs(position.x) <= 1.1 && Math.abs(position.y) <= 1.1,
      x: (position.x * 0.5 + 0.5) * window.innerWidth,
      y: (-position.y * 0.5 + 0.5) * window.innerHeight,
    };
  },
  setBaseFov: (degrees) => {
    baseFovDegrees = THREE.MathUtils.clamp(Number(degrees), 50, 105);
    CONFIG.camera.fovDegrees = baseFovDegrees;
    if (!zoomActive) {
      camera.fov = baseFovDegrees;
      camera.updateProjectionMatrix();
    }
    return baseFovDegrees;
  },
  setMouseSensitivity: (multiplier = 1) => {
    const value = THREE.MathUtils.clamp(Number(multiplier) || 1, 0.4, 1.8);
    CONFIG.camera.mouseSensitivity = defaultMouseSensitivity * value;
    return value;
  },
  setDebugVisible: (visible) => {
    return setDebugPanelsVisible(visible);
  },
  setShadowQuality,
  setGtaoQuality,
  setSsgiQuality,
  setSsrQuality,
  setScreenSpaceShadowQuality,
  setCinematicPostProcessingQuality,
  setDebugPanelsVisible,
  toggleDebugPanels,
  saveSceneDebugPreset: () => debugHub?.scene.save(),
  saveSceneDebugToProject: () => debugHub?.scene.saveProject(),
  loadSceneDebugPreset: () => debugHub?.scene.load(),
  resetSceneDebugPreset: () => debugHub?.scene.reset(),
  copySceneDebugConfig: () => debugHub?.scene.copyConfig(),
  rebuildPostProcessing: () => postProcessingRuntime.setup(),
  showPostProcessingPanel: () => debugHub?.postProcessing.show(),
  hidePostProcessingPanel: () => debugHub?.postProcessing.hide(),
  togglePostProcessingPanel: () => debugHub?.postProcessing.toggle(),
  savePostProcessingPreset: () => debugHub?.postProcessing.save(),
  savePostProcessingToProject: () => debugHub?.postProcessing.saveProject(),
  loadPostProcessingPreset: () => debugHub?.postProcessing.load(),
  resetPostProcessingPreset: () => debugHub?.postProcessing.reset(),
  copyPostProcessingConfig: () => debugHub?.postProcessing.copyConfig(),
  showShiftResults: () => showShiftResults(fusionCore.getSnapshot()),
  startIndicatorTest: startDiagnosticSelfTest,
  startSelfTest: startDiagnosticSelfTest,
  addDiagnosticLampFault: (fault) => diagnosticRuntime.addLampFault(fault),
  addDiagnosticGaugeFault: (fault) => diagnosticRuntime.addGaugeFault(fault),
  addDiagnosticKnobFault: (fault) => diagnosticRuntime.addKnobFault(fault),
  getDiagnostics: () => diagnosticRuntime.getDebugState(),
  setInteriorMaskDebug,
  triggerFixtureFlicker,
  setNoclip: (enabled) => {
    noclipEnabled = Boolean(enabled);
    return noclipEnabled;
  },
  setNoclipSpeed: operatorMovementRuntime.setNoclipSpeed,
  setRoomLights: (enabled) => {
    const nextEnabled = Boolean(enabled);
    if (roomLightingRuntime.state.enabled !== nextEnabled) {
      setRoomLightsEnabled(nextEnabled);
    }
    return roomLightingRuntime.state.enabled;
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
    levelSession: activeLevelSessionRuntime.snapshot(),
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
    return interactionHoverRuntime.setForcedTarget(target);
  },
  hideControlTooltip: () => {
    interactionHoverRuntime.clear();
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
    ...fpsMeterRuntime.snapshot(),
    adaptiveQuality: adaptiveQualityRuntime.snapshot(),
    renderCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    points: renderer.info.render.points,
    lines: renderer.info.render.lines,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  }),
  runPerformanceBenchmark,
  getPerformanceBenchmark: () => performanceBenchmark.getLastReport(),
  applyQualityProfile,
  setDisplayGamma,
  setPhotometricDebugMode: (enabled) => {
    return photometricPointLightRuntime.setDebugMode(enabled);
  },
  resumeNeedles: () => {
    freezeNeedles = false;
    needles.forEach((needle) => {
      needle.userData.needleDebugAxis = null;
    });
  },
  getState: getRuntimeDebugState,
});

if (CONFIG.debug?.enabled && CONFIG.debug?.performanceBenchmark?.autoRun) {
  const delayMs = Math.max(0, Number(CONFIG.debug.performanceBenchmark.startDelaySeconds ?? 6) * 1000);
  window.setTimeout(() => {
    runPerformanceBenchmark().catch((error) => console.error("[OperatorGame benchmark] Failed", error));
  }, delayMs);
}

