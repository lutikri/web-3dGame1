export class PowerQualificationRuntime {
  constructor({
    playNarration = async () => false,
    isNarrationActive = () => false,
    completeShift = () => null,
  } = {}) {
    this.playNarration = playNarration;
    this.isNarrationActive = isNarrationActive;
    this.completeShift = completeShift;
    this.reset();
  }

  configure(config = null) {
    this.config = config?.powerQualification ?? null;
    this.resetAttempt();
  }

  reset() {
    this.config = null;
    this.resetAttempt();
  }

  resetAttempt() {
    this.started = false;
    this.stageIndex = 0;
    this.holdElapsed = 0;
    this.stageArmed = false;
    this.promptPending = false;
    this.completed = false;
  }

  isEnabled() {
    return Boolean(this.config?.stages?.length);
  }

  onCoreStarted() {
    if (!this.isEnabled() || this.started) return false;
    this.started = true;
    if (!this.isNarrationActive()) void this.requestCurrentPrompt();
    return true;
  }

  onNarrationEnded({ line } = {}) {
    if (!this.started || this.completed) return;
    const stage = this.currentStage();
    if (line === stage?.narration) {
      this.promptPending = false;
      this.stageArmed = true;
      this.holdElapsed = 0;
      return;
    }
    if (!this.stageArmed && !this.promptPending) void this.requestCurrentPrompt();
  }

  update(dt, snapshot) {
    if (!this.isEnabled()) return snapshot;
    if (!this.started || this.completed || snapshot.mode !== "running") return this.decorate(snapshot);

    const stage = this.currentStage();
    if (!stage || !this.stageArmed) return this.decorate(snapshot);
    const tolerance = Math.max(0, Number(stage.toleranceMw) || 0);
    const onTarget = Math.abs(snapshot.powerOutput - stage.targetMw) <= tolerance;
    this.holdElapsed = onTarget ? this.holdElapsed + Math.max(0, dt) : 0;

    if (this.holdElapsed < stage.holdSeconds) return this.decorate(snapshot);
    this.stageIndex += 1;
    this.holdElapsed = 0;
    this.stageArmed = false;
    this.promptPending = false;

    if (this.stageIndex >= this.config.stages.length) {
      this.completed = true;
      const completedSnapshot = this.completeShift() ?? snapshot;
      return {
        ...completedSnapshot,
        qualification: createPassedQualification(this.config.stages),
      };
    }

    void this.requestCurrentPrompt();
    return this.decorate(snapshot);
  }

  getDemandTarget(fallback = null) {
    return this.started && !this.completed ? this.currentStage()?.targetMw ?? fallback : fallback;
  }

  currentStage() {
    return this.config?.stages?.[this.stageIndex] ?? null;
  }

  async requestCurrentPrompt() {
    const stage = this.currentStage();
    if (!this.started || this.completed || !stage?.narration || this.promptPending || this.stageArmed) return false;
    this.promptPending = true;
    const played = await this.playNarration(stage.narration);
    if (!played) this.promptPending = false;
    return Boolean(played);
  }

  decorate(snapshot) {
    const stage = this.currentStage();
    if (!this.started || !stage || snapshot.mode === "failed") return snapshot;
    const remaining = Math.max(0, stage.holdSeconds - this.holdElapsed);
    const targetOutput = stage.targetMw;
    const demandError = targetOutput > 0 ? (snapshot.powerOutput - targetOutput) / targetOutput : 0;
    const toleranceRatio = Math.max(0, Number(stage.toleranceMw) || 0) / Math.max(1, targetOutput);
    return {
      ...snapshot,
      remaining,
      targetOutput,
      demandError,
      phase: { ...snapshot.phase, name: stage.name },
      status: this.stageArmed
        ? `HOLD ${targetOutput} MW / ${Math.ceil(remaining)} SEC`
        : `AWAITING ${targetOutput} MW PROCEDURE`,
      warning: {
        ...snapshot.warning,
        outputLow: demandError < -toleranceRatio,
        underDemand: demandError < -toleranceRatio,
        underDemandCritical: demandError < -Math.max(0.25, toleranceRatio * 2),
        overDemand: demandError > toleranceRatio,
        overDemandCritical: demandError > Math.max(0.25, toleranceRatio * 2),
      },
    };
  }
}

function createPassedQualification(stages) {
  const phaseResults = stages.map((stage) => ({ name: stage.name, compliance: 1 }));
  return {
    passed: true,
    reasons: [],
    gridCompliance: 1,
    averageEfficiency: 100,
    peakCoreStress: 0,
    criticalTempRatio: 0,
    coreStallRatio: 0,
    instabilityRatio: 0,
    maxSevereDemandStreakSeconds: 0,
    passingPhases: phaseResults.length,
    requiredPassingPhases: phaseResults.length,
    phaseResults,
  };
}
