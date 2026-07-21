export class OperatorPanelRuntime {
  constructor({ load, update, reset, applyLevel, hasModel, tick = null }) {
    this.loadModel = load;
    this.updateModel = update;
    this.resetModel = reset;
    this.applyLevelModel = applyLevel;
    this.hasModel = hasModel;
    this.tick = tick;
    this.observedIgnitionPulseCount = tick?.getSnapshot?.().ignitionPulseCount ?? 0;
  }

  load() {
    return this.loadModel();
  }

  update(dt) {
    if (!this.hasModel()) return;
    if (this.tick) this.#updateTick(dt);
    else this.updateModel(dt);
  }

  reset() {
    return this.resetModel();
  }

  applyLevel(levelId, mode) {
    return this.applyLevelModel(levelId, mode);
  }

  get loaded() {
    return Boolean(this.hasModel());
  }

  #updateTick(dt) {
    const tick = this.tick;
    const before = tick.getSnapshot();
    const fuelBlend = tick.fuelBlend.update(dt, {
      shiftMode: before.mode,
      shiftElapsed: before.elapsed,
    });
    const inputs = tick.getControlInputs(fuelBlend);
    const snapshot = tick.simulation.update(dt, inputs);
    const pulseCount = snapshot.ignitionPulseCount ?? 0;
    if (pulseCount > this.observedIgnitionPulseCount) tick.onIgnitionPulse();
    this.observedIgnitionPulseCount = pulseCount;
    tick.setSnapshot(snapshot);
    tick.diagnostics.update(dt);
    if (tick.diagnostics.consumeLightRestartRequest()) tick.onLightRestart();
    tick.updateThoughts(before, snapshot, inputs);
    tick.updateRecorder(dt, snapshot, inputs);
    tick.updateCompletion(dt, snapshot);
    const panelSnapshot = tick.diagnostics.createSelfTestSnapshot(tick.getPresentationSnapshot(snapshot));
    tick.statusScreen.setSnapshot(panelSnapshot);
    tick.statusScreen.setPowerFactor(tick.diagnostics.getBlackoutFactor());
    tick.statusScreen.update(dt);
    tick.controls.update(dt);
    tick.needles.forEach((needle) => {
      if (!tick.areNeedlesFrozen()) tick.gauges.update(needle, panelSnapshot, dt);
      tick.gauges.applyRotation(needle);
    });
    tick.lamps.forEach((lamp, index) => {
      lamp.material = tick.lampResolver.resolve(lamp, panelSnapshot, index);
      lamp.scale.copy(lamp.userData.initialScale);
    });
  }
}
