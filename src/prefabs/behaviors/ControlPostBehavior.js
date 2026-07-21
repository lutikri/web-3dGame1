import * as THREE from "three";

const tmpBox = new THREE.Box3();

export function createControlPostRuntime(parts, config = {}) {
  const trigger = parts.get(config.triggerName ?? "SM_ControlPost1_Trigger_1") ?? null;
  if (trigger) {
    trigger.visible = false;
    trigger.castShadow = false;
    trigger.receiveShadow = false;
    trigger.userData.controlPostTrigger = true;
  }
  return {
    ...config,
    trigger,
    insideElapsed: 0,
    cooldownRemaining: 0,
    armed: true,
  };
}

export function resetControlPostRuntime(runtime) {
  if (!runtime) return;
  runtime.insideElapsed = 0;
  runtime.cooldownRemaining = 0;
  runtime.armed = true;
}

export function updateControlPostRuntime(runtime, dt, playerPosition) {
  if (!runtime?.enabled || !runtime.trigger || !playerPosition) return null;
  runtime.cooldownRemaining = Math.max(0, (runtime.cooldownRemaining ?? 0) - dt);
  if (runtime.cooldownRemaining <= 0 && runtime.insideElapsed <= 0) runtime.armed = true;

  runtime.trigger.updateWorldMatrix(true, false);
  tmpBox.setFromObject(runtime.trigger);
  const inside = tmpBox.containsPoint(playerPosition);
  if (!inside) {
    runtime.insideElapsed = 0;
    return null;
  }

  runtime.insideElapsed = (runtime.insideElapsed ?? 0) + dt;
  if (!runtime.armed || runtime.cooldownRemaining > 0) return null;
  if (runtime.insideElapsed < Math.max(0, runtime.triggerHoldSeconds ?? 0.5)) return null;

  runtime.armed = false;
  runtime.cooldownRemaining = Math.max(0, runtime.triggerCooldownSeconds ?? 8);
  if (!runtime.alertSoundKey) return null;
  return {
    type: "sound",
    object: runtime.trigger,
    soundKey: runtime.alertSoundKey,
    refDistance: runtime.alertRefDistance ?? runtime.refDistance,
    maxDistance: runtime.alertMaxDistance ?? runtime.maxDistance,
  };
}
