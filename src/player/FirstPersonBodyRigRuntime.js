import * as THREE from "three";

export class FirstPersonBodyRigRuntime {
  constructor({ config, initialYaw = 0 } = {}) {
    this.config = config ?? {};
    this.reset(initialYaw);
  }

  reset(headYaw = 0) {
    this.bodyYaw = headYaw;
    this.bodyYawVelocity = 0;
    this.previousWorldVelocity = new THREE.Vector3();
    this.supportLeg = "left";
    this.supportSign = -1;
    this.distanceIntoStep = 0;
    this.stepCount = 0;
    this.turnStepCooldown = 0;
    this.time = 0;
    this.movementAmount = 0;
    this.strafeWeight = springState();
    this.strafeRoll = springState();
    this.forwardWeight = springState();
    this.turnSide = springState();
    this.turnRoll = springState();
    this.lookPitch = springState();
    this.verticalStabilizer = springState();
    this.heelCompression = springState();
    this.stanceWeight = springState();
    this.turnWeight = springState();
    this.pendingLookYaw = 0;
    this.pendingLookPitch = 0;
    this.snapshot = emptySnapshot(headYaw);
  }

  addLookDelta({ yaw = 0, pitch = 0 } = {}) {
    this.pendingLookYaw += Number(yaw) || 0;
    this.pendingLookPitch += Number(pitch) || 0;
  }

  onStanceChanged({ eyeHeightDelta = 0, crouched = false } = {}) {
    this.verticalStabilizer.position += Number(eyeHeightDelta) || 0;
    this.stanceWeight.position += crouched ? 0.009 : -0.004;
    this.stanceWeight.velocity += crouched ? 0.035 : -0.018;
  }

