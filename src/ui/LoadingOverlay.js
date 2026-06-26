import * as THREE from "three";

export function createLoadingOverlay({
  overlay,
  percent,
  status,
  shiftTitle,
  barFill,
  minimumVisibleMs = 2000,
} = {}) {
  let progress = 0;
  let displayedProgress = 0;
  let complete = false;
  let startedAt = performance.now();

  function setProgress(value) {
    progress = THREE.MathUtils.clamp(value, progress, 100);
    if (progress >= 70) shiftTitle?.classList.add("is-visible");
  }

  function setStatus(text) {
    if (status) status.textContent = text;
  }

  function setTitle(text) {
    if (shiftTitle) shiftTitle.textContent = text;
  }

  function show({
    title = "YOUR FIRST FUSION SHIFT",
    statusText = "INITIALIZING OPERATOR CONSOLE",
    progressValue = 0,
  } = {}) {
    startedAt = performance.now();
    progress = THREE.MathUtils.clamp(progressValue, 0, 100);
    displayedProgress = progress;
    complete = false;
    overlay?.classList.remove("is-complete");
    if (percent) percent.textContent = `${String(Math.round(displayedProgress)).padStart(2, "0")}%`;
    if (barFill) barFill.style.width = `${Math.round(displayedProgress)}%`;
    shiftTitle?.classList.toggle("is-visible", progress >= 70);
    setStatus(statusText);
    setTitle(title);
  }

  function finish(onComplete) {
    setStatus("CORE INTERFACE ONLINE");
    setProgress(100);
    const remainingMinimum = Math.max(0, minimumVisibleMs - (performance.now() - startedAt));

    window.setTimeout(() => {
      overlay?.classList.add("is-complete");
      complete = true;
      onComplete?.();
    }, remainingMinimum + 450);
  }

  function skip() {
    complete = true;
    setProgress(100);
    overlay?.classList.add("is-complete");
  }

  function update(dt, waitingForPrimaryAsset = false) {
    if (!overlay || complete) return;

    if (waitingForPrimaryAsset) {
      setProgress(Math.min(progress + dt * 9, 68));
    }

    displayedProgress = THREE.MathUtils.damp(displayedProgress, progress, 12, dt);
    const shownPercent = Math.min(100, Math.round(displayedProgress));

    if (percent) percent.textContent = `${String(shownPercent).padStart(2, "0")}%`;
    if (barFill) barFill.style.width = `${shownPercent}%`;
    if (shownPercent >= 70) shiftTitle?.classList.add("is-visible");
  }

  return {
    finish,
    isComplete: () => complete,
    setTitle,
    setProgress,
    setStatus,
    show,
    skip,
    update,
  };
}
