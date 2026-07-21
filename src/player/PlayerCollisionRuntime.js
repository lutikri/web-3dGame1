import * as THREE from "three";

export function createPlayerCollisionRuntime({
  config,
  playerPosition,
  playerCapsule,
  camera,
  cameraCollisionCapsule,
  movementVelocity,
  getPhysicsSystem,
  getPhysicsSceneKey,
  getCollisionOctree,
  isCollisionReady,
  getPlayerRadius,
  getPlayerHeight,
  getCameraRadius,
  setDimensions = () => {},
  updateDebug = () => {},
}) {
  function syncCapsule() {
    const radius = getPlayerRadius();
    const feetY = playerPosition.y - config.playerEyeHeight;
    playerCapsule.start.set(playerPosition.x, feetY + radius, playerPosition.z);
    playerCapsule.end.set(
      playerPosition.x,
      feetY + getPlayerHeight() - radius,
      playerPosition.z,
    );
  }

  function resolveCollisions() {
    if (!isCollisionReady()) return;
    const octree = getCollisionOctree();
    for (let iteration = 0; iteration < 4; iteration += 1) {
      const collision = octree.capsuleIntersect(playerCapsule);
      if (!collision) break;
      const floorThreshold = config.player?.collision?.floorNormalThreshold ?? 0.55;
      const collisionNormal = collision.normal.clone();
      const correction = collisionNormal.y >= floorThreshold
        ? new THREE.Vector3(0, collision.depth / Math.max(collisionNormal.y, 0.001), 0)
        : collisionNormal.multiplyScalar(collision.depth);
      playerCapsule.translate(correction);
      const velocityIntoSurface = movementVelocity.dot(collision.normal);
      if (velocityIntoSurface < 0) movementVelocity.addScaledVector(collision.normal, -velocityIntoSurface);
    }
  }

  function move(delta, dt = 1 / 60) {
    const physics = getPhysicsSystem();
    const sceneKey = getPhysicsSceneKey();
    if (physics?.hasCharacter() && physics.hasScene(sceneKey)) {
      const nextPosition = physics.moveCharacter(delta, dt);
      if (nextPosition) {
        playerPosition.copy(nextPosition);
        syncCapsule();
        return;
      }
    }

    const originalStart = playerCapsule.start.clone();
    const originalEnd = playerCapsule.end.clone();
    const originalVelocity = movementVelocity.clone();
    playerCapsule.translate(delta);
    resolveCollisions();

    const desiredDistance = Math.hypot(delta.x, delta.z);
    const normalDistance = Math.hypot(
      playerCapsule.start.x - originalStart.x,
      playerCapsule.start.z - originalStart.z,
    );
    const stepHeight = Math.max(0, config.player?.collision?.stepHeight ?? 0);
    if (stepHeight > 0 && desiredDistance > 0.0001 && normalDistance < desiredDistance * 0.7) {
      const normalStart = playerCapsule.start.clone();
      const normalEnd = playerCapsule.end.clone();
      const normalVelocity = movementVelocity.clone();
      playerCapsule.start.copy(originalStart);
      playerCapsule.end.copy(originalEnd);
      movementVelocity.copy(originalVelocity);
      playerCapsule.translate(new THREE.Vector3(0, stepHeight, 0));
      const blockedAbove = getCollisionOctree().capsuleIntersect(playerCapsule);
      if (!blockedAbove) {
        playerCapsule.translate(delta);
        resolveCollisions();
        playerCapsule.translate(new THREE.Vector3(0, -stepHeight, 0));
        resolveCollisions();
        const steppedDistance = Math.hypot(
          playerCapsule.start.x - originalStart.x,
          playerCapsule.start.z - originalStart.z,
        );
        const acceptableFloor = playerCapsule.start.y >= originalStart.y - 0.02;
        if (steppedDistance <= normalDistance + 0.001 || !acceptableFloor) {
          restoreAttempt(normalStart, normalEnd, normalVelocity);
        }
      } else {
        restoreAttempt(normalStart, normalEnd, normalVelocity);
      }
    }

    playerPosition.set(
      playerCapsule.start.x,
      playerCapsule.start.y + config.playerEyeHeight - getPlayerRadius(),
      playerCapsule.start.z,
    );
  }

  function restoreAttempt(start, end, velocity) {
    playerCapsule.start.copy(start);
    playerCapsule.end.copy(end);
    movementVelocity.copy(velocity);
  }

  function applyCameraOffset(offset) {
    const distance = offset.length();
    if (!isCollisionReady() || distance <= 0.0001) {
      camera.position.add(offset);
      return;
    }
    const origin = camera.position.clone();
    const probePosition = new THREE.Vector3();
    const stepLength = Math.max(getCameraRadius() * 0.5, 0.01);
    const stepCount = Math.max(1, Math.ceil(distance / stepLength));
    let safeFraction = 0;
    const octree = getCollisionOctree();
    for (let step = 1; step <= stepCount; step += 1) {
      const testFraction = step / stepCount;
      probePosition.copy(origin).addScaledVector(offset, testFraction);
      cameraCollisionCapsule.start.copy(probePosition);
      cameraCollisionCapsule.end.copy(probePosition);
      if (!octree.capsuleIntersect(cameraCollisionCapsule)) {
        safeFraction = testFraction;
        continue;
      }
      let low = safeFraction;
      let high = testFraction;
      for (let iteration = 0; iteration < 6; iteration += 1) {
        const middle = (low + high) * 0.5;
        probePosition.copy(origin).addScaledVector(offset, middle);
        cameraCollisionCapsule.start.copy(probePosition);
        cameraCollisionCapsule.end.copy(probePosition);
        if (octree.capsuleIntersect(cameraCollisionCapsule)) high = middle;
        else low = middle;
      }
      safeFraction = low;
      break;
    }
    camera.position.copy(origin).addScaledVector(offset, safeFraction);
  }

  function applySettings() {
    const radius = config.player?.collisionRadius ?? 0.28;
    const height = Math.max(config.player?.collisionHeight ?? 1.7, radius * 2);
    const cameraRadius = config.player?.collision?.cameraRadius ?? 0.12;
    setDimensions({ radius, height, cameraRadius });
    playerCapsule.radius = radius;
    cameraCollisionCapsule.radius = cameraRadius;
    syncCapsule();
    resolveCollisions();
    getPhysicsSystem()?.createCharacter({
      eyePosition: playerPosition,
      eyeHeight: config.playerEyeHeight,
      height,
      radius,
      config: config.player?.collision ?? {},
    });
    updateDebug();
    return { radius, height, cameraRadius };
  }

  return { move, resolveCollisions, syncCapsule, applyCameraOffset, applySettings };
}