  update({
    dt,
    headYaw,
    actualDelta,
    groundedBefore = false,
    groundedAfter = false,
    verticalVelocityBefore = 0,
    crouched = false,
  }) {
    const delta = Math.min(0.05, Math.max(0, Number(dt) || 0));
    if (delta <= 0) return this.snapshot;
    this.time += delta;
    this.turnStepCooldown = Math.max(0, this.turnStepCooldown - delta);

    const displacement = actualDelta ?? new THREE.Vector3();
    const planarDistance = Math.hypot(displacement.x, displacement.z);
    const worldVelocity = new THREE.Vector3(displacement.x / delta, 0, displacement.z / delta);
    const worldAcceleration = worldVelocity.clone().sub(this.previousWorldVelocity).multiplyScalar(1 / delta);
    this.previousWorldVelocity.copy(worldVelocity);
    const speed = worldVelocity.length();
    this.movementAmount = THREE.MathUtils.damp(
      this.movementAmount,
      THREE.MathUtils.smoothstep(speed, 0.04, 0.65),
      9,
      delta,
    );

    const bodyTurn = this.#updateBodyYaw(headYaw, speed, delta);
    const bodyForward = forwardFromYaw(this.bodyYaw);
    const bodyRight = rightFromYaw(this.bodyYaw);
    const sideSpeed = worldVelocity.dot(bodyRight);
    const forwardSpeed = worldVelocity.dot(bodyForward);
    const sideAcceleration = THREE.MathUtils.clamp(worldAcceleration.dot(bodyRight), -16, 16);
    const forwardAcceleration = THREE.MathUtils.clamp(worldAcceleration.dot(bodyForward), -16, 16);
    const walkReferenceSpeed = this.config.walkReferenceSpeed ?? 1.65;
    const strafeAmount = THREE.MathUtils.clamp(sideSpeed / walkReferenceSpeed, -1, 1);
    stepDampedSpring(
      this.strafeWeight,
      strafeAmount * (this.config.strafeTranslation ?? 0.015),
      this.config.strafeSpringFrequency ?? 7.2,
      this.config.strafeSpringDamping ?? 0.62,
      delta,
    );
    stepDampedSpring(
      this.strafeRoll,
      -strafeAmount * THREE.MathUtils.degToRad(this.config.strafeRollDegrees ?? 1.5),
      this.config.strafeSpringFrequency ?? 7.2,
      this.config.strafeSpringDamping ?? 0.62,
      delta,
    );
    const maxWeightOffset = this.config.forwardWeightLimit ?? 0.024;
    stepDampedSpring(
      this.forwardWeight,
      THREE.MathUtils.clamp(
        -forwardAcceleration * (this.config.forwardAccelerationScale ?? 0.0021),
        -maxWeightOffset,
        maxWeightOffset,
      ),
      this.config.forwardWeightFrequency ?? 6.2,
      this.config.forwardWeightDamping ?? 0.72,
      delta,
    );
    this.#updateLookReaction(delta);

    const strideLength = resolveStrideLength(this.config, speed, crouched);
    const halfStride = Math.max(0.2, strideLength * 0.5);
    if (groundedAfter && planarDistance > 0) {
      this.distanceIntoStep += planarDistance;
      while (this.distanceIntoStep >= halfStride) {
        this.distanceIntoStep -= halfStride;
        this.#plantFoot(speed, false);
      }
    }
    const stationaryStepThreshold = Math.max(
      (this.config.freeHeadYawDegrees ?? 28) + 3,
      this.config.stationaryTurnStepDegrees ?? 17,
    );
    if (speed < 0.08 && Math.abs(bodyTurn.relativeYaw) > THREE.MathUtils.degToRad(stationaryStepThreshold)
      && this.turnStepCooldown <= 0) {
      this.#plantFoot(0, true, Math.sign(bodyTurn.relativeYaw));
      this.turnStepCooldown = this.config.stationaryTurnStepInterval ?? 0.34;
    }

    if (groundedBefore && groundedAfter && Math.abs(displacement.y) > 0.0001 && Math.abs(displacement.y) < 0.4) {
      this.verticalStabilizer.position -= displacement.y * (this.config.stepVerticalStabilization ?? 0.72);
    }
    if (!groundedBefore && groundedAfter && verticalVelocityBefore < -0.65) {
      this.heelCompression.velocity -= Math.min(
        this.config.landingImpulseLimit ?? 0.13,
        Math.abs(verticalVelocityBefore) * (this.config.landingImpulseScale ?? 0.018),
      );
    }
    stepCriticalSpring(this.verticalStabilizer, 0, this.config.verticalRecoveryFrequency ?? 5.4, delta);
    stepCriticalSpring(this.heelCompression, 0, this.config.heelSpringFrequency ?? 7.5, delta);
    stepCriticalSpring(this.stanceWeight, 0, this.config.stanceSpringFrequency ?? 4.6, delta);
    stepCriticalSpring(this.turnWeight, 0, this.config.turnWeightFrequency ?? 6.5, delta);

    const progress = THREE.MathUtils.clamp(this.distanceIntoStep / halfStride, 0, 1);
    const gait = evaluateAuthoredGait(progress, this.supportSign, this.movementAmount, speed, crouched, this.config);
    const idleSide = Math.sin(this.time * 1.37) * 0.00018;
    const idleVertical = Math.sin(this.time * 1.11 + 0.8) * 0.00014;
    const heldMassScale = this.config.heldMassScale ?? 1.35;
    const freeYaw = THREE.MathUtils.degToRad(this.config.freeHeadYawDegrees ?? 28);
    const relativeYawAmount = THREE.MathUtils.clamp(bodyTurn.relativeYaw / Math.max(freeYaw, 0.001), -1, 1);
    const yawDifferenceSide = relativeYawAmount * (this.config.headYawTranslation ?? 0.0045);
    const yawDifferenceRoll = -relativeYawAmount
      * THREE.MathUtils.degToRad(this.config.headYawRollDegrees ?? 0.32);
    const forwardWeightPitch = -this.forwardWeight.position
      * THREE.MathUtils.degToRad(this.config.forwardWeightPitchDegreesPerMeter ?? 24);

    this.snapshot = {
      bodyYaw: this.bodyYaw,
      headRelativeYaw: wrapAngle(headYaw - this.bodyYaw),
      supportLeg: this.supportLeg,
      stepCount: this.stepCount,
      movementAmount: this.movementAmount,
      headAnchor: {
        side: this.strafeWeight.position + this.turnSide.position + yawDifferenceSide
          + gait.bodySide + this.turnWeight.position,
        vertical: gait.bodyVertical + this.heelCompression.position,
        forward: this.forwardWeight.position + this.stanceWeight.position,
      },
      camera: {
        side: this.strafeWeight.position + this.turnSide.position + yawDifferenceSide + gait.cameraSide,
        vertical: this.verticalStabilizer.position + this.heelCompression.position * 0.32 + gait.cameraVertical,
        forward: this.forwardWeight.position + this.stanceWeight.position * 0.45,
        roll: gait.cameraRoll + this.strafeRoll.position + this.turnRoll.position + yawDifferenceRoll,
        pitch: gait.cameraPitch + forwardWeightPitch + this.lookPitch.position,
      },
      held: {
        side: idleSide + (this.strafeWeight.position + this.turnSide.position + yawDifferenceSide
          + this.turnWeight.position) * heldMassScale + gait.heldSide,
        vertical: idleVertical + this.heelCompression.position * 0.9 + gait.heldVertical,
        forward: (this.forwardWeight.position + this.stanceWeight.position) * heldMassScale,
        roll: gait.heldRoll + (this.strafeRoll.position + this.turnRoll.position + yawDifferenceRoll) * heldMassScale
          + THREE.MathUtils.degToRad(0.035) * Math.sin(this.time * 1.71),
        pitch: gait.heldPitch + (forwardWeightPitch + this.lookPitch.position) * heldMassScale
          + THREE.MathUtils.degToRad(0.025) * Math.sin(this.time * 1.19 + 0.4),
        yaw: -this.bodyYawVelocity * (this.config.heldTurnYawScale ?? 0.018),
      },
      components: {
        sideSpeed,
        forwardSpeed,
        sideAcceleration,
        forwardAcceleration,
        gait,
        strafe: { side: this.strafeWeight.position, roll: this.strafeRoll.position },
        look: { side: this.turnSide.position, roll: this.turnRoll.position, pitch: this.lookPitch.position },
        forwardWeight: this.forwardWeight.position,
      },
    };
    return this.snapshot;
  }

