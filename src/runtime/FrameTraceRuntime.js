const DEFAULT_STORAGE_KEY = "operatorGame.frameTrace.v1";

export class FrameTraceRuntime {
  constructor({
    now = () => performance.now(),
    getContext = () => ({}),
    storage = globalThis.localStorage,
    storageKey = DEFAULT_STORAGE_KEY,
    log = console.info,
    onComplete = null,
  } = {}) {
    this.now = now;
    this.getContext = getContext;
    this.storage = storage;
    this.storageKey = storageKey;
    this.log = log;
    this.onComplete = onComplete;
    this.active = false;
    this.lastTrace = this.#readStoredTrace();
  }

  start({ durationSeconds = 60, spikeThresholdMs = 18, warmupSeconds = 3 } = {}) {
    const durationMs = clamp(Number(durationSeconds) * 1000, 5000, 300000);
    const warmupMs = clamp(Number(warmupSeconds) * 1000, 0, 10000);
    this.active = true;
    this.startedAt = this.now();
    this.captureStartsAt = this.startedAt + warmupMs;
    this.durationMs = durationMs;
    this.spikeThresholdMs = clamp(Number(spikeThresholdMs), 8, 100);
    this.frameTimes = [];
    this.spikes = [];
    this.previousFrame = null;
    this.currentFrame = null;
    this.lastSpikeAt = null;
    this.lastTrace = null;
    const status = this.status();
    this.log?.(`[FrameTrace] Recording starts in ${Math.round(warmupMs / 1000)}s for ${Math.round(durationMs / 1000)}s; spike >= ${this.spikeThresholdMs}ms`);
    return status;
  }

  beginFrame({ deltaSeconds = 0, paused = false } = {}) {
    if (!this.active) return false;
    const frameMs = Math.max(0, Number(deltaSeconds) || 0) * 1000;
    if (this.previousFrame && frameMs > 0) this.#commitPreviousFrame(frameMs);
    if (!this.active) return false;
    this.currentFrame = {
      startedAt: this.now(),
      paused: Boolean(paused),
      steps: [],
    };
    return true;
  }

  measureStep(label, callback) {
    if (!this.active || !this.currentFrame) return callback();
    const startedAt = this.now();
    try {
      return callback();
    } finally {
      this.currentFrame.steps.push({
        label: String(label || "anonymous"),
        ms: round(this.now() - startedAt),
      });
    }
  }

  endFrame() {
    if (!this.active || !this.currentFrame) return;
    this.currentFrame.cpuMs = round(this.now() - this.currentFrame.startedAt);
    this.currentFrame.steps.sort((left, right) => right.ms - left.ms);
    this.previousFrame = this.currentFrame;
    this.currentFrame = null;
  }

  stop(reason = "manual") {
    if (!this.active) return this.lastTrace;
    this.active = false;
    const endedAt = this.now();
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    this.lastTrace = {
      version: 1,
      reason,
      startedAt: new Date(Date.now() - Math.max(0, endedAt - this.captureStartsAt)).toISOString(),
      durationMs: round(Math.max(0, endedAt - this.captureStartsAt)),
      spikeThresholdMs: this.spikeThresholdMs,
      frames: sorted.length,
      frameTime: summarize(sorted),
      spikes: this.spikes,
    };
    this.#storeTrace(this.lastTrace);
    this.onComplete?.(this.lastTrace);
    this.log?.(`[FrameTrace] ${reason}; ${this.lastTrace.frames} frames, ${this.spikes.length} spikes`, this.lastTrace);
    this.currentFrame = null;
    this.previousFrame = null;
    return this.lastTrace;
  }

  status() {
    return {
      active: this.active,
      elapsedSeconds: this.active ? round(Math.max(0, this.now() - this.captureStartsAt) / 1000) : 0,
      durationSeconds: this.active ? round(this.durationMs / 1000) : 0,
      frames: this.frameTimes?.length ?? this.lastTrace?.frames ?? 0,
      spikes: this.spikes?.length ?? this.lastTrace?.spikes?.length ?? 0,
      storageKey: this.storageKey,
    };
  }

  getLastTrace() {
    return this.lastTrace ?? this.#readStoredTrace();
  }

  #commitPreviousFrame(frameMs) {
    if (this.now() < this.captureStartsAt) return;
    this.frameTimes.push(round(frameMs));
    const elapsedMs = this.now() - this.captureStartsAt;
    if (frameMs >= this.spikeThresholdMs) {
      const context = safeContext(this.getContext);
      this.spikes.push({
        atMs: round(elapsedMs),
        sincePreviousSpikeMs: this.lastSpikeAt == null ? null : round(elapsedMs - this.lastSpikeAt),
        frameMs: round(frameMs),
        cpuMs: this.previousFrame.cpuMs,
        paused: this.previousFrame.paused,
        topSteps: this.previousFrame.steps.slice(0, 6),
        context,
      });
      this.lastSpikeAt = elapsedMs;
    }
    if (elapsedMs >= this.durationMs) this.stop("duration-complete");
  }

  #storeTrace(trace) {
    try {
      this.storage?.setItem?.(this.storageKey, JSON.stringify(trace));
    } catch {
      // Diagnostics must never disturb gameplay when storage is unavailable.
    }
  }

  #readStoredTrace() {
    try {
      const value = this.storage?.getItem?.(this.storageKey);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }
}

export function getFrameTraceStepLabel(step, index, paused = false) {
  return step?.frameTraceLabel || step?.name || `${paused ? "paused" : "step"}-${index + 1}`;
}

function summarize(sorted) {
  const average = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0;
  return {
    averageMs: round(average),
    p50Ms: round(percentile(sorted, 0.5)),
    p95Ms: round(percentile(sorted, 0.95)),
    p99Ms: round(percentile(sorted, 0.99)),
    worstMs: round(sorted.at(-1) ?? 0),
  };
}

function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

function safeContext(getContext) {
  try {
    return getContext?.() ?? {};
  } catch (error) {
    return { error: error?.message ?? String(error) };
  }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : minimum));
}

function round(value) {
  return Number(Number(value ?? 0).toFixed(3));
}
