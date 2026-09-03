export class LevelRuntimeManager {
  constructor({ load, dispose }) {
    if (typeof load !== "function" || typeof dispose !== "function") {
      throw new TypeError("LevelRuntimeManager requires load and dispose functions");
    }
    this.loadRuntime = load;
    this.disposeRuntime = dispose;
    this.current = null;
    this.status = "idle";
    this.latestRequestId = 0;
    this.transitionTail = Promise.resolve();
  }

  request(levelId, context) {
    if (!levelId) return Promise.reject(new TypeError("A level id is required"));
    const requestId = ++this.latestRequestId;
    const transition = async () => {
      if (requestId !== this.latestRequestId) return this.snapshot("superseded");
      if (this.current?.levelId === levelId) return this.snapshot("unchanged");
      this.status = "transitioning";
      if (this.current) {
        const previous = this.current;
        this.current = null;
        await this.disposeRuntime(previous);
      }
      if (requestId !== this.latestRequestId) return this.snapshot("superseded");

      const runtime = await this.loadRuntime(levelId, context);
      if (!runtime || runtime.levelId !== levelId) {
        if (runtime) await this.disposeRuntime(runtime);
        throw new Error(`Invalid runtime returned for level "${levelId}"`);
      }
      if (requestId !== this.latestRequestId) {
        await this.disposeRuntime(runtime);
        return this.snapshot("superseded");
      }
      this.current = runtime;
      this.status = "idle";
      return this.snapshot("loaded");
    };

    const result = this.transitionTail.then(transition, transition).catch((error) => {
      this.status = "idle";
      throw error;
    });
    this.transitionTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async dispose() {
    ++this.latestRequestId;
    await this.transitionTail;
    if (!this.current) {
      this.status = "idle";
      return;
    }
    const runtime = this.current;
    this.current = null;
    await this.disposeRuntime(runtime);
    this.status = "idle";
  }

  snapshot(status = this.status) {
    return {
      status,
      levelId: this.current?.levelId ?? null,
      runtime: this.current,
      requestId: this.latestRequestId,
    };
  }
}