  #updateBodyYaw(headYaw, speed, dt) {
    const relativeYaw = wrapAngle(headYaw - this.bodyYaw);
    const freeYaw = THREE.MathUtils.degToRad(this.config.freeHeadYawDegrees ?? 28);
    let targetYaw = this.bodyYaw;
    let frequency = this.config.stationaryBodyTurnFrequency ?? 2.2;
    if (speed > 0.08) {
      targetYaw = headYaw;
      frequency = THREE.MathUtils.lerp(
        this.config.movingBodyTurnFrequency ?? 4.2,
        this.config.fastBodyTurnFrequency ?? 6,
        THREE.MathUtils.clamp(speed / 2.8, 0, 1),
      );
    } else if (Math.abs(relativeYaw) > freeYaw) {
      targetYaw = headYaw - Math.sign(relativeYaw) * freeYaw;
    }
    const before = this.bodyYaw;
    const unwrappedTarget = this.bodyYaw + wrapAngle(targetYaw - this.bodyYaw);
    const yawState = { position: this.bodyYaw, velocity: this.bodyYawVelocity };
    stepCriticalSpring(yawState, unwrappedTarget, frequency, dt);
    this.bodyYaw = yawState.position;
    this.bodyYawVelocity = yawState.velocity;
    return { relativeYaw, angularDelta: wrapAngle(this.bodyYaw - before) };
  }

  #plantFoot(speed, stationaryTurn = false, turnSign = 0) {
    this.supportSign *= -1;
    this.supportLeg = this.supportSign < 0 ? "left" : "right";
    this.stepCount += 1;
    const speedAmount = THREE.MathUtils.clamp(speed / 2.8, 0, 1);
    this.heelCompression.velocity -= stationaryTurn
      ? this.config.turnFootCompressionImpulse ?? 0.012
      : THREE.MathUtils.lerp(
        this.config.walkHeelCompressionImpulse ?? 0.022,
        this.config.runHeelCompressionImpulse ?? 0.038,
        speedAmount,
      );
    if (stationaryTurn) {
      this.turnWeight.velocity += turnSign * this.supportSign * (this.config.turnWeightImpulse ?? 0.018);
    }
  }

  #updateLookReaction(dt) {
    const yawRate = THREE.MathUtils.clamp(
      this.pendingLookYaw / Math.max(dt, 1 / 240),
      -(this.config.lookAngularVelocityLimit ?? 7),
      this.config.lookAngularVelocityLimit ?? 7,
    );
    const pitchRate = THREE.MathUtils.clamp(
      this.pendingLookPitch / Math.max(dt, 1 / 240),
      -(this.config.lookAngularVelocityLimit ?? 7),
      this.config.lookAngularVelocityLimit ?? 7,
    );
    this.pendingLookYaw = 0;
    this.pendingLookPitch = 0;
    const yawAmount = yawRate / Math.max(this.config.lookAngularVelocityForFullSway ?? 4.5, 0.001);
    const pitchAmount = pitchRate / Math.max(this.config.lookAngularVelocityForFullSway ?? 4.5, 0.001);
    const frequency = this.config.lookReactionFrequency ?? 8;
    const damping = this.config.lookReactionDamping ?? 0.58;
    stepDampedSpring(
      this.turnSide,
      THREE.MathUtils.clamp(yawAmount, -1, 1) * (this.config.lookYawTranslation ?? 0.012),
      frequency,
      damping,
      dt,
    );
    stepDampedSpring(
      this.turnRoll,
      -THREE.MathUtils.clamp(yawAmount, -1, 1)
        * THREE.MathUtils.degToRad(this.config.lookYawRollDegrees ?? 1.25),
      frequency,
      damping,
      dt,
    );
    stepDampedSpring(
      this.lookPitch,
      -THREE.MathUtils.clamp(pitchAmount, -1, 1)
        * THREE.MathUtils.degToRad(this.config.lookPitchReactionDegrees ?? 0.65),
      frequency,
      damping,
      dt,
    );
  }
}

