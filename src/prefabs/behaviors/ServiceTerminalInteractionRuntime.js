import * as THREE from "three";

import {
  applyServiceTerminalHover,
  getServiceTerminalHit,
} from "./ServiceTerminalBehavior.js?v=shared-screen-focus";

const smoothstep = (value) => value * value * (3 - 2 * value);

export function createServiceTerminalInteractionRuntime({
  canvas,
  camera,
  pointer,
  raycaster,
  getLanguage = () => "en",
  onBriefViewed = () => {},
  onLanguageChange = () => {},
  exitPointerLock = () => globalThis.document?.exitPointerLock?.(),
  requestPointerLock = () => {},
  setPlayerEnabled = () => {},
  clearMovementInput = () => {},
  body = globalThis.document?.body,
  reentryCooldownSeconds = 3,
  now = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000,
} = {}) {
  let aimedRuntime = null;
  let focusedRuntime = null;
  let focusedRequest = null;
  let phase = "idle";
  let elapsed = 0;
  let transitionDuration = 0;
  const reportedBriefs = new Set();
  const savedPosition = new THREE.Vector3();
  const savedQuaternion = new THREE.Quaternion();
  const transitionStartPosition = new THREE.Vector3();
  const transitionStartQuaternion = new THREE.Quaternion();
  const transitionTargetPosition = new THREE.Vector3();
  const transitionTargetQuaternion = new THREE.Quaternion();
  let savedFov = 50;
  let transitionStartFov = 50;
  let transitionTargetFov = 50;
  let reentryAllowedAt = Number.NEGATIVE_INFINITY;

  function updateAimTarget(target) {
    if (focusedRuntime) {
      aimedRuntime = focusedRuntime;
      const hit = focusedRuntime.renderer
        ? getServiceTerminalHit(focusedRuntime, raycaster, camera, pointer)
        : null;
      const hover = focusedRuntime.renderer ? applyServiceTerminalHover(focusedRuntime, hit) : null;
      body?.classList?.toggle("screen-focus-action-hover", Boolean(hover));
      return hover;
    }
    const nextRuntime = target?.userData?.kind === "serviceTerminal"
      ? target.userData.serviceTerminalRuntime
      : null;
    if (aimedRuntime && aimedRuntime !== nextRuntime) applyServiceTerminalHover(aimedRuntime, null);
    aimedRuntime = nextRuntime;
    if (!aimedRuntime) return null;
    aimedRuntime.setLanguage(getLanguage());
    const hit = getServiceTerminalHit(
      aimedRuntime,
      raycaster,
      camera,
      pointer,
      target.userData.lastHitUv,
    );
    return applyServiceTerminalHover(aimedRuntime, hit);
  }

  function activate(target, request = {}) {
    const runtime = getFocusRuntime(target);
    if (!runtime || now() < reentryAllowedAt) return false;
    if (!focusedRuntime) return enterFocus(runtime, request);
    if (focusedRuntime !== runtime || phase !== "active") return focusedRuntime === runtime;
    if (!runtime.renderer) return true;
    runtime.setLanguage(getLanguage());
    const hit = getServiceTerminalHit(
      runtime,
      raycaster,
      camera,
      pointer,
      target.userData.lastHitUv,
    );
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

  function enterFocus(runtime, request) {
    if (!runtime?.viewSocket) return false;
    runtime.setLanguage?.(getLanguage());
    focusedRuntime = runtime;
    focusedRequest = request;
    savedPosition.copy(camera.position);
    savedQuaternion.copy(camera.quaternion);
    savedFov = camera.fov;
    transitionStartPosition.copy(camera.position);
    transitionStartQuaternion.copy(camera.quaternion);
    runtime.viewSocket.updateWorldMatrix(true, false);
    runtime.viewSocket.getWorldPosition(transitionTargetPosition);
    runtime.viewSocket.getWorldQuaternion(transitionTargetQuaternion);
    transitionStartFov = camera.fov;
    transitionTargetFov = runtime.focusFovDegrees;
    transitionDuration = Math.max(0.01, runtime.enterDurationSeconds);
    elapsed = 0;
    phase = "entering";
    clearMovementInput();
    setPlayerEnabled(false);
    exitPointerLock();
    body?.classList?.add("screen-focus");
    return true;
  }

  function beginExit({ restorePointerLock = true } = {}) {
    if (!focusedRuntime || phase === "exiting") return false;
    transitionStartPosition.copy(camera.position);
    transitionStartQuaternion.copy(camera.quaternion);
    transitionTargetPosition.copy(savedPosition);
    transitionTargetQuaternion.copy(savedQuaternion);
    transitionStartFov = camera.fov;
    transitionTargetFov = savedFov;
    transitionDuration = Math.max(0.01, focusedRuntime.exitDurationSeconds);
    elapsed = 0;
    phase = "exiting";
    body?.classList?.remove("screen-focus-action-hover");
    if (restorePointerLock) requestPointerLock();
    return true;
  }

  function update(dt = 0) {
    if (phase !== "entering" && phase !== "exiting") return;
    elapsed = Math.min(transitionDuration, elapsed + Math.max(0, dt));
    const alpha = smoothstep(Math.min(1, elapsed / transitionDuration));
    camera.position.lerpVectors(transitionStartPosition, transitionTargetPosition, alpha);
    camera.quaternion.slerpQuaternions(transitionStartQuaternion, transitionTargetQuaternion, alpha);
    camera.fov = THREE.MathUtils.lerp(transitionStartFov, transitionTargetFov, alpha);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    if (elapsed < transitionDuration) return;
    if (phase === "entering") {
      phase = "active";
      return;
    }
    finishExit();
  }

  function finishExit() {
    focusedRuntime && applyServiceTerminalHover(focusedRuntime, null);
    focusedRuntime = null;
    focusedRequest = null;
    aimedRuntime = null;
    phase = "idle";
    reentryAllowedAt = now() + Math.max(0, Number(reentryCooldownSeconds) || 0);
    body?.classList?.remove("screen-focus", "screen-focus-action-hover");
    clearMovementInput();
    setPlayerEnabled(true);
  }

  function handleWheel(event) {
    const runtime = aimedRuntime ?? focusedRuntime;
    if (!runtime?.renderer?.isDocumentOpen()) return false;
    const hit = getServiceTerminalHit(runtime, raycaster, camera, pointer);
    if (!hit) return false;
    return runtime.renderer.scroll(event.deltaY);
  }

  function handleKeyDown(event) {
    if (event.code !== "Escape" || !focusedRuntime) return false;
    focusedRuntime.renderer?.back?.();
    return beginExit({ restorePointerLock: true });
  }

  function handlePointerDown(event) {
    if (event?.button !== 2 || !focusedRuntime) return false;
    focusedRuntime.renderer?.back?.();
    return beginExit({ restorePointerLock: true });
  }

  function clearFocus({ restorePointerLock = false } = {}) {
    if (aimedRuntime) applyServiceTerminalHover(aimedRuntime, null);
    focusedRuntime?.renderer?.back?.();
    if (focusedRuntime) {
      camera.position.copy(savedPosition);
      camera.quaternion.copy(savedQuaternion);
      camera.fov = savedFov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    }
    aimedRuntime = null;
    focusedRuntime = null;
    focusedRequest = null;
    phase = "idle";
    body?.classList?.remove("screen-focus", "screen-focus-action-hover");
    clearMovementInput();
    setPlayerEnabled(true);
    if (restorePointerLock) requestPointerLock();
    return true;
  }

  function setLanguage(language) {
    const runtimes = new Set([aimedRuntime, focusedRuntime].filter(Boolean));
    let changed = false;
    runtimes.forEach((runtime) => { changed = runtime.setLanguage?.(language) || changed; });
    return changed;
  }

  return {
    activate,
    update,
    updateAimTarget,
    handleWheel,
    handleKeyDown,
    handlePointerDown,
    clearFocus,
    close: clearFocus,
    setLanguage,
    isActive: () => phase !== "idle",
    getPhase: () => phase,
    getFocusedRuntime: () => focusedRuntime,
    getFocusedRequest: () => focusedRequest,
    isCoolingDown: () => now() < reentryAllowedAt,
  };
}

function getFocusRuntime(target) {
  return target?.userData?.serviceTerminalRuntime ?? target?.userData?.screenFocusRuntime ?? null;
}
