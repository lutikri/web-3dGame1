export class LevelRouteCoordinator {
  constructor(options) {
    Object.assign(this, options);
  }

  resetForMenu = async () => {
    this.sessions.reset({ clearSaved: true });
    this.setShiftProfile(null);
    this.resetLevelRuntime();
    this.resetShift();
    return this.enterMenuView();
  };

  enterLevel = async ({ levelId, mode, onProgress }) => {
    this.stopEditing();
    onProgress?.(8);
    const loadedLevelId = await this.loadEnvironment(levelId);
    if (loadedLevelId !== this.resolveEnvironmentId(levelId)) return false;
    onProgress?.(68);

    const config = this.getLevelConfig(levelId, loadedLevelId);
    this.setActiveRoute(levelId, mode);
    this.sessions.start({ levelId, config: config.session ?? {}, resume: false });
    this.setLevelView();
    this.resetDoors(levelId);
    this.activateEnvironment();
    onProgress?.(76);
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
    const warmupStarted = nowMilliseconds();
    await this.warmupRendering?.(loadedLevelId);
    console.info(`[RenderWarmup] ${loadedLevelId}: ${(nowMilliseconds() - warmupStarted).toFixed(1)}ms`);
    onProgress?.(94);
    if (config.narration?.autoStart !== false) this.scheduleNarration(levelId);
    onProgress?.(98);
    return true;
  };
}

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}
