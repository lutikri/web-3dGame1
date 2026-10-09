import * as THREE from "three";

export function createFlashlightAimRuntime(root) {
  const spots = [];
  root.updateWorldMatrix(true, true);
  root.traverse((light) => {
    if (!light.isSpotLight || light.userData.prefabLightMarker) return;
    spots.push({ light, targetPosition: light.target.position.clone() });
  });
  const light = spots[0]?.light;
  if (!light) return null;
  const emitter = root.worldToLocal(light.getWorldPosition(new THREE.Vector3()));
  const forward = root.worldToLocal(light.target.getWorldPosition(new THREE.Vector3())).sub(emitter).normalize();
  return { root, spots, emitter, forward };
}

export function getFlashlightAimPoint(camera, physics, key, distance) {
  const origin = camera.getWorldPosition(new THREE.Vector3());
  const direction = camera.getWorldDirection(new THREE.Vector3());
  return physics.raycastWorld?.(origin, direction, distance, key)
    ?? origin.addScaledVector(direction, distance);
}

export function aimFlashlightPose(runtime, position, quaternion, target) {
  // A swept carry pose can be nearer the camera than the requested pose.
  // Keep the model facing forward when the requested emitter is past a wall.
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const emitter = runtime.emitter.clone().applyQuaternion(quaternion).add(position);
    const direction = target.clone().sub(emitter).normalize();
    const forward = runtime.forward.clone().applyQuaternion(quaternion);
    if (direction.dot(forward) <= 0) return;
    quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(forward, direction)).normalize();
  }
}

export function updateFlashlightAim(runtime, target = null) {
  if (!runtime) return;
  runtime.root.updateWorldMatrix(true, true);
  runtime.spots.forEach(({ light, targetPosition }) => {
    if (target) light.target.position.copy(light.target.parent.worldToLocal(target.clone()));
    else light.target.position.copy(targetPosition);
    light.target.updateWorldMatrix(true, false);
  });
}
