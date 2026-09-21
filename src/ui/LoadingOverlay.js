import * as THREE from "three";

const LOADING_STAGE_WIDTH = 1920;
const LOADING_STAGE_HEIGHT = 1080;
export const BOOT_BACKGROUND_URLS = Object.freeze([
  "./assets/ui/boot-backgrounds/site-12-01.webp",
  "./assets/ui/boot-backgrounds/site-12-02.webp",
  "./assets/ui/boot-backgrounds/site-12-03.webp",
  "./assets/ui/boot-backgrounds/site-12-04.webp",
]);

export function pickBootBackground(backgrounds = BOOT_BACKGROUND_URLS, random = Math.random) {
  if (!backgrounds.length) return "";
  const sample = Math.min(0.999999, Math.max(0, Number(random()) || 0));
  return backgrounds[Math.floor(sample * backgrounds.length)];
}

export function getLoadingStageScale(viewportWidth, viewportHeight) {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const height = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  return Math.min(width / LOADING_STAGE_WIDTH, height / LOADING_STAGE_HEIGHT);
}

export function updateLoadingStageScale(overlay, view = globalThis.window) {
  const stage = overlay?.querySelector?.(".loading-stage");
  if (!stage || !view) return 0;
  const scale = getLoadingStageScale(view.innerWidth, view.innerHeight);
  stage.style.setProperty("--loading-stage-scale", String(scale));
  return scale;
}

export function createLoadingOverlay({
  overlay,
  percent,
  status,
  shiftTitle,
  barFill,
  minimumVisibleMs = 2000,
  finishStatusText = "CORE INTERFACE ONLINE",
  bootBackgrounds = BOOT_BACKGROUND_URLS,
  random = Math.random,
  view = globalThis.window,
  setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
} = {}) {
  let progress = 0;
  let displayedProgress = 0;
  let complete = false;
  let startedAt = performance.now();
  const bootLog = overlay?.querySelector?.("[data-boot-log]");
  const bootReadyLabel = overlay?.querySelector?.("[data-boot-ready-label]");
  const bootBackgroundImage = overlay?.querySelector?.("[data-boot-background-image]");
  const bootBackground = pickBootBackground(bootBackgrounds, random);
  if (bootBackgroundImage && bootBackground) bootBackgroundImage.src = bootBackground;
  updateLoadingStageScale(overlay, view);

  function setProgress(value) {
    progress = THREE.MathUtils.clamp(value, progress, 100);
    displayedProgress = progress;
    renderProgress(displayedProgress);
    if (progress >= 70) shiftTitle?.classList.add("is-visible");
  }

  function renderProgress(value) {
    const shownPercent = Math.min(100, Math.round(value));
    if (percent) percent.textContent = `${String(shownPercent).padStart(2, "0")}%`;
    if (barFill) barFill.style.width = `${shownPercent}%`;
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function setBootSystem(name, state, value) {
    const row = overlay?.querySelector?.(`[data-boot-system="${name}"]`);
    if (!row) return false;
    row.classList.remove("is-active", "is-complete", "is-standby", "is-error");
    if (state) row.classList.add(`is-${state}`);
    const output = row.querySelector?.("b");
    if (output && value) output.textContent = value;
    return true;
  }

  function appendBootLog(text) {
    if (!bootLog || !text) return false;
    const line = bootLog.ownerDocument?.createElement?.("span");
    if (!line) return false;
    line.textContent = `> ${text}`;
    bootLog.append(line);
    while (bootLog.children.length > 5) bootLog.firstElementChild?.remove();
    return true;
  }

  function setBootDiagnostics({ renderer, profile, mode } = {}) {
    const rendererNode = overlay?.querySelector?.("[data-boot-renderer]");
    const webglNode = overlay?.querySelector?.("[data-boot-webgl]");
    const profileNode = overlay?.querySelector?.("[data-boot-profile]");
    const modeNode = overlay?.querySelector?.("[data-boot-mode]");
    if (renderer && rendererNode) rendererNode.textContent = renderer;
    if (renderer && webglNode) webglNode.textContent = "ACTIVE";
    if (profile && profileNode) profileNode.textContent = String(profile).toUpperCase();
    if (mode && modeNode) modeNode.textContent = mode;
  }

  function setTitle(text) {
    if (shiftTitle) shiftTitle.textContent = text;
  }

  function show({
    title = "YOUR FIRST FUSION SHIFT",
    statusText = "INITIALIZING OPERATOR CONSOLE",
    progressValue = 0,
  } = {}) {
    updateLoadingStageScale(overlay, view);
    startedAt = performance.now();
    progress = THREE.MathUtils.clamp(progressValue, 0, 100);
    displayedProgress = progress;
    complete = false;
    if (overlay) overlay.hidden = false;
    overlay?.classList.remove("is-complete");
    renderProgress(displayedProgress);
    shiftTitle?.classList.toggle("is-visible", progress >= 70);
    setStatus(statusText);
    setTitle(title);
  }

  function finish(onComplete, {
    beforeHide,
    immediateHide = false,
  } = {}) {
    setStatus(finishStatusText);
    setBootSystem("siteData", "complete", "LOADED");
    setBootSystem("renderSystem", "complete", "ONLINE");
    setBootSystem("controlBus", "complete", "READY");
    if (bootReadyLabel) bootReadyLabel.textContent = "SYSTEM READY";
    appendBootLog("operator interface ready");
    setProgress(100);
    const remainingMinimum = Math.max(0, minimumVisibleMs - (performance.now() - startedAt));

    setTimeoutFn(async () => {
      try {
        await beforeHide?.();
      } finally {
        if (immediateHide && overlay) overlay.hidden = true;
        else overlay?.classList.add("is-complete");
        complete = true;
        onComplete?.();
      }
    }, remainingMinimum + 450);
  }

  function skip() {
    complete = true;
    setProgress(100);
    overlay?.classList.add("is-complete");
  }

  function update(dt, waitingForPrimaryAsset = false) {
    if (!overlay || complete) return;

    updateLoadingStageScale(overlay, view);

    if (waitingForPrimaryAsset) {
      setProgress(Math.min(progress + dt * 9, 68));
    }

    displayedProgress = THREE.MathUtils.damp(displayedProgress, progress, 12, dt);
    const shownPercent = Math.min(100, Math.round(displayedProgress));
    renderProgress(displayedProgress);
    if (shownPercent >= 70) shiftTitle?.classList.add("is-visible");
  }

  return {
    finish,
    isComplete: () => complete,
    appendBootLog,
    setBootDiagnostics,
    setBootSystem,
    setTitle,
    setProgress,
    setStatus,
    show,
    skip,
    update,
  };
}