function evaluateAuthoredGait(progress, supportSign, amount, speed, crouched, config) {
  const speedAmount = THREE.MathUtils.clamp((speed - 0.4) / 2.4, 0, 1);
  const compressionRise = sampleStrideCurve(progress, [
    [0, -0.32],
    [0.1, -1],
    [0.28, 0.12],
    [0.52, 1],
    [0.72, 0.42],
    [0.9, -0.12],
    [1, -0.32],
  ]);
  const weightTransfer = sampleStrideCurve(progress, [
    [0, 0],
    [0.14, 0.72],
    [0.36, 1],
    [0.64, 0.72],
    [0.86, 0.18],
    [1, 0],
  ]) * supportSign;
  const neckPitch = sampleStrideCurve(progress, [
    [0, 0.52],
    [0.12, 1],
    [0.34, -0.25],
    [0.58, -0.72],
    [0.82, 0.12],
    [1, 0.52],
  ]);
  const stanceScale = crouched ? 0.62 : 1;
  const verticalScale = THREE.MathUtils.lerp(0.86, 1.12, speedAmount);
  const lateralScale = THREE.MathUtils.lerp(0.9, 1.12, speedAmount);
  return {
    bodySide: weightTransfer * (config.bodyGaitSide ?? 0.019) * lateralScale * amount * stanceScale,
    bodyVertical: compressionRise * (config.bodyGaitVertical ?? 0.02) * verticalScale * amount * stanceScale,
    cameraSide: weightTransfer * (config.cameraGaitSide ?? 0.014) * lateralScale * amount * stanceScale,
    cameraVertical: compressionRise * (config.cameraGaitVertical ?? 0.016) * verticalScale * amount * stanceScale,
    cameraRoll: weightTransfer * THREE.MathUtils.degToRad(config.cameraGaitRollDegrees ?? 0.9)
      * lateralScale * amount * stanceScale,
    cameraPitch: neckPitch * THREE.MathUtils.degToRad(config.cameraGaitPitchDegrees ?? 0.58)
      * verticalScale * amount * stanceScale,
    heldSide: weightTransfer * (config.heldGaitSide ?? 0.025) * lateralScale * amount * stanceScale,
    heldVertical: compressionRise * (config.heldGaitVertical ?? 0.027) * verticalScale * amount * stanceScale,
    heldRoll: weightTransfer * THREE.MathUtils.degToRad(config.heldGaitRollDegrees ?? 1.45)
      * lateralScale * amount * stanceScale,
    heldPitch: neckPitch * THREE.MathUtils.degToRad(config.heldGaitPitchDegrees ?? 1.05)
      * verticalScale * amount * stanceScale,
  };
}

