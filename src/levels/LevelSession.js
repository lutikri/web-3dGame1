export const LEVEL_SESSION_SCHEMA_VERSION = 1;

export class LevelSession {
  constructor({ levelId, config = {}, storage = globalThis.sessionStorage }) {
    if (!levelId) throw new TypeError("LevelSession requires a level id");
    this.levelId = levelId;
    this.config = config;
    this.storage = storage;
    this.storageKey = `operatorGame.levelSession.${levelId}.v${LEVEL_SESSION_SCHEMA_VERSION}`;
    this.persistInterval = Math.max(0.25, config.persistIntervalSeconds ?? 1);
    this.persistElapsed = 0;
    this.state = createInitialState(config);
  }

  start({ resume = true } = {}) {
    this.state = resume ? this.readSavedState() ?? createInitialState(this.config) : createInitialState(this.config);
    this.state.status = "running";
    this.persist();
    return this.snapshot();
  }

  update(dt, context = {}) {
    if (this.state.status !== "running") return this.snapshot();
    this.state.elapsedSeconds += dt;
    if (context.shiftMode === "running") this.state.activeShiftSeconds += dt;
    if (Number.isFinite(context.shiftElapsed)) {
      this.state.activeShiftSeconds = Math.max(this.state.activeShiftSeconds, context.shiftElapsed);
    }
    for (const objective of this.config.objectives ?? []) {
      const state = this.state.objectives[objective.id];
      if (!state || state.complete) continue;
      if (objective.type === "survive") {
        state.progress = this.state.activeShiftSeconds;
        state.complete = state.progress >= objective.seconds;
      } else if (objective.type === "shiftComplete") {
        state.complete = context.shiftMode === "complete";
      }
    }
    this.updateCompletion();
    this.persistElapsed += dt;
    if (this.persistElapsed >= this.persistInterval) {
      if (typeof context.createCheckpoint === "function") {
        this.setCheckpoint("runtime", context.createCheckpoint());
      }
      this.persist();
    }
    return this.snapshot();
  }

  emit(type, detail = {}) {
    if (this.state.status !== "running") return this.snapshot();
    this.state.events[type] = (this.state.events[type] ?? 0) + 1;
    for (const objective of this.config.objectives ?? []) {
      const state = this.state.objectives[objective.id];
      if (!state || state.complete) continue;
      if (objective.type === "event" && objective.event === type) {
        const matchesTarget = !objective.target || objective.target === detail.target;
        if (matchesTarget) {
          state.progress = (state.progress ?? 0) + 1;
          state.complete = state.progress >= (objective.count ?? 1);
        }
      }
    }
    this.updateCompletion();
    this.persist();
    return this.snapshot();
  }

  bindingsFor(source, event = "press") {
    return (this.config.bindings ?? []).filter(
      (binding) => binding.source === source && (binding.event ?? "press") === event,
    );
  }

  setCheckpoint(key, value) {
    if (this.state.status === "running") this.state.checkpoints[key] = structuredClone(value);
  }

  getCheckpoint(key) {
    const value = this.state.checkpoints[key];
    return value == null ? null : structuredClone(value);
  }

  reset({ clearSaved = true } = {}) {
    this.state = createInitialState(this.config);
    if (clearSaved) this.storage?.removeItem?.(this.storageKey);
    return this.snapshot();
  }

  finish() {
    this.state.status = "finished";
    this.persist();
    return this.snapshot();
  }

  snapshot() {
    return structuredClone({
      schemaVersion: LEVEL_SESSION_SCHEMA_VERSION,
      levelId: this.levelId,
      ...this.state,
    });
  }

  updateCompletion() {
    const objectives = Object.values(this.state.objectives);
    if (objectives.length === 0) return;
    const complete =
      this.config.completion === "any"
        ? objectives.some((objective) => objective.complete)
        : objectives.every((objective) => objective.complete);
    if (complete) this.state.status = "complete";
  }

  persist() {
    this.persistElapsed = 0;
    this.storage?.setItem?.(this.storageKey, JSON.stringify(this.snapshot()));
  }

  readSavedState() {
    try {
      const saved = JSON.parse(this.storage?.getItem?.(this.storageKey) ?? "null");
      if (
        !saved ||
        saved.schemaVersion !== LEVEL_SESSION_SCHEMA_VERSION ||
        saved.levelId !== this.levelId
      ) {
        return null;
      }
      const initial = createInitialState(this.config);
      return {
        ...initial,
        status: saved.status === "complete" ? "complete" : "running",
        elapsedSeconds: Number(saved.elapsedSeconds) || 0,
        activeShiftSeconds: Number(saved.activeShiftSeconds) || 0,
        events: { ...initial.events, ...saved.events },
        checkpoints: { ...initial.checkpoints, ...saved.checkpoints },
        objectives: Object.fromEntries(
          Object.entries(initial.objectives).map(([id, objective]) => [
            id,
            { ...objective, ...(saved.objectives?.[id] ?? {}) },
          ]),
        ),
      };
    } catch {
      return null;
    }
  }
}

function createInitialState(config) {
  return {
    status: "idle",
    elapsedSeconds: 0,
    activeShiftSeconds: 0,
    events: {},
    checkpoints: {},
    objectives: Object.fromEntries(
      (config.objectives ?? []).map((objective) => [
        objective.id,
        { complete: false, progress: 0 },
      ]),
    ),
  };
}
