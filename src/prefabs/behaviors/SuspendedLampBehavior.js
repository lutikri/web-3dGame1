import * as THREE from "three";

const DEG2RAD = Math.PI / 180;

export function createSuspendedLampRuntime(parts, config = {}, instanceName = "") {
  if (config.enabled === false) return null;
  const pivot = parts.get(config.pivotName ?? "PIVOT_LampDome1_Suspension");
  if (!pivot) {
    console.warn(`[SuspendedLampBehavior] Missing suspension pivot for "${instanceName}"`);
    return null;
  }

  const phase = stablePhase(instanceName || pivot.name);
  const initialAngle = Number(config.initialAngleDegrees ?? 0.45) * DEG2RAD;
  return {
    pivot,
    initialRotation: pivot.rotation.clone(),
    angleX: Math.sin(phase) * initialAngle,
    angleZ: Math.cos(phase * 1.37) * initialAngle * 0.7,
    velocityX: 0,
    velocityZ: 0,
    elapsed: 0,
    phase,
    config,
  };
}

export function updateSuspendedLampRuntime(runtime, dt) {
  if (!runtime?.pivot || !(dt > 0)) return runtime;
  const config = runtime.config;
  if (config.enabled === false) {
    runtime.angleX = 0;
    runtime.angleZ = 0;
    runtime.velocityX = 0;
    runtime.velocityZ = 0;
    runtime.pivot.rotation.copy(runtime.initialRotation);
    return runtime;
  }
  const step = Math.min(dt, 1 / 20);
  const period = Math.max(0.5, Number(config.naturalPeriodSeconds ?? 3.6));
  const omega = (Math.PI * 2) / period;
  const damping = Math.max(0, Number(config.dampingPerSecond ?? 0.65));
  const airflow = Number(config.airflowDegrees ?? 0.28) * DEG2RAD;
  const airflowPeriodX = Math.max(1, Number(config.airflowPeriodXSeconds ?? 7.1));
  const airflowPeriodZ = Math.max(1, Number(config.airflowPeriodZSeconds ?? 9.3));
  runtime.elapsed += step;

  const targetX = airflow * Math.sin(runtime.phase + runtime.elapsed * Math.PI * 2 / airflowPeriodX);
  const targetZ = airflow * 0.65 * Math.sin(runtime.phase * 1.73 + runtime.elapsed * Math.PI * 2 / airflowPeriodZ);
  runtime.velocityX += (-omega * omega * (runtime.angleX - targetX) - damping * runtime.velocityX) * step;
  runtime.velocityZ += (-omega * omega * (runtime.angleZ - targetZ) - damping * runtime.velocityZ) * step;
  runtime.angleX += runtime.velocityX * step;
  runtime.angleZ += runtime.velocityZ * step;

  const maxAngle = Math.max(0, Number(config.maxAngleDegrees ?? 1.4)) * DEG2RAD;
  runtime.angleX = THREE.MathUtils.clamp(runtime.angleX, -maxAngle, maxAngle);
  runtime.angleZ = THREE.MathUtils.clamp(runtime.angleZ, -maxAngle, maxAngle);
  runtime.pivot.rotation.set(
    runtime.initialRotation.x + runtime.angleX,
    runtime.initialRotation.y,
    runtime.initialRotation.z + runtime.angleZ,
    runtime.initialRotation.order,
  );
  return runtime;
}

export function nudgeSuspendedLampRuntime(runtime, impulseX = 0, impulseZ = 0) {
  if (!runtime) return false;
  runtime.velocityX += Number(impulseX) || 0;
  runtime.velocityZ += Number(impulseZ) || 0;
  return true;
}

function stablePhase(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967296) * Math.PI * 2;
}
