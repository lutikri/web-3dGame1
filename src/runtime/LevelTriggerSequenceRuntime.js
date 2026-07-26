import * as THREE from "three";

export class LevelTriggerSequenceRuntime {
  constructor({ environmentModels, prefabInstances, getActiveLevelId, resolveEnvironmentId = (id) => id,
    getLevelConfig, getPlayerPosition, isLevelView, playNarration, requestBarrierUnlock,
    emitEvent = () => {},
    setTimeoutFn = (callback, ms) => window.setTimeout(callback, ms),
    clearTimeoutFn = (timer) => window.clearTimeout(timer) }) {
    Object.assign(this, { environmentModels, prefabInstances, getActiveLevelId, resolveEnvironmentId,
      getLevelConfig, getPlayerPosition, isLevelView, playNarration, requestBarrierUnlock,
      emitEvent, setTimeoutFn, clearTimeoutFn });
    this.levelId = null;
    this.triggerStates = new Map();
    this.timers = new Set();
    this.box = new THREE.Box3();
  }

  update = () => {
    const levelId = this.getActiveLevelId();
    if (levelId !== this.levelId) this.#activateLevel(levelId);
    if (!this.isLevelView() || !levelId) return;
    const environmentId = this.resolveEnvironmentId(levelId);
    const root = this.environmentModels.get(environmentId);
    const playerPosition = this.getPlayerPosition();
    if (!root || !playerPosition) return;
    const levelConfig = this.getLevelConfig(levelId);
    for (const sequence of levelConfig?.triggerSequences ?? []) {
      const markerName = sequence.trigger?.markerName;
      if (!markerName) continue;
      let state = this.triggerStates.get(markerName);
      if (!state) {
        const marker = root.getObjectByName(markerName);
        if (!marker) continue;
        state = { marker, inside: false, fired: false };
        this.triggerStates.set(markerName, state);
      }
      state.marker.updateWorldMatrix(true, true);
      this.box.setFromObject(state.marker);
      const inside = this.box.containsPoint(playerPosition);
      const entered = inside && !state.inside;
      state.inside = inside;
      const repeatable = levelConfig?.repeatableTriggerSequences?.includes(sequence.name);
      if (!entered || (!repeatable && sequence.trigger?.once !== false && state.fired)) continue;
      state.fired = true;
      this.emitEvent("triggerEntered", { target: sequence.name ?? markerName, markerName });
      void this.#runSequence(levelId, sequence);
    }
  };

  reset = () => {
    this.timers.forEach(this.clearTimeoutFn);
    this.timers.clear();
    this.triggerStates.clear();
    this.levelId = null;
  };

  async #runSequence(levelId, sequence) {
    const narration = sequence.narration ? await this.playNarration(levelId, sequence.narration) : null;
    if (this.getActiveLevelId() !== levelId) return;
    if (sequence.narration && !narration) {
      console.warn(`[LevelSequence] Narration "${sequence.narration}" was unavailable for "${levelId}"`);
      return;
    }
    for (const action of sequence.actions ?? []) {
      const delaySeconds = action.relativeTo === "narrationEnd"
        ? Math.max(0, Number(narration?.duration ?? 0) + Number(action.offsetSeconds ?? 0))
        : Math.max(0, Number(action.delaySeconds ?? 0));
      this.#schedule(levelId, () => this.#executeAction(levelId, action), delaySeconds);
    }
  }

  #executeAction(levelId, action) {
    if (action.action !== "unlockBarrierGate") return;
    const environmentId = this.resolveEnvironmentId(levelId);
    const runtime = this.prefabInstances.get(`${environmentId}:${action.target}`);
    this.requestBarrierUnlock(runtime?.barrierGate);
  }

  #schedule(levelId, callback, seconds) {
    const timer = this.setTimeoutFn(() => {
      this.timers.delete(timer);
      if (this.getActiveLevelId() === levelId) callback();
    }, seconds * 1000);
    this.timers.add(timer);
  }

  #activateLevel(levelId) {
    this.timers.forEach(this.clearTimeoutFn);
    this.timers.clear();
    this.triggerStates.clear();
    this.levelId = levelId;
  }
}
