import * as THREE from "three";

const VALID_AXES = new Set(["x", "y", "z"]);

export function createCoreViewportRuntime(parts, config = {}, prefabName = "CoreViewport") {
  const shutter = parts.get(config.shutterMeshName ?? "SM_CoreViewport1_Shutter1");
  if (!shutter?.isMesh) {
    throw new Error(`[CoreViewport] Missing shutter mesh in prefab "${prefabName}"`);
  }

  const runtime = {
    shutter,
    config,
    axis: resolveAxis(config.axis),
    closedPosition: finiteNumber(config.closedPosition, shutter.position.y),
    openPosition: finiteNumber(config.openPosition, 0.226287),
    travelDurationSeconds: positiveNumber(config.travelDurationSeconds, 10),
    progress: config.startsOpen ? 1 : 0,
    targetProgress: config.startsOpen ? 1 : 0,
  };
  applyCoreViewportPosition(runtime);
  return runtime;
}

export function applyCoreViewportConfig(runtime, config = {}) {
  if (!runtime) return false;
  runtime.config = config;
  runtime.axis = resolveAxis(config.axis ?? runtime.axis);
  runtime.closedPosition = finiteNumber(config.closedPosition, runtime.closedPosition);
  runtime.openPosition = finiteNumber(config.openPosition, runtime.openPosition);
  runtime.travelDurationSeconds = positiveNumber(config.travelDurationSeconds, runtime.travelDurationSeconds);
  applyCoreViewportPosition(runtime);
  return true;
}

export function requestCoreViewportToggle(runtime) {
  if (!runtime) return false;
  runtime.targetProgress = runtime.targetProgress >= 0.5 ? 0 : 1;
  return true;
}

export function updateCoreViewportRuntime(runtime, dt) {
  if (!runtime) return null;
  const duration = positiveNumber(runtime.travelDurationSeconds, 10);
  const step = Math.max(0, Number(dt) || 0) / duration;
  runtime.progress = moveTowards(runtime.progress, runtime.targetProgress, step);
  applyCoreViewportPosition(runtime);
  return runtime;
}

function applyCoreViewportPosition(runtime) {
  const eased = THREE.MathUtils.smoothstep(runtime.progress, 0, 1);
  runtime.shutter.position[runtime.axis] = THREE.MathUtils.lerp(
    runtime.closedPosition,
    runtime.openPosition,
    eased,
  );
}

function moveTowards(value, target, maxDelta) {
  if (Math.abs(target - value) <= maxDelta) return target;
  return value + Math.sign(target - value) * maxDelta;
}

function resolveAxis(value) {
  return VALID_AXES.has(value) ? value : "y";
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
