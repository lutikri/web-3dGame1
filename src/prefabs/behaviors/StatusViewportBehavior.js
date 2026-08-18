import * as THREE from "three";
import {
  applyStatusScreenMaterialConfig,
  createStatusScreenMaterial,
} from "../../panels/StatusScreenMaterial.js?v=status-viewport-prefab";

const SCREEN_WIDTH = 1024;
const SCREEN_HEIGHT = 512;
const INDICATOR_PREFIX = "SM_PanelViewStatus1_Indicator_";
const LOG_LIMIT = 7;

export function createStatusViewportRuntime(root, parts, config = {}, prefabName = "StatusViewport") {
  const screenMesh = parts.get(config.screenMeshName ?? "SM_PanelViewStatus1_Screen");
  if (!screenMesh?.isMesh) {
    throw new Error(`[StatusViewport] Missing screen mesh in prefab "${prefabName}"`);
  }

  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_WIDTH;
  canvas.height = SCREEN_HEIGHT;
  const previousCanvas = document.createElement("canvas");
  previousCanvas.width = SCREEN_WIDTH;
  previousCanvas.height = SCREEN_HEIGHT;
  const context = canvas.getContext("2d");
  const previousContext = previousCanvas.getContext("2d");
  if (!context || !previousContext) {
    throw new Error(`[StatusViewport] Canvas 2D context unavailable for prefab "${prefabName}"`);
  }

  const texture = createCanvasTexture(canvas, `${prefabName}_MasterLog`);
  const previousTexture = createCanvasTexture(previousCanvas, `${prefabName}_MasterLogPrevious`);
  const screenMaterial = createStatusScreenMaterial({
    currentTexture: texture,
    previousTexture,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    config: config.screen,
  });
  screenMaterial.name = `${prefabName}_MasterLogMaterial`;
  screenMaterial.addEventListener("dispose", () => {
    texture.dispose();
    previousTexture.dispose();
  });
  screenMesh.material = screenMaterial;
  screenMesh.castShadow = false;
  screenMesh.receiveShadow = false;

  const indicatorMaterials = new Map();
  const materialCloneEntries = [];
  Object.entries(config.indicators ?? {}).forEach(([indicatorName]) => {
    const meshName = `${INDICATOR_PREFIX}${indicatorName}`;
    const mesh = parts.get(meshName);
    if (!mesh?.isMesh) {
      console.warn(`[StatusViewport] Missing indicator mesh "${meshName}" in prefab "${prefabName}"`);
      return;
    }
    const material = mesh.material.clone();
    material.name = `${prefabName}_${indicatorName}_IndicatorMaterial`;
    material.userData.statusIndicator = indicatorName;
    mesh.material = material;
    mesh.castShadow = false;
    indicatorMaterials.set(indicatorName, material);
    materialCloneEntries.push({ material, materialKey: "panelStatusView1" });
  });

  const runtime = {
    root,
    screenMesh,
    screenMaterial,
    indicatorMaterials,
    materialCloneEntries,
    materials: [screenMaterial, ...indicatorMaterials.values()],
    canvas,
    context,
    previousCanvas,
    previousContext,
    texture,
    previousTexture,
    elapsed: Number.POSITIVE_INFINITY,
    persistenceAge: 1000,
    snapshot: null,
    previousSummary: null,
    log: [],
    config,
  };
  drawMasterLog(runtime);
  previousContext.drawImage(canvas, 0, 0);
  texture.needsUpdate = true;
  previousTexture.needsUpdate = true;
  applyStatusViewportConfig(runtime, config);
  return runtime;
}

export function applyStatusViewportConfig(runtime, config = {}) {
  if (!runtime) return false;
  runtime.config = config;
  applyStatusScreenMaterialConfig(runtime.screenMaterial, config.screen);
  applyIndicatorMaterials(runtime, getStatusViewportIndicatorStates(runtime.snapshot));
  return true;
}

