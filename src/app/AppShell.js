import { LEVEL_DEFINITIONS as LEVELS } from "../levels/LevelRegistry.js?v=suspended-lamp-properties-2";
import { translate } from "./Localization.js?v=suspended-lamp-properties-2";
import { createIntroTutorialFlow } from "./IntroTutorialFlow.js?v=suspended-lamp-properties-2";
import { createSubtitleQueue } from "./SubtitleQueue.js?v=suspended-lamp-properties-2";
import { createTutorialHintQueue } from "./TutorialHintQueue.js?v=suspended-lamp-properties-2";
import {
  clearPreflightStorage,
  clearProgressStorage,
  createEmptyProgress,
  loadProgress,
  loadSettings,
  requestReturnToMenuAfterPreflight,
  saveProgress,
  saveSettings as persistSettings,
} from "./AppPersistence.js?v=suspended-lamp-properties-2";
import { createAppPanelController } from "./AppPanelController.js?v=suspended-lamp-properties-2";
import { createAppRouter } from "./AppRouter.js?v=suspended-lamp-properties-2";
import { createLevelSelectPanel } from "./panels/LevelSelectPanel.js?v=suspended-lamp-properties-2";
import { createSettingsPanel } from "./panels/SettingsPanel.js?v=suspended-lamp-properties-2";
import { createBriefingPanel } from "./panels/BriefingPanel.js?v=suspended-lamp-properties-2";

const INTRO_LEVEL_ID = "intro-shift";

export function createAppShell({ gameApi }) {
  const overlay = document.querySelector("#appOverlay");
  const routeLoadingOverlay = document.querySelector("#routeLoadingOverlay");
  const routeLoadingPercent = document.querySelector("#routeLoadingPercent");
  const routeLoadingTitle = document.querySelector("#routeLoadingTitle");
  const routeLoadingStatus = document.querySelector("#routeLoadingStatus");
  const routeLoadingBarFill = document.querySelector("#routeLoadingBarFill");
  const subtitleQueue = createSubtitleQueue({ element: document.querySelector("#operatorSubtitle") });
  const tutorialHintQueue = createTutorialHintQueue({
    element: document.querySelector("#tutorialHint"),
    translate,
  });
  const panels = new Map([...document.querySelectorAll("[data-app-panel]")].map((panel) => [panel.dataset.appPanel, panel]));
  const settings = loadSettings();
  const settingsPanel = createSettingsPanel({ settings, gameApi, save: persistSettings });
  const debugConfig = gameApi?.config?.debug ?? {};
  const firstVisitEmulation = Boolean(gameApi?.config?.app?.firstVisitEmulation);
  const returnToMenuAfterPreflight = Boolean(window.operatorGameBootOptions?.returnToMenuAfterPreflight);
  const progress = firstVisitEmulation ? createEmptyProgress() : loadProgress();
  const levelSelectPanel = createLevelSelectPanel({ levels: LEVELS, progress });
  const updateLevelProgressUi = levelSelectPanel.refresh;
  const isLevelUnlocked = levelSelectPanel.isUnlocked;
  let currentPanel = null;
  let previousPanel = "main-menu";
  let transitionActive = false;
  let initialRouteHandled = false;
  let activeGameplayLevelId = null;
  let briefingPanel = null;
  const panelController = createAppPanelController({
    overlay,
    panels,
    onBeforeShow: () => {
      hideBriefing(true);
      introTutorialFlow.stop();
      gameApi.releasePointerLock?.();
    },
    onVisibilityChange: ({ open, panelName }) => {
      currentPanel = panelName;
      updateInputLock();
      if (open && panelName === "level-select") levelSelectPanel.show();
    },
  });
  const router = createAppRouter({
    overlay: routeLoadingOverlay,
    percent: routeLoadingPercent,
    title: routeLoadingTitle,
    status: routeLoadingStatus,
    barFill: routeLoadingBarFill,
    releaseInput: () => gameApi.releasePointerLock?.(),
    onStateChange: (active) => {
      transitionActive = active;
      updateInputLock();
    },
  });
  const introTutorialFlow = createIntroTutorialFlow({
    hintQueue: tutorialHintQueue,
    isAllowed: (state) =>
      Boolean(
        state?.levelId === INTRO_LEVEL_ID &&
          activeGameplayLevelId === INTRO_LEVEL_ID &&
          !briefingPanel?.isActive() &&
          !transitionActive &&
          !isOpen() &&
          !document.querySelector("#resultsOverlay")?.classList.contains("is-visible"),
      ),
  });
  briefingPanel = createBriefingPanel({
    levels: LEVELS,
    onActiveChange: updateInputLock,
    onDismissed: (levelId, delayMs) => maybeStartIntroTutorial(levelId, delayMs),
  });
  const preloadLevelBriefing = briefingPanel.preload;
  const showLevelBriefing = briefingPanel.show;
  const dismissBriefing = briefingPanel.dismiss;
  let resolveInitialRouteReady = null;
  const initialRouteReady = new Promise((resolve) => {
    resolveInitialRouteReady = resolve;
  });

  settingsPanel.apply();
  wireActions();
  levelSelectPanel.wire();
  briefingPanel.wire();
  settingsPanel.wire();
  wireProgression();
  wireTutorialHints();
  wireSubtitles();
  levelSelectPanel.validate();
  levelSelectPanel.refresh();
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
      if (briefingPanel.isActive() && event.code === "Enter" && !event.repeat) {
        event.preventDefault();
        dismissBriefing();
        return;
      }
      if (briefingPanel.isActive() && event.key === "Enter" && !event.repeat) {
        event.preventDefault();
        dismissBriefing();
        return;
      }
      if (briefingPanel.isActive()) {
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
      router.showCurtain();
      requestReturnToMenuAfterPreflight();
      clearPreflightStorage();
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => window.location.reload());
      });
    }
  }

  async function runRouteTransition({ title, status = translate("loading.preparing"), action }) {
    return router.transition({ title, status, action });
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
    clearProgressStorage();
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
      "og('goto intro-elevator')",
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

  function hideBriefing(immediate = false, { keepTutorialHints = false } = {}) {
    if (!keepTutorialHints) introTutorialFlow.stop();
    briefingPanel.hide(immediate);
  }

  function showPanel(panelName) {
    panelController.show(panelName);
  }

  function hideOverlay() {
    panelController.hide();
  }

  function maybeStartIntroTutorial(levelId, delayMs = 0) {
    introTutorialFlow.stop();
    if (levelId !== INTRO_LEVEL_ID || activeGameplayLevelId !== INTRO_LEVEL_ID) return;
    introTutorialFlow.start({ levelId, delayMs });
  }

  function updateInputLock() {
    const uiBlocked = Boolean(transitionActive || briefingPanel.isActive() || isOpen());
    gameApi.setInputLocked?.(uiBlocked);
    subtitleQueue.setBlocked(
      uiBlocked || Boolean(document.querySelector("#resultsOverlay")?.classList.contains("is-visible")),
    );
  }

  function isOpen() {
    return panelController.isOpen();
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

