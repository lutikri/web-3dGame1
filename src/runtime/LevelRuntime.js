export class LevelRuntime {
  constructor(levelId) {
    if (!levelId) throw new TypeError("LevelRuntime requires a level id");
    this.levelId = levelId;
    this.state = "loading";
    this.disposers = [];
    this.disposePromise = null;
  }

  defer(disposer) {
    if (typeof disposer !== "function") throw new TypeError("Runtime disposer must be a function");
    if (this.state === "disposing" || this.state === "disposed") {
      throw new Error(`Cannot register resources on disposed runtime "${this.levelId}"`);
    }
    this.disposers.push(disposer);
    return disposer;
  }

  activate() {
    if (this.state !== "loading") throw new Error(`Cannot activate runtime in state "${this.state}"`);
    this.state = "active";
    return this;
  }

  dispose() {
    if (this.disposePromise) return this.disposePromise;
    this.state = "disposing";
    this.disposePromise = this.disposeAll();
    return this.disposePromise;
  }

  async disposeAll() {
    const errors = [];
    while (this.disposers.length > 0) {
      const disposer = this.disposers.pop();
      try {
        await disposer();
      } catch (error) {
        errors.push(error);
      }
    }
    this.state = "disposed";
    if (errors.length > 0) {
      throw new AggregateError(errors, `Failed to fully dispose level runtime "${this.levelId}"`);
    }
  }
}
