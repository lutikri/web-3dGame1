import { LevelSession } from "./LevelSession.js?v=prototype-flow-1";

export class ActiveLevelSessionRuntime {
  constructor({ createSession = (options) => new LevelSession(options), onComplete = () => {} } = {}) {
    this.createSession = createSession;
    this.onComplete = onComplete;
    this.session = null;
    this.previousStatus = "idle";
  }

  start({ levelId, config = {}, resume = false }) {
    this.reset({ clearSaved: true });
    this.session = this.createSession({ levelId, config });
    const state = this.session.start({ resume });
    this.previousStatus = state.status;
    return state;
  }

  update(dt, context) {
    if (!this.session) return null;
    const state = this.session.update(dt, context);
    if (state.status !== this.previousStatus) {
      this.previousStatus = state.status;
      if (state.status === "complete") this.onComplete(state.levelId, state);
    }
    return state;
  }

  emit(type, detail = {}) {
    return this.session?.emit(type, detail) ?? null;
  }

  reset({ clearSaved = true } = {}) {
    const state = this.session?.reset({ clearSaved }) ?? null;
    this.session = null;
    this.previousStatus = "idle";
    return state;
  }

  snapshot() {
    return this.session?.snapshot() ?? null;
  }

  get config() {
    return this.session?.config ?? null;
  }
}
