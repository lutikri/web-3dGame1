import * as THREE from "three";

export function createFlashlightAimRuntime(root) {
  const spots = [];
  root.updateWorldMatrix(true, true);
  root.traverse((light) => {
    if (!light.isSpotLight || light.userData.prefabLightMarker) return;
    spots.push(light);
  });
  if (!spots.length) return null;
  return { root, light: spots[0], inverseAimDistance: null };
}

export function getFlashlightAimPoint(runtime, camera, physics, key, config, dt, immediate = false) {
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const direction = camera.getWorldDirection(new THREE.Vector3());
  const distance = Math.max(0.25, config.aimDistance ?? 12);
  const hit = physics.raycastWorld?.(origin, direction, distance, key);
  const depth = hit ? Math.max(0.01, hit.clone().sub(origin).dot(direction)) : distance;
  const inverseDistance = 1 / depth;
  const response = Math.max(0, config.aimSmoothingSeconds ?? 0.12);
  if (runtime.inverseAimDistance == null || immediate || response === 0) {
    runtime.inverseAimDistance = inverseDistance;
  } else {
    // Parallax depends on inverse depth. Smoothing depth directly still snaps
    // the beam when a nearby surface is replaced by a distant hit or the sky.
    runtime.inverseAimDistance = THREE.MathUtils.lerp(runtime.inverseAimDistance, inverseDistance,
      1 - Math.exp(-Math.max(0, dt) / response));
  }
  return origin.clone().addScaledVector(direction, 1 / runtime.inverseAimDistance);
}

export function resetFlashlightAim(runtime) {
  if (runtime) runtime.inverseAimDistance = null;
}

export function aimFlashlightPose(runtime, position, quaternion, target, config) {
  runtime.root.updateWorldMatrix(true, true);
  const scale = runtime.root.getWorldScale(new THREE.Vector3());
  const emitter = runtime.root.worldToLocal(runtime.light.getWorldPosition(new THREE.Vector3()));
  const forward = runtime.root.worldToLocal(runtime.light.target.getWorldPosition(new THREE.Vector3()))
    .sub(emitter).multiply(scale).normalize();
  emitter.multiply(scale);
  const offset = target.clone().sub(position);
  const axialOffset = emitter.dot(forward);
  const perpendicularSq = Math.max(0, emitter.lengthSq() - axialOffset * axialOffset);
  if (offset.lengthSq() <= perpendicularSq) return;

  // Solve for a point on the authored beam axis, including the emitter's
  // offset from the grip. Only the body rotates; the spotlight stays rigid.
  const travel = Math.sqrt(offset.lengthSq() - perpendicularSq) - axialOffset;
  if (travel <= 0) return;
  const from = emitter.addScaledVector(forward, travel).normalize().applyQuaternion(quaternion);
  const to = offset.normalize();
  const correction = new THREE.Quaternion().setFromUnitVectors(from, to);
  const angle = from.angleTo(to);
  const limit = THREE.MathUtils.degToRad(Math.max(0, config.aimMaxAngleDegrees ?? 70));
  if (angle > limit) correction.slerp(new THREE.Quaternion(), 1 - limit / angle);
  quaternion.premultiply(correction).normalize();
}
