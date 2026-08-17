import { updateLoadingStageScale } from "../ui/LoadingOverlay.js?v=open-facility-bulkheads";

export function createAppRouter({ overlay, percent, title, status, barFill, releaseInput, onStateChange }) {
  let active = false;

  async function transition({ title: routeTitle, status: routeStatus, action }) {
    if (active) return false;
    active = true;
    onStateChange?.(true);
    releaseInput?.();
    showCurtain();
    await wait(140);
    showLoading(routeTitle, routeStatus);
    await wait(420);
    await action?.({ setProgress, setStatus });
    setProgress(100);
    await wait(80);
    overlay?.classList.add("is-revealing");
    overlay?.classList.remove("is-loading");
    title?.classList.remove("is-visible");
    await wait(200);
    hideCurtain();
    await wait(500);
    active = false;
    onStateChange?.(false);
    return true;
  }

  function showCurtain() {
    if (!overlay) return;
    updateLoadingStageScale(overlay);
    overlay.classList.remove("is-loading");
    overlay.classList.remove("is-revealing", "is-scene-reveal");
    title?.classList.remove("is-visible");
    overlay.hidden = false;
    overlay.getBoundingClientRect();
    overlay.classList.add("is-visible");
  }

  function showLoading(routeTitle, routeStatus) {
    if (!overlay) return;
    if (title) title.textContent = routeTitle;
    if (status) status.textContent = routeStatus;
    if (percent) percent.textContent = "00%";
    if (barFill) barFill.style.width = "0%";
    overlay.classList.add("is-loading");
    title?.classList.add("is-visible");
    setProgress(4);
  }

  function setProgress(value) {
    const progress = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
    if (percent) percent.textContent = `${String(progress).padStart(2, "0")}%`;
    if (barFill) barFill.style.width = `${progress}%`;
  }

  function setStatus(value) {
    if (status && value) status.textContent = value;
  }

  function hideCurtain() {
    if (!overlay) return;
    overlay.classList.add("is-scene-reveal");
    overlay.classList.remove("is-visible", "is-loading");
    title?.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!overlay.classList.contains("is-visible")) {
        overlay.hidden = true;
        overlay.classList.remove("is-revealing", "is-scene-reveal");
      }
    }, 500);
  }

  return {
    transition,
    showCurtain,
    isActive: () => active,
  };
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
