import { BRIEFING_UI } from "../BriefingUiConfig.js?v=environment-polish";

const DISMISS_MS = 300;

export function createBriefingPanel({
  levels,
  onActiveChange,
  onDismissed,
  onSheetShown,
  root = document,
  getLanguage = () => document.documentElement.lang,
}) {
  const overlay = root.querySelector("#briefingOverlay");
  const sheetFrame = root.querySelector("#briefingSheetFrame");
  const image = root.querySelector("#briefingImage");
  let active = false;
  let queue = [];
  let levelId = null;
  let inspectHeld = false;
  let hideTimer = 0;
  let sheetToken = 0;

  function wire() {
    if (!overlay || !sheetFrame || !image) return;
    overlay.addEventListener("mousemove", (event) => {
      if (!active) return;
      const rect = sheetFrame.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const insideImage = isPointInsideRect(event.clientX, event.clientY, rect);
      overlay.classList.toggle("is-inspectable", insideImage);
      if (!insideImage || !inspectHeld) return stopInspect();
      updateInspectPosition(event, rect);
    });
    overlay.addEventListener("mousedown", (event) => {
      if (!active || event.button !== 0) return;
      const rect = sheetFrame.getBoundingClientRect();
      if (!isPointInsideRect(event.clientX, event.clientY, rect)) return;
      event.preventDefault();
      inspectHeld = true;
      overlay.classList.add("is-inspecting");
      updateInspectPosition(event, rect);
    });
    window.addEventListener("mouseup", (event) => {
      if (event.button !== 0 || !inspectHeld) return;
      inspectHeld = false;
      stopInspect();
    });
    overlay.addEventListener("mouseleave", () => {
      inspectHeld = false;
      overlay.classList.remove("is-inspectable");
      stopInspect();
    });
  }

  function getSheets(requestedLevelId) {
    const briefingConfig = levels[requestedLevelId]?.briefingImage;
    const language = getLanguage() === "ru" ? "ru" : "en";
    const localized = typeof briefingConfig === "string"
      ? briefingConfig
      : briefingConfig?.[language] ?? briefingConfig?.en;
    return Array.isArray(localized) ? localized : localized ? [localized] : [];
  }

  async function preload(requestedLevelId) {
    await Promise.all(getSheets(requestedLevelId).map(preloadImage));
  }

  function show(requestedLevelId) {
    const sheets = getSheets(requestedLevelId);
    return showSheets(requestedLevelId, sheets);
  }

  function showSheet(requestedLevelId, sheetIndex) {
    const sheets = getSheets(requestedLevelId);
    const selected = sheets[Number.isInteger(sheetIndex) ? sheetIndex : -1];
    return showSheets(requestedLevelId, selected ? [selected] : []);
  }

  function showSheets(requestedLevelId, sheets) {
    if (sheets.length === 0 || !overlay || !image) return false;
    window.clearTimeout(hideTimer);
    sheetToken += 1;
    levelId = requestedLevelId;
    queue = [...sheets];
    setActive(true);
    overlay.hidden = true;
    overlay.classList.remove("is-visible", "is-dismissed");
    image.removeAttribute("src");
    queue.slice(1).forEach((source) => {
      const preload = new Image();
      preload.src = source;
    });
    showNextSheet();
    return true;
  }

  function dismiss() {
    if (!overlay || !active) return false;
    const completedLevelId = levelId;
    inspectHeld = false;
    stopInspect();
    if (queue.length > 0) {
      overlay.classList.remove("is-visible");
      overlay.classList.add("is-dismissed");
      hideTimer = window.setTimeout(showNextSheet, DISMISS_MS);
      return true;
    }
    setActive(false);
    overlay.classList.remove("is-visible");
    overlay.classList.add("is-dismissed");
    onDismissed?.(completedLevelId, DISMISS_MS + 420);
    hideTimer = window.setTimeout(() => hide(true), DISMISS_MS);
    return true;
  }

  function hide(immediate = false) {
    if (!overlay) return;
    window.clearTimeout(hideTimer);
    sheetToken += 1;
    setActive(false);
    queue = [];
    levelId = null;
    overlay.classList.remove("is-visible", "is-dismissed");
    resetInspectState();
    if (immediate) {
      overlay.hidden = true;
      image?.removeAttribute("src");
    }
  }

  function showNextSheet() {
    const token = ++sheetToken;
    const source = queue.shift();
    if (!source || !overlay || !image) return;
    image.alt = `${levels[levelId]?.title ?? levelId} briefing`;
    overlay.hidden = true;
    overlay.classList.remove("is-visible", "is-dismissed");
    resetInspectState();
    image.onload = () => {
      if (token !== sheetToken || !active) return;
      overlay.hidden = false;
      overlay.getBoundingClientRect();
      overlay.classList.add("is-visible");
      onSheetShown?.({ levelId, source });
    };
    image.src = source;
    if (image.complete) image.onload();
  }

  function updateInspectPosition(event, rect) {
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    overlay.style.setProperty("--briefing-origin-x", `${(x * 100).toFixed(1)}%`);
    overlay.style.setProperty("--briefing-origin-y", `${(y * 100).toFixed(1)}%`);
    overlay.style.setProperty("--briefing-pan-x", `${((0.5 - x) * BRIEFING_UI.inspect.panX).toFixed(1)}px`);
    overlay.style.setProperty("--briefing-pan-y", `${((0.5 - y) * BRIEFING_UI.inspect.panY).toFixed(1)}px`);
    overlay.style.setProperty("--briefing-cursor-x", `${event.clientX.toFixed(1)}px`);
    overlay.style.setProperty("--briefing-cursor-y", `${event.clientY.toFixed(1)}px`);
    overlay.style.setProperty("--briefing-focus-radius", `${getFocusRadius(rect).toFixed(1)}px`);
    overlay.classList.add("is-inspecting");
  }

  function resetInspectState() {
    if (!overlay) return;
    inspectHeld = false;
    overlay.classList.remove("is-inspecting", "is-inspectable");
    const properties = {
      "--briefing-base-scale": BRIEFING_UI.inspect.baseScale,
      "--briefing-zoom-scale": BRIEFING_UI.inspect.zoomScale,
      "--briefing-vignette-clear": `${BRIEFING_UI.vignette.clearStop}%`,
      "--briefing-vignette-fade": `${BRIEFING_UI.vignette.fadeStop}%`,
      "--briefing-vignette-edge": `${BRIEFING_UI.vignette.edgeStop}%`,
      "--briefing-vignette-mid-opacity": BRIEFING_UI.vignette.midOpacity,
      "--briefing-vignette-edge-opacity": BRIEFING_UI.vignette.edgeOpacity,
      "--briefing-origin-x": "50%",
      "--briefing-origin-y": "50%",
      "--briefing-pan-x": "0px",
      "--briefing-pan-y": "0px",
      "--briefing-cursor-x": "50vw",
      "--briefing-cursor-y": "50vh",
      "--briefing-focus-radius": `${BRIEFING_UI.vignette.minRadius}px`,
    };
    Object.entries(properties).forEach(([key, value]) => overlay.style.setProperty(key, String(value)));
  }

  function stopInspect() {
    overlay?.classList.remove("is-inspecting");
  }

  function getFocusRadius(rect) {
    const raw = Math.max(rect.width, rect.height) * BRIEFING_UI.vignette.radiusRatio;
    return Math.min(BRIEFING_UI.vignette.maxRadius, Math.max(BRIEFING_UI.vignette.minRadius, raw));
  }

  function setActive(value) {
    const next = Boolean(value);
    if (active === next) return;
    active = next;
    onActiveChange?.(active);
  }

  return { wire, preload, show, showSheet, dismiss, hide, isActive: () => active, getSheets };
}

export function isPointInsideRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

async function preloadImage(source) {
  if (!source) return;
  const image = new Image();
  image.src = source;
  try {
    if (typeof image.decode === "function") {
      await image.decode();
      return;
    }
  } catch {
    // Cached/cross-origin images may reject decode; load/error still settles preloading.
  }
  if (image.complete) return;
  await new Promise((resolve) => {
    image.onload = resolve;
    image.onerror = resolve;
  });
}
