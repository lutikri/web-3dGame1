export class BriefInteractionRuntime {
  constructor({ interactive, getHoveredInteractive, openBriefingSheet, setHoldProgress = () => {}, onOpened = () => {} }) {
    this.interactive = interactive;
    this.getHoveredInteractive = getHoveredInteractive;
    this.openBriefingSheet = openBriefingSheet;
    this.setHoldProgress = setHoldProgress;
    this.onOpened = onOpened;
    this.activeTarget = null;
    this.elapsed = 0;
  }

  register(levelId, prefabConfig, runtime) {
    if (prefabConfig?.behavior !== "briefSheet") return false;
    const target = runtime?.briefSheet?.mesh;
    if (!target) return false;
    const config = prefabConfig.briefSheet ?? {};
    target.userData.kind = "briefSheet";
    target.userData.levelId = levelId;
    target.userData.maxInteractionDistance = config.maxDistance;
    target.userData.briefingLevelId = config.briefingLevelId ?? levelId;
    target.userData.briefingSheetIndex = config.sheetIndex ?? 0;
    target.userData.holdInteractionSeconds = config.holdSeconds ?? 0.5;
    this.interactive.push(target);
    return true;
  }

  begin(target) {
    if (target?.userData.kind !== "briefSheet") return false;
    this.activeTarget = target;
    this.elapsed = 0;
    this.setHoldProgress(0, true);
    return true;
  }

  release() {
    this.activeTarget = null;
    this.elapsed = 0;
    this.setHoldProgress(0, false);
  }

  update(dt) {
    const target = this.activeTarget;
    if (!target) return false;
    if (this.getHoveredInteractive() !== target) {
      this.release();
      return false;
    }
    this.elapsed += Math.max(0, Number(dt) || 0);
    const holdSeconds = Math.max(0.01, target.userData.holdInteractionSeconds ?? 0.5);
    this.setHoldProgress(Math.min(1, this.elapsed / holdSeconds), true);
    if (this.elapsed < holdSeconds) return false;
    const request = {
      levelId: target.userData.briefingLevelId,
      sheetIndex: target.userData.briefingSheetIndex,
    };
    this.activeTarget = null;
    this.elapsed = 0;
    const opened = this.openBriefingSheet?.(request);
    if (opened === false) this.release();
    else this.onOpened({ ...request, target });
    return true;
  }
}
