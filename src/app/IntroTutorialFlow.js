import { translateRequired } from "./Localization.js?v=20260707-tutorial2";

const INTRO_LEVEL_ID = "intro-shift";

export function createIntroTutorialFlow({ hintQueue, isAllowed }) {
  let state = null;
  let hintTimer = 0;
  const subtitleTimers = [];

  function start({ levelId, delayMs = 0 } = {}) {
    stop();
    if (levelId !== INTRO_LEVEL_ID) return;
    state = { levelId, step: "move" };
    hintTimer = window.setTimeout(() => {
      if (!isStepAllowed("move")) return;
      hintQueue.show({
        id: "move",
        textKey: "hints.move",
        tokens: {
          keys: ["W", "A", "S", "D"].map((label) => ({ type: "key", label })),
        },
      });
    }, Math.max(0, delayMs));
  }

  function stop() {
    window.clearTimeout(hintTimer);
    subtitleTimers.forEach((timer) => window.clearTimeout(timer));
    subtitleTimers.length = 0;
    state = null;
    hintQueue.clear();
  }

  function handleKey(event) {
    if (!state || event.repeat || !isStepAllowed()) return;
    if (state.step === "move" && ["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      hintQueue.hide("move");
      state.step = "jump";
      hintTimer = window.setTimeout(() => {
        if (!isStepAllowed("jump")) return;
        hintQueue.show({
          id: "jump",
          textKey: "hints.jump",
          tokens: { key: { type: "key", label: "SPACE" } },
        });
      }, 1000);
      return;
    }
    if (state.step === "jump" && event.code === "Space") {
      completeStep("jump");
      state.step = "wait-panel";
      emitSubtitle("tutorial-apple", 1.9);
    }
  }

  function handleHover(detail = {}) {
    if (!state || !isStepAllowed()) return;
    if (state.step === "wait-panel" && isPanelControlKind(detail.kind)) {
      state.step = "lean";
      hintQueue.show({
        id: "lean",
        textKey: "hints.lean",
        tokens: { button: { type: "mouse", side: "right", label: "Right mouse button" } },
      });
      return;
    }
    if (state.step === "wait-knob" && detail.kind === "controlKnob") {
      state.step = "wheel";
      hintQueue.show({
        id: "wheel",
        textKey: "hints.wheel",
        tokens: { wheel: { type: "wheel", label: "Mouse wheel" } },
      });
    }
  }

  function handleInputAction(detail = {}) {
    if (!state || !isStepAllowed()) return;
    if (state.step === "lean" && detail.action === "lean") {
      completeStep("lean");
      state.step = "wait-knob";
      queueSubtitles([
        ["tutorial-where", 350, 2.2],
        ["tutorial-again", 800, 2.3],
        ["tutorial-ignite", 1250, 2.7],
      ]);
    }
  }

  function handleKnobAdjusted() {
    completeStep("wheel");
  }

  function completeStep(step) {
    if (!state || state.step !== step) return;
    hintQueue.hide(step);
    if (step === "wheel") {
      state = null;
      emitSubtitle("tutorial-start-core", 2.5, { allowAfterComplete: true });
    }
  }

  function isStepAllowed(step = state?.step) {
    return Boolean(state && step === state.step && isAllowed?.(state));
  }

  function queueSubtitles(items) {
    items.forEach(([id, delayMs, duration]) => {
      subtitleTimers.push(window.setTimeout(() => emitSubtitle(id, duration), delayMs));
    });
  }

  function emitSubtitle(id, duration = 2.4, { allowAfterComplete = false } = {}) {
    if (!state && !allowAfterComplete) return;
    window.dispatchEvent(
      new CustomEvent("operatorgame:subtitle", {
        detail: {
          id,
          text: translateRequired(`subtitles.${id}`),
          priority: 0,
          duration,
        },
      }),
    );
  }

  return {
    start,
    stop,
    handleKey,
    handleHover,
    handleInputAction,
    handleKnobAdjusted,
  };
}

function isPanelControlKind(kind) {
  return kind === "controlKnob" || kind === "controlButton" || kind === "roomLightButton";
}
