export class LevelRouteCoordinator {
  constructor(options) {
    Object.assign(this, options);
    this.setTimeoutFn ??= globalThis.setTimeout.bind(globalThis);
    this.clearTimeoutFn ??= globalThis.clearTimeout.bind(globalThis);
  }

  resetForMenu = async () => {
    this.sessions.reset({ clearSaved: true });
    this.setShiftProfile(null);
    this.resetLevelRuntime();
    this.resetShift();
    return this.enterMenuView();
  };

  enterLevel = async ({ levelId, mode, onProgress }) => {
    const reportProgress = createMonotonicProgressReporter(onProgress);
    this.stopEditing();
    reportProgress(8);
    const loadedLevelId = await this.loadEnvironment(levelId, {
      onProgress: (value) => reportProgress(mapProgress(value, 8, 68)),
    });
    if (loadedLevelId !== this.resolveEnvironmentId(levelId)) return false;
    reportProgress(68);

    const config = this.getLevelConfig(levelId, loadedLevelId);
    this.setActiveRoute(levelId, mode);
    this.sessions.start({ levelId, config: config.session ?? {}, resume: false });
    this.setLevelView();
    this.resetDoors(levelId);
    this.activateEnvironment();
    reportProgress(76);
    this.restartPrefabLights(loadedLevelId);
    this.setRoomLights(true, { instant: false });
    this.resetDiagnostics({ levelId, config });
    this.resetFuelBlend({ config });
    this.setShiftProfile(config.shiftProfile ?? null);
    this.resetLevelRuntime();
    this.resetRecorder();
    this.resetThoughts?.();
    this.resetCore();
    this.stopFuelBlend();
    const snapshot = this.getCoreSnapshot();
    this.resetCompletion(snapshot.mode);
    this.updateStatus(snapshot, true);
    const warmupPromise = this.warmupRendering?.({
      onProgress: (value) => reportProgress(mapProgress(value, 76, 94)),
    });
    const warmupTiming = await trackEstimatedProgress(warmupPromise, {
      reportProgress,
      setTimeoutFn: this.setTimeoutFn,
      clearTimeoutFn: this.clearTimeoutFn,
    });
    console.info(formatWarmupTiming(loadedLevelId, warmupTiming));
    reportProgress(94);
    if (config.narration?.autoStart !== false) this.scheduleNarration(levelId);
    reportProgress(98);
    return true;
  };
}

function createMonotonicProgressReporter(onProgress) {
  let latest = -Infinity;
  return (value) => {
    const next = Math.max(0, Math.min(100, Number(value) || 0));
    if (next <= latest) return;
    latest = next;
    onProgress?.(next);
  };
}

function mapProgress(value, start, end) {
  const ratio = Math.max(0, Math.min(1, Number(value) || 0));
  return start + (end - start) * ratio;
}

async function trackEstimatedProgress(promise, {
  reportProgress,
  setTimeoutFn,
  clearTimeoutFn,
  intervalMs = 120,
  timeConstantMs = 3500,
} = {}) {
  if (!promise || typeof promise.then !== "function") return promise;
  const startedAt = nowMilliseconds();
  let timer = null;
  let complete = false;
  const tick = () => {
    if (complete) return;
    const elapsed = nowMilliseconds() - startedAt;
    const estimatedRatio = 0.72 * (1 - Math.exp(-elapsed / timeConstantMs));
    reportProgress(mapProgress(estimatedRatio, 76, 94));
    timer = setTimeoutFn(tick, intervalMs);
  };
  timer = setTimeoutFn(tick, intervalMs);
  try {
    return await promise;
  } finally {
    complete = true;
    if (timer !== null) clearTimeoutFn(timer);
  }
}

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function formatWarmupTiming(levelId, timing = {}) {
  return `[RenderWarmup] ${levelId}: total=${(timing?.totalMs ?? 0).toFixed(1)}ms`
    + ` prepare=${(timing?.prepareMs ?? 0).toFixed(1)}ms`
    + ` shaderCompile=${(timing?.shaderCompileMs ?? 0).toFixed(1)}ms`
    + ` visibilityWait=${(timing?.visibilityWaitMs ?? 0).toFixed(1)}ms`
    + ` settle=${(timing?.settleMs ?? 0).toFixed(1)}ms`
    + ` gpuWait=${(timing?.gpuWaitMs ?? 0).toFixed(1)}ms`
    + ` frames=${timing?.frameCount ?? 0}`;
}