function sampleStrideCurve(progress, keys) {
  const value = THREE.MathUtils.clamp(progress, 0, 1);
  for (let index = 1; index < keys.length; index += 1) {
    const previous = keys[index - 1];
    const next = keys[index];
    if (value > next[0]) continue;
    const segment = THREE.MathUtils.clamp((value - previous[0]) / Math.max(next[0] - previous[0], 0.0001), 0, 1);
    const eased = segment * segment * (3 - 2 * segment);
    return THREE.MathUtils.lerp(previous[1], next[1], eased);
  }
  return keys.at(-1)[1];
}

function resolveStrideLength(config, speed, crouched) {
  if (crouched) return config.crouchStrideLength ?? 0.86;
  const runAmount = THREE.MathUtils.smoothstep(speed, 1.5, 2.8);
  return THREE.MathUtils.lerp(config.walkStrideLength ?? 1.2, config.runStrideLength ?? 1.55, runAmount);
}

function springState() {
  return { position: 0, velocity: 0 };
}

export function stepCriticalSpring(state, target, frequency, dt) {
  const omega = Math.max(0.001, Number(frequency) || 1);
  const displacement = state.position - target;
  const junction = state.velocity + omega * displacement;
  const decay = Math.exp(-omega * dt);
  state.position = target + (displacement + junction * dt) * decay;
  state.velocity = (state.velocity - omega * junction * dt) * decay;
  return state;
}

export function stepDampedSpring(state, target, frequency, dampingRatio, dt) {
  const omega = Math.max(0.001, Number(frequency) || 1);
  const damping = Math.max(0, Number(dampingRatio) || 0);
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const step = dt / steps;
  for (let index = 0; index < steps; index += 1) {
    const acceleration = (target - state.position) * omega * omega
      - 2 * damping * omega * state.velocity;
    state.velocity += acceleration * step;
    state.position += state.velocity * step;
  }
  return state;
}

export function wrapAngle(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function forwardFromYaw(yaw) {
  return new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
}

function rightFromYaw(yaw) {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
}

function emptySnapshot(yaw) {
  return {
    bodyYaw: yaw,
    headRelativeYaw: 0,
    supportLeg: "left",
    stepCount: 0,
    movementAmount: 0,
    headAnchor: { side: 0, vertical: 0, forward: 0 },
    camera: { side: 0, vertical: 0, forward: 0, roll: 0, pitch: 0 },
    held: { side: 0, vertical: 0, forward: 0, roll: 0, pitch: 0, yaw: 0 },
    components: {
      sideSpeed: 0,
      forwardSpeed: 0,
      sideAcceleration: 0,
      forwardAcceleration: 0,
      gait: {},
      strafe: { side: 0, roll: 0 },
      look: { side: 0, roll: 0, pitch: 0 },
      forwardWeight: 0,
    },
  };
}
