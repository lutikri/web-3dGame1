import * as THREE from "three";

import { applyAxisRotation } from "../scene/TransformUtils.js?v=inventory-wheel-drop";

export class BulkheadExitRuntime {
  constructor({ config, interactive, playSound, getGameMode, emitThought, getResults, showResults, refreshTooltip }) {
    Object.assign(this, {
      config, interactive, playSound, getGameMode, emitThought,
      getResults, showResults, refreshTooltip,
    });
    this.handle = null;
    this.held = false;
    this.progress = 0;
    this.lockedAttemptTime = -1;
    this.pending = false;
    this.complete = false;
  }

  register = (object) => {
    if (this.handle) return false;
    this.handle = object;
    object.userData.kind = "bulkheadHandle";
    object.userData.controlLabel = this.config.label;
    object.userData.initialRotation = object.rotation.clone();
    object.userData.maxInteractionDistance = this.config.maxInteractionDistance;
    this.interactive.push(object);
    return true;
  };

  update = (dt) => {
    if (!this.handle) return;
    let angle = 0;
    if (this.complete) {
      angle = THREE.MathUtils.degToRad(this.config.unlockedTurnDegrees);
    } else if (this.pending) {
      const direction = this.held ? 1 / this.config.unlockHoldSeconds : -1 / this.config.returnSeconds;
      this.progress = THREE.MathUtils.clamp(this.progress + direction * dt, 0, 1);
      const eased = this.progress * this.progress * (3 - 2 * this.progress);
      const envelope = Math.sin(this.progress * Math.PI);
      const jerk = -Math.abs(Math.sin(this.progress * Math.PI * this.config.turnJerkFrequency))
        * THREE.MathUtils.degToRad(this.config.turnJerkDegrees) * envelope;
      angle = THREE.MathUtils.degToRad(this.config.unlockedTurnDegrees) * eased + jerk;
      if (this.progress >= 1) {
        this.complete = true;
        this.held = false;
        const results = this.getResults();
        if (results) this.showResults(results);
      }
    } else if (this.lockedAttemptTime >= 0) {
      this.lockedAttemptTime += dt;
      const progress = THREE.MathUtils.clamp(this.lockedAttemptTime / this.config.lockedAttemptSeconds, 0, 1);
      const stopAngle = THREE.MathUtils.degToRad(this.config.lockedStopDegrees);
      if (progress < 0.45) {
        const drive = progress / 0.45;
        const eased = drive * drive * (3 - 2 * drive);
        const jerk = -Math.abs(Math.sin(drive * Math.PI * 5))
          * THREE.MathUtils.degToRad(this.config.lockedKnockDegrees * 0.45)
          * Math.sin(drive * Math.PI);
        angle = stopAngle * eased + jerk;
      } else if (progress < 0.65) {
        const knockProgress = (progress - 0.45) / 0.2;
        angle = stopAngle + Math.sin(knockProgress * Math.PI * 7) * (1 - knockProgress)
          * THREE.MathUtils.degToRad(this.config.lockedKnockDegrees);
      } else {
        const returnProgress = (progress - 0.65) / 0.35;
        const easedReturn = returnProgress * returnProgress * (3 - 2 * returnProgress);
        angle = stopAngle * (1 - easedReturn);
      }
      if (progress >= 1) this.lockedAttemptTime = -1;
    }
    this.handle.rotation.copy(this.handle.userData.initialRotation);
    applyAxisRotation(this.handle, this.config.rotationAxis, angle);
  };

  begin = () => {
    if (!this.handle || this.complete) return false;
    if ((this.handle.userData.lastHitDistance ?? Infinity) > this.config.maxInteractionDistance) return false;
    if (this.pending) {
      this.playSound(this.handle, "DoorBulk1_LatchCrank1", { maxDistance: 4.5 });
      this.held = true;
      return true;
    }
    this.playSound(this.handle, "DoorBulk1_LatchCrank1", { volume: 0.45, maxDistance: 4.5 });
    this.lockedAttemptTime = 0;
    this.emitThought(this.getGameMode() === "running" ? "door-live-core" : "door-interlocked", 1, 3.2);
    return true;
  };

  release = () => {
    this.held = false;
  };

  unlock = () => {
    if (!this.canUnlock()) return false;
    this.pending = true;
    this.handle.userData.controlLabel = "HOLD TO OPEN BULKHEAD";
    this.refreshTooltip();
    return true;
  };

  canUnlock = () => Boolean(this.handle && !this.pending && !this.complete);
  hasHandle = () => Boolean(this.handle);

  reset = () => {
    this.held = false;
    this.progress = 0;
    this.lockedAttemptTime = -1;
    this.pending = false;
    this.complete = false;
    if (!this.handle) return;
    this.handle.userData.controlLabel = this.config.label;
    this.handle.rotation.copy(this.handle.userData.initialRotation);
  };
}
