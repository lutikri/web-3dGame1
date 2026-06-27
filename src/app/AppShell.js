import { LEVELS } from "./LevelCatalog.js";
import { BRIEFING_UI } from "./BriefingUiConfig.js";

const STORAGE_KEY = "operatorGame.settings.v1";
const PROGRESS_STORAGE_KEY = "operatorGame.progress.v1";
const INTRO_LEVEL_ID = "intro-shift";

export function createAppShell({ gameApi }) {
  const overlay = document.querySelector("#appOverlay");
  const routeLoadingOverlay = document.querySelector("#routeLoadingOverlay");
  const routeLoadingPercent = document.querySelector("#routeLoadingPercent");
  const routeLoadingTitle = document.querySelector("#routeLoadingTitle");
  const routeLoadingStatus = document.querySelector("#routeLoadingStatus");
  const routeLoadingBarFill = document.querySelector("#routeLoadingBarFill");
  const briefingOverlay = document.querySelector("#briefingOverlay");
  const briefingSheetFrame = document.querySelector("#briefingSheetFrame");
  const briefingImage = document.querySelector("#briefingImage");
  const panels = new Map([...document.querySelectorAll("[data-app-panel]")].map((panel) => [panel.dataset.appPanel, panel]));
  const fovInput = document.querySelector("#settingFov");
  const fovValue = document.querySelector("#settingFovValue");
  const uiScaleInput = document.querySelector("#settingUiScale");
  const uiScaleValue = document.querySelector("#settingUiScaleValue");
  const shadowQualityInput = document.querySelector("#settingShadowQuality");
  const shadowQualityValue = document.querySelector("#settingShadowQualityValue");
  const gtaoQualityInput = document.querySelector("#settingGtaoQuality");
  const gtaoQualityValue = document.querySelector("#settingGtaoQualityValue");
  const ssgiQualityInput = document.querySelector("#settingSsgiQuality");
  const ssgiQualityValue = document.querySelector("#settingSsgiQualityValue");
  const ssrQualityInput = document.querySelector("#settingSsrQuality");
  const ssrQualityValue = document.querySelector("#settingSsrQualityValue");
  const screenSpaceShadowQualityInput = document.querySelector("#settingScreenSpaceShadowQuality");
  const screenSpaceShadowQualityValue = document.querySelector("#settingScreenSpaceShadowQualityValue");
  const debugInput = document.querySelector("#settingDebugWindow");
  const settings = loadSettings();
  const firstVisitEmulation = Boolean(gameApi?.config?.app?.firstVisitEmulation);
  const progress = firstVisitEmulation ? createEmptyProgress() : loadProgress();
  let currentPanel = null;
  let previousPanel = "main-menu";
  let transitionActive = false;
  let initialRouteHandled = false;
  let briefingActive = false;
  let briefingHideTimer = 0;

  applySettings();
  wireActions();
  wireBriefingInspect();
  wireSettings();
  wireProgression();
  updateLevelProgressUi();

  function wireActions() {
    document.addEventListener("click", (event) => {
      const actionTarget = event.target.closest("[data-app-action]");
      if (actionTarget) {
        runAction(actionTarget.dataset.appAction);
        return;
      }

      const levelTarget = event.target.closest("[data-level-id]");
      if (levelTarget && !levelTarget.disabled) startLevel(levelTarget.dataset.levelId);
    });

    document.addEventListener("keydown", (event) => {
      if (briefingActive && event.code === "Enter" && !event.repeat) {
        event.preventDefault();
        dismissBriefing();
        return;
      }
      if (briefingActive) {
        event.preventDefault();
        return;
      }

      if (event.code !== "KeyP" || event.repeat) return;
      if (document.querySelector("#resultsOverlay")?.classList.contains("is-visible")) return;
      event.preventDefault();

      if (isOpen()) {
        runAction(currentPanel === "settings" ? "back" : "resume");
      } else {
        showPanel("pause");
      }
    });
  }

  function wireSettings() {
    if (fovInput) {
      fovInput.value = String(settings.fov);
      fovInput.addEventListener("input", () => {
        settings.fov = Number(fovInput.value);
        applySettings();
        saveSettings();
      });
    }

    if (uiScaleInput) {
      uiScaleInput.value = String(settings.uiScale);
      uiScaleInput.addEventListener("input", () => {
        settings.uiScale = Number(uiScaleInput.value);
        applySettings();
        saveSettings();
      });
    }

    if (debugInput) {
      debugInput.checked = settings.showDebug;
      debugInput.addEventListener("change", () => {
        settings.showDebug = debugInput.checked;
        applySettings();
        saveSettings();
      });
    }

    if (shadowQualityInput) {
      shadowQualityInput.value = settings.shadowQuality;
      shadowQualityInput.addEventListener("change", () => {
        settings.shadowQuality = shadowQualityInput.value;
        applySettings();
        saveSettings();
      });
    }

    if (gtaoQualityInput) {
      gtaoQualityInput.value = settings.gtaoQuality;
      gtaoQualityInput.addEventListener("change", () => {
        settings.gtaoQuality = gtaoQualityInput.value;
        applySettings();
        saveSettings();
      });
    }

    if (ssgiQualityInput) {
      ssgiQualityInput.value = settings.ssgiQuality;
      ssgiQualityInput.addEventListener("change", () => {
        settings.ssgiQuality = ssgiQualityInput.value;
        applySettings();
        saveSettings();
      });
    }

    if (ssrQualityInput) {
      ssrQualityInput.value = settings.ssrQuality;
      ssrQualityInput.addEventListener("change", () => {
        settings.ssrQuality = ssrQualityInput.value;
        applySettings();
        saveSettings();
      });
    }

    if (screenSpaceShadowQualityInput) {
      screenSpaceShadowQualityInput.value = settings.screenSpaceShadowQuality;
      screenSpaceShadowQualityInput.addEventListener("change", () => {
        settings.screenSpaceShadowQuality = screenSpaceShadowQualityInput.value;
        applySettings();
        saveSettings();
      });
    }
  }

  function wireProgression() {
    window.addEventListener("operatorgame:loading-complete", handleInitialRoute, { once: true });
    window.addEventListener("operatorgame:shift-results", (event) => {
      const { levelId, snapshot } = event.detail ?? {};
      if (levelId !== INTRO_LEVEL_ID || !["complete", "failed"].includes(snapshot?.mode)) return;

      progress.finishedLevels[INTRO_LEVEL_ID] = true;
      if (snapshot.mode === "complete") progress.completedLevels[INTRO_LEVEL_ID] = true;
      if (!firstVisitEmulation) saveProgress(progress);
      updateLevelProgressUi();
    });

    if (gameApi?.isLoadingComplete?.()) handleInitialRoute();
  }

  function handleInitialRoute() {
    if (initialRouteHandled) return;
    initialRouteHandled = true;

    if (progress.finishedLevels[INTRO_LEVEL_ID]) {
      gameApi.resetForMenu?.();
      showPanel("main-menu");
      return;
    }

    startIntroShift();
  }

  function wireBriefingInspect() {
    if (!briefingOverlay || !briefingSheetFrame || !briefingImage) return;

    briefingOverlay.addEventListener("mousemove", (event) => {
      if (!briefingActive) return;
      const rect = briefingSheetFrame.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const insideImage =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (!insideImage) {
        stopBriefingInspect();
        return;
      }

      const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
      briefingOverlay.style.setProperty("--briefing-origin-x", `${(x * 100).toFixed(1)}%`);
      briefingOverlay.style.setProperty("--briefing-origin-y", `${(y * 100).toFixed(1)}%`);
      briefingOverlay.style.setProperty("--briefing-pan-x", `${((0.5 - x) * BRIEFING_UI.inspect.panX).toFixed(1)}px`);
      briefingOverlay.style.setProperty("--briefing-pan-y", `${((0.5 - y) * BRIEFING_UI.inspect.panY).toFixed(1)}px`);
      briefingOverlay.style.setProperty("--briefing-cursor-x", `${event.clientX.toFixed(1)}px`);
      briefingOverlay.style.setProperty("--briefing-cursor-y", `${event.clientY.toFixed(1)}px`);
      briefingOverlay.style.setProperty("--briefing-focus-radius", `${getBriefingFocusRadius(rect).toFixed(1)}px`);
      briefingOverlay.classList.add("is-inspecting");
    });

    briefingOverlay.addEventListener("mouseleave", () => {
      stopBriefingInspect();
    });
  }

  function startIntroShift() {
    if (transitionActive) return;
    transitionActive = true;
    hideOverlay();
    window.setTimeout(() => {
      gameApi.startLevel?.({ levelId: INTRO_LEVEL_ID, mode: LEVELS[INTRO_LEVEL_ID]?.mode ?? "tutorial" });
      showLevelBriefing(INTRO_LEVEL_ID);
      transitionActive = false;
    }, 120);
  }

  function runAction(action) {
    if (transitionActive) return;

    if (action === "resume") {
      hideOverlay();
      gameApi.requestPointerLock?.();
    } else if (action === "main-menu") {
      hideBriefing(true);
      if (currentPanel && currentPanel !== "pause") {
        showPanel("main-menu");
        return;
      }

      runRouteTransition({
        title: "MAIN MENU",
        status: "RETURNING TO OPERATOR CONSOLE",
        action: () => {
          gameApi.hideShiftResults?.();
          gameApi.resetForMenu?.();
          showPanel("main-menu");
        },
      });
    } else if (action === "level-select") {
      gameApi.hideShiftResults?.();
      hideBriefing(true);
      showPanel("level-select");
    } else if (action === "profile") {
      hideBriefing(true);
      showPanel("profile");
    } else if (action === "settings") {
      previousPanel = currentPanel ?? "pause";
      hideBriefing(true);
      showPanel("settings");
    } else if (action === "back") {
      showPanel(previousPanel || "main-menu");
    } else if (action === "restart") {
      runRouteTransition({
        title: "RESTARTING SHIFT",
        status: "RESETTING CORE SESSION",
        action: () => {
          gameApi.hideShiftResults?.();
          hideOverlay();
          gameApi.restartGame?.();
          showLevelBriefing(gameApi.getState?.().activeLevelId);
        },
      });
    } else if (action === "quick-level-select") {
      showPanel("level-select");
    } else if (action === "quick-main-menu") {
      showPanel("main-menu");
    }
  }

  async function runRouteTransition({ title, status = "PREPARING OPERATOR CONSOLE", action }) {
    transitionActive = true;
    updateInputLock();
    gameApi.releasePointerLock?.();
    showRouteCurtain();
    await wait(140);
    showRouteLoading(title, status);
    await wait(420);
    hideRouteLoadingPanel();
    await wait(100);
    action?.();
    await wait(80);
    hideRouteCurtain();
    await wait(140);
    transitionActive = false;
    updateInputLock();
  }

  function showRouteCurtain() {
    if (!routeLoadingOverlay) return;
    routeLoadingOverlay.classList.remove("is-loading");
    routeLoadingTitle?.classList.remove("is-visible");
    routeLoadingOverlay.hidden = false;
    routeLoadingOverlay.getBoundingClientRect();
    routeLoadingOverlay.classList.add("is-visible");
  }

  function showRouteLoading(title, status) {
    if (!routeLoadingOverlay) return;
    if (routeLoadingTitle) routeLoadingTitle.textContent = title;
    if (routeLoadingStatus) routeLoadingStatus.textContent = status;
    if (routeLoadingPercent) routeLoadingPercent.textContent = "00%";
    if (routeLoadingBarFill) routeLoadingBarFill.style.width = "0%";
    routeLoadingOverlay.classList.add("is-loading");
    routeLoadingTitle?.classList.add("is-visible");
    window.requestAnimationFrame(() => {
      if (routeLoadingPercent) routeLoadingPercent.textContent = "100%";
      if (routeLoadingBarFill) routeLoadingBarFill.style.width = "100%";
    });
  }

  function hideRouteLoadingPanel() {
    routeLoadingOverlay?.classList.remove("is-loading");
  }

  function hideRouteCurtain() {
    if (!routeLoadingOverlay) return;
    routeLoadingOverlay.classList.remove("is-visible", "is-loading");
    routeLoadingTitle?.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!routeLoadingOverlay.classList.contains("is-visible")) routeLoadingOverlay.hidden = true;
    }, 140);
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function startLevel(levelId) {
    if (transitionActive) return;
    const level = LEVELS[levelId];
    if (!level?.playable) return;

    runRouteTransition({
      title: level.title,
      status: "LOADING SHIFT",
      action: () => {
        gameApi.hideShiftResults?.();
        hideOverlay();
        gameApi.startLevel?.({ levelId, mode: level.mode });
        showLevelBriefing(levelId);
      },
    });
  }

  function showLevelBriefing(levelId) {
    const briefing = LEVELS[levelId]?.briefingImage;
    if (!briefing || !briefingOverlay || !briefingImage) return;

    window.clearTimeout(briefingHideTimer);
    briefingActive = true;
    updateInputLock();
    briefingImage.src = briefing;
    briefingImage.alt = `${LEVELS[levelId]?.title ?? levelId} briefing`;
    briefingOverlay.hidden = false;
    briefingOverlay.classList.remove("is-visible", "is-dismissed");
    resetBriefingInspectState();
    briefingOverlay.getBoundingClientRect();
    briefingOverlay.classList.add("is-visible");
  }

  function dismissBriefing() {
    if (!briefingOverlay || !briefingActive) return;
    briefingActive = false;
    updateInputLock();
    briefingOverlay.classList.remove("is-visible");
    briefingOverlay.classList.add("is-dismissed");
    briefingHideTimer = window.setTimeout(() => hideBriefing(true), 980);
  }

  function hideBriefing(immediate = false) {
    if (!briefingOverlay) return;
    window.clearTimeout(briefingHideTimer);
    briefingActive = false;
    updateInputLock();
    briefingOverlay.classList.remove("is-visible", "is-dismissed");
    resetBriefingInspectState();
    if (immediate) briefingOverlay.hidden = true;
  }

  function stopBriefingInspect() {
    briefingOverlay?.classList.remove("is-inspecting");
  }

  function resetBriefingInspectState() {
    if (!briefingOverlay) return;
    briefingOverlay.classList.remove("is-inspecting");
    briefingOverlay.style.setProperty("--briefing-base-scale", String(BRIEFING_UI.inspect.baseScale));
    briefingOverlay.style.setProperty("--briefing-zoom-scale", String(BRIEFING_UI.inspect.zoomScale));
    briefingOverlay.style.setProperty("--briefing-vignette-clear", `${BRIEFING_UI.vignette.clearStop}%`);
    briefingOverlay.style.setProperty("--briefing-vignette-fade", `${BRIEFING_UI.vignette.fadeStop}%`);
    briefingOverlay.style.setProperty("--briefing-vignette-edge", `${BRIEFING_UI.vignette.edgeStop}%`);
    briefingOverlay.style.setProperty("--briefing-vignette-mid-opacity", String(BRIEFING_UI.vignette.midOpacity));
    briefingOverlay.style.setProperty("--briefing-vignette-edge-opacity", String(BRIEFING_UI.vignette.edgeOpacity));
    briefingOverlay.style.setProperty("--briefing-origin-x", "50%");
    briefingOverlay.style.setProperty("--briefing-origin-y", "50%");
    briefingOverlay.style.setProperty("--briefing-pan-x", "0px");
    briefingOverlay.style.setProperty("--briefing-pan-y", "0px");
    briefingOverlay.style.setProperty("--briefing-cursor-x", "50vw");
    briefingOverlay.style.setProperty("--briefing-cursor-y", "50vh");
    briefingOverlay.style.setProperty("--briefing-focus-radius", `${BRIEFING_UI.vignette.minRadius}px`);
  }

  function getBriefingFocusRadius(rect) {
    const rawRadius = Math.max(rect.width, rect.height) * BRIEFING_UI.vignette.radiusRatio;
    return Math.min(BRIEFING_UI.vignette.maxRadius, Math.max(BRIEFING_UI.vignette.minRadius, rawRadius));
  }

  function updateLevelProgressUi() {
    document.querySelectorAll("[data-level-id]").forEach((node) => {
      const levelId = node.dataset.levelId;
      const completed = Boolean(progress.completedLevels[levelId]);
      const finished = Boolean(progress.finishedLevels[levelId]);
      node.classList.toggle("is-complete", completed);
      node.classList.toggle("is-finished", finished && !completed);
      node.dataset.completion = completed ? "complete" : finished ? "attempted" : "";
      node.setAttribute(
        "aria-label",
        `${LEVELS[levelId]?.title ?? levelId}${completed ? " complete" : finished ? " attempted" : ""}`,
      );
    });
  }

  function showPanel(panelName) {
    hideBriefing(true);
    currentPanel = panelName;
    overlay.hidden = false;
    document.body.classList.add("app-ui-open");
    gameApi.releasePointerLock?.();
    updateInputLock();

    panels.forEach((panel, name) => {
      panel.hidden = name !== panelName;
    });
  }

  function hideOverlay() {
    currentPanel = null;
    overlay.hidden = true;
    document.body.classList.remove("app-ui-open");
    updateInputLock();
    panels.forEach((panel) => {
      panel.hidden = true;
    });
  }

  function updateInputLock() {
    gameApi.setInputLocked?.(Boolean(transitionActive || briefingActive || isOpen()));
  }

  function applySettings() {
    if (fovValue) fovValue.textContent = String(settings.fov);
    if (uiScaleValue) uiScaleValue.textContent = `${settings.uiScale}%`;
    if (shadowQualityValue) shadowQualityValue.textContent = getQualityLabel(settings.shadowQuality);
    if (gtaoQualityValue) gtaoQualityValue.textContent = getQualityLabel(settings.gtaoQuality);
    if (ssgiQualityValue) ssgiQualityValue.textContent = getQualityLabel(settings.ssgiQuality);
    if (ssrQualityValue) ssrQualityValue.textContent = getQualityLabel(settings.ssrQuality);
    if (screenSpaceShadowQualityValue) {
      screenSpaceShadowQualityValue.textContent = getQualityLabel(settings.screenSpaceShadowQuality);
    }
    if (fovInput && Number(fovInput.value) !== settings.fov) fovInput.value = String(settings.fov);
    if (uiScaleInput && Number(uiScaleInput.value) !== settings.uiScale) uiScaleInput.value = String(settings.uiScale);
    if (shadowQualityInput && shadowQualityInput.value !== settings.shadowQuality) {
      shadowQualityInput.value = settings.shadowQuality;
    }
    if (gtaoQualityInput && gtaoQualityInput.value !== settings.gtaoQuality) {
      gtaoQualityInput.value = settings.gtaoQuality;
    }
    if (ssgiQualityInput && ssgiQualityInput.value !== settings.ssgiQuality) {
      ssgiQualityInput.value = settings.ssgiQuality;
    }
    if (ssrQualityInput && ssrQualityInput.value !== settings.ssrQuality) {
      ssrQualityInput.value = settings.ssrQuality;
    }
    if (
      screenSpaceShadowQualityInput &&
      screenSpaceShadowQualityInput.value !== settings.screenSpaceShadowQuality
    ) {
      screenSpaceShadowQualityInput.value = settings.screenSpaceShadowQuality;
    }
    if (debugInput) debugInput.checked = settings.showDebug;

    document.body.style.setProperty("--ui-scale", String(settings.uiScale / 100));
    document.body.classList.toggle("debug-hidden", !settings.showDebug);
    gameApi.setBaseFov?.(settings.fov);
    gameApi.setDebugVisible?.(settings.showDebug);
    gameApi.setShadowQuality?.(settings.shadowQuality);
    gameApi.setGtaoQuality?.(settings.gtaoQuality);
    gameApi.setSsgiQuality?.(settings.ssgiQuality);
    gameApi.setSsrQuality?.(settings.ssrQuality);
    gameApi.setScreenSpaceShadowQuality?.(settings.screenSpaceShadowQuality);
  }

  function isOpen() {
    return Boolean(!overlay.hidden && currentPanel);
  }

  return {
    hideOverlay,
    showMainMenu: () => showPanel("main-menu"),
    showLevelSelect: () => showPanel("level-select"),
    showPause: () => showPanel("pause"),
    showSettings: () => showPanel("settings"),
  };
}