export function updateStatusViewportRuntime(runtime, snapshot, dt) {
  if (!runtime) return null;
  const safeDt = Math.max(0, Number(dt) || 0);
  runtime.screenMaterial.uniforms.uTime.value += safeDt;
  runtime.persistenceAge += safeDt;
  runtime.screenMaterial.uniforms.uPersistenceAge.value = runtime.persistenceAge;
  runtime.elapsed += safeDt;
  runtime.snapshot = snapshot ?? null;
  const interval = Math.max(0.1, Number(runtime.config.updateIntervalSeconds) || 1);
  if (runtime.elapsed < interval) return runtime;

  runtime.elapsed = 0;
  appendSnapshotEvents(runtime, runtime.snapshot);
  runtime.previousContext.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  runtime.previousContext.drawImage(runtime.canvas, 0, 0);
  drawMasterLog(runtime);
  runtime.persistenceAge = 0;
  runtime.screenMaterial.uniforms.uPersistenceAge.value = 0;
  runtime.previousTexture.needsUpdate = true;
  runtime.texture.needsUpdate = true;
  applyIndicatorMaterials(runtime, getStatusViewportIndicatorStates(runtime.snapshot));
  return runtime;
}

export function getStatusViewportIndicatorStates(snapshot) {
  const data = snapshot ?? {};
  const warning = data.warning ?? {};
  const mode = data.mode ?? "standby";
  const active = mode === "running" || mode === "starting";
  const failed = mode === "failed" || Boolean(data.failureType);
  const outputError = Math.abs(Number(data.demandError) || 0);
  const efficiency = Number(data.reactionEfficiency) || 0;
  const heatSink = Number(data.heatSinkCapacity) || 0;
  const fuel = Number(data.fuelReserve) || 0;
  const pulseCharge = Number(data.pulseCharge) || 0;
  const stall = Number(data.coreStall) || 0;
  const stress = Number(data.coreStress) || 0;
  const hasWarning = Object.values(warning).some(Boolean);

  return {
    AlarmSilence: failed ? "red" : hasWarning ? "amber" : "off",
    Generation: failed ? "red" : mode === "starting" ? "amber" : mode === "running" ? "green" : "off",
    Cireculation: active ? thresholdState(heatSink, 35, 65) : "off",
    Turbine: active ? thresholdState(Number(data.powerOutput) || 0, 80, 240) : "off",
    Pumps: active ? thresholdState(heatSink, 30, 60) : "off",
    Fuel: active ? thresholdState(fuel, 22, 48) : "off",
    Output: active ? inverseThresholdState(outputError, 0.1, 0.24) : "off",
    Demand: active && (Number(data.targetOutput) || 0) > 0 ? "green" : "off",
    Battery: active ? thresholdState(pulseCharge, 30, 70) : "off",
    Efficiency: active ? thresholdState(efficiency, 52, 72) : "off",
    Stall: active ? inverseThresholdState(stall, 35, 68) : "off",
    Stress: active ? inverseThresholdState(stress, 62, 82) : "off",
    Coolant: active
      ? (warning.tempCritical ? "red" : warning.tempHigh || warning.heatSinkLow ? "amber" : "green")
      : "off",
  };
}

export function getMasterSystemStatus(snapshot) {
  if (!snapshot || snapshot.mode === "standby") return "SYSTEM STANDBY";
  if (snapshot.mode === "starting") return "START SEQUENCE ACTIVE";
  if (snapshot.mode === "failed" || snapshot.failureType) return "SYSTEM FAULT";
  if (snapshot.mode === "complete") return "CORE SHUTDOWN";
  const warning = snapshot.warning ?? {};
  if (warning.tempCritical || warning.coreStallCritical || Number(snapshot.coreStress) >= 90) return "IMMEDIATE ATTENTION";
  if (Object.values(warning).some(Boolean)) return "ATTENTION REQUIRED";
  return "SYSTEM STABLE";
}

function createCanvasTexture(canvas, name) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = name;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function applyIndicatorMaterials(runtime, states) {
  const palette = runtime.config.palette ?? {};
  runtime.indicatorMaterials.forEach((material, name) => {
    const tuning = runtime.config.indicators?.[name] ?? {};
    const state = states[name] ?? "off";
    const stateColor = new THREE.Color(palette[state] ?? defaultPalette(state));
    const tint = new THREE.Color(tuning.tint ?? 0xffffff);
    material.emissive.copy(stateColor.multiply(tint));
    const intensity = Math.max(0, Number(tuning.intensity) || 0);
    material.emissiveIntensity = state === "off" ? intensity * 0.035 : intensity;
    material.userData.baseEmissiveIntensity = material.emissiveIntensity;
  });
}

