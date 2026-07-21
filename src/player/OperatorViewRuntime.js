import * as THREE from "three";

export class OperatorViewRuntime {
  constructor(options) {
    Object.assign(this, options);
    this.exitPointerLock ??= () => globalThis.document?.exitPointerLock?.();
  }

  clearTransientInput() {
    this.exitPointerLock();
    this.keys.clear();
    this.movementVelocity.set(0, 0, 0);
    this.movementRuntime.resetPresentation();
    this.setZoomActive(false);
    this.pointer.set(0, 0);
  }

  applyCameraPose(position, rotationDegrees = {}) {
    this.camera.position.copy(position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.x = THREE.MathUtils.degToRad(rotationDegrees.x ?? 0);
    this.camera.rotation.y = THREE.MathUtils.degToRad(rotationDegrees.y ?? 0);
    this.camera.rotation.z = THREE.MathUtils.degToRad(rotationDegrees.z ?? 0);
  }

  resetLevelView() {
    this.setViewMode("level");
    this.clearTransientInput();
    this.setJumpQueued(false);
    const playerConfig = this.config.levelEnvironments?.[this.getActiveLevelId()]?.player;
    const spawnPosition = playerConfig?.spawnPosition ?? this.playerSpawnPosition;
    const spawnRotation = playerConfig?.rotationDegrees ?? {};
    const yaw = THREE.MathUtils.degToRad(spawnRotation.y ?? this.config.player?.spawnYawDegrees ?? 0);
    const pitch = THREE.MathUtils.degToRad(spawnRotation.x ?? this.config.player?.spawnPitchDegrees ?? 0);
    this.setControlMode(playerConfig?.controlMode ?? "walk");
    this.playerPosition.copy(spawnPosition);
    this.teleportCharacter(spawnPosition);
    this.syncPlayerCapsule();
    this.applyCameraPose(spawnPosition, { x: THREE.MathUtils.radToDeg(pitch), y: THREE.MathUtils.radToDeg(yaw), z: spawnRotation.z ?? 0 });
    this.setYaw(yaw);
    this.setPitch(pitch);
  }

  async enterMenuView() {
    const loadedLevelId = await this.loadLevelEnvironment("intro-shift");
    if (loadedLevelId !== "intro-shift") return false;
    this.resetLevelDoors();
    this.setViewMode("menu");
    this.updateActiveLevelEnvironment();
    this.clearTransientInput();
    const menuView = this.config.camera.menuView;
    if (menuView?.position && menuView?.rotationDegrees) {
      const yaw = THREE.MathUtils.degToRad(menuView.rotationDegrees.y ?? 0);
      const pitch = THREE.MathUtils.degToRad(menuView.rotationDegrees.x ?? 0);
      this.playerPosition.copy(menuView.position);
      this.applyCameraPose(menuView.position, menuView.rotationDegrees);
      this.setYaw(yaw);
      this.setPitch(pitch);
    }
    this.setRoomLightsEnabled(Boolean(menuView?.roomLightsOn), { instant: true });
    return true;
  }
}
