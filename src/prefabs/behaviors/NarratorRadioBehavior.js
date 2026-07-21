import * as THREE from "three";

export function createNarratorRadioRuntime(parts, config = {}) {
  const lamp = parts.get(config.lampName ?? "SM_Radio1_Lamp") ?? null;
  const lampMaterials = lamp
    ? (Array.isArray(lamp.material) ? lamp.material : [lamp.material]).filter(Boolean)
    : [];
  lampMaterials.forEach((material) => {
    material.userData.baseEmissiveIntensity = material.emissiveIntensity ?? 0;
    material.emissiveIntensity = 0;
    material.needsUpdate = true;
  });
  return {
    ...config,
    lamp,
    lampMaterials,
    talkingRemaining: 0,
    talkingElapsed: 0,
  };
}

export function resetNarratorRadioRuntime(radioRuntime) {
  if (!radioRuntime) return;
  radioRuntime.talkingRemaining = 0;
  radioRuntime.talkingElapsed = 0;
  radioRuntime.lampMaterials?.forEach((material) => {
    material.emissiveIntensity = 0;
    material.needsUpdate = true;
  });
}

export function startNarratorRadioSpeech(radioRuntime, durationSeconds) {
  if (!radioRuntime) return;
  radioRuntime.talkingRemaining = Math.max(0, durationSeconds);
  radioRuntime.talkingElapsed = 0;
}

export function updateNarratorRadioRuntime(radioRuntime, dt) {
  if (!radioRuntime) return;
  radioRuntime.talkingRemaining = Math.max(0, (radioRuntime.talkingRemaining ?? 0) - dt);
  if (radioRuntime.talkingRemaining > 0) radioRuntime.talkingElapsed = (radioRuntime.talkingElapsed ?? 0) + dt;
  const blinkFrequency = radioRuntime.lampBlinkFrequency ?? 1.1;
  const blink = radioRuntime.talkingRemaining > 0
    ? 0.15 + 0.85 * Math.pow((Math.sin(radioRuntime.talkingElapsed * Math.PI * 2 * blinkFrequency) + 1) * 0.5, 1.8)
    : 0;
  const intensity = blink * (radioRuntime.lampEmissiveIntensity ?? 8.8);
  radioRuntime.lampMaterials?.forEach((material) => {
    material.emissiveIntensity = THREE.MathUtils.clamp(intensity, 0, 30);
    material.needsUpdate = true;
  });
}
