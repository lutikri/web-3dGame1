import {
  applyServiceTerminalHover,
  getServiceTerminalHit,
} from "./ServiceTerminalBehavior.js?v=core-viewport-shutter";

export function createServiceTerminalInteractionRuntime({
  canvas,
  camera,
  pointer,
  raycaster,
  getLanguage = () => "en",
  onBriefViewed = () => {},
  onLanguageChange = () => {},
} = {}) {
  let aimedRuntime = null;
  let focusedRuntime = null;
  let focusedRequest = null;
  const reportedBriefs = new Set();

  function updateAimTarget(target) {
    const nextRuntime = target?.userData?.kind === "serviceTerminal"
      ? target.userData.serviceTerminalRuntime
      : null;
    if (aimedRuntime && aimedRuntime !== nextRuntime) applyServiceTerminalHover(aimedRuntime, null);
    aimedRuntime = nextRuntime;
    if (!aimedRuntime) return null;
    aimedRuntime.setLanguage(getLanguage());
    const hit = getServiceTerminalHit(aimedRuntime, raycaster, camera, pointer);
    return applyServiceTerminalHover(aimedRuntime, hit);
  }

  function activate(target, request = {}) {
    const runtime = target?.userData?.serviceTerminalRuntime;
    if (!runtime?.renderer) return false;
    runtime.setLanguage(getLanguage());
    const hit = getServiceTerminalHit(runtime, raycaster, camera, pointer);
    if (!hit) return false;
    focusedRuntime = runtime;
    focusedRequest = request;
    const result = runtime.renderer.activateAt(hit.pixel.x, hit.pixel.y);
    if (!result) return false;
    if (result.type === "language") onLanguageChange(result.language);
    const briefKey = `${request.levelId ?? ""}:${request.prefabName ?? ""}`;
    if (!reportedBriefs.has(briefKey)) {
      reportedBriefs.add(briefKey);
      onBriefViewed(request);
    }
    return true;
  }

  function handleWheel(event) {
    const runtime = aimedRuntime ?? focusedRuntime;
    if (!runtime?.renderer?.isDocumentOpen()) return false;
    const hit = getServiceTerminalHit(runtime, raycaster, camera, pointer);
    if (!hit) return false;
    return runtime.renderer.scroll(event.deltaY);
  }

  function handleKeyDown(event) {
    if (event.code !== "Escape" || !focusedRuntime?.renderer?.isDocumentOpen()) return false;
    return focusedRuntime.renderer.back();
  }

  function clearFocus() {
    if (aimedRuntime) applyServiceTerminalHover(aimedRuntime, null);
    focusedRuntime?.renderer?.back?.();
    aimedRuntime = null;
    focusedRuntime = null;
    focusedRequest = null;
    return true;
  }

  function setLanguage(language) {
    const runtimes = new Set([aimedRuntime, focusedRuntime].filter(Boolean));
    let changed = false;
    runtimes.forEach((runtime) => { changed = runtime.setLanguage(language) || changed; });
    return changed;
  }

  return {
    activate,
    updateAimTarget,
    handleWheel,
    handleKeyDown,
    clearFocus,
    close: clearFocus,
    setLanguage,
    isActive: () => false,
    getFocusedRuntime: () => focusedRuntime,
    getFocusedRequest: () => focusedRequest,
  };
}
