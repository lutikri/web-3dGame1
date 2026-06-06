import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { CONFIG, MATERIAL_COLORS } from "./OperatorGameConfig.js";
import { createStatusScreen } from "./StatusScreen.js";

const canvas = document.querySelector("#scene");
const lockButton = document.querySelector("#lockButton");
const debugOverlay = document.querySelector("#debugOverlay");
const fpsMeter = document.querySelector("#fpsMeter");
const controlTooltip = document.createElement("div");
controlTooltip.className = "control-tooltip";
document.body.appendChild(controlTooltip);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.world.backgroundColor);
scene.fog = new THREE.Fog(CONFIG.world.fogColor, CONFIG.world.fogNear, CONFIG.world.fogFar);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 80);
camera.position.set(0, CONFIG.playerEyeHeight, 4.8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = CONFIG.shadows.enabled;
renderer.shadowMap.type = CONFIG.shadows.type;

const textureLoader = new THREE.TextureLoader();
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(0, 0);
const keys = new Set();
const interactive = [];
const lamps = [];
const needles = [];
const controlKnobs = [];
const controlButtons = [];
const statusScreen = createStatusScreen();

let panelModel = null;
let testButton = null;
let yaw = 0;
let pitch = 0;
let testActive = false;
let testTime = 0;
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

const panelTextureMaps = createPanelTextureMaps();
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
  panelButtonOn: createPanelPbrMaterial("Panel1_ButtonOn_PBR", {
    emissive: MATERIAL_COLORS.buttonOnEmissive,
    emissiveIntensity: 1.5,
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
  lampRed: new THREE.MeshStandardMaterial({
    color: MATERIAL_COLORS.lampRed,
    emissive: MATERIAL_COLORS.lampRedEmissive,
    emissiveIntensity: 3.6,
    roughness: 0.2,
  }),
};

function createPanelTextureMaps() {
  const map = loadPanelTexture("assets/T_Panel1_BaseColor.png", {
    colorSpace: THREE.SRGBColorSpace,
  });
  const normalMap = loadPanelTexture("assets/T_Panel1_Normal.png");
  const ormMap = loadPanelTexture("assets/T_Panel1_OcclusionRoughnessMetallic.png");

  return { map, normalMap, ormMap };
}

function createPanelPbrMaterial(name, overrides = {}) {
  return new THREE.MeshStandardMaterial({
    name,
    map: panelTextureMaps.map,
    normalMap: panelTextureMaps.normalMap,
    aoMap: panelTextureMaps.ormMap,
    roughnessMap: panelTextureMaps.ormMap,
    metalnessMap: panelTextureMaps.ormMap,
    roughness: 1,
    metalness: 1,
    aoMapIntensity: 1,
    side: THREE.DoubleSide,
    ...overrides,
  });
}

function loadPanelTexture(path, options = {}) {
  const texture = textureLoader.load(path);
  texture.flipY = false;
  texture.colorSpace = options.colorSpace ?? THREE.NoColorSpace;
  texture.anisotropy = maxAnisotropy;
  return texture;
}

init();

function init() {
  setupLights();
  buildRoom();
  setupPostProcessing();
  loadPanelModel();
  animate();
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(
    CONFIG.lighting.ambientSky,
    CONFIG.lighting.ambientGround,
    CONFIG.lighting.ambientIntensity,
  );
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
    applyShadowSettings(light, lightConfig);
    scene.add(light);
  }
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
  const { width, depth } = CONFIG.room;
  addBox("Floor", [width, 0.12, depth], [0, -0.06, 0], materials.floor, { receiveShadow: true });
}

function loadPanelModel() {
  const loader = new GLTFLoader();
  loader.load(
    CONFIG.assetPath,
    (gltf) => {
      panelModel = gltf.scene;
      panelModel.name = "Panel1";

      panelModel.traverse(registerPanelObject);
      fitPanelToRoom(panelModel);
      scene.add(panelModel);

      console.log(`[OperatorGame] Loaded Panel1.glb: ${needles.length} arrows, ${lamps.length} lamps`);
    },
    undefined,
    (error) => {
      console.error("[OperatorGame] Failed to load Panel1.glb", error);
    },
  );
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
    object.userData.needleNoiseSeed = Math.random() * 100;
    needles.push(object);
  }

  if (object.name.startsWith("LightCase1_Light_")) {
    object.material = materials.lampOff;
    object.userData.initialScale = object.scale.clone();
    lamps.push(object);
  }

  if (object.name === "Buttun_Test") {
    object.userData.kind = "testButton";
    testButton = object;
    interactive.push(object);
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
  object.userData.initialPosition = object.position.clone();
  object.userData.pressAxis = buttonConfig.pressAxis ?? "y";
  object.userData.pressDistance = buttonConfig.pressDistance ?? -0.02;
  object.userData.pressSpeed = buttonConfig.pressSpeed ?? 16;
  object.userData.pressed = false;
  object.userData.pressProgress = 0;

  controlButtons.push(object);
  interactive.push(object);
}

function applyPanelPbrMaterial(object) {
  if (!object.geometry.attributes.uv2 && object.geometry.attributes.uv) {
    object.geometry.setAttribute("uv2", object.geometry.attributes.uv.clone());
  }

  object.material = materials.panel;
}

function fitPanelToRoom(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const scale = CONFIG.panel.width / Math.max(size.x, size.y, size.z);

  model.scale.setScalar(scale);
  model.position.set(
    CONFIG.panel.position.x - center.x * scale,
    CONFIG.panel.position.y - center.y * scale,
    CONFIG.panel.position.z - center.z * scale,
  );
  model.rotation.copy(CONFIG.panel.rotation);
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
  updateFpsMeter(dt);
  testTime += dt;
  updateMovement(dt);
  updateHoverTarget();
  updateControlLabels();
  updatePanel(dt);
  updateDebugOverlay();
  if (composer) {
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
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
  return object.userData.kind === "controlKnob" || object.userData.kind === "controlButton" ? object : null;
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
  return target.userData.controlLabel;
}

function updatePanel(dt) {
  statusScreen.update(dt);
  updateControlButtons(dt);

  needles.forEach((needle, index) => {
    if (!freezeNeedles) updateNeedle(needle, index, dt);
    needle.rotation.copy(needle.userData.initialRotation);
    applyNeedleAxisRotation(needle, needle.userData.needleDebugAxis ?? "z", needle.userData.needleAngle);
  });

  lamps.forEach((lamp, index) => {
    if (!testActive) {
      lamp.material = materials.lampOff;
      return;
    }

    const chase = Math.floor(testTime * 8) % lamps.length;
    const load = Math.floor((Math.sin(testTime * 1.6) + 1) * (lamps.length / 2 + 0.5));
    const on = index <= load || index === chase;
    lamp.material = on ? (index >= lamps.length - 2 ? materials.lampRed : materials.lampAmber) : materials.lampOff;
    lamp.scale.copy(lamp.userData.initialScale);
  });
}

function updateControlButtons(dt) {
  controlButtons.forEach((button) => {
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

function updateNeedle(needle, index, dt) {
  needle.userData.needleDebugAxis = null;
  const animationConfig = CONFIG.needleAnimation;
  const limitA = THREE.MathUtils.degToRad(animationConfig.minDegrees);
  const limitB = THREE.MathUtils.degToRad(animationConfig.maxDegrees);
  const lowerAngle = Math.min(limitA, limitB);
  const upperAngle = Math.max(limitA, limitB);
  const inactiveAngle = THREE.MathUtils.degToRad(animationConfig.inactiveDegrees);
  const activeAngle = THREE.MathUtils.degToRad(animationConfig.activeDegrees);
  const overshoot = THREE.MathUtils.degToRad(animationConfig.overshootDegrees);
  const targetAngle = testActive ? activeAngle + overshoot * Math.sin(testTime * 2.8 + index) : inactiveAngle;
  const currentAngle = needle.userData.needleAngle ?? inactiveAngle;

  needle.userData.needleSpeedTimer -= dt;
  if (needle.userData.needleSpeedTimer <= 0) {
    needle.userData.needleSpeed = getRandomNeedleSpeed();
    needle.userData.needleSpeedTimer = animationConfig.speedRetargetInterval * THREE.MathUtils.randFloat(0.75, 1.45);
  }

  const direction = Math.sign(targetAngle - currentAngle);
  const step = needle.userData.needleSpeed * dt;
  let nextAngle = Math.abs(targetAngle - currentAngle) <= step ? targetAngle : currentAngle + direction * step;

  if (testActive) {
    const jitter = THREE.MathUtils.degToRad(animationConfig.jitterDegrees);
    const noise = Math.sin(testTime * animationConfig.jitterFrequency + needle.userData.needleNoiseSeed) * jitter;
    nextAngle += noise * THREE.MathUtils.randFloat(0.15, 1);
  }

  needle.userData.needleAngle = THREE.MathUtils.clamp(nextAngle, lowerAngle, upperAngle);
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
  console.log(`[OperatorGame] ${knob.userData.controlLabel}: ${Math.round(next)}%`);
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

function setControlButtonPressed(button, pressed) {
  if (!button || button.userData.kind !== "controlButton") return;
  if (button.userData.pressed === pressed) return;
  button.userData.pressed = pressed;
  button.material = pressed ? materials.panelButtonOn : materials.panel;
  console.log(`[OperatorGame] ${button.userData.controlLabel} ${pressed ? "PRESSED" : "RELEASED"}`);
}

function releaseAllControlButtons() {
  controlButtons.forEach((button) => setControlButtonPressed(button, false));
}

function getRandomNeedleSpeed() {
  const speedConfig = CONFIG.needleAnimation.speedDegreesPerSecond;
  return THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(speedConfig.min, speedConfig.max));
}

function updateMovement(dt) {
  const speed = keys.has("ShiftLeft") || keys.has("ShiftRight") ? 4.2 : 2.4;
  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw) * -1);
  const right = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
  const move = new THREE.Vector3();

  if (keys.has("KeyW")) move.add(forward);
  if (keys.has("KeyS")) move.sub(forward);
  if (keys.has("KeyD")) move.add(right);
  if (keys.has("KeyA")) move.sub(right);
  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(speed * dt);
    camera.position.add(move);
  }

  // Only floor collision for now: keep the player on a constant eye height.
  camera.position.y = CONFIG.playerEyeHeight;
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

function clickScene() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(interactive, true)[0];
  const target = hit ? findInteractiveRoot(hit.object) : null;
  if (target?.userData.kind === "testButton") {
    setTestActive(!testActive);
  }
}

function setTestActive(value) {
  testActive = value;
  freezeNeedles = false;
  if (testButton) testButton.material = testActive ? materials.panelButtonOn : materials.panel;
  statusScreen.setActive(testActive);
  console.log(`[OperatorGame] Button_Test ${testActive ? "ON" : "OFF"}`);
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

document.addEventListener("keydown", (event) => keys.add(event.code));
document.addEventListener("keyup", (event) => keys.delete(event.code));

document.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) {
    updatePointerFromEvent(event);
    return;
  }

  pointer.set(0, 0);
  yaw -= event.movementX * 0.0022;
  pitch -= event.movementY * 0.0022;
  pitch = THREE.MathUtils.clamp(pitch, -1.25, 1.25);
});

