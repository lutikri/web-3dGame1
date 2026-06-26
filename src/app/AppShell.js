import { LEVELS } from "./LevelCatalog.js";

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

  applySettings();
  wireActions();
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

  function startIntroShift() {
    if (transitionActive) return;
    transitionActive = true;
    hideOverlay();
    window.setTimeout(() => {
      gameApi.startLevel?.({ levelId: INTRO_LEVEL_ID, mode: LEVELS[INTRO_LEVEL_ID]?.mode ?? "tutorial" });
      transitionActive = false;
    }, 120);
  }

  function runAction(action) {
    if (transitionActive) return;

    if (action === "resume") {
      hideOverlay();
      gameApi.requestPointerLock?.();
    } else if (action === "main-menu") {
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
      showPanel("level-select");
    } else if (action === "profile") {
      showPanel("profile");
    } else if (action === "settings") {
      previousPanel = currentPanel ?? "pause";
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
      },
    });
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
    currentPanel = panelName;
    overlay.hidden = false;
    document.body.classList.add("app-ui-open");
    gameApi.releasePointerLock?.();

    panels.forEach((panel, name) => {
      panel.hidden = name !== panelName;
    });
  }

  function hideOverlay() {
    currentPanel = null;
    overlay.hidden = true;
    document.body.classList.remove("app-ui-open");
    panels.forEach((panel) => {
      panel.hidden = true;
    });
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
