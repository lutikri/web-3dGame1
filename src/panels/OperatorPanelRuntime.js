export class OperatorPanelRuntime {
  constructor({ load, update, reset, applyLevel, hasModel }) {
    this.loadModel = load;
    this.updateModel = update;
    this.resetModel = reset;
    this.applyLevelModel = applyLevel;
    this.hasModel = hasModel;
  }

  load() {
    return this.loadModel();
  }

  update(dt) {
    if (this.hasModel()) this.updateModel(dt);
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
}
