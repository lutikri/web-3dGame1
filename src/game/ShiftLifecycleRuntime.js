export class ShiftLifecycleRuntime {
  constructor(options) { Object.assign(this, options); }

  start() {
    const snapshot = this.getSnapshot();
    if (snapshot.mode === "running") {
      this.simulation.triggerStartupFault();
      this.emitThought("startup-command-fault", 4, 3.6);
      return false;
    }
    if (snapshot.mode !== "standby") return false;
    this.resetRecorder();
    this.hideResults();
    this.resetBulkhead();
    this.resetThoughts();
    this.simulation.start();
    this.fuelBlend.start();
    this.playIgnition();
    this.completion.reset("running");
    this.triggerStartupFeedback();
    this.setIndicatorTimer(0);
    this.diagnostics.stopSelfTest();
    this.diagnostics.startTimeline();
    this.updateStatus(this.simulation.getSnapshot(), true);
    return true;
  }

  reset() {
    this.resetRecorder();
    this.hideResults();
    this.resetBulkhead();
    this.resetThoughts();
    this.simulation.reset();
    this.fuelBlend.stop();
    this.stopCoreLoop();
    this.completion.reset("standby");
    this.setStartupTimer(0);
    this.setIndicatorTimer(0);
    this.diagnostics.stopSelfTest();
    this.diagnostics.stopTimeline();
    this.updateStatus(this.simulation.getSnapshot(), true);
    return true;
  }

  startDiagnosticSelfTest() {
    if (this.getSnapshot().mode !== "standby") {
      this.log("[OperatorGame] Self-test unavailable after ignition");
      return false;
    }
    this.diagnostics.startSelfTest();
    this.setIndicatorTimer(0);
    this.updateStatus(this.diagnostics.createSelfTestSnapshot(this.simulation.getSnapshot()), true);
    this.log("[OperatorGame] Self-test started");
    return true;
  }
}
