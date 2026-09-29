const DEFAULT_SAMPLE_LIMIT = 240;

export class RenderPerformanceMonitor {
  #activeQuery = null;
  #pendingQueries = [];
  #cpuStartedAt = 0;
  #cpuSamples = [];
  #gpuSamples = [];
  #previousInfoAutoReset = null;
  #renderStats = { calls: 0, triangles: 0, points: 0, lines: 0 };

  constructor({ renderer, now = () => performance.now(), sampleLimit = DEFAULT_SAMPLE_LIMIT } = {}) {
    this.renderer = renderer;
    this.now = now;
    this.sampleLimit = Math.max(30, Number(sampleLimit) || DEFAULT_SAMPLE_LIMIT);
    this.gl = renderer?.getContext?.() ?? null;
    this.extension = this.gl?.getExtension?.("EXT_disjoint_timer_query_webgl2") ?? null;
  }

  beginFrame() {
    this.#pollGpuQueries();
    this.#cpuStartedAt = this.now();
    const info = this.renderer?.info;
    if (info) {
      this.#previousInfoAutoReset = info.autoReset;
      info.autoReset = false;
      info.reset?.();
    }
    if (!this.extension || this.#activeQuery || this.#pendingQueries.length >= 4) return;
    const query = this.gl.createQuery?.();
    if (!query) return;
    try {
      this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, query);
      this.#activeQuery = query;
    } catch {
      this.gl.deleteQuery?.(query);
      this.extension = null;
    }
  }

  endFrame() {
    if (this.#cpuStartedAt) this.#push(this.#cpuSamples, this.now() - this.#cpuStartedAt);
    this.#cpuStartedAt = 0;
    const info = this.renderer?.info;
    if (info) {
      this.#renderStats = readRenderStats(info.render);
      info.autoReset = this.#previousInfoAutoReset ?? true;
      this.#previousInfoAutoReset = null;
      info.reset?.();
    }
    if (!this.#activeQuery) return;
    try {
      this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
      this.#pendingQueries.push(this.#activeQuery);
    } catch {
      this.gl.deleteQuery?.(this.#activeQuery);
      this.extension = null;
    }
    this.#activeQuery = null;
  }

  reset() {
    this.#cpuSamples.length = 0;
    this.#gpuSamples.length = 0;
    this.#renderStats = { calls: 0, triangles: 0, points: 0, lines: 0 };
    this.#pendingQueries.forEach((query) => this.gl?.deleteQuery?.(query));
    this.#pendingQueries.length = 0;
  }

  snapshot() {
    this.#pollGpuQueries();
    return {
      cpu: summarizeDurations(this.#cpuSamples),
      gpu: {
        available: Boolean(this.extension),
        ...summarizeDurations(this.#gpuSamples),
      },
      render: { ...this.#renderStats },
    };
  }

  dispose() {
    if (this.#activeQuery) {
      try {
        this.gl?.endQuery?.(this.extension.TIME_ELAPSED_EXT);
      } catch {
        // The context may already be gone during shutdown.
      }
      this.gl?.deleteQuery?.(this.#activeQuery);
    }
    this.#pendingQueries.forEach((query) => this.gl?.deleteQuery?.(query));
    this.#activeQuery = null;
    this.#pendingQueries.length = 0;
    this.#cpuSamples.length = 0;
    this.#gpuSamples.length = 0;
  }

  #pollGpuQueries() {
    if (!this.extension || !this.#pendingQueries.length) return;
    const disjoint = Boolean(this.gl.getParameter?.(this.extension.GPU_DISJOINT_EXT));
    while (this.#pendingQueries.length) {
      const query = this.#pendingQueries[0];
      const available = this.gl.getQueryParameter?.(query, this.gl.QUERY_RESULT_AVAILABLE);
      if (!available) break;
      this.#pendingQueries.shift();
      if (!disjoint) {
        const nanoseconds = Number(this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) ?? 0);
        if (nanoseconds > 0) this.#push(this.#gpuSamples, nanoseconds / 1e6);
      }
      this.gl.deleteQuery?.(query);
    }
  }

  #push(target, value) {
    if (!Number.isFinite(value) || value < 0) return;
    target.push(value);
    if (target.length > this.sampleLimit) target.splice(0, target.length - this.sampleLimit);
  }
}

export function summarizeDurations(samples = []) {
  const sorted = samples.filter(Number.isFinite).sort((a, b) => a - b);
  const average = sorted.length
    ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length
    : 0;
  return {
    samples: sorted.length,
    avgMs: rounded(average),
    p50Ms: rounded(percentile(sorted, 0.5)),
    p95Ms: rounded(percentile(sorted, 0.95)),
    p99Ms: rounded(percentile(sorted, 0.99)),
    worstMs: rounded(sorted.at(-1) ?? 0),
  };
}

function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

function rounded(value) {
  return Number(Number(value ?? 0).toFixed(3));
}

function readRenderStats(render = {}) {
  return {
    calls: Number(render.calls ?? 0),
    triangles: Number(render.triangles ?? 0),
    points: Number(render.points ?? 0),
    lines: Number(render.lines ?? 0),
  };
}
