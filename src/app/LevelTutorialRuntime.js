export function createLevelTutorialRuntime({ hintQueue, worldHint, emitThought, isAllowed }) {
  let state = null;
  let revealTimer = 0;
  let advanceTimer = 0;
  let hoverConfirmTimer = 0;

  function start({ levelId, config } = {}) {
    stop();
    if (!config?.enabled) return false;
    state = {
      levelId,
      config,
      milestones: new Set(),
      hoveredKind: "none",
      hoveredPrefabName: "",
      thoughts: new Set(),
      revealed: false,
      narrationActive: false,
      presentedHintId: null,
      worldHintVisible: false,
      waitingToAdvance: false,
      controlHintKind: null,
    };
    revealTimer = window.setTimeout(() => {
      if (!state) return;
      state.revealed = true;
      reconcile();
    }, Math.max(0, config.spawnHintDelaySeconds ?? 2) * 1000);
    return true;
  }

  function stop() {
    window.clearTimeout(revealTimer);
    window.clearTimeout(advanceTimer);
    window.clearTimeout(hoverConfirmTimer);
    state = null;
    hintQueue.clear();
    worldHint.clear();
  }

  function handleKey(event) {
    if (!active() || event.repeat || state.presentedHintId !== "move") return;
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      complete("moved", true, state.config.postMovementDelaySeconds ?? 5);
    }
  }

  function handleMouseMove(event) {
    if (!active() || state.presentedHintId !== "look") return;
    if (Math.abs(event.movementX) + Math.abs(event.movementY) >= 2) complete("lookedAround");
  }

  function handleHover(detail = {}) {
    if (!active() || detail.levelId !== state.levelId) return;
    const nextKind = detail.kind ?? "none";
    const nextPrefabName = detail.prefabName ?? "";
    if (nextKind === state.hoveredKind && nextPrefabName === state.hoveredPrefabName) return;
    state.hoveredKind = nextKind;
    state.hoveredPrefabName = nextPrefabName;
    window.clearTimeout(hoverConfirmTimer);
    if (isConfirmableHover(nextKind, nextPrefabName)) {
      hoverConfirmTimer = window.setTimeout(
        confirmCurrentHover,
        Math.max(0, state.config.hoverConfirmSeconds ?? 0.4) * 1000,
      );
    }
    reconcile();
  }

  function handleInputAction(detail = {}) {
    if (!active() || detail.levelId !== state.levelId) return;
    if (detail.action === "lean" && state.presentedHintId === "lean") complete("leanedAtPanel");
    if (
      detail.action === "primary"
      && state.presentedHintId === "door-hold"
      && detail.kind === "doorLatchHandle"
      && detail.prefabName === state.config.entryDoorTarget
    ) complete("entryDoorOpened");
  }

  function handleEvent({ type, detail = {} } = {}) {
    if (!state) return;
    const isBlockingNarration = detail.line === "welcome" || detail.line === state.config.controlBoothNarration;
    if (type === "doorOpened" && detail.target === state.config.entryDoorTarget) complete("entryDoorOpened");
    if (type === "narrationStarted" && isBlockingNarration) {
      state.narrationActive = true;
      if (detail.line === "welcome") state.milestones.add("entryDoorOpened");
      present(null);
    }
    if (type === "narrationEnded" && isBlockingNarration) {
      state.narrationActive = false;
      if (detail.line === "welcome") complete("welcomeFinished");
      else reconcile();
    }
    if (type === "briefOpened") complete("briefOpened");
    if (type === "triggerEntered" && detail.target === state.config.welcomeTrigger) {
      ["moved", "lookedAround", "entryDoorOpened"].forEach((id) => state.milestones.add(id));
      present(null);
    }
    if (type === "triggerEntered" && detail.target === state.config.mainCorridorTrigger) {
      complete("mainCorridorEntered", false);
      sayOnce("main-corridor", state.config.mainCorridorThought);
      reconcile();
    }
    if (type === "triggerEntered" && detail.target === state.config.controlBoothTrigger) {
      complete("controlBoothEntered");
    }
    if (type === "knobAdjusted" || type === "buttonPressed") {
      complete("controlUsed", false);
      sayOnce("start-core", state.config.startCoreThought);
      reconcile();
    }
    if (type === "coreStarted") {
      ["controlBoothEntered", "leanedAtPanel", "controlUsed", "coreStarted"].forEach((id) => state.milestones.add(id));
      present(null);
    }
  }

  function complete(id, shouldReconcile = true, delaySeconds = null) {
    if (!state || state.milestones.has(id)) return;
    state.milestones.add(id);
    if (!shouldReconcile) return;
    const delayMs = Math.max(0, delaySeconds ?? state.config.advanceHintDelaySeconds ?? 2) * 1000;
    present(null);
    window.clearTimeout(advanceTimer);
    state.waitingToAdvance = delayMs > 0;
    advanceTimer = window.setTimeout(() => {
      if (!state) return;
      state.waitingToAdvance = false;
      reconcile();
    }, delayMs);
  }

  function reconcile() {
    if (!state) return;
    if (!active() || !state.revealed || state.waitingToAdvance || state.narrationActive) return present(null);
    const done = (id) => state.milestones.has(id);
    if (done("coreStarted")) return present(null);
    if (!done("lookedAround")) return present("look", "hints.exploringLook", { button: mouseToken("Mouse") });
    if (!done("moved")) return present("move", "hints.exploringMove", { keys: keyTokens(["W", "A", "S", "D"]) });
    if (!done("entryDoorOpened")) {
      if (done("entryDoorHandleSeen")) {
        return present("door-hold", "hints.exploringDoor", { button: mouseToken("Left mouse button", "left") }, {
          prefab: state.config.entryDoorTarget,
          role: "latchHandle",
          indicator: "!",
        });
      }
      return present("door-look", "hints.exploringDoorLook", {}, {
        prefab: state.config.entryDoorTarget,
        role: "latchHandle",
        indicator: "!",
      });
    }
    if (!done("welcomeFinished")) return present(null);
    if (!done("briefOpened") && !done("mainCorridorEntered") && !done("controlBoothEntered")) {
      if (done("briefSeen")) {
        return present("brief-hold", "hints.exploringBriefHold", { button: mouseToken("Left mouse button", "left") });
      }
      return present("brief", "hints.exploringBrief");
    }
    if (!done("controlBoothEntered")) return present(null);
    if (!done("leanedAtPanel")) return present("lean", "hints.exploringLean", { button: mouseToken("Right mouse button", "right") });
    if (done("controlUsed")) return present(null);
    if (state.controlHintKind === "controlKnob") return present("wheel", "hints.exploringWheel", { wheel: { type: "wheel", label: "Mouse wheel" } });
    if (state.controlHintKind === "controlButton" || state.controlHintKind === "roomLightButton") {
      return present("button", "hints.exploringButton", { button: mouseToken("Left mouse button", "left") });
    }
    return present(null);
  }

  function isConfirmableHover(kind, prefabName) {
    if (kind === "doorLatchHandle") {
      return prefabName === state.config.entryDoorTarget && !state.milestones.has("entryDoorHandleSeen");
    }
    if (kind === "briefSheet") return !state.milestones.has("briefSeen");
    return !state.controlHintKind && ["controlKnob", "controlButton", "roomLightButton"].includes(kind);
  }

  function confirmCurrentHover() {
    hoverConfirmTimer = 0;
    if (!state || !isConfirmableHover(state.hoveredKind, state.hoveredPrefabName)) return;
    if (state.hoveredKind === "doorLatchHandle") state.milestones.add("entryDoorHandleSeen");
    else if (state.hoveredKind === "briefSheet") state.milestones.add("briefSeen");
    else if (!state.controlHintKind) state.controlHintKind = state.hoveredKind;
    reconcile();
  }

  function present(id, textKey, tokens = {}, worldTarget = null) {
    if (!state) return;
    if (id !== state.presentedHintId) {
      hintQueue.clear();
      state.presentedHintId = id;
      if (id) hintQueue.show({ id, textKey, tokens });
    }
    if (worldTarget && !state.worldHintVisible) {
      worldHint.show(worldTarget);
      state.worldHintVisible = true;
    } else if (!worldTarget && state.worldHintVisible) {
      worldHint.clear();
      state.worldHintVisible = false;
    }
  }

  function sayOnce(id, thoughtId) {
    if (!thoughtId || state.thoughts.has(id)) return;
    state.thoughts.add(id);
    emitThought(thoughtId);
  }

  function active() {
    return Boolean(state && isAllowed?.(state));
  }

  return { start, stop, refresh: reconcile, handleKey, handleMouseMove, handleHover, handleInputAction, handleEvent };
}

function keyTokens(labels) {
  return labels.map((label) => ({ type: "key", label }));
}

function mouseToken(label, side = "") {
  return { type: "mouse", side, label };
}
