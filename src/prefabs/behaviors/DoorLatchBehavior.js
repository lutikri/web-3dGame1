import * as THREE from "three";

import { applyAxisRotation } from "../../scene/TransformUtils.js?v=pause-full-texture-upgrades";

export function smoothDoorLatchProgress(progress) {
  return progress * progress * (3 - 2 * progress);
}

export function getDoorLatchBaseDegrees(door, latched = door.latched, handle = door.activeLatchHandle ?? door.latchHandle) {
  if (door.interaction.latchAction === "holdOpen") return 0;
  const explicitByName = door.interaction.latchHandleDegreesByName?.[handle?.name];
  const explicitLatchedDegrees = Number.isFinite(explicitByName)
    ? explicitByName
    : door.interaction.latchHandleLatchedDegrees;
  return latched ? explicitLatchedDegrees ?? -70 : 0;
}

export function getDoorLatchRestDegrees(door, handle = door.activeLatchHandle ?? door.latchHandle) {
  if (
    door.activeLatchHandle &&
    handle !== door.activeLatchHandle &&
    (door.interaction.latchAction === "toggleDoor" || door.interaction.latchAction === "holdOpen")
  ) {
    return 0;
  }
  return getDoorLatchBaseDegrees(door, door.latched, handle) + (door.latchHandleSpinOffsetDegrees ?? 0);
}

export function getDoorLatchMotionDegrees(door, fromDegrees, toDegrees, progress, jerkScale = 1) {
  const easedProgress = smoothDoorLatchProgress(THREE.MathUtils.clamp(progress, 0, 1));
  const jerkEnvelope = Math.sin(progress * Math.PI);
  const mechanicalJerk =
    Math.sin(progress * Math.PI * (door.interaction.latchJerkFrequency ?? 8)) *
    (door.interaction.latchJerkDegrees ?? 7) *
    jerkEnvelope *
    jerkScale;
  return THREE.MathUtils.lerp(fromDegrees, toDegrees, easedProgress) + mechanicalJerk;
}

export function getDoorLatchHandleDegrees(door, handle = door.activeLatchHandle ?? door.latchHandle) {
  if (
    door.activeLatchHandle &&
    handle !== door.activeLatchHandle &&
    (door.interaction.latchAction === "toggleDoor" || door.interaction.latchAction === "holdOpen")
  ) {
    return 0;
  }
  if (door.latchBlockedAttempt) {
    const duration = door.interaction.latchBlockedAttemptSeconds ?? 0.55;
    const progress = THREE.MathUtils.clamp(door.latchBlockedAttempt.elapsed / Math.max(duration, 0.001), 0, 1);
    const fromDegrees = door.latchBlockedAttempt.fromDegrees ?? getDoorLatchRestDegrees(door, handle);
    const toDegrees =
      door.latchBlockedAttempt.toDegrees ??
      fromDegrees + (door.latchBlockedAttempt.sign ?? 1) * (door.interaction.latchBlockedStopDegrees ?? 26);
    if (progress < 0.5) {
      return getDoorLatchMotionDegrees(door, fromDegrees, toDegrees, progress / 0.5, 0.8);
    }
    return getDoorLatchMotionDegrees(door, toDegrees, fromDegrees, (progress - 0.5) / 0.5, 0.8);
  }
  if (!door.latchOperation) return getDoorLatchRestDegrees(door, handle);

  const progress = THREE.MathUtils.clamp(door.latchOperation.progress ?? 0, 0, 1);
  return getDoorLatchMotionDegrees(door, door.latchOperation.fromDegrees, door.latchOperation.toDegrees, progress);
}

export function applyDoorLatchHandleRotation(runtime) {
  const door = runtime?.door;
  const handles = door?.latchHandles?.length ? door.latchHandles : door?.latchHandle ? [door.latchHandle] : [];
  if (!handles.length) return;
  handles.forEach((handle) => {
    handle.rotation.copy(handle.userData.prefabInitialRotation);
    const degrees = getDoorLatchHandleDegrees(door, handle);
    applyAxisRotation(handle, door.interaction.latchHandleAxis ?? "z", THREE.MathUtils.degToRad(degrees));
  });
}
