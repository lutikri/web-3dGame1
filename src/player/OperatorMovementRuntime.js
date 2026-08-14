import * as THREE from "three";

import { FirstPersonBodyRigRuntime } from "./FirstPersonBodyRigRuntime.js?v=body-motion-debug";

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
  const movementConfig = config.camera.operatorMovement ?? {};
  const bodyRig = new FirstPersonBodyRigRuntime({ config: movementConfig.bodyRig, initialYaw: getYaw() });
  let rigSnapshot = bodyRig.snapshot;
  let leanAmount = 0;
  let crouched = false;
  let noclipSpeed = config.camera.noclip?.speed ?? config.camera.walkSpeed;
  let noclipWasActive = false;
  const previousPosition = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();
  const frameDelta = new THREE.Vector3();
  const actualDelta = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3();
  const bodyForward = new THREE.Vector3();
  const bodyRight = new THREE.Vector3();

  function update(dt) {
    if (getViewMode() === "menu") return;
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
    camera.rotation.set(getPitch(), getYaw(), 0);
    camera.getWorldDirection(forward);
    if (!noclip) {
      forward.y = 0;
      forward.normalize();
    }
    right.crossVectors(forward, worldUp).normalize();
    move.set(0, 0, 0);
    if (keys.has("KeyW")) move.add(forward);
    if (keys.has("KeyS")) move.sub(forward);
    if (keys.has("KeyD")) move.add(right);
    if (keys.has("KeyA")) move.sub(right);
    if (noclip && keys.has("Space")) move.y += 1;
    if (noclip && (keys.has("ControlLeft") || keys.has("ControlRight"))) move.y -= 1;

    const hasMove = move.lengthSq() > 0;
    if (hasMove) move.normalize().multiplyScalar(speed);
    const damping = hasMove ? movementConfig.acceleration ?? 7 : movementConfig.deceleration ?? 12;
    movementVelocity.x = THREE.MathUtils.damp(movementVelocity.x, hasMove ? move.x : 0, damping, dt);
    movementVelocity.y = THREE.MathUtils.damp(movementVelocity.y, hasMove ? move.y : 0, damping, dt);
    movementVelocity.z = THREE.MathUtils.damp(movementVelocity.z, hasMove ? move.z : 0, damping, dt);

    if (getControlMode() === "lookOnlyUntilElevatorArrival") {
      movementVelocity.set(0, 0, 0);
      previousPosition.copy(playerPosition);
      if (movingPlatformDelta.lengthSq() > 0) {
        playerPosition.add(movingPlatformDelta);
        getPhysicsSystem()?.teleportCharacter(playerPosition);
        syncCapsule();
        movingPlatformDelta.set(0, 0, 0);
      }
      actualDelta.copy(playerPosition).sub(previousPosition);
      updateBodyRig(dt, actualDelta, false, false, 0);
      applyCameraRig(dt);
      return;
    }

    if (noclip) {
      if (!noclipWasActive) bodyRig.reset(getYaw());
      noclipWasActive = true;
      movingPlatformDelta.set(0, 0, 0);
      playerPosition.addScaledVector(movementVelocity, dt);
      camera.position.copy(playerPosition);
      camera.rotation.set(getPitch(), getYaw(), 0);
      updateLean(dt, forward);
      return;
    }
    if (noclipWasActive) bodyRig.reset(getYaw());
    noclipWasActive = false;

    if (getJumpQueued()) getPhysicsSystem()?.jump(config.player?.collision?.jumpSpeed ?? 3.2);
    setJumpQueued(false);
    previousPosition.copy(playerPosition);
    const groundedBefore = Boolean(getPhysicsSystem()?.isCharacterGrounded?.());
    const verticalVelocityBefore = getPhysicsSystem()?.getCharacterVerticalVelocity?.() ?? 0;
    frameDelta.copy(movementVelocity).multiplyScalar(dt).add(movingPlatformDelta);
    movingPlatformDelta.set(0, 0, 0);
    moveWithCollisions(frameDelta, dt);
    syncCapsule();
    actualDelta.copy(playerPosition).sub(previousPosition);
    const groundedAfter = Boolean(getPhysicsSystem()?.isCharacterGrounded?.());
    updateBodyRig(dt, actualDelta, groundedBefore, groundedAfter, verticalVelocityBefore);
    applyCameraRig(dt);
  }

  function updateBodyRig(dt, displacement, groundedBefore, groundedAfter, verticalVelocityBefore) {
    rigSnapshot = bodyRig.update({
      dt,
      headYaw: getYaw(),
      actualDelta: displacement,
      groundedBefore,
      groundedAfter,
      verticalVelocityBefore,
      crouched,
    });
  }

  function updateStance(requested) {
    if (requested === crouched) return;
    const previousEyeHeight = getPlayerEyeHeight();
    if (!setCrouched(requested)) return;
    const nextEyeHeight = getPlayerEyeHeight();
    crouched = requested;
    bodyRig.onStanceChanged({
      eyeHeightDelta: previousEyeHeight - nextEyeHeight,
      crouched,
    });
  }

  function applyCameraRig(dt) {
    camera.position.copy(playerPosition);
    bodyForward.set(-Math.sin(rigSnapshot.bodyYaw), 0, -Math.cos(rigSnapshot.bodyYaw));
    bodyRight.set(Math.cos(rigSnapshot.bodyYaw), 0, -Math.sin(rigSnapshot.bodyYaw));
    cameraOffset.set(0, rigSnapshot.camera.vertical, 0)
      .addScaledVector(bodyRight, rigSnapshot.camera.side)
      .addScaledVector(bodyForward, rigSnapshot.camera.forward);
    applyCameraOffset(limitCameraOffset(
      camera.position,
      cameraOffset,
      config.player?.collision?.cameraRadius ?? 0.12,
    ));
    camera.rotation.set(
      getPitch() + rigSnapshot.camera.pitch,
      getYaw(),
      rigSnapshot.camera.roll,
      "YXZ",
    );
    camera.getWorldDirection(forward);
    updateLean(dt, forward);
  }

  function updateLean(dt, viewForward) {
    leanAmount = THREE.MathUtils.damp(
      leanAmount,
      getZoomActive() ? 1 : 0,
      movementConfig.leanDamping ?? 4,
      dt,
    );
    if (leanAmount <= 0.0001) return;
    cameraOffset.copy(viewForward).multiplyScalar(leanAmount * (movementConfig.leanForward ?? 0.26));
    cameraOffset.y -= leanAmount * (movementConfig.leanDown ?? 0.025);
    applyCameraOffset(limitCameraOffset(
      camera.position,
      cameraOffset,
      config.player?.collision?.cameraRadius ?? 0.12,
    ));
  }

  function updateZoom(dt) {
    if (getViewMode() === "menu") return;
    const baseFov = getBaseFov();
    const targetFov = getZoomActive() ? Math.min(config.camera.zoomFovDegrees, baseFov) : baseFov;
    camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, config.camera.zoomDamping, dt);
    camera.updateProjectionMatrix();
  }

  function updateLook(movementX, movementY) {
    const sensitivity = config.camera.mouseSensitivity
      * (getZoomActive() ? movementConfig.zoomSensitivityMultiplier ?? 0.88 : 1);
    const previousYaw = getYaw();
    const previousPitch = getPitch();
    setYaw(previousYaw - movementX * sensitivity);
    const pitchLimitDegrees = getZoomActive()
      ? config.camera.leanPitchLimitDegrees ?? config.camera.pitchLimitDegrees ?? 88
      : config.camera.pitchLimitDegrees ?? 72;
    const limit = THREE.MathUtils.degToRad(pitchLimitDegrees);
    setPitch(THREE.MathUtils.clamp(previousPitch - movementY * sensitivity, -limit, limit));
    bodyRig.addLookDelta({
      yaw: wrapAngle(getYaw() - previousYaw),
      pitch: getPitch() - previousPitch,
    });
  }

  function resetPresentation() {
    leanAmount = 0;
    bodyRig.reset(getYaw());
    rigSnapshot = bodyRig.snapshot;
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

  const getLocomotionPresentation = () => ({
    bodyYaw: rigSnapshot.bodyYaw,
    headRelativeYaw: rigSnapshot.headRelativeYaw,
    supportLeg: rigSnapshot.supportLeg,
    movementAmount: rigSnapshot.movementAmount,
    equipmentSide: rigSnapshot.held.side,
    equipmentVertical: rigSnapshot.held.vertical,
    equipmentForward: rigSnapshot.held.forward,
    equipmentRoll: rigSnapshot.held.roll,
    equipmentPitch: rigSnapshot.held.pitch,
    equipmentYaw: rigSnapshot.held.yaw,
  });

  return {
    update,
    updateZoom,
    updateLook,
    resetPresentation,
    setNoclipSpeed,
    adjustNoclipSpeed,
    getNoclipSpeed: () => noclipSpeed,
    getLeanAmount: () => leanAmount,
    getLocomotionPresentation,
    getBodyRigSnapshot: () => rigSnapshot,
    isCrouched: () => crouched,
  };
}

function wrapAngle(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}
