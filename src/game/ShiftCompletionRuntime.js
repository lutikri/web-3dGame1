import * as THREE from "three";

export class ShiftCompletionRuntime {
  constructor({
    config, initialMode, createStartupPattern, getStartupDuration, stopCoreLoop,
    emitThought, playOutcomeNarration = () => {}, canUnlockBulkhead, unlockBulkhead, shouldWaitForDoorExit,
    hasBulkhead, resultsController,
  }) {
    Object.assign(this, {
      config, createStartupPattern, getStartupDuration, stopCoreLoop, emitThought, playOutcomeNarration,
      canUnlockBulkhead, unlockBulkhead, shouldWaitForDoorExit, hasBulkhead, resultsController,
    });
    this.previousMode = initialMode;
    this.resultsTimer = 0;
    this.resultsSnapshot = null;
    this.terminalElapsed = -1;
    this.terminalStartupPattern = [];
  }

  update = (dt, snapshot) => {
    const finished = this.previousMode === "running" && (snapshot.mode === "complete" || snapshot.mode === "failed");
    this.previousMode = snapshot.mode;
    if (finished) {
      this.stopCoreLoop();
      this.terminalStartupPattern = snapshot.failureType === "coreDestroyed" ? this.createStartupPattern() : [];
      this.resultsTimer = this.#resultsDelay(snapshot);
      this.resultsSnapshot = snapshot;
      this.terminalElapsed = 0;
      this.playOutcomeNarration(resolveOutcomeNarrationKey(snapshot));
    }
    if (this.terminalElapsed >= 0) this.terminalElapsed += dt;
    const thoughtDelay = snapshot.failureType === "coreDestroyed"
      ? this.config.feedback.terminal.destroyedBlackoutSeconds : 0.8;
    if (this.terminalElapsed >= thoughtDelay) {
      if (snapshot.mode === "complete") this.emitThought("shift-complete", 3, 4);
      else if (snapshot.failureType === "coreDestroyed") this.emitThought("core-destroyed", 4, 4);
      else if (snapshot.mode === "failed") this.emitThought("fail-safe", 3, 4);
    }
    if (this.canUnlockBulkhead() && this.terminalElapsed >= this.#bulkheadDelay(snapshot)) this.unlockBulkhead();
    if (this.shouldWaitForDoorExit() || (this.hasBulkhead() && this.resultsSnapshot)) return;
    if (this.resultsTimer <= 0 || this.resultsController.visible) return;
    this.resultsTimer = Math.max(0, this.resultsTimer - dt);
    if (this.resultsTimer === 0 && this.resultsSnapshot) this.resultsController.show(this.resultsSnapshot);
  };

  getPresentationSnapshot = (snapshot) => {
    if (this.terminalElapsed < 0 || (snapshot.mode !== "complete" && snapshot.mode !== "failed")) return snapshot;
    const terminal = this.config.feedback.terminal;
    const shutdownProgress = THREE.MathUtils.smoothstep(this.terminalElapsed, 0.12, terminal.instrumentShutdownSeconds);
    const factor = 1 - shutdownProgress;
    const destroyed = snapshot.failureType === "coreDestroyed";
    return {
      ...snapshot,
      plasmaTemp: snapshot.plasmaTemp * factor,
      containment: snapshot.containment * factor,
      powerOutput: snapshot.powerOutput * factor,
      burnRate: snapshot.burnRate * factor,
      coreStress: snapshot.coreStress * factor,
      outputSurge: snapshot.outputSurge * factor,
      reactionEfficiency: snapshot.reactionEfficiency * factor,
      shutdownLevel: Math.max(snapshot.shutdownLevel ?? 0, shutdownProgress),
      terminalElapsed: this.terminalElapsed,
      terminalBlackout: destroyed && this.terminalElapsed < terminal.destroyedBlackoutSeconds,
    };
  };

  reset = (mode) => {
    this.previousMode = mode;
    this.resultsTimer = 0;
    this.resultsSnapshot = null;
    this.terminalElapsed = -1;
    this.terminalStartupPattern = [];
  };

  #bulkheadDelay(snapshot) {
    const terminal = this.config.feedback.terminal;
    if (snapshot.failureType !== "coreDestroyed") return terminal.instrumentShutdownSeconds;
    return terminal.destroyedBlackoutSeconds
      + this.getStartupDuration(this.terminalStartupPattern)
      + terminal.emergencyLightSettleSeconds;
  }

  #resultsDelay(snapshot) {
    return this.#bulkheadDelay(snapshot) + this.config.feedback.terminal.resultsHoldSeconds;
  }
}

export function resolveOutcomeNarrationKey(snapshot) {
  if (snapshot?.mode === "complete") return "passed";
  if (snapshot?.failureType === "qualityFailure") return "insufficient";
  return "trip";
}
