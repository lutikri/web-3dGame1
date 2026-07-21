import * as THREE from "three";

export function createOperatorMovementRuntime({
  config,
  camera,
  keys,
  playerPosition,
  movementVelocity,
  movingPlatformDelta,
  worldUp,
  getViewMode,
  getControlMode,
  getNoclipEnabled,
  getZoomActive,
  getJumpQueued,
  setJumpQueued,
  getPhysicsSystem,
  moveWithCollisions,
  syncCapsule,
  applyCameraOffset,
  getYaw,
  setYaw,
  getPitch,
  setPitch,
  getBaseFov,
}) {
  let headBobTime = 0;
  let leanAmount = 0;
  let noclipSpeed = config.camera.noclip?.speed ?? config.camera.walkSpeed;

  function update(dt) {
    if (getViewMode() === "menu") return;
    const movementConfig = config.camera.operatorMovement ?? {};
    const noclip = getNoclipEnabled();
    const baseSpeed = noclip
      ? noclipSpeed
      : keys.has("ShiftLeft") || keys.has("ShiftRight")
        ? config.camera.runSpeed
        : config.camera.walkSpeed;
    const speed = baseSpeed * (getZoomActive() && !noclip ? movementConfig.zoomSpeedMultiplier ?? 0.62 : 1);

    camera.rotation.order = "YXZ";
    camera.rotation.y = getYaw();
    camera.rotation.x = getPitch();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    if (!noclip) {
      forward.y = 0;
      forward.normalize();
    }
    const right = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
    const move = new THREE.Vector3();
    if (keys.has("KeyW")) move.add(forward);
    if (keys.has("KeyS")) move.sub(forward);
    if (keys.has("KeyD")) move.add(right);
    if (keys.has("KeyA")) move.sub(right);
    if (noclip && keys.has("Space")) move.y += 1;
    if (noclip && (keys.has("ControlLeft") || keys.has("ControlRight"))) move.y -= 1;

    const targetVelocity = move.lengthSq() > 0 ? move.normalize().multiplyScalar(speed) : new THREE.Vector3();
    const damping = targetVelocity.lengthSq() > 0 ? movementConfig.acceleration ?? 13 : movementConfig.deceleration ?? 18;
    movementVelocity.x = THREE.MathUtils.damp(movementVelocity.x, targetVelocity.x, damping, dt);
    movementVelocity.y = THREE.MathUtils.damp(movementVelocity.y, targetVelocity.y, damping, dt);
    movementVelocity.z = THREE.MathUtils.damp(movementVelocity.z, targetVelocity.z, damping, dt);

    if (getControlMode() === "lookOnlyUntilElevatorArrival") {
      movementVelocity.set(0, 0, 0);
      if (movingPlatformDelta.lengthSq() > 0) {
        playerPosition.add(movingPlatformDelta);
        camera.position.add(movingPlatformDelta);
        getPhysicsSystem()?.teleportCharacter(playerPosition);
        syncCapsule();
        movingPlatformDelta.set(0, 0, 0);
      }
      applyCameraPresentation(forward, right, dt);
      return;
    }
    if (!noclip) {
      if (getJumpQueued()) getPhysicsSystem()?.jump(config.player?.collision?.jumpSpeed ?? 3.2);
      setJumpQueued(false);
      const frameDelta = movementVelocity.clone().multiplyScalar(dt).add(movingPlatformDelta);
      movingPlatformDelta.set(0, 0, 0);
      moveWithCollisions(frameDelta, dt);
      syncCapsule();
    } else {
      movingPlatformDelta.set(0, 0, 0);
      playerPosition.addScaledVector(movementVelocity, dt);
    }
    applyCameraPresentation(forward, right, dt);
  }

  function applyCameraPresentation(forward, right, dt) {
    const movementConfig = config.camera.operatorMovement ?? {};
    camera.position.copy(playerPosition);
    if (getNoclipEnabled()) {
      leanAmount = THREE.MathUtils.damp(leanAmount, 0, movementConfig.leanDamping ?? 11, dt);
      return;
    }
    const horizontalSpeed = Math.hypot(movementVelocity.x, movementVelocity.z);
    const speedRatio = THREE.MathUtils.clamp(horizontalSpeed / Math.max(config.camera.runSpeed, 0.001), 0, 1);
    headBobTime += horizontalSpeed * (movementConfig.headBobFrequency ?? 9.5) * dt;
    const bobFade = THREE.MathUtils.smoothstep(speedRatio, 0.03, 0.45);
    camera.position.y += Math.sin(headBobTime * 2) * (movementConfig.headBobAmplitude ?? 0.018) * bobFade;
    camera.position.addScaledVector(
      right,
      Math.sin(headBobTime) * (movementConfig.headBobSway ?? 0.009) * bobFade,
    );
    leanAmount = THREE.MathUtils.damp(leanAmount, getZoomActive() ? 1 : 0, movementConfig.leanDamping ?? 11, dt);
    const leanOffset = forward.clone().multiplyScalar(leanAmount * (movementConfig.leanForward ?? 0.16));
    leanOffset.y -= leanAmount * (movementConfig.leanDown ?? 0.025);
    applyCameraOffset(leanOffset);
  }

  function updateZoom(dt) {
    const baseFov = getBaseFov();
    const targetFov = getZoomActive() ? Math.min(config.camera.zoomFovDegrees, baseFov) : baseFov;
    camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, config.camera.zoomDamping, dt);
    camera.updateProjectionMatrix();
  }

  function updateLook(movementX, movementY) {
    const movementConfig = config.camera.operatorMovement ?? {};
    const sensitivity = config.camera.mouseSensitivity * (getZoomActive() ? movementConfig.zoomSensitivityMultiplier ?? 0.48 : 1);
    setYaw(getYaw() - movementX * sensitivity);
    const pitchLimitDegrees = getZoomActive()
      ? config.camera.leanPitchLimitDegrees ?? config.camera.pitchLimitDegrees ?? 88
      : config.camera.pitchLimitDegrees ?? 72;
    const limit = THREE.MathUtils.degToRad(pitchLimitDegrees);
    setPitch(THREE.MathUtils.clamp(getPitch() - movementY * sensitivity, -limit, limit));
  }

  function resetPresentation() {
    headBobTime = 0;
    leanAmount = 0;
  }

  function setNoclipSpeed(value) {
    const noclipConfig = config.camera.noclip ?? {};
    noclipSpeed = THREE.MathUtils.clamp(
      Number(value),
      noclipConfig.minSpeed ?? 0.25,
      noclipConfig.maxSpeed ?? 30,
    );
    return noclipSpeed;
  }

  function adjustNoclipSpeed(direction) {
    const step = config.camera.noclip?.wheelStep ?? 0.35;
    return setNoclipSpeed(noclipSpeed + direction * step);
  }

  return {
    update, updateZoom, updateLook, resetPresentation, setNoclipSpeed, adjustNoclipSpeed,
    getNoclipSpeed: () => noclipSpeed, getLeanAmount: () => leanAmount,
  };
}
