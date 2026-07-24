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

  warmup = async () => {
    const releaseForegroundLease = this.acquireForegroundLease?.() ?? (() => {});
    try {
      await this.prepare?.();
      this.scene?.updateMatrixWorld?.(true);
      this.camera?.updateMatrixWorld?.(true);
      if (typeof this.renderer?.compileAsync === "function") {
        await this.renderer.compileAsync(this.scene, this.camera);
      } else {
        this.renderer?.compile?.(this.scene, this.camera);
      }

      await this.#waitUntilVisible();
      const startedAt = await this.#nextFrame();
      let previousFrameAt = startedAt;
      let frameCount = 0;
      while (frameCount < this.minimumSettleFrames || previousFrameAt - startedAt < this.settleDurationMs) {
        const frameAt = await this.#nextFrame();
        const dt = Math.max(1 / 240, Math.min(0.1, (frameAt - previousFrameAt) / 1000));
        this.renderFrame?.(dt);
        await this.#waitForGpu();
        previousFrameAt = frameAt;
        frameCount += 1;
      }
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
      await this.#delay(this.settleDelayMs);
      return;
    }

    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) return;
    gl.flush?.();
    const startedAt = nowMilliseconds();
    try {
      while (nowMilliseconds() - startedAt < this.gpuTimeoutMs) {
        const status = gl.clientWaitSync(sync, 0, 0);
        if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) return;
        if (status === gl.WAIT_FAILED) return;
        await this.#delay(8);
      }
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

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}
