import { getGraphicsQualityProfile, resolveGraphicsPixelRatio } from "../config/GraphicsQualityProfiles.js?v=drawer-flashlight-audio";

export class AdaptiveQualityRuntime {
  constructor({
    applyPixelRatio,
    getViewport = () => ({ width: window.innerWidth, height: window.innerHeight }),
    shouldSample = () => !document.hidden && document.hasFocus(),
    now = () => globalThis.performance?.now?.() ?? Date.now(),
    settleDurationMs = 3000,
    sampleWindowMs = 1000,
    lowFpsThreshold = 48,
    lowConfirmWindows = 2,
    criticalFpsThreshold = 32,
    criticalConfirmWindows = 3,
  }) {
    Object.assign(this, {
      applyPixelRatio,
      getViewport,
      shouldSample,
      now,
      settleDurationMs,
      sampleWindowMs,
      lowFpsThreshold,
      lowConfirmWindows,
      criticalFpsThreshold,
      criticalConfirmWindows,
    });
    this.profile = "low";
    this.quality = getGraphicsQualityProfile("low");
    this.degraded = false;
    this.lowRecommended = false;
    this.pixelRatio = this.#resolvePixelRatio();
    this.lastFps = 0;
    this.lowWindows = 0;
    this.criticalWindows = 0;
    this.sampleAllowedAt = 0;
    this.windowStartedAt = null;
    this.frameCount = 0;
  }

  configure = (profile = "low") => {
    this.profile = ["low", "medium", "high"].includes(profile) ? profile : "low";
    this.quality = getGraphicsQualityProfile(this.profile);
    this.degraded = false;
    this.lowRecommended = false;
    this.lastFps = 0;
    this.#resetSampling(this.now(), true);
    this.#applyResolvedRatio();
    return this.profile;
  };

  update = () => {
    const timestamp = this.now();
    if (!this.shouldSample() || this.quality.adaptivePixelRatioFactor >= 1) {
      this.#resetSampling(timestamp, false);
      return;
    }
    if (timestamp < this.sampleAllowedAt) {
      this.windowStartedAt = timestamp;
      this.frameCount = 0;
      return;
    }
    if (this.windowStartedAt == null) this.windowStartedAt = timestamp;
    this.frameCount += 1;
    const elapsed = timestamp - this.windowStartedAt;
    if (elapsed < this.sampleWindowMs) return;

    this.lastFps = this.frameCount * 1000 / Math.max(1, elapsed);
    this.windowStartedAt = timestamp;
    this.frameCount = 0;
    if (!this.degraded) {
      this.lowWindows = this.lastFps < this.lowFpsThreshold ? this.lowWindows + 1 : 0;
      if (this.lowWindows >= this.lowConfirmWindows) {
        this.degraded = true;
        this.lowWindows = 0;
        this.#resetSampling(timestamp, true);
        this.#applyResolvedRatio();
      }
      return;
    }

    this.criticalWindows = this.lastFps < this.criticalFpsThreshold ? this.criticalWindows + 1 : 0;
    if (this.criticalWindows >= this.criticalConfirmWindows) this.lowRecommended = true;
  };

  resize = () => this.#applyResolvedRatio();

  snapshot = () => ({
    profile: this.profile,
    pixelRatio: Number(this.pixelRatio.toFixed(3)),
    degraded: this.degraded,
    lastFps: Number(this.lastFps.toFixed(1)),
    lowRecommended: this.lowRecommended,
  });

  #resolvePixelRatio() {
    const viewport = this.getViewport();
    return resolveGraphicsPixelRatio(this.quality, viewport.width, viewport.height, this.degraded);
  }

  #applyResolvedRatio() {
    const nextRatio = this.#resolvePixelRatio();
    if (Math.abs(nextRatio - this.pixelRatio) < 0.001) return false;
    this.pixelRatio = nextRatio;
    this.applyPixelRatio?.(nextRatio);
    return true;
  }

  #resetSampling(timestamp, settle) {
    this.windowStartedAt = timestamp;
    this.frameCount = 0;
    this.lowWindows = 0;
    this.criticalWindows = 0;
    if (settle) this.sampleAllowedAt = timestamp + this.settleDurationMs;
  }
}
