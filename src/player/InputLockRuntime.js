export class InputLockRuntime {
  constructor(options = {}) {
    Object.assign(this, options);
    this.locked = false;
  }

  isLocked = () => this.locked;

  setLocked(locked) {
    this.locked = Boolean(locked);
    if (!this.locked) return false;
    this.endDoorDrag();
    this.releaseDoorLatches();
    this.clearHoveredDoor();
    this.exitPointerLock();
    this.keys.clear();
    this.setJumpQueued(false);
    this.movementVelocity.set(0, 0, 0);
    this.setZoomActive(false);
    this.releaseControls();
    this.clearHoveredKnob();
    this.clearHoveredTooltip();
    return true;
  }

  suspend() {
    const wasLocked = this.locked;
    this.locked = true;
    this.keys.clear();
    this.movementVelocity.set(0, 0, 0);
    this.exitPointerLock();
    return wasLocked;
  }

  restore(wasLocked) {
    this.locked = Boolean(wasLocked);
    return this.locked;
  }
}
