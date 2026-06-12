import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { createFusionCoreSimulation } from "./FusionCoreSimulation.js";
import { CONFIG, MATERIAL_COLORS } from "./OperatorGameConfig.js";
import { createStatusScreen } from "./StatusScreen.js";

const canvas = document.querySelector("#scene");
const lockButton = document.querySelector("#lockButton");
const debugOverlay = document.querySelector("#debugOverlay");
const fpsMeter = document.querySelector("#fpsMeter");
const loadingOverlay = document.querySelector("#loadingOverlay");
const loadingPercent = document.querySelector("#loadingPercent");
const loadingStatus = document.querySelector("#loadingStatus");
const loadingShiftTitle = document.querySelector("#loadingShiftTitle");
const loadingBarFill = document.querySelector("#loadingBarFill");
const resultsOverlay = document.querySelector("#resultsOverlay");
const resultsOutcome = document.querySelector("#resultsOutcome");
const resultsProfile = document.querySelector("#resultsProfile");
const resultsSummary = document.querySelector("#resultsSummary");
const resultsStats = document.querySelector("#resultsStats");
const resultsRestartButton = document.querySelector("#resultsRestartButton");
const controlTooltip = document.createElement("div");
controlTooltip.className = "control-tooltip";
document.body.appendChild(controlTooltip);

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
renderer.shadowMap.enabled = CONFIG.shadows.enabled;
renderer.shadowMap.type = CONFIG.shadows.type;

const textureLoader = new KTX2Loader()
  .setTranscoderPath("https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/libs/basis/")
  .detectSupport(renderer);
const imageTextureLoader = new THREE.TextureLoader();
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

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
let bloomPass = null;
let chromaticAberrationPass = null;
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
let loadingProgress = 0;
let displayedLoadingProgress = 0;
let loadingComplete = Boolean(CONFIG.loading?.skip);
const loadingStartedAt = performance.now();
let shiftRecorder = createShiftRecorder();
let previousGameMode = latestSnapshot.mode;
let resultsTimer = 0;
let resultsSnapshot = null;
let resultsVisible = false;
let roomLightsEnabled = CONFIG.interior.lightToggleButton?.initialOn ?? true;
let roomLightCurrentFactor = roomLightsEnabled ? 1 : 0;
let roomLightSwitchTimer = 0;
let roomLightSwitchMode = "off";
let roomLightBootTimer = 0;

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
      applyTextureMapsToMaterial(materials.interiorCustom[key], textureMaps);
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

const GAUGE_RANGES = {
  plasmaTemp: [0, 180],
  containment: [0, 100],
  powerOutput: [0, 1200],
  targetOutput: [0, 1200],
  fuelReserve: [0, 100],
  heatSinkCapacity: [0, 100],
  coreStress: [0, 100],
  reactionEfficiency: [0, 100],
};

const LAMP_WARNING_KEYS = {
  LightCase1_Light_COREDAMAGE: "coreStress",
  LightCase1_Light_FIELDWEAK: "fieldWeak",
  LightCase1_Light_INSTABILITY: "instability",
  LightCase1_Light_OUTPUTLOW: "outputLow",
  LightCase1_Light_QUENCH_RISK: "quenchRisk",
  LightCase1_Light_QUENCHRISK: "quenchRisk",
  LightCase1_Light_TEMPHIGH: "tempHigh",
};

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

function getInitialTexturePaths(paths) {
  if (!paths) return null;
  return paths.preview ?? paths.initial ?? paths;
}

function getDeferredTexturePaths(paths) {
  if (!paths?.full) return null;
  return paths.full;
}

