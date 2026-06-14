import { LEVELS } from "./LevelCatalog.js";

const STORAGE_KEY = "operatorGame.settings.v1";

export function createAppShell({ gameApi }) {
  const overlay = document.querySelector("#appOverlay");
  const panels = new Map([...document.querySelectorAll("[data-app-panel]")].map((panel) => [panel.dataset.appPanel, panel]));
  const fovInput = document.querySelector("#settingFov");
  const fovValue = document.querySelector("#settingFovValue");
  const uiScaleInput = document.querySelector("#settingUiScale");
  const uiScaleValue = document.querySelector("#settingUiScaleValue");
  const debugInput = document.querySelector("#settingDebugWindow");
  const settings = loadSettings();
  let currentPanel = null;
  let previousPanel = "main-menu";
  let transitionActive = false;

  applySettings();
  wireActions();
  wireSettings();

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
  }

  function runAction(action) {
    if (transitionActive) return;

    if (action === "resume") {
      hideOverlay();
      gameApi.requestPointerLock?.();
    } else if (action === "main-menu") {
      runRouteTransition("RETURNING TO MENU", () => {
        gameApi.hideShiftResults?.();
        gameApi.resetForMenu?.();
        showPanel("main-menu");
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
      runRouteTransition("RESTARTING SHIFT", () => {
        gameApi.hideShiftResults?.();
        hideOverlay();
        gameApi.restartGame?.();
      });
    } else if (action === "quick-level-select") {
      showPanel("level-select");
    } else if (action === "quick-main-menu") {
      showPanel("main-menu");
    }
  }

  async function runRouteTransition(label, action) {
    transitionActive = true;
    gameApi.releasePointerLock?.();
    gameApi.showLoadingScreen?.({
      title: label,
      status: "PREPARING OPERATOR CONSOLE",
      progress: 0,
    });
    await wait(450);
    gameApi.showLoadingScreen?.({
      title: label,
      status: "ROUTING SHIFT PROFILE",
      progress: 72,
    });
    action?.();
    await wait(450);
    gameApi.finishLoadingScreen?.(() => {
      transitionActive = false;
    });
  }

  function wait(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function startLevel(levelId) {
    if (transitionActive) return;
    const level = LEVELS[levelId];
    if (!level?.playable) return;

    runRouteTransition(level.title, () => {
      gameApi.hideShiftResults?.();
      hideOverlay();
      gameApi.startLevel?.({ levelId, mode: level.mode });
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
    if (fovInput && Number(fovInput.value) !== settings.fov) fovInput.value = String(settings.fov);
    if (uiScaleInput && Number(uiScaleInput.value) !== settings.uiScale) uiScaleInput.value = String(settings.uiScale);
    if (debugInput) debugInput.checked = settings.showDebug;

    document.body.style.setProperty("--ui-scale", String(settings.uiScale / 100));
    document.body.classList.toggle("debug-hidden", !settings.showDebug);
    gameApi.setBaseFov?.(settings.fov);
    gameApi.setDebugVisible?.(settings.showDebug);
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

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      fov: clampNumber(parsed.fov, 55, 95, 72),
      uiScale: clampNumber(parsed.uiScale, 80, 130, 100),
      showDebug: typeof parsed.showDebug === "boolean" ? parsed.showDebug : true,
    };
  } catch {
    return {
      fov: 72,
      uiScale: 100,
      showDebug: true,
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
    }),
  );
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
