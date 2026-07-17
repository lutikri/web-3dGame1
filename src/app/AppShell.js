import { LEVEL_DEFINITIONS as LEVELS } from "../levels/LevelRegistry.js?v=20260717-radio-tight-fade-bright-lamp";
import { BRIEFING_UI } from "./BriefingUiConfig.js?v=20260717-radio-tight-fade-bright-lamp";
import { translate } from "./Localization.js?v=20260717-radio-tight-fade-bright-lamp";
import { createIntroTutorialFlow } from "./IntroTutorialFlow.js?v=20260717-radio-tight-fade-bright-lamp";
import { createSubtitleQueue } from "./SubtitleQueue.js?v=20260717-radio-tight-fade-bright-lamp";
import { createTutorialHintQueue } from "./TutorialHintQueue.js?v=20260717-radio-tight-fade-bright-lamp";

const STORAGE_KEY = "operatorGame.settings.v1";
const PROGRESS_STORAGE_KEY = "operatorGame.progress.v1";
const PREFLIGHT_STORAGE_KEY = "operatorGame.preflight.v1";
const INTRO_LEVEL_ID = "intro-shift";
const BRIEFING_DISMISS_MS = 300;
const LEVEL_ROUTE_LINKS = [
  { from: "qualification", to: "facility", fromSide: "bottom", toSide: "top" },
  { from: "qualification", to: "tests", fromSide: "bottom", toSide: "top" },
];
const LEVEL_UNLOCKS = {
  "intro-shift": [],
  "unexpected-stuff": ["intro-shift"],
  "fuel-problems": ["intro-shift"],
  "shift-coordination": ["unexpected-stuff", "fuel-problems"],
  "exploring-around": ["shift-coordination"],
  "power-bus-training": ["shift-coordination"],
  "longer-shifts": ["shift-coordination"],
  "broken-lamp": ["shift-coordination"],
  "low-fuel": ["shift-coordination"],
  "low-heat-sink": ["shift-coordination"],
  "maximum-load": ["shift-coordination"],
  freeplay: [],
  competitive: ["shift-coordination"],
};

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
  const subtitleQueue = createSubtitleQueue({ element: document.querySelector("#operatorSubtitle") });
  const tutorialHintQueue = createTutorialHintQueue({
    element: document.querySelector("#tutorialHint"),
    translate,
  });
  const panels = new Map([...document.querySelectorAll("[data-app-panel]")].map((panel) => [panel.dataset.appPanel, panel]));
  const levelRouteScroll = document.querySelector(".level-route-scroll");
  const levelRouteCanvas = document.querySelector(".level-route-canvas");
  const levelRouteLinksSvg = document.querySelector(".route-links-svg");
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
  const sensitivityInput = document.querySelector("#settingSensitivity");
  const sensitivityValue = document.querySelector("#settingSensitivityValue");
  const settings = loadSettings();
  const debugConfig = gameApi?.config?.debug ?? {};
  const firstVisitEmulation = Boolean(gameApi?.config?.app?.firstVisitEmulation);
  const returnToMenuAfterPreflight = Boolean(window.operatorGameBootOptions?.returnToMenuAfterPreflight);
  const progress = firstVisitEmulation ? createEmptyProgress() : loadProgress();
  let currentPanel = null;
  let previousPanel = "main-menu";
  let transitionActive = false;
  let initialRouteHandled = false;
  let briefingActive = false;
  let briefingQueue = [];
  let briefingLevelId = null;
  let briefingInspectHeld = false;
  let briefingHideTimer = 0;
  let briefingSheetToken = 0;
  let activeGameplayLevelId = null;
  const introTutorialFlow = createIntroTutorialFlow({
    hintQueue: tutorialHintQueue,
    isAllowed: (state) =>
      Boolean(
        state?.levelId === INTRO_LEVEL_ID &&
          activeGameplayLevelId === INTRO_LEVEL_ID &&
          !briefingActive &&
          !transitionActive &&
          !isOpen() &&
          !document.querySelector("#resultsOverlay")?.classList.contains("is-visible"),
      ),
  });
  let resolveInitialRouteReady = null;
  const initialRouteReady = new Promise((resolve) => {
    resolveInitialRouteReady = resolve;
  });

  applySettings();
  wireActions();
  wireLevelRouteDrag();
  wireBriefingInspect();
  wireSettings();
  wireProgression();
  wireTutorialHints();
  wireSubtitles();
  validateLevelMenu();
  updateLevelProgressUi();
  installDevConsoleCommands();

  function wireSubtitles() {
    window.addEventListener("operatorgame:subtitle", (event) => subtitleQueue.enqueue(event.detail));
    window.addEventListener("operatorgame:subtitle-clear", (event) => {
      subtitleQueue.clear({ resetSeen: Boolean(event.detail?.resetSeen) });
      updateInputLock();
    });
    window.addEventListener("operatorgame:shift-results", () => {
      subtitleQueue.clear();
      subtitleQueue.setBlocked(true);
    });
  }

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
      if (briefingActive && event.key === "Enter" && !event.repeat) {
        event.preventDefault();
        dismissBriefing();
        return;
      }
      if (briefingActive) {
        event.preventDefault();
        return;
      }

      introTutorialFlow.handleKey(event);

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

  function wireLevelRouteDrag() {
    if (!levelRouteScroll) return;
    let drag = null;
    let suppressClick = false;
    const dragThreshold = 4;

    levelRouteScroll.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollLeft: levelRouteScroll.scrollLeft,
        scrollTop: levelRouteScroll.scrollTop,
        active: false,
      };
    });

    levelRouteScroll.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.active && Math.hypot(dx, dy) < dragThreshold) return;
      if (!drag.active && !levelRouteScroll.hasPointerCapture(drag.pointerId)) {
        levelRouteScroll.setPointerCapture(drag.pointerId);
      }
      drag.active = true;
      suppressClick = true;
      levelRouteScroll.classList.add("is-dragging");
      levelRouteScroll.scrollLeft = drag.scrollLeft - dx;
      levelRouteScroll.scrollTop = drag.scrollTop - dy;
      event.preventDefault();
    });

    const endDrag = (event) => {
      if (!drag) return;
      drag = null;
      levelRouteScroll.classList.remove("is-dragging");
      if (levelRouteScroll.hasPointerCapture(event.pointerId)) levelRouteScroll.releasePointerCapture(event.pointerId);
    };

    levelRouteScroll.addEventListener(
      "click",
      (event) => {
        if (!suppressClick) return;
        suppressClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      true,
    );
    levelRouteScroll.addEventListener("pointerup", endDrag);
    levelRouteScroll.addEventListener("pointercancel", endDrag);
    levelRouteScroll.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("blur", () => {
      drag = null;
      suppressClick = false;
      levelRouteScroll.classList.remove("is-dragging");
    });
    window.addEventListener("resize", updateLevelRouteLinks);
  }

  function updateLevelRouteLinks() {
    if (!levelRouteCanvas || !levelRouteLinksSvg) return;
    const canvasRect = levelRouteCanvas.getBoundingClientRect();
    const width = levelRouteCanvas.offsetWidth;
    const height = levelRouteCanvas.offsetHeight;
    levelRouteLinksSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    levelRouteLinksSvg.innerHTML = LEVEL_ROUTE_LINKS.map((link) => {
      const from = getRouteAnchor(link.from, link.fromSide, canvasRect);
      const to = getRouteAnchor(link.to, link.toSide, canvasRect);
      if (!from || !to) return "";
      return `<path d="${createRoutePath(from, to, link)}" />`;
    }).join("");
  }

  function getRouteAnchor(sectionId, side, canvasRect) {
    const section = levelRouteCanvas?.querySelector(`[data-route-section="${sectionId}"]`);
    if (!section) return null;
    const rect = section.getBoundingClientRect();
    const x = rect.left - canvasRect.left;
    const y = rect.top - canvasRect.top;
    const anchors = {
      top: { x: x + rect.width / 2, y },
      right: { x: x + rect.width, y: y + rect.height / 2 },
      bottom: { x: x + rect.width / 2, y: y + rect.height },
      left: { x, y: y + rect.height / 2 },
    };
    return anchors[side] ?? anchors.bottom;
  }

  function createRoutePath(from, to, link) {
    if (link.fromSide === "bottom" && link.toSide === "top") {
      const midY = Math.round((from.y + to.y) / 2);
      return `M ${round(from.x)} ${round(from.y)} L ${round(from.x)} ${midY} L ${round(to.x)} ${midY} L ${round(to.x)} ${round(to.y)}`;
    }
    if (link.fromSide === "left" && link.toSide === "right") {
      const midX = Math.round((from.x + to.x) / 2);
      return `M ${round(from.x)} ${round(from.y)} L ${midX} ${round(from.y)} L ${midX} ${round(to.y)} L ${round(to.x)} ${round(to.y)}`;
    }
    return `M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(to.y)}`;
  }

  function round(value) {
    return Math.round(value * 10) / 10;
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

    if (sensitivityInput) {
      sensitivityInput.value = String(settings.sensitivity);
      sensitivityInput.addEventListener("input", () => {
        settings.sensitivity = Number(sensitivityInput.value);
        applySettings();
        saveSettings();
      });
    }
  }

  function wireProgression() {
    window.addEventListener("operatorgame:loading-complete", handleInitialRoute, { once: true });
    window.addEventListener("operatorgame:shift-results", (event) => {
      const { levelId, snapshot, levelSession } = event.detail ?? {};
      if (!LEVELS[levelId]?.playable || !["complete", "failed"].includes(snapshot?.mode)) return;

      progress.finishedLevels[levelId] = true;
      if (snapshot.mode === "complete" && levelSession?.status === "complete") {
        progress.completedLevels[levelId] = true;
      }
      if (!firstVisitEmulation) saveProgress(progress);
      updateLevelProgressUi();
    });

    if (gameApi?.isLoadingComplete?.()) handleInitialRoute();
  }

  async function handleInitialRoute() {
    if (initialRouteHandled) return;
    initialRouteHandled = true;

    if (returnToMenuAfterPreflight) {
      await gameApi.resetForMenu?.();
      showPanel("main-menu");
      resolveInitialRouteReady?.();
      resolveInitialRouteReady = null;
      return;
    }

    const fastLoadLevelId = debugConfig.enabled ? debugConfig.fastLoadLevel : null;
    const fastLoadLevel = LEVELS[fastLoadLevelId];
    if (fastLoadLevelId && fastLoadLevel?.playable) {
      hideOverlay();
      await gameApi.startLevel?.({ levelId: fastLoadLevelId, mode: fastLoadLevel.mode });
      activeGameplayLevelId = fastLoadLevelId;
      if (!debugConfig.skipBriefing) {
        await preloadLevelBriefing(fastLoadLevelId);
        showLevelBriefing(fastLoadLevelId);
      }
      resolveInitialRouteReady?.();
      resolveInitialRouteReady = null;
      return;
    }

    if (progress.finishedLevels[INTRO_LEVEL_ID]) {
      await gameApi.resetForMenu?.();
      showPanel("main-menu");
      resolveInitialRouteReady?.();
      resolveInitialRouteReady = null;
      return;
    }

    startIntroShift();
  }

  function wireTutorialHints() {
    window.addEventListener("operatorgame:hover-target", (event) => {
      introTutorialFlow.handleHover(event.detail);
    });
    window.addEventListener("operatorgame:input-action", (event) => {
      introTutorialFlow.handleInputAction(event.detail);
    });
    window.addEventListener("operatorgame:knob-adjusted", () => {
      introTutorialFlow.handleKnobAdjusted();
    });
  }

  function wireBriefingInspect() {
    if (!briefingOverlay || !briefingSheetFrame || !briefingImage) return;

    briefingOverlay.addEventListener("mousemove", (event) => {
      if (!briefingActive) return;
      const rect = briefingSheetFrame.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const insideImage = isPointInsideRect(event.clientX, event.clientY, rect);
      briefingOverlay.classList.toggle("is-inspectable", insideImage);
      if (!insideImage || !briefingInspectHeld) {
        stopBriefingInspect();
        return;
      }
      updateBriefingInspectPosition(event, rect);
    });

    briefingOverlay.addEventListener("mousedown", (event) => {
      if (!briefingActive || event.button !== 0) return;
      const rect = briefingSheetFrame.getBoundingClientRect();
      if (!isPointInsideRect(event.clientX, event.clientY, rect)) return;
      event.preventDefault();
      briefingInspectHeld = true;
      briefingOverlay.classList.add("is-inspecting");
      updateBriefingInspectPosition(event, rect);
    });

    window.addEventListener("mouseup", (event) => {
      if (event.button !== 0 || !briefingInspectHeld) return;
      briefingInspectHeld = false;
      stopBriefingInspect();
    });

    briefingOverlay.addEventListener("mouseleave", () => {
      briefingInspectHeld = false;
      briefingOverlay.classList.remove("is-inspectable");
      stopBriefingInspect();
    });
  }

  function updateBriefingInspectPosition(event, rect) {
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
  }

  function isPointInsideRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function startIntroShift() {
    if (transitionActive) return;
    transitionActive = true;
    hideOverlay();
    window.setTimeout(async () => {
      await gameApi.startLevel?.({ levelId: INTRO_LEVEL_ID, mode: LEVELS[INTRO_LEVEL_ID]?.mode ?? "tutorial" });
      activeGameplayLevelId = INTRO_LEVEL_ID;
      await preloadLevelBriefing(INTRO_LEVEL_ID);
      showLevelBriefing(INTRO_LEVEL_ID);
      transitionActive = false;
      resolveInitialRouteReady?.();
      resolveInitialRouteReady = null;
    }, 120);
  }

  function runAction(action) {
    if (transitionActive) return;

    if (action === "resume") {
      hideOverlay();
      gameApi.requestPointerLock?.();
    } else if (action === "main-menu") {
      hideBriefing(true);
      gameApi.hideShiftResults?.({ immediate: true });
      if (currentPanel && currentPanel !== "pause") {
        showPanel("main-menu");
        return;
      }

      runRouteTransition({
        title: translate("actions.mainMenu"),
        status: translate("loading.returning"),
        action: async () => {
          gameApi.hideShiftResults?.({ immediate: true });
          await gameApi.resetForMenu?.();
          activeGameplayLevelId = null;
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
        title: translate("loading.restartingShift"),
        status: translate("loading.resettingCore"),
        action: async () => {
          gameApi.hideShiftResults?.({ immediate: true });
          hideOverlay();
          await gameApi.restartGame?.();
          activeGameplayLevelId = gameApi.getState?.().activeLevelId ?? activeGameplayLevelId;
          await preloadLevelBriefing(activeGameplayLevelId);
          showLevelBriefing(activeGameplayLevelId);
        },
      });
    } else if (action === "quick-level-select") {
      showPanel("level-select");
    } else if (action === "quick-main-menu") {
      showPanel("main-menu");
    } else if (action === "redetect-graphics") {
      transitionActive = true;
      gameApi.releasePointerLock?.();
      showRouteCurtain();
      sessionStorage.setItem("operatorGame.preflight.returnToMenu", "1");
      localStorage.removeItem(PREFLIGHT_STORAGE_KEY);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.location.reload());
      });
    }
  }

  async function runRouteTransition({ title, status = translate("loading.preparing"), action }) {
    transitionActive = true;
    updateInputLock();
    gameApi.releasePointerLock?.();
    showRouteCurtain();
    await wait(140);
    showRouteLoading(title, status);
    await wait(420);
    await action?.();
    await wait(80);
    hideRouteLoadingPanel();
    await wait(100);
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

  function startLevel(levelId, { force = false } = {}) {
    if (transitionActive) return false;
    const level = LEVELS[levelId];
    if (!level?.playable || (!force && !isLevelUnlocked(levelId))) return false;

    const transition = runRouteTransition({
      title: getLevelTitle(levelId),
      status: translate("loading.loadingShift"),
      action: async () => {
        gameApi.hideShiftResults?.();
        hideOverlay();
        await gameApi.startLevel?.({ levelId, mode: level.mode });
        activeGameplayLevelId = levelId;
        await preloadLevelBriefing(levelId);
        showLevelBriefing(levelId);
      },
    });
    return transition;
  }

  function completeLevel(levelId, { finished = true } = {}) {
    const level = LEVELS[levelId];
    if (!level) {
      console.warn(`[OperatorGame] Unknown level: ${levelId}`);
      return false;
    }
    progress.completedLevels[levelId] = true;
    if (finished) progress.finishedLevels[levelId] = true;
    if (!firstVisitEmulation) saveProgress(progress);
    updateLevelProgressUi();
    console.log(`[OperatorGame] Marked complete: ${levelId}`);
    return true;
  }

  function attemptLevel(levelId) {
    const level = LEVELS[levelId];
    if (!level) {
      console.warn(`[OperatorGame] Unknown level: ${levelId}`);
      return false;
    }
    progress.finishedLevels[levelId] = true;
    delete progress.completedLevels[levelId];
    if (!firstVisitEmulation) saveProgress(progress);
    updateLevelProgressUi();
    console.log(`[OperatorGame] Marked attempted: ${levelId}`);
    return true;
  }

  function clearLevelProgress(levelId) {
    if (!LEVELS[levelId]) {
      console.warn(`[OperatorGame] Unknown level: ${levelId}`);
      return false;
    }
    delete progress.finishedLevels[levelId];
    delete progress.completedLevels[levelId];
    if (!firstVisitEmulation) saveProgress(progress);
    updateLevelProgressUi();
    console.log(`[OperatorGame] Cleared progress: ${levelId}`);
    return true;
  }

  function resetProgress() {
    Object.keys(progress.finishedLevels).forEach((levelId) => delete progress.finishedLevels[levelId]);
    Object.keys(progress.completedLevels).forEach((levelId) => delete progress.completedLevels[levelId]);
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith("operatorGame.levelSession."))
      .forEach((key) => sessionStorage.removeItem(key));
    updateLevelProgressUi();
    console.log("[OperatorGame] Progress reset");
    return true;
  }

  function getProgressSnapshot() {
    return {
      finishedLevels: { ...progress.finishedLevels },
      completedLevels: { ...progress.completedLevels },
      unlockedLevels: Object.fromEntries(Object.keys(LEVELS).map((levelId) => [levelId, isLevelUnlocked(levelId)])),
    };
  }

  function listConsoleLevels() {
    return Object.fromEntries(
      Object.entries(LEVELS).map(([levelId, level]) => [
        levelId,
        {
          title: level.title,
          playable: level.playable,
          unlocked: isLevelUnlocked(levelId),
          finished: Boolean(progress.finishedLevels[levelId]),
          complete: Boolean(progress.completedLevels[levelId]),
        },
      ]),
    );
  }

  function runConsoleCommand(commandLine = "") {
    const [command, ...args] = String(commandLine).trim().split(/\s+/).filter(Boolean);
    const levelId = args[0];
    if (!command || command === "help") return getConsoleHelp();
    if (command === "complete") return completeLevel(levelId);
    if (command === "attempt") return attemptLevel(levelId);
    if (command === "clear") return clearLevelProgress(levelId);
    if (command === "goto" || command === "go") return startLevel(levelId, { force: true });
    if (command === "reset" && levelId === "progress") return resetProgress();
    if (command === "progress") return getProgressSnapshot();
    if (command === "levels" || command === "list") return listConsoleLevels();
    console.warn(`[OperatorGame] Unknown dev command: ${commandLine}`);
    return getConsoleHelp();
  }

  function getConsoleHelp() {
    return [
      "og('complete intro-shift')",
      "og('attempt unexpected-stuff')",
      "og('clear fuel-problems')",
      "og('goto intro-shift')",
      "og('reset progress')",
      "og('progress')",
      "og('levels')",
      "og.complete('intro-shift')",
      "og.goto('fuel-problems')",
      "og.resetProgress()",
    ];
  }

  function installDevConsoleCommands() {
    const og = (commandLine) => runConsoleCommand(commandLine);
    Object.assign(og, {
      help: getConsoleHelp,
      complete: completeLevel,
      attempt: attemptLevel,
      clear: clearLevelProgress,
      goto: (levelId) => startLevel(levelId, { force: true }),
      resetProgress,
      progress: getProgressSnapshot,
      levels: listConsoleLevels,
    });
    window.og = og;
    window.operatorGameConsole = og;
    window.completeLevel = completeLevel;
    window.attemptLevel = attemptLevel;
    window.clearLevelProgress = clearLevelProgress;
    window.gotoLevel = (levelId) => startLevel(levelId, { force: true });
    window.resetProgress = resetProgress;
    window.operatorGameDebug = {
      ...(window.operatorGameDebug ?? {}),
      completeLevel,
      attemptLevel,
      clearLevelProgress,
      gotoLevel: (levelId) => startLevel(levelId, { force: true }),
      resetProgress,
      getProgress: getProgressSnapshot,
      listLevels: listConsoleLevels,
      runCommand: runConsoleCommand,
    };
    console.info("[OperatorGame] Dev console commands ready. Try og('help').");
  }

  function getLevelBriefingSheets(levelId) {
    const briefingConfig = LEVELS[levelId]?.briefingImage;
    const language = document.documentElement.lang === "ru" ? "ru" : "en";
    const localizedBriefing =
      typeof briefingConfig === "string" ? briefingConfig : briefingConfig?.[language] ?? briefingConfig?.en;
    return Array.isArray(localizedBriefing) ? localizedBriefing : localizedBriefing ? [localizedBriefing] : [];
  }

  async function preloadLevelBriefing(levelId) {
    const sheets = getLevelBriefingSheets(levelId);
    await Promise.all(sheets.map(preloadImage));
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
      // Fall through to the load/error pair below; some browsers reject decode for cached images.
    }
    if (image.complete) return;
    await new Promise((resolve) => {
      image.onload = resolve;
      image.onerror = resolve;
    });
  }

  function showLevelBriefing(levelId) {
    const sheets = getLevelBriefingSheets(levelId);
    if (sheets.length === 0 || !briefingOverlay || !briefingImage) return;

    window.clearTimeout(briefingHideTimer);
    briefingSheetToken += 1;
    briefingLevelId = levelId;
    briefingQueue = [...sheets];
    briefingActive = true;
    updateInputLock();
    briefingOverlay.hidden = true;
    briefingOverlay.classList.remove("is-visible", "is-dismissed");
    briefingImage.removeAttribute("src");
    briefingQueue.slice(1).forEach((source) => {
      const preload = new Image();
      preload.src = source;
    });
    showNextBriefingSheet();
  }

  function showNextBriefingSheet() {
    const token = ++briefingSheetToken;
    const briefing = briefingQueue.shift();
    if (!briefing || !briefingOverlay || !briefingImage) return;
    briefingImage.alt = `${LEVELS[briefingLevelId]?.title ?? briefingLevelId} briefing`;
    briefingOverlay.hidden = true;
    briefingOverlay.classList.remove("is-visible", "is-dismissed");
    resetBriefingInspectState();
    briefingImage.onload = () => {
      if (token !== briefingSheetToken || !briefingActive) return;
      briefingOverlay.hidden = false;
      briefingOverlay.getBoundingClientRect();
      briefingOverlay.classList.add("is-visible");
    };
    briefingImage.src = briefing;
    if (briefingImage.complete) briefingImage.onload();
  }

  function dismissBriefing() {
    if (!briefingOverlay || !briefingActive) return;
    const completedBriefingLevelId = briefingLevelId;
    briefingInspectHeld = false;
    stopBriefingInspect();
    if (briefingQueue.length > 0) {
      briefingOverlay.classList.remove("is-visible");
      briefingOverlay.classList.add("is-dismissed");
      briefingHideTimer = window.setTimeout(showNextBriefingSheet, BRIEFING_DISMISS_MS);
      return;
    }
    briefingActive = false;
    updateInputLock();
    briefingOverlay.classList.remove("is-visible");
    briefingOverlay.classList.add("is-dismissed");
    maybeStartIntroTutorial(completedBriefingLevelId, BRIEFING_DISMISS_MS + 420);
    briefingHideTimer = window.setTimeout(() => hideBriefing(true, { keepTutorialHints: true }), BRIEFING_DISMISS_MS);
  }

  function hideBriefing(immediate = false, { keepTutorialHints = false } = {}) {
    if (!briefingOverlay) return;
    window.clearTimeout(briefingHideTimer);
    briefingSheetToken += 1;
    briefingActive = false;
    briefingQueue = [];
    briefingLevelId = null;
    if (!keepTutorialHints) introTutorialFlow.stop();
    updateInputLock();
    briefingOverlay.classList.remove("is-visible", "is-dismissed");
    resetBriefingInspectState();
    if (immediate) briefingOverlay.hidden = true;
    if (immediate && briefingImage) briefingImage.removeAttribute("src");
  }

  function stopBriefingInspect() {
    briefingOverlay?.classList.remove("is-inspecting");
  }

  function resetBriefingInspectState() {
    if (!briefingOverlay) return;
    briefingInspectHeld = false;
    briefingOverlay.classList.remove("is-inspecting", "is-inspectable");
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
      const level = LEVELS[levelId];
      const completed = Boolean(progress.completedLevels[levelId]);
      const finished = Boolean(progress.finishedLevels[levelId]);
      const unlocked = isLevelUnlocked(levelId);
      const available = Boolean(level?.playable && unlocked);
      node.classList.toggle("is-complete", completed);
      node.classList.toggle("is-finished", finished && !completed);
      node.classList.toggle("is-active", available);
      node.classList.toggle("is-locked", !available);
      node.dataset.completion = completed ? "complete" : finished ? "attempted" : "";
      if ("disabled" in node) node.disabled = !available;
      node.setAttribute(
        "aria-label",
        `${LEVELS[levelId]?.title ?? levelId}${completed ? " complete" : finished ? " attempted" : ""}`,
      );
    });
  }

  function isLevelUnlocked(levelId) {
    const requirements = LEVEL_UNLOCKS[levelId];
    if (!requirements) return Boolean(LEVELS[levelId]?.playable);
    if (requirements.length === 0) return true;
    return requirements.some((requiredLevelId) => progress.completedLevels[requiredLevelId]);
  }

  function showPanel(panelName) {
    hideBriefing(true);
    introTutorialFlow.stop();
    currentPanel = panelName;
    overlay.hidden = false;
    document.body.classList.add("app-ui-open");
    gameApi.releasePointerLock?.();
    updateInputLock();

    panels.forEach((panel, name) => {
      panel.hidden = name !== panelName;
    });
    if (panelName === "level-select" && levelRouteScroll) {
      requestAnimationFrame(() => {
        updateLevelRouteLinks();
        levelRouteScroll.scrollTo({ left: 2810, top: 30 });
      });
    }
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

  function maybeStartIntroTutorial(levelId, delayMs = 0) {
    introTutorialFlow.stop();
    if (levelId !== INTRO_LEVEL_ID || activeGameplayLevelId !== INTRO_LEVEL_ID) return;
    introTutorialFlow.start({ levelId, delayMs });
  }

  function validateLevelMenu() {
    const menuLevelIds = new Set(
      [...document.querySelectorAll("[data-level-id]")]
        .map((node) => node.dataset.levelId)
        .filter(Boolean),
    );

    menuLevelIds.forEach((levelId) => {
      if (!LEVELS[levelId]) {
        throw new Error(`[AppShell] Menu references unknown level: ${levelId}`);
      }
    });

    Object.values(LEVELS).forEach((level) => {
      if (level.playable && !menuLevelIds.has(level.id)) {
        console.warn(`[AppShell] Playable level is missing from the level menu: ${level.id}`);
      }
    });
  }

  function updateInputLock() {
    const uiBlocked = Boolean(transitionActive || briefingActive || isOpen());
    gameApi.setInputLocked?.(uiBlocked);
    subtitleQueue.setBlocked(
      uiBlocked || Boolean(document.querySelector("#resultsOverlay")?.classList.contains("is-visible")),
    );
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
    if (sensitivityValue) sensitivityValue.textContent = `${settings.sensitivity}%`;
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
    if (sensitivityInput && Number(sensitivityInput.value) !== settings.sensitivity) {
      sensitivityInput.value = String(settings.sensitivity);
    }
    document.body.style.setProperty("--ui-scale", String(settings.uiScale / 100));
    gameApi.setBaseFov?.(settings.fov);
    gameApi.setShadowQuality?.(settings.shadowQuality);
    gameApi.setGtaoQuality?.(settings.gtaoQuality);
    gameApi.setSsgiQuality?.(settings.ssgiQuality);
    gameApi.setSsrQuality?.(settings.ssrQuality);
    gameApi.setScreenSpaceShadowQuality?.(settings.screenSpaceShadowQuality);
    gameApi.setMouseSensitivity?.(settings.sensitivity / 100);
  }

  function isOpen() {
    return Boolean(!overlay.hidden && currentPanel);
  }

  return {
    initialRouteReady,
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
      shadowQuality: normalizeQuality(parsed.shadowQuality, ["off", "min", "med", "max"], "min"),
      gtaoQuality: normalizeQuality(parsed.gtaoQuality, ["off", "min", "med", "max"], "off"),
      ssgiQuality: normalizeQuality(parsed.ssgiQuality, ["off", "min", "med", "max"], "off"),
      ssrQuality: normalizeQuality(parsed.ssrQuality, ["off", "min", "med", "max"], "off"),
      screenSpaceShadowQuality: normalizeQuality(
        parsed.screenSpaceShadowQuality,
        ["off", "min", "med", "max"],
        "off",
      ),
      sensitivity: clampNumber(parsed.sensitivity, 40, 180, 100),
    };
  } catch {
    return {
      fov: 72,
      uiScale: 100,
      shadowQuality: "min",
      gtaoQuality: "off",
      ssgiQuality: "off",
      ssrQuality: "off",
      screenSpaceShadowQuality: "off",
      sensitivity: 100,
    };
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      fov: Number(document.querySelector("#settingFov")?.value ?? 72),
      uiScale: Number(document.querySelector("#settingUiScale")?.value ?? 100),
      shadowQuality: document.querySelector("#settingShadowQuality")?.value ?? "min",
      gtaoQuality: document.querySelector("#settingGtaoQuality")?.value ?? "off",
      ssgiQuality: document.querySelector("#settingSsgiQuality")?.value ?? "off",
      ssrQuality: document.querySelector("#settingSsrQuality")?.value ?? "off",
      screenSpaceShadowQuality: document.querySelector("#settingScreenSpaceShadowQuality")?.value ?? "off",
      sensitivity: Number(document.querySelector("#settingSensitivity")?.value ?? 100),
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

function getLevelTitle(levelId) {
  const key = {
    "intro-shift": "levels.intro.title",
    "exploring-around": "levels.exploring.title",
    "shift-coordination": "levels.coordination.title",
    "unexpected-stuff": "levels.unexpected.title",
    "fuel-problems": "levels.fuel.title",
    freeplay: "levels.freeplay.title",
    competitive: "levels.competitive.title",
  }[levelId];
  return key ? translate(key) : LEVELS[levelId]?.title ?? levelId;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}