function queueDeferredTextureLoad(key, paths) {
  const loadFullTextureMaps = async () => {
    try {
      const fullTextureMaps = await loadInteriorTextureMaps(paths);
      const previousTextureMaps = interiorCustomTextureMaps[key];
      interiorCustomTextureMaps[key] = fullTextureMaps;
      applyTextureMapsToMaterial(materials.interiorCustom[key], fullTextureMaps);
      materials.interiorCustom[key].userData.textureTier = "full";
      disposeTextureMaps(previousTextureMaps);
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
      const fullTextureMaps = await loadInteriorTextureMaps(paths);
      const previousTextureMaps = panelTextureMaps;
      panelTextureMaps = fullTextureMaps;
      applyPanelTextureMapsToMaterial(materials.panel, fullTextureMaps);
      materials.panel.userData.textureTier = "full";
      disposeTextureMaps(previousTextureMaps);
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

async function loadInteriorTextureMaps(paths) {
  if (!paths) return null;

  const textureJobs = {
    map: paths.baseColor ? loadRuntimeTexture(paths.baseColor, { colorSpace: THREE.SRGBColorSpace }) : null,
    normalMap: paths.normal ? loadRuntimeTexture(paths.normal) : null,
    ormMap: paths.orm ? loadRuntimeTexture(paths.orm) : null,
    emissiveMap: paths.emissive ? loadRuntimeTexture(paths.emissive, { colorSpace: THREE.SRGBColorSpace }) : null,
  };

  const entries = await Promise.all(
    Object.entries(textureJobs).map(async ([name, texturePromise]) => [name, texturePromise ? await texturePromise : null]),
  );
  return Object.fromEntries(entries);
}

function disposeTextureMaps(textureMaps) {
  if (!textureMaps) return;
  Object.values(textureMaps).forEach((texture) => texture?.dispose?.());
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
  return material;
}

function applyTextureMapsToMaterial(material, textureMaps) {
  if (!material || !textureMaps) return;

  material.map = textureMaps.map ?? null;
  material.normalMap = textureMaps.normalMap ?? null;
  material.aoMap = textureMaps.ormMap ?? null;
  material.roughnessMap = textureMaps.ormMap ?? null;
  material.metalnessMap = textureMaps.ormMap ?? null;
  material.emissiveMap = textureMaps.emissiveMap ?? null;
  material.needsUpdate = true;
}

async function loadPanelTexture(path, options = {}) {
  try {
    const texture = await textureLoader.loadAsync(path);
    texture.flipY = false;
    texture.colorSpace = options.colorSpace ?? THREE.NoColorSpace;
    texture.anisotropy = maxAnisotropy;
    setLoadingProgress(Math.max(loadingProgress, 18));
    return texture;
  } catch (error) {
    setLoadingStatus("TEXTURE MAP WARNING");
    throw error;
  }
}

async function loadRuntimeTexture(path, options = {}) {
  return path.toLowerCase().endsWith(".ktx2") ? loadPanelTexture(path, options) : loadImageTexture(path, options);
}

async function loadImageTexture(path, options = {}) {
  const texture = await imageTextureLoader.loadAsync(path);
  texture.flipY = false;
  texture.colorSpace = options.colorSpace ?? THREE.NoColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

init();

function init() {
  if (CONFIG.loading?.skip) skipLoadingOverlay();
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
  light.castShadow = CONFIG.shadows.enabled && Boolean(lightConfig.castShadow);
  if (!light.castShadow) return;

  const mapSize = lightConfig.shadowMapSize ?? 1024;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = lightConfig.shadowBias ?? -0.0005;
  light.shadow.normalBias = lightConfig.shadowNormalBias ?? 0.03;
  light.shadow.camera.near = lightConfig.shadowNear ?? 0.1;
  light.shadow.camera.far = lightConfig.shadowFar ?? lightConfig.distance ?? 10;
}

function setupPostProcessing() {
  if (!CONFIG.postProcessing.enabled) return;

  composer = new EffectComposer(renderer);
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));

  if (CONFIG.postProcessing.gtao.enabled) {
    const gtaoConfig = CONFIG.postProcessing.gtao;
    gtaoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
    gtaoPass.output = GTAOPass.OUTPUT.Default;
    gtaoPass.blendIntensity = gtaoConfig.blendIntensity;
    gtaoPass.updateGtaoMaterial({
      radius: gtaoConfig.radius,
      distanceExponent: gtaoConfig.distanceExponent,
      thickness: gtaoConfig.thickness,
      distanceFallOff: gtaoConfig.distanceFallOff,
      scale: gtaoConfig.scale,
      samples: gtaoConfig.samples,
    });
    gtaoPass.updatePdMaterial({
      radius: gtaoConfig.denoiseRadius,
      samples: gtaoConfig.denoiseSamples,
    });
    composer.addPass(gtaoPass);
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
        setLoadingProgress(Math.max(loadingProgress, 62));
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
        assignedTo: CONFIG.interior.specialMaterials?.[key]?.meshNames ?? [],
        mapsLoaded: Boolean(interiorCustomTextureMaps[key]),
        color: `#${material.color.getHexString()}`,
        roughness: material.roughness,
        metalness: material.metalness,
        emissive: `#${material.emissive.getHexString()}`,
        emissiveIntensity: material.emissiveIntensity,
        fixtureName: material.userData.fixtureName ?? "",
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
  updateDebugOverlay();
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

function setLoadingProgress(value) {
  loadingProgress = THREE.MathUtils.clamp(value, loadingProgress, 100);
  if (loadingProgress >= 70) loadingShiftTitle?.classList.add("is-visible");
}

function setLoadingStatus(text) {
  if (loadingStatus) loadingStatus.textContent = text;
}

function finishLoading() {
  if (CONFIG.loading?.skip) {
    skipLoadingOverlay();
    return;
  }

  setLoadingStatus("CORE INTERFACE ONLINE");
  setLoadingProgress(100);
  const remainingMinimum = Math.max(0, 2000 - (performance.now() - loadingStartedAt));
  window.setTimeout(() => {
    loadingOverlay?.classList.add("is-final");
  }, remainingMinimum + 450);
  window.setTimeout(() => {
    loadingOverlay?.classList.add("is-complete");
    loadingComplete = true;
    triggerRoomLightBoot();
  }, remainingMinimum + 1150);
}

function skipLoadingOverlay() {
  loadingComplete = true;
  setLoadingProgress(100);
  loadingOverlay?.classList.add("is-final", "is-complete");
}

function updateLoadingOverlay(dt) {
  if (!loadingOverlay || loadingComplete) return;

  if (!panelModel) {
    const idleTarget = Math.min(loadingProgress + dt * 9, 68);
    setLoadingProgress(idleTarget);
  }

  displayedLoadingProgress = THREE.MathUtils.damp(displayedLoadingProgress, loadingProgress, 12, dt);
  const shownPercent = Math.min(100, Math.round(displayedLoadingProgress));

  if (loadingPercent) loadingPercent.textContent = `${String(shownPercent).padStart(2, "0")}%`;
  if (loadingBarFill) loadingBarFill.style.width = `${shownPercent}%`;
  if (shownPercent >= 70) loadingShiftTitle?.classList.add("is-visible");
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
    `shadows: ${CONFIG.shadows.enabled ? "on" : "off"}`,
    `gtao: ${gtaoPass ? "on" : "off"}`,
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
  return false;
}

function createShiftRecorder() {
  return {
    active: false,
    elapsed: 0,
    sampleTimer: 0,
    sampleCount: 0,
    demandErrorSum: 0,
    efficiencySum: 0,
    tempSum: 0,
    outputSum: 0,
    underDemandTime: 0,
    overDemandTime: 0,
    tempHighTime: 0,
    tempCriticalTime: 0,
    thermalSoakTime: 0,
    outputSurgeTime: 0,
    coreStressTime: 0,
    quenchTime: 0,
    instabilityTime: 0,
    ventTime: 0,
    ventActivations: 0,
    fuelSum: 0,
    fieldSum: 0,
    coolantSum: 0,
    maxTemp: 0,
    maxCoreStress: 0,
    maxThermalSoak: 0,
    maxOutput: 0,
    knobMovement: 0,
    previousControls: null,
  };
}

function resetShiftRecorder() {
  shiftRecorder = createShiftRecorder();
}

function updateShiftRecorder(dt, snapshot, controls) {
  if (snapshot.mode !== "running") return;

  shiftRecorder.active = true;
  shiftRecorder.elapsed += dt;
  shiftRecorder.sampleTimer += dt;
  shiftRecorder.demandErrorSum += Math.abs(snapshot.demandError ?? 0) * dt;
  shiftRecorder.efficiencySum += snapshot.reactionEfficiency * dt;
  shiftRecorder.tempSum += snapshot.plasmaTemp * dt;
  shiftRecorder.outputSum += snapshot.powerOutput * dt;
  shiftRecorder.fuelSum += controls.fuelInjection * dt;
  shiftRecorder.fieldSum += controls.magneticField * dt;
  shiftRecorder.coolantSum += controls.coolantFlow * dt;
  if (snapshot.warning?.underDemand) shiftRecorder.underDemandTime += dt;
  if (snapshot.warning?.overDemand) shiftRecorder.overDemandTime += dt;
  if (snapshot.warning?.tempHigh) shiftRecorder.tempHighTime += dt;
  if (snapshot.warning?.tempCritical) shiftRecorder.tempCriticalTime += dt;
  if (snapshot.warning?.thermalSoak) shiftRecorder.thermalSoakTime += dt;
  if (snapshot.warning?.outputSurge) shiftRecorder.outputSurgeTime += dt;
  if (snapshot.warning?.coreStress) shiftRecorder.coreStressTime += dt;
  if (snapshot.warning?.quenchRisk) shiftRecorder.quenchTime += dt;
  if (snapshot.warning?.instability) shiftRecorder.instabilityTime += dt;
  if (controls.ventActive) shiftRecorder.ventTime += dt;

  shiftRecorder.maxTemp = Math.max(shiftRecorder.maxTemp, snapshot.plasmaTemp);
  shiftRecorder.maxCoreStress = Math.max(shiftRecorder.maxCoreStress, snapshot.coreStress);
  shiftRecorder.maxThermalSoak = Math.max(shiftRecorder.maxThermalSoak, snapshot.thermalSoak ?? 0);
  shiftRecorder.maxOutput = Math.max(shiftRecorder.maxOutput, snapshot.powerOutput);

  if (shiftRecorder.previousControls) {
    shiftRecorder.knobMovement +=
      Math.abs(controls.fuelInjection - shiftRecorder.previousControls.fuelInjection) +
      Math.abs(controls.magneticField - shiftRecorder.previousControls.magneticField) +
      Math.abs(controls.coolantFlow - shiftRecorder.previousControls.coolantFlow);
    if (controls.ventActive && !shiftRecorder.previousControls.ventActive) shiftRecorder.ventActivations += 1;
  } else if (controls.ventActive) {
    shiftRecorder.ventActivations += 1;
  }
  shiftRecorder.previousControls = { ...controls };

  if (shiftRecorder.sampleTimer >= 2) {
    shiftRecorder.sampleCount += 1;
    shiftRecorder.sampleTimer = 0;
  }
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

  const report = buildShiftReport(snapshot);
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
}

function hideShiftResults() {
  if (!resultsOverlay) return;
  resultsOverlay.classList.remove("is-visible");
  window.setTimeout(() => {
    if (!resultsOverlay.classList.contains("is-visible")) resultsOverlay.hidden = true;
  }, 1200);
  resultsVisible = false;
}

function buildShiftReport(snapshot) {
  const duration = Math.max(1, shiftRecorder.elapsed);
  const avgDemandError = shiftRecorder.demandErrorSum / duration;
  const avgEfficiency = shiftRecorder.efficiencySum / duration;
  const avgTemp = shiftRecorder.tempSum / duration;
  const avgOutput = shiftRecorder.outputSum / duration;
  const overRatio = shiftRecorder.overDemandTime / duration;
  const underRatio = shiftRecorder.underDemandTime / duration;
  const tempHighRatio = shiftRecorder.tempHighTime / duration;
  const tempCriticalRatio = shiftRecorder.tempCriticalTime / duration;
  const thermalSoakRatio = shiftRecorder.thermalSoakTime / duration;
  const outputSurgeRatio = shiftRecorder.outputSurgeTime / duration;
  const coreStressRatio = shiftRecorder.coreStressTime / duration;
  const quenchRatio = shiftRecorder.quenchTime / duration;
  const instabilityRatio = shiftRecorder.instabilityTime / duration;
  const ventRatio = shiftRecorder.ventTime / duration;
  const movementRate = shiftRecorder.knobMovement / duration;
  const avgFuel = shiftRecorder.fuelSum / duration;
  const avgField = shiftRecorder.fieldSum / duration;
  const avgCoolant = shiftRecorder.coolantSum / duration;
  const profile = pickOperatorProfile({
    avgDemandError,
    avgEfficiency,
    avgOutput,
    avgTemp,
    avgFuel,
    avgField,
    avgCoolant,
    overRatio,
    underRatio,
    tempHighRatio,
    tempCriticalRatio,
    thermalSoakRatio,
    outputSurgeRatio,
    coreStressRatio,
    quenchRatio,
    instabilityRatio,
    ventRatio,
    ventActivations: shiftRecorder.ventActivations,
    movementRate,
    maxTemp: shiftRecorder.maxTemp,
    maxCoreStress: shiftRecorder.maxCoreStress,
    maxThermalSoak: shiftRecorder.maxThermalSoak,
    maxOutput: shiftRecorder.maxOutput,
    snapshot,
  });

  return {
    profile: profile.title,
    summary: profile.summary,
    stats: [
      ["SHIFT TIME", formatDuration(snapshot.elapsed)],
      ["AVG EFFICIENCY", `${Math.round(avgEfficiency)}%`],
      ["AVG OUTPUT", `${Math.round(avgOutput)} MW`],
      ["AVG DEMAND ERROR", `${Math.round(avgDemandError * 100)}%`],
      ["MAX TEMP", `${Math.round(shiftRecorder.maxTemp)} MK`],
      ["MAX CORE STRESS", `${Math.round(shiftRecorder.maxCoreStress)}%`],
      ["MAX HEAT SOAK", `${Math.round(shiftRecorder.maxThermalSoak)}%`],
      ["CRITICAL TEMP", `${Math.round(tempCriticalRatio * 100)}%`],
      ["OUTPUT SURGE", `${Math.round(outputSurgeRatio * 100)}%`],
      ["OVER DEMAND", `${Math.round(overRatio * 100)}%`],
      ["UNDER DEMAND", `${Math.round(underRatio * 100)}%`],
      ["QUENCH RISK", `${Math.round(quenchRatio * 100)}%`],
      ["VENT HELD", `${Math.round(ventRatio * 100)}%`],
      ["VENT PULSES", `${shiftRecorder.ventActivations}`],
      ["AVG TEMP", `${Math.round(avgTemp)} MK`],
      ["CONTROL MOTION", `${Math.round(movementRate)}%/s`],
    ],
  };
}

function pickOperatorProfile(stats) {
  if (stats.snapshot.mode === "failed" && stats.maxCoreStress > 96 && stats.maxTemp > 178) {
    return {
      title: "OPERATOR TYPE: CONTAINMENT POSTMORTEM",
      summary: "You found the part of the operating envelope that writes reports in all caps.",
    };
  }
  if (stats.ventActivations >= 4 || (stats.ventRatio > 0.06 && stats.maxTemp > 155)) {
    return {
      title: "OPERATOR TYPE: NERVOUS PURGE TECH",
      summary: "Short purge pulses solved several problems and created several new entries in the logbook.",
    };
  }
  if (stats.avgEfficiency > 82 && stats.avgDemandError < 0.12 && stats.maxCoreStress < 55 && stats.instabilityRatio < 0.08) {
    return {
      title: "OPERATOR TYPE: FIELD PHYSICIST",
      summary: "Quiet hands, good coupling, acceptable grid discipline. Suspiciously competent.",
    };
  }
  if (stats.avgOutput > 720 && stats.avgDemandError < 0.18 && stats.tempCriticalRatio > 0.04 && stats.coreStressRatio < 0.14) {
    return {
      title: "OPERATOR TYPE: HIGH LOAD SPECIALIST",
      summary: "You ran the burn hot on purpose and mostly convinced the machinery it was planned.",
    };
  }
  if (stats.thermalSoakRatio > 0.12 || stats.maxThermalSoak > 75 || stats.maxTemp > 185) {
    return {
      title: "OPERATOR TYPE: REDLINE PHILOSOPHER",
      summary: "You treated heat soak as a philosophical disagreement between you and the panel. The panel had evidence.",
    };
  }
  if (stats.outputSurgeRatio > 0.08) {
    return {
      title: "OPERATOR TYPE: BUS SURGE CONDUCTOR",
      summary: "The grid received power in expressive waves. Some of them were even useful.",
    };
  }
  if (stats.overRatio > 0.32) {
    return {
      title: "OPERATOR TYPE: GRID OVERFEEDER",
      summary: "Demand was a target. You interpreted it as a lower bound.",
    };
  }
  if (stats.avgFuel > 84 && stats.avgOutput < 650) {
    return {
      title: "OPERATOR TYPE: FUEL INTO NOISE",
      summary: "A lot of fuel became heat, alarms, and character development before it became grid power.",
    };
  }
  if (stats.avgField > 86 && stats.avgOutput < 820) {
    return {
      title: "OPERATOR TYPE: MAGNETIC ACCOUNTANT",
      summary: "Containment was extremely well filed. Net output was less impressed.",
    };
  }
  if (stats.avgCoolant < 28 && stats.maxTemp > 160 && stats.maxCoreStress < 75) {
    return {
      title: "OPERATOR TYPE: HEAT SINK GAMBLER",
      summary: "You trusted the thermal mass longer than the manual recommends, but the lights stayed on.",
    };
  }
  if (stats.quenchRatio > 0.18 || (stats.avgCoolant > 72 && stats.avgTemp < 110)) {
    return {
      title: "OPERATOR TYPE: COOLANT INTERN",
      summary: "The plasma spent much of the shift wondering why it was being refrigerated instead of operated.",
    };
  }
  if (stats.underRatio > 0.42) {
    return {
      title: "OPERATOR TYPE: UNDERPOWERED OPTIMIST",
      summary: "The grid kept asking for more. You maintained a tasteful distance from the request.",
    };
  }
  if (stats.movementRate > 12) {
    return {
      title: "OPERATOR TYPE: WHY IS THIS LAMP BLINKING",
      summary: "You made many corrections and at least some of them were related to the problem at hand.",
    };
  }
  if (stats.movementRate < 1.2 && stats.avgDemandError > 0.28) {
    return {
      title: "OPERATOR TYPE: CONTROL ROOM STATUE",
      summary: "The panel changed phases. You respected its independence.",
    };
  }
  if (stats.tempCriticalRatio > 0.16 && stats.maxCoreStress < 70) {
    return {
      title: "OPERATOR TYPE: EDGE WALKER",
      summary: "You visited the red band often enough to learn the furniture, then left before it became permanent.",
    };
  }
  if (stats.snapshot.mode === "failed") {
    return {
      title: "OPERATOR TYPE: UNSCHEDULED EXPERIMENT",
      summary: "The shift ended with useful data, technically. The maintenance team may use different words.",
    };
  }
  if (stats.avgDemandError < 0.18 && stats.avgEfficiency > 68) {
    return {
      title: "OPERATOR TYPE: SHIFT OPERATOR",
      summary: "You kept the core moving, made some compromises, and left enough machine for the next person.",
    };
  }
  if (stats.maxOutput > 980 && stats.maxCoreStress < 80) {
    return {
      title: "OPERATOR TYPE: PEAK OUTPUT TOURIST",
      summary: "You went sightseeing near maximum output and brought back most of the equipment.",
    };
  }
  if (stats.avgEfficiency < 45) {
    return {
      title: "OPERATOR TYPE: REACTION POET",
      summary: "The numbers formed an emotional arc. The grid requested fewer metaphors.",
    };
  }
  return {
    title: "OPERATOR TYPE: PANEL APPRENTICE",
    summary: "You learned which lights matter and which lights merely judge.",
  };
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
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

  if (chromaticAberrationPass) {
    const chromaConfig = CONFIG.postProcessing.chromaticAberration;
    chromaticAberrationPass.uniforms.amount.value =
      chromaConfig.amount + emergency * CONFIG.feedback.thermalEmergency.chromaticBoost * flickerWave(10, 1.1);
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
  const angle = THREE.MathUtils.degToRad(CONFIG.controls.knobRotationDegrees) * (percent / 100);
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

function runControlButtonAction(button) {
  if (button.userData.controlAction === "start") {
    resetShiftRecorder();
    hideShiftResults();
    fusionCore.start();
    previousGameMode = "running";
    resultsTimer = 0;
    resultsSnapshot = null;
    triggerStartupFeedback();
    statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
    console.log("[OperatorGame] Fusion core run started");
  } else if (button.userData.controlAction === "reset") {
    resetShiftRecorder();
    hideShiftResults();
    fusionCore.reset();
    previousGameMode = "standby";
    resultsTimer = 0;
    resultsSnapshot = null;
    startupFeedbackTimer = 0;
    indicatorTestTimer = 0;
    statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
    console.log("[OperatorGame] Fusion core reset");
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
  const targetFov = zoomActive ? CONFIG.camera.zoomFovDegrees : CONFIG.camera.fovDegrees;
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
    const rawDelta = event.deltaY * CONFIG.controls.wheelPercentPerDelta;
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
  if (document.pointerLockElement !== canvas) {
    requestPointerLock();
  }
});

lockButton.addEventListener("click", requestPointerLock);
resultsRestartButton?.addEventListener("click", () => {
  resetShiftRecorder();
  hideShiftResults();
  fusionCore.start();
  previousGameMode = "running";
  resultsTimer = 0;
  resultsSnapshot = null;
  triggerStartupFeedback();
  indicatorTestTimer = 0;
  statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
});

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
  startGame: () => {
    resetShiftRecorder();
    hideShiftResults();
    fusionCore.start();
    previousGameMode = "running";
    resultsTimer = 0;
    resultsSnapshot = null;
    triggerStartupFeedback();
    statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
  },
  resetGame: () => {
    resetShiftRecorder();
    hideShiftResults();
    fusionCore.reset();
    previousGameMode = "standby";
    resultsTimer = 0;
    resultsSnapshot = null;
    startupFeedbackTimer = 0;
    indicatorTestTimer = 0;
    statusScreen.setSnapshot(fusionCore.getSnapshot(), true);
  },
  showShiftResults: () => showShiftResults(fusionCore.getSnapshot()),
  startIndicatorTest: () => {
    indicatorTestTimer = CONFIG.feedback.indicatorTest.duration;
  },
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
    recorder: {
      elapsed: Number(shiftRecorder.elapsed.toFixed(1)),
      underDemandTime: Number(shiftRecorder.underDemandTime.toFixed(1)),
      overDemandTime: Number(shiftRecorder.overDemandTime.toFixed(1)),
      tempHighTime: Number(shiftRecorder.tempHighTime.toFixed(1)),
      tempCriticalTime: Number(shiftRecorder.tempCriticalTime.toFixed(1)),
      thermalSoakTime: Number(shiftRecorder.thermalSoakTime.toFixed(1)),
      outputSurgeTime: Number(shiftRecorder.outputSurgeTime.toFixed(1)),
      coreStressTime: Number(shiftRecorder.coreStressTime.toFixed(1)),
      ventTime: Number(shiftRecorder.ventTime.toFixed(1)),
      ventActivations: shiftRecorder.ventActivations,
    },
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
      gtaoBlendIntensity: gtaoPass?.blendIntensity ?? 0,
      bloom: Boolean(bloomPass),
      bloomStrength: bloomPass?.strength ?? 0,
      chromaticAberration: Boolean(chromaticAberrationPass),
      chromaticAberrationAmount: chromaticAberrationPass?.uniforms.amount.value ?? 0,
    },
    shadows: {
      enabled: renderer.shadowMap.enabled,
      lights: Object.values(CONFIG.lighting.pointLights).filter((light) => light.castShadow).length,
    },
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
