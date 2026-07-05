export class PlayerController {
  constructor({ updateMovement, updateZoom, updateCollisionDebug, resetView, applyCollisionSettings }) {
    this.updateMovement = updateMovement;
    this.updateZoom = updateZoom;
    this.updateCollisionDebug = updateCollisionDebug;
    this.resetView = resetView;
    this.applyCollisionSettings = applyCollisionSettings;
    this.enabled = true;
  }

  update(dt) {
    if (!this.enabled) return;
    this.updateMovement(dt);
    this.updateZoom(dt);
  }

  updateAfterPhysics() {
    if (this.enabled) this.updateCollisionDebug();
  }

  reset() {
    this.resetView();
  }

  configureCollision() {
    this.applyCollisionSettings();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
  }
}
