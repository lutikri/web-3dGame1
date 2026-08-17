import { translateRequired } from "./Localization.js?v=open-facility-bulkheads";

const INTRO_LEVEL_ID = "intro-shift";

export function createIntroTutorialFlow({ hintQueue, isAllowed }) {
  let state = null;
  let hintTimer = 0;
  const subtitleTimers = [];
  const APPLE_SUBTITLE_GUARD_MS = 2800;

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
      state.hintsBlockedUntil = window.performance.now() + APPLE_SUBTITLE_GUARD_MS;
      emitSubtitle("tutorial-apple", 1.9);
    }
  }

  function handleHover(detail = {}) {
    if (!state || !isStepAllowed()) return;
    if (state.step === "wait-panel" && isPanelControlKind(detail.kind)) {
      scheduleLeanHint();
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
      subtitleTimers.push(
        window.setTimeout(() => {
          emitSubtitle("tutorial-start-core", 2.5, { allowAfterComplete: true });
        }, 500),
      );
    }
  }

  function scheduleLeanHint() {
    const remainingMs = Math.max(0, (state?.hintsBlockedUntil ?? 0) - window.performance.now());
    window.clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => {
      if (!isStepAllowed("wait-panel")) return;
      state.step = "lean";
      hintQueue.show({
        id: "lean",
        textKey: "hints.lean",
        tokens: { button: { type: "mouse", side: "right", label: "Right mouse button" } },
      });
    }, remainingMs);
  }

  function isStepAllowed(step = state?.step) {
    return Boolean(state && step === state.step && isAllowed?.(state));
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
