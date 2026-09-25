export class WorldBoundsRecoveryRuntime {
  constructor({
    config = {},
    playerPosition,
    getLevelId,
    getViewMode,
    getSpawnPosition,
    canRecoverPlayer = () => true,
    teleportPlayer,
    suspendPlayer,
    restorePlayer,
    resetOutOfBoundsProps = () => [],
    screenTransition,
  }) {
    this.config = config;
    this.playerPosition = playerPosition;
    this.getLevelId = getLevelId;
    this.getViewMode = getViewMode;
    this.getSpawnPosition = getSpawnPosition;
    this.canRecoverPlayer = canRecoverPlayer;
    this.teleportPlayer = teleportPlayer;
    this.suspendPlayer = suspendPlayer;
    this.restorePlayer = restorePlayer;
    this.resetOutOfBoundsProps = resetOutOfBoundsProps;
    this.screenTransition = screenTransition;
    this.levelId = null;
    this.propCheckElapsed = 0;
    this.recovering = false;
  }

  update = (dt) => {
    if (this.getViewMode() !== "level") return;
    this.syncLevel();
    this.propCheckElapsed += Math.max(0, Number(dt) || 0);
    const interval = Math.max(0.05, Number(this.config.propCheckIntervalSeconds) || 0.25);
    if (this.propCheckElapsed >= interval) {
      this.propCheckElapsed = 0;
      this.resetOutOfBoundsProps(Number(this.config.propMinimumY) || -8);
    }
    if (this.recovering) return;
    const minimumY = Number(this.config.playerMinimumY) || -4;
    if (this.playerPosition.y < minimumY) {
      if (this.canRecoverPlayer()) void this.recoverPlayer();
      return;
    }
  };

  syncLevel() {
    const levelId = this.getLevelId();
    if (levelId === this.levelId) return;
    this.levelId = levelId;
    this.propCheckElapsed = 0;
  }

  async recoverPlayer() {
    if (this.recovering) return false;
    this.recovering = true;
    const recoveryLevelId = this.levelId;
    const suspendedState = this.suspendPlayer();
    try {
      await this.screenTransition.cover({
        tone: "black",
        durationMs: Number(this.config.coverDurationMs) || 320,
        holdMs: Number(this.config.coverHoldMs) || 120,
      });
      if (this.getLevelId() === recoveryLevelId) {
        const spawn = this.getSpawnPosition(recoveryLevelId);
        if (spawn) this.teleportPlayer(spawn);
      }
      await this.screenTransition.reveal({
        durationMs: Number(this.config.revealDurationMs) || 520,
      });
      return true;
    } finally {
      this.restorePlayer(suspendedState);
      this.recovering = false;
    }
  }
}