function appendSnapshotEvents(runtime, snapshot) {
  if (!snapshot) return;
  const summary = summarizeSnapshot(snapshot);
  if (!runtime.previousSummary) {
    pushEvent(runtime, snapshot, `EFF ${summary.efficiency}`);
    pushEvent(runtime, snapshot, `OUTPUT ${summary.output} MW`);
    pushEvent(runtime, snapshot, `DEMAND ${summary.demand} MW`);
    runtime.previousSummary = summary;
    return;
  }
  const previous = runtime.previousSummary;
  if (summary.mode !== previous.mode) pushEvent(runtime, snapshot, `CORE ${summary.mode}`);
  if (summary.efficiency !== previous.efficiency) pushEvent(runtime, snapshot, `EFF ${summary.efficiency}`);
  if (summary.demand !== previous.demand) pushEvent(runtime, snapshot, `DEMAND ${summary.demand} MW`);
  if (summary.outputState !== previous.outputState) pushEvent(runtime, snapshot, `OUTPUT ${summary.outputState}`);
  summary.activeWarnings.forEach((warning) => {
    if (!previous.activeWarnings.includes(warning)) pushEvent(runtime, snapshot, warning);
  });
  runtime.previousSummary = summary;
}

function summarizeSnapshot(snapshot) {
  const efficiency = Number(snapshot.reactionEfficiency) || 0;
  const outputError = Math.abs(Number(snapshot.demandError) || 0);
  return {
    mode: String(snapshot.mode ?? "standby").toUpperCase(),
    efficiency: efficiency >= 72 ? "NOMINAL" : efficiency >= 52 ? "MARGINAL" : "LOW",
    output: Math.round(Number(snapshot.powerOutput) || 0),
    outputState: outputError <= 0.1 ? "TRACKING" : outputError <= 0.24 ? "DEVIATION" : "OUT OF RANGE",
    demand: Math.round((Number(snapshot.targetOutput) || 0) / 10) * 10,
    activeWarnings: Object.entries(snapshot.warning ?? {})
      .filter(([, active]) => Boolean(active))
      .map(([key]) => `WARN ${humanizeKey(key)}`),
  };
}

function pushEvent(runtime, snapshot, message) {
  runtime.log.push({ time: formatElapsed(snapshot.elapsed), message });
  if (runtime.log.length > LOG_LIMIT) runtime.log.splice(0, runtime.log.length - LOG_LIMIT);
}

function drawMasterLog(runtime) {
  const { context: ctx } = runtime;
  ctx.fillStyle = "#020806";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 34px ui-monospace, 'Courier New', monospace";
  ctx.fillStyle = "#a7ffc8";
  ctx.fillText("MASTER EVENT LOG", 46, 58);
  ctx.strokeStyle = "#246d43";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(46, 82);
  ctx.lineTo(978, 82);
  ctx.stroke();

  ctx.font = "500 27px ui-monospace, 'Courier New', monospace";
  const visible = runtime.log.slice(-5);
  visible.forEach((entry, index) => {
    const y = 132 + index * 52;
    ctx.fillStyle = "#56b77c";
    ctx.fillText(entry.time, 48, y);
    ctx.fillStyle = entry.message.startsWith("WARN") ? "#ffc45b" : "#d2ffe1";
    ctx.fillText(entry.message, 238, y);
  });
  if (!visible.length) {
    ctx.fillStyle = "#4f7961";
    ctx.fillText("-- NO EVENTS RECORDED --", 48, 132);
  }

  ctx.strokeStyle = "#246d43";
  ctx.beginPath();
  ctx.moveTo(46, 420);
  ctx.lineTo(978, 420);
  ctx.stroke();
  ctx.font = "700 31px ui-monospace, 'Courier New', monospace";
  const status = getMasterSystemStatus(runtime.snapshot);
  ctx.fillStyle = status === "SYSTEM STABLE" ? "#6dff9e"
    : status.includes("FAULT") || status.includes("IMMEDIATE") ? "#ff675c" : "#ffc45b";
  ctx.fillText(status, 48, 470);
}

function thresholdState(value, redBelow, amberBelow) {
  return value < redBelow ? "red" : value < amberBelow ? "amber" : "green";
}

function inverseThresholdState(value, amberAbove, redAbove) {
  return value >= redAbove ? "red" : value >= amberAbove ? "amber" : "green";
}

function defaultPalette(state) {
  if (state === "red") return 0xff4638;
  if (state === "amber") return 0xffb83f;
  if (state === "green") return 0x52ff91;
  return 0x24352e;
}

function formatElapsed(value) {
  const total = Math.max(0, Math.floor(Number(value) || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

function humanizeKey(value) {
  return String(value).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toUpperCase();
}