function createEmptyProgress() {
  return {
    finishedLevels: {},
    completedLevels: {},
  };
}

function loadProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? "{}");
    return {
      finishedLevels: parsed.finishedLevels && typeof parsed.finishedLevels === "object" ? parsed.finishedLevels : {},
      completedLevels:
        parsed.completedLevels && typeof parsed.completedLevels === "object" ? parsed.completedLevels : {},
    };
  } catch {
    return createEmptyProgress();
  }
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      fov: clampNumber(parsed.fov, 55, 95, 72),
      uiScale: clampNumber(parsed.uiScale, 80, 130, 100),
      showDebug: typeof parsed.showDebug === "boolean" ? parsed.showDebug : true,
      shadowQuality: normalizeQuality(parsed.shadowQuality, ["off", "min", "max"], "min"),
      gtaoQuality: normalizeQuality(parsed.gtaoQuality, ["off", "min", "med", "max"], "off"),
      ssgiQuality: normalizeQuality(parsed.ssgiQuality, ["off", "min", "med", "max"], "off"),
      ssrQuality: normalizeQuality(parsed.ssrQuality, ["off", "min", "med", "max"], "off"),
      screenSpaceShadowQuality: normalizeQuality(
        parsed.screenSpaceShadowQuality,
        ["off", "min", "med", "max"],
        "off",
      ),
    };
  } catch {
    return {
      fov: 72,
      uiScale: 100,
      showDebug: true,
      shadowQuality: "min",
      gtaoQuality: "off",
      ssgiQuality: "off",
      ssrQuality: "off",
      screenSpaceShadowQuality: "off",
    };
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      fov: Number(document.querySelector("#settingFov")?.value ?? 72),
      uiScale: Number(document.querySelector("#settingUiScale")?.value ?? 100),
      showDebug: Boolean(document.querySelector("#settingDebugWindow")?.checked),
      shadowQuality: document.querySelector("#settingShadowQuality")?.value ?? "min",
      gtaoQuality: document.querySelector("#settingGtaoQuality")?.value ?? "off",
      ssgiQuality: document.querySelector("#settingSsgiQuality")?.value ?? "off",
      ssrQuality: document.querySelector("#settingSsrQuality")?.value ?? "off",
      screenSpaceShadowQuality: document.querySelector("#settingScreenSpaceShadowQuality")?.value ?? "off",
    }),
  );
}

function normalizeQuality(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function getQualityLabel(value) {
  if (value === "off") return "OFF";
  if (value === "min") return "MIN";
  if (value === "med") return "MED";
  if (value === "max") return "MAX";
  return String(value).toUpperCase();
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