canvas.addEventListener(
  "wheel",
  (event) => {
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
  if (event.button !== 0) return;
  if (document.pointerLockElement !== canvas) updatePointerFromEvent(event);
  updateHoverTarget();
  if (hoveredInteractive?.userData.kind === "controlButton") {
    setControlButtonPressed(hoveredInteractive, true);
  }
});

window.addEventListener("mouseup", () => {
  releaseAllControlButtons();
});

window.addEventListener("blur", releaseAllControlButtons);

function updatePointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== canvas) {
    requestPointerLock();
    return;
  }
  clickScene();
});

lockButton.addEventListener("click", requestPointerLock);

document.addEventListener("pointerlockchange", () => {
  lockButton.textContent = document.pointerLockElement === canvas ? "Pointer Locked" : "Enter First Person";
  if (document.pointerLockElement === canvas) pointer.set(0, 0);
  releaseAllControlButtons();
});

window.operatorGameDebug = {
  scene,
  camera,
  renderer,
  config: CONFIG,
  toggleTest: () => setTestActive(!testActive),
  setTestActive,
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
    const button = controlButtons.find((controlButton) => controlButton.name === name);
    if (!button) return null;
    setControlButtonPressed(button, Boolean(pressed));
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
    testActive,
    freezeNeedles,
    modelLoaded: Boolean(panelModel),
    buttonLoaded: Boolean(testButton),
    screen: statusScreen.getState(),
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
    controls: Object.fromEntries(
      controlKnobs.map((knob) => [knob.name, Math.round(knob.userData.controlPercent ?? 0)]),
    ),
    buttons: Object.fromEntries(
      controlButtons.map((button) => [
        button.name,
        {
          pressed: Boolean(button.userData.pressed),
          progress: Number((button.userData.pressProgress ?? 0).toFixed(2)),
        },
      ]),
    ),
    lampMaterials: lamps.map((lamp) =>
      lamp.material === materials.lampOff ? "off" : lamp.material === materials.lampRed ? "red" : "amber",
    ),
    needleAngles: needles.map((needle) => Number(THREE.MathUtils.radToDeg(needle.userData.needleAngle ?? 0).toFixed(1))),
  }),
};
