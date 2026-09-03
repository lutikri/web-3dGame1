export class RenderWarmupRuntime {
  constructor({
    renderer,
    scene,
    camera,
    prepare,
    renderFrame,
    acquireForegroundLease = () => () => {},
    documentRef = document,
    setTimeoutFn = window.setTimeout.bind(window),
    requestAnimationFrameFn = window.requestAnimationFrame.bind(window),
    minimumSettleFrames = 8,
    settleDurationMs = 500,
    settleDelayMs = 16,
    gpuTimeoutMs = 2500,
  }) {
    Object.assign(this, {
      renderer,
      scene,
      camera,
      prepare,
      renderFrame,
      acquireForegroundLease,
      documentRef,
      setTimeoutFn,
      requestAnimationFrameFn,
      minimumSettleFrames,
      settleDurationMs,
      settleDelayMs,
      gpuTimeoutMs,
    });
  }

  warmup = async ({ onProgress } = {}) => {
    const totalStarted = nowMilliseconds();
    const releaseForegroundLease = this.acquireForegroundLease?.() ?? (() => {});
    try {
      reportProgress(onProgress, 0);
      const prepareStarted = nowMilliseconds();
      await this.prepare?.();
      this.scene?.updateMatrixWorld?.(true);
      this.camera?.updateMatrixWorld?.(true);
      const prepareMs = nowMilliseconds() - prepareStarted;
      reportProgress(onProgress, 0.05);
      const shaderCompileStarted = nowMilliseconds();
      if (typeof this.renderer?.compileAsync === "function") {
        await this.renderer.compileAsync(this.scene, this.camera);
      } else {
        this.renderer?.compile?.(this.scene, this.camera);
      }
      const shaderCompileMs = nowMilliseconds() - shaderCompileStarted;
      reportProgress(onProgress, 0.75);

      const visibilityWaitStarted = nowMilliseconds();
      await this.#waitUntilVisible();
      const visibilityWaitMs = nowMilliseconds() - visibilityWaitStarted;
      reportProgress(onProgress, 0.78);
      const settleStarted = nowMilliseconds();
      const startedAt = await this.#nextFrame();
      let previousFrameAt = startedAt;
      let frameCount = 0;
      let gpuWaitMs = 0;
      while (frameCount < this.minimumSettleFrames || previousFrameAt - startedAt < this.settleDurationMs) {
        const frameAt = await this.#nextFrame();
        const dt = Math.max(1 / 240, Math.min(0.1, (frameAt - previousFrameAt) / 1000));
        this.renderFrame?.(dt);
        gpuWaitMs += await this.#waitForGpu();
        previousFrameAt = frameAt;
        frameCount += 1;
        const frameProgress = Math.min(1, frameCount / this.minimumSettleFrames);
        const timeProgress = Math.min(1, (previousFrameAt - startedAt) / this.settleDurationMs);
        reportProgress(onProgress, 0.78 + 0.22 * Math.min(frameProgress, timeProgress));
      }
      reportProgress(onProgress, 1);
      return {
        totalMs: nowMilliseconds() - totalStarted,
        prepareMs,
        shaderCompileMs,
        visibilityWaitMs,
        settleMs: nowMilliseconds() - settleStarted,
        gpuWaitMs,
        frameCount,
      };
    } finally {
      releaseForegroundLease();
    }
  };

  #waitUntilVisible() {
    if (!this.documentRef?.hidden) return Promise.resolve();
    return new Promise((resolve) => {
      const handleVisibility = () => {
        if (this.documentRef.hidden) return;
        this.documentRef.removeEventListener("visibilitychange", handleVisibility);
        resolve();
      };
      this.documentRef.addEventListener("visibilitychange", handleVisibility);
    });
  }

  async #waitForGpu() {
    const gl = this.renderer?.getContext?.();
    if (!gl?.fenceSync || !gl?.clientWaitSync || !gl?.deleteSync) {
      const startedAt = nowMilliseconds();
      await this.#delay(this.settleDelayMs);
      return nowMilliseconds() - startedAt;
    }

    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) return 0;
    gl.flush?.();
    const startedAt = nowMilliseconds();
    try {
      while (nowMilliseconds() - startedAt < this.gpuTimeoutMs) {
        const status = gl.clientWaitSync(sync, 0, 0);
        if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) break;
        if (status === gl.WAIT_FAILED) break;
        await this.#delay(8);
      }
      return nowMilliseconds() - startedAt;
    } finally {
      gl.deleteSync(sync);
    }
  }

  #delay(ms) {
    return new Promise((resolve) => this.setTimeoutFn(resolve, ms));
  }

  #nextFrame() {
    return new Promise((resolve) => this.requestAnimationFrameFn(resolve));
  }
}

function reportProgress(onProgress, value) {
  onProgress?.(Math.max(0, Math.min(1, value)));
}

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}
