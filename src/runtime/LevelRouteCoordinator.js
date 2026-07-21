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

  enterLevel = async ({ levelId, mode }) => {
    this.stopEditing();
    const loadedLevelId = await this.loadEnvironment(levelId);
    if (loadedLevelId !== this.resolveEnvironmentId(levelId)) return false;

    const config = this.getLevelConfig(levelId, loadedLevelId);
    this.setActiveRoute(levelId, mode);
    this.sessions.start({ levelId, config: config.session ?? {}, resume: false });
    this.setLevelView();
    this.resetDoors(levelId);
    this.activateEnvironment();
    this.restartPrefabLights(loadedLevelId);
    this.setRoomLights(true, { instant: false });
    this.resetDiagnostics({ levelId, config });
    this.resetFuelBlend({ config });
    this.setShiftProfile(config.shiftProfile ?? null);
    this.resetLevelRuntime();
    this.resetRecorder();
    this.resetCore();
    this.stopFuelBlend();
    const snapshot = this.getCoreSnapshot();
    this.resetCompletion(snapshot.mode);
    this.updateStatus(snapshot, true);
    this.scheduleNarration(levelId);
    return true;
  };
}
