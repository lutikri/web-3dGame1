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
  setCrouched = () => true,
  getPlayerEyeHeight = () => config.playerEyeHeight,
  applyCameraOffset,
  limitCameraOffset = (_origin, offset) => offset,
  getYaw,
  setYaw,
  getPitch,
  setPitch,
  getBaseFov,
}) {
  let gaitPhase = 0;
  let gaitStep = 0;
  let leanAmount = 0;
  let crouched = false;
  let stanceVisualOffset = 0;
  let movementRoll = 0;
  let movementPitch = 0;
  let stepOffset = 0;
  let stepVelocity = 0;
  let inertiaSide = 0;
  let inertiaForward = 0;
  let previousLocalSideSpeed = 0;
  let previousLocalForwardSpeed = 0;
  let movementAmount = 0;
  let presentationTime = 0;
  let landingOffset = 0;
  let landingVelocity = 0;
  let runBlend = 0;
  let noclipSpeed = config.camera.noclip?.speed ?? config.camera.walkSpeed;
  const previousPosition = new THREE.Vector3();

  function update(dt) {
    if (getViewMode() === "menu") return;
    presentationTime += dt;
    const movementConfig = config.camera.operatorMovement ?? {};
    const noclip = getNoclipEnabled();
    const crouchRequested = !noclip && (keys.has("ControlLeft") || keys.has("ControlRight"));
    updateStance(crouchRequested);
    const running = !crouched && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
    const baseSpeed = noclip
      ? noclipSpeed
      : crouched
        ? config.camera.crouchSpeed ?? config.camera.walkSpeed * 0.55
        : running
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
      applyCameraPresentation(forward, right, dt, new THREE.Vector3(), false);
      return;
    }
    if (!noclip) {
      if (getJumpQueued()) getPhysicsSystem()?.jump(config.player?.collision?.jumpSpeed ?? 3.2);
      setJumpQueued(false);
      previousPosition.copy(playerPosition);
      const groundedBeforeMove = Boolean(getPhysicsSystem()?.isCharacterGrounded?.());
      const verticalVelocityBeforeMove = getPhysicsSystem()?.getCharacterVerticalVelocity?.() ?? 0;
      const frameDelta = movementVelocity.clone().multiplyScalar(dt).add(movingPlatformDelta);
      movingPlatformDelta.set(0, 0, 0);
      moveWithCollisions(frameDelta, dt);
      syncCapsule();
      const actualDelta = new THREE.Vector3(
        playerPosition.x - previousPosition.x,
        0,
        playerPosition.z - previousPosition.z,
      );
      const groundedAfterMove = Boolean(getPhysicsSystem()?.isCharacterGrounded?.());
      if (!groundedBeforeMove && groundedAfterMove && verticalVelocityBeforeMove < -0.8) {
        landingVelocity = Math.min(
          landingVelocity,
          -Math.min(0.16, Math.abs(verticalVelocityBeforeMove) * 0.025),
        );
      }
      applyCameraPresentation(forward, right, dt, actualDelta, running);
      return;
    } else {
      movingPlatformDelta.set(0, 0, 0);
      playerPosition.addScaledVector(movementVelocity, dt);
    }
    applyCameraPresentation(forward, right, dt, movementVelocity.clone().multiplyScalar(dt), running);
  }

  function updateStance(requested) {
    if (requested === crouched) return;
    const previousEyeHeight = getPlayerEyeHeight();
    if (!setCrouched(requested)) return;
    const nextEyeHeight = getPlayerEyeHeight();
    stanceVisualOffset += previousEyeHeight - nextEyeHeight;
    crouched = requested;
  }

  function applyCameraPresentation(forward, right, dt, actualDelta, running) {
    const movementConfig = config.camera.operatorMovement ?? {};
    camera.position.copy(playerPosition);
    if (getNoclipEnabled()) {
      leanAmount = THREE.MathUtils.damp(leanAmount, 0, movementConfig.leanDamping ?? 11, dt);
      movementRoll = THREE.MathUtils.damp(movementRoll, 0, movementConfig.movementTiltDamping ?? 6.5, dt);
      movementPitch = THREE.MathUtils.damp(movementPitch, 0, movementConfig.movementTiltDamping ?? 6.5, dt);
      camera.rotation.x = getPitch() + movementPitch;
      camera.rotation.z = movementRoll;
      return;
    }
    const actualDistance = actualDelta.length();
    const horizontalSpeed = dt > 0 ? actualDistance / dt : 0;
    const speedRatio = THREE.MathUtils.clamp(horizontalSpeed / Math.max(config.camera.runSpeed, 0.001), 0, 1);
    movementAmount = THREE.MathUtils.damp(
      movementAmount,
      THREE.MathUtils.smoothstep(speedRatio, 0.02, 0.3),
      10,
      dt,
    );
    const strideLength = crouched
      ? movementConfig.crouchStrideLength ?? 0.9
      : running
        ? movementConfig.runStrideLength ?? 1.62
        : movementConfig.walkStrideLength ?? 1.25;
    const stepImpulse = crouched
      ? movementConfig.crouchStepImpulse ?? 0.003
      : running
        ? movementConfig.runStepImpulse ?? 0.17
        : movementConfig.walkStepImpulse ?? 0.11;
    const weightShift = crouched
      ? movementConfig.crouchWeightShift ?? 0.0015
      : running
        ? movementConfig.runWeightShift ?? 0.011
        : movementConfig.walkWeightShift ?? 0.006;
    const gaitLift = crouched
      ? movementConfig.crouchGaitLift ?? 0.003
      : running
        ? movementConfig.runGaitLift ?? 0.012
        : movementConfig.walkGaitLift ?? 0.007;
    if (actualDistance > 0.00001) {
      gaitPhase += actualDistance / Math.max(strideLength, 0.01) * Math.PI * 2;
      const nextStep = Math.floor(gaitPhase / Math.PI);
      if (nextStep !== gaitStep) {
        stepVelocity -= stepImpulse * THREE.MathUtils.lerp(0.55, 1, speedRatio);
        gaitStep = nextStep;
      }
    }
    stanceVisualOffset = THREE.MathUtils.damp(
      stanceVisualOffset,
      0,
      movementConfig.stanceDamping ?? 11,
      dt,
    );
    updateStepSpring(dt, movementConfig);
    updateLandingSpring(dt, movementConfig);
    const midStepLift = Math.pow(Math.abs(Math.sin(gaitPhase)), 4) * gaitLift * movementAmount;
    camera.position.y += stanceVisualOffset + stepOffset + landingOffset + midStepLift;
    camera.position.addScaledVector(right, Math.sin(gaitPhase) * weightShift * movementAmount);

    const localSideSpeed = dt > 0 ? actualDelta.dot(right) / dt : 0;
    const localForwardSpeed = dt > 0 ? actualDelta.dot(forward) / dt : 0;
    const sideAcceleration = THREE.MathUtils.clamp((localSideSpeed - previousLocalSideSpeed) / Math.max(dt, 1 / 120), -18, 18);
    const forwardAcceleration = THREE.MathUtils.clamp((localForwardSpeed - previousLocalForwardSpeed) / Math.max(dt, 1 / 120), -18, 18);
    previousLocalSideSpeed = localSideSpeed;
    previousLocalForwardSpeed = localForwardSpeed;
    const inertiaLimit = movementConfig.inertiaMaxOffset ?? 0.012;
    inertiaSide = THREE.MathUtils.damp(
      inertiaSide,
      THREE.MathUtils.clamp(-sideAcceleration * (movementConfig.inertiaSideScale ?? 0.0011), -inertiaLimit, inertiaLimit),
      movementConfig.inertiaDamping ?? 7.5,
      dt,
    );
    inertiaForward = THREE.MathUtils.damp(
      inertiaForward,
      THREE.MathUtils.clamp(-forwardAcceleration * (movementConfig.inertiaForwardScale ?? 0.0008), -inertiaLimit, inertiaLimit),
      movementConfig.inertiaDamping ?? 7.5,
      dt,
    );
    const targetRoll = THREE.MathUtils.degToRad(movementConfig.movementRollDegrees ?? 0.78)
      * THREE.MathUtils.clamp(-localSideSpeed / Math.max(config.camera.runSpeed, 0.001), -1, 1)
      + THREE.MathUtils.degToRad(movementConfig.gaitRollDegrees ?? 0.34) * Math.sin(gaitPhase) * movementAmount;
    movementRoll = THREE.MathUtils.damp(
      movementRoll,
      targetRoll,
      movementConfig.movementTiltDamping ?? 6.5,
      dt,
    );
    const targetPitch = THREE.MathUtils.degToRad(movementConfig.accelerationPitchDegrees ?? 0.48)
      * THREE.MathUtils.clamp(-forwardAcceleration / 12, -1, 1)
      + THREE.MathUtils.degToRad(movementConfig.gaitPitchDegrees ?? 0.28)
        * Math.sin(gaitPhase * 2) * movementAmount;
    movementPitch = THREE.MathUtils.damp(
      movementPitch,
      targetPitch,
      movementConfig.movementTiltDamping ?? 6.5,
      dt,
    );
    camera.rotation.x = getPitch() + movementPitch;
    camera.rotation.z = movementRoll;
    runBlend = THREE.MathUtils.damp(runBlend, running && horizontalSpeed > 0.1 ? speedRatio : 0, 5.5, dt);
    leanAmount = THREE.MathUtils.damp(leanAmount, getZoomActive() ? 1 : 0, movementConfig.leanDamping ?? 11, dt);
    const leanOffset = forward.clone().multiplyScalar(
      leanAmount * (movementConfig.leanForward ?? 0.16) + inertiaForward,
    );
    leanOffset.addScaledVector(right, inertiaSide);
    leanOffset.y -= leanAmount * (movementConfig.leanDown ?? 0.025);
    applyCameraOffset(limitCameraOffset(
      camera.position,
      leanOffset,
      config.player?.collision?.cameraRadius ?? 0.12,
    ));
  }

  function updateStepSpring(dt, movementConfig) {
    const stiffness = movementConfig.stepSpring ?? 92;
    const damping = movementConfig.stepDamping ?? 18;
    stepVelocity += (-stepOffset * stiffness - stepVelocity * damping) * dt;
    stepOffset += stepVelocity * dt;
    const limit = movementConfig.stepMaxOffset ?? 0.022;
    stepOffset = THREE.MathUtils.clamp(stepOffset, -limit, limit);
  }

  function updateLandingSpring(dt, movementConfig) {
    const stiffness = movementConfig.landingSpring ?? 72;
    const damping = movementConfig.landingDamping ?? 15;
    landingVelocity += (-landingOffset * stiffness - landingVelocity * damping) * dt;
    landingOffset += landingVelocity * dt;
    const limit = movementConfig.landingMaxOffset ?? 0.035;
    landingOffset = THREE.MathUtils.clamp(landingOffset, -limit, limit);
  }

  function updateZoom(dt) {
    if (getViewMode() === "menu") return;
    const baseFov = getBaseFov();
    const runFov = (config.camera.operatorMovement?.runFovDegrees ?? 2.2) * runBlend;
    const targetFov = getZoomActive() ? Math.min(config.camera.zoomFovDegrees, baseFov) : baseFov + runFov;
    const damping = getZoomActive()
      ? config.camera.zoomDamping
      : config.camera.operatorMovement?.runFovDamping ?? 5.5;
    camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, damping, dt);
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
    gaitPhase = 0;
    gaitStep = 0;
    leanAmount = 0;
    stanceVisualOffset = 0;
    movementRoll = 0;
    movementPitch = 0;
    stepOffset = 0;
    stepVelocity = 0;
    inertiaSide = 0;
    inertiaForward = 0;
    previousLocalSideSpeed = 0;
    previousLocalForwardSpeed = 0;
    movementAmount = 0;
    presentationTime = 0;
    landingOffset = 0;
    landingVelocity = 0;
    runBlend = 0;
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
    getLocomotionPresentation: () => {
      const idleSide = (Math.sin(presentationTime * 1.7) + Math.sin(presentationTime * 2.43 + 0.8) * 0.45) * 0.0011;
      const idleVertical = (Math.sin(presentationTime * 1.31 + 0.4) + Math.sin(presentationTime * 2.07) * 0.35) * 0.00075;
      const gaitSide = Math.sin(gaitPhase) * (0.008 + runBlend * 0.007) * movementAmount;
      const gaitVertical = Math.sin(gaitPhase * 2) * (0.0045 + runBlend * 0.004) * movementAmount;
      return {
        runBlend,
        movementAmount,
        lensStretch: runBlend * (config.camera.operatorMovement?.runLensStretch ?? 0.008),
        chromaticAberration: runBlend * (config.camera.operatorMovement?.runChromaticAberration ?? 0.00035),
        equipmentSide: idleSide + gaitSide,
        equipmentVertical: idleVertical + gaitVertical + stepOffset * (2.2 + runBlend),
        equipmentRoll: movementRoll * 1.55
          + THREE.MathUtils.degToRad(0.12) * Math.sin(presentationTime * 1.83)
          + THREE.MathUtils.degToRad(0.72 + runBlend * 0.65) * Math.sin(gaitPhase) * movementAmount,
        equipmentPitch: movementPitch * 1.4
          + THREE.MathUtils.degToRad(0.09) * Math.sin(presentationTime * 1.17 + 1.1)
          + THREE.MathUtils.degToRad(0.42 + runBlend * 0.48) * Math.sin(gaitPhase * 2) * movementAmount,
      };
    },
    isCrouched: () => crouched,
  };
}
