import * as THREE from "three";

export function createFlashlightAimRuntime(root) {
  const spots = [];
  root.updateWorldMatrix(true, true);
  root.traverse((light) => {
    if (!light.isSpotLight || light.userData.prefabLightMarker) return;
    spots.push({ light, targetPosition: light.target.position.clone() });
  });
  if (!spots.length) return null;
  return { root, spots, inverseAimDistance: null };
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

export function updateFlashlightAim(runtime, target = null) {
  if (!runtime) return;
  if (!target) runtime.inverseAimDistance = null;
  runtime.root.updateWorldMatrix(true, true);
  runtime.spots.forEach(({ light, targetPosition }) => {
    if (target) light.target.position.copy(light.target.parent.worldToLocal(target.clone()));
    else light.target.position.copy(targetPosition);
    light.target.updateWorldMatrix(true, false);
  });
}
