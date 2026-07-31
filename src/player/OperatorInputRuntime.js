import * as THREE from "three";

const MOVEMENT_CODES = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "ShiftLeft",
  "ShiftRight",
  "Space",
  "ControlLeft",
  "ControlRight",
]);

export function createOperatorInputRuntime({
  config,
  canvas,
  lockButton,
  camera,
  pointer,
  keys,
  unlockAudio,
  isInputLocked,
  isLookOnly,
  isUiOpen,
  isDebugTransformEditing,
  getNoclipEnabled,
  setNoclipEnabled,
  setJumpQueued,
  getZoomActive,
  setZoomActive,
  getDraggedDoor,
  updateCameraLook,
  syncCameraLook,
  updateDoorDrag,
  adjustNoclipSpeed,
  getHoveredKnob,
  adjustControlKnob,
  getActiveLevelId,
  updateHoverTarget,
  getHoveredInteractive,
  canLean = () => true,
  beginItemPrimary = () => false,
  releaseItemPrimary = () => false,
  cancelItemPrimary = () => false,
  activateRelevantItem = () => false,
  dropHandledItem = () => false,
  beginInventorySelection = () => false,
  moveInventorySelection = () => false,
  commitInventorySelection = () => false,
  cancelInventorySelection = () => false,
  activateInteractive,
  releasePrimaryInteractions,
  releaseAllControls,
  requestPointerLock,
  toggleDebugPanels,
  now = () => performance.now() / 1000,
}) {
  const removers = [];
  let debugToggleBuffer = "";
  let dropPressedAt = null;

  function wire() {
    listen(document, "keydown", handleDebugToggle);
    listen(document, "pointerdown", unlockAudio);
    listen(document, "keydown", handleKeyDown);
    listen(document, "keyup", handleKeyUp);
    listen(document, "mousemove", handleMouseMove);
    listen(canvas, "wheel", handleWheel, { passive: false });
    listen(canvas, "mousedown", handleMouseDown);
    listen(window, "mouseup", handleMouseUp);
    listen(canvas, "contextmenu", (event) => event.preventDefault());
    listen(window, "blur", handleBlur);
    listen(canvas, "click", handleCanvasClick);
    listen(lockButton, "click", requestPointerLock);
    listen(document, "pointerlockchange", handlePointerLockChange);
  }

  function dispose() {
    while (removers.length) removers.pop()();
    keys.clear();
    setZoomActive(false);
    cancelItemPrimary();
    cancelInventorySelection();
    dropPressedAt = null;
    releasePrimaryInteractions();
    releaseAllControls();
  }

  function handleDebugToggle(event) {
    unlockAudio();
    const toggleSequence = String(config.sceneDebug?.toggleSequence ?? "debug3").toLowerCase();
    if (isTextEditingTarget(event.target) || event.ctrlKey || event.altKey || event.metaKey || event.repeat || event.key.length !== 1) return;
    debugToggleBuffer = `${debugToggleBuffer}${event.key.toLowerCase()}`.slice(-toggleSequence.length);
    if (debugToggleBuffer !== toggleSequence) return;
    debugToggleBuffer = "";
    event.preventDefault();
    toggleDebugPanels();
  }

  function handleKeyDown(event) {
    unlockAudio();
    if (isInputLocked()) {
      if (isMovementCode(event.code)) event.preventDefault();
      return;
    }
    if (isMovementCode(event.code)) event.preventDefault();
    if (event.code === "Tab") {
      event.preventDefault();
      if (!event.repeat) beginInventorySelection();
      return;
    }
    if (event.code === "KeyE") {
      event.preventDefault();
      if (!event.repeat) {
        updateHoverTarget();
        activateRelevantItem(getHoveredInteractive());
      }
      return;
    }
    if (event.code === "KeyQ") {
      event.preventDefault();
      if (!event.repeat && dropPressedAt == null) dropPressedAt = now();
      return;
    }
    if (event.code === "KeyN" && !event.repeat) {
      const enabled = !getNoclipEnabled();
      setNoclipEnabled(enabled);
      console.log(`[OperatorGame] Noclip ${enabled ? "enabled" : "disabled"}`);
    }
    if (isLookOnly()) {
      if (isMovementCode(event.code)) event.preventDefault();
      setJumpQueued(false);
    } else if (event.code === "Space" && !event.repeat && !getNoclipEnabled()) {
      setJumpQueued(true);
    }
    keys.add(event.code);
  }

  function handleKeyUp(event) {
    keys.delete(event.code);
    if (event.code === "KeyQ" && dropPressedAt != null) {
      event.preventDefault();
      const heldSeconds = Math.max(0, now() - dropPressedAt);
      dropPressedAt = null;
      if (!isInputLocked()) {
        dropHandledItem({
          throwStrength: getThrowStrength(heldSeconds),
        });
      }
      return;
    }
    if (event.code !== "Tab") return;
    event.preventDefault();
    if (isInputLocked()) cancelInventorySelection();
    else commitInventorySelection();
  }

  function handleMouseMove(event) {
    if (isInputLocked()) return;
    if (getDraggedDoor()) {
      updateCameraLook(event.movementX, event.movementY);
      syncCameraLook();
      updateDoorDrag();
      return;
    }
    if (document.pointerLockElement !== canvas) {
      updatePointerFromEvent(event);
      return;
    }
    pointer.set(0, 0);
    updateCameraLook(event.movementX, event.movementY);
  }

  function handleWheel(event) {
    if (isInputLocked()) return;
    if (moveInventorySelection(Math.sign(event.deltaY))) {
      event.preventDefault();
      return;
    }
    if (isLookOnly()) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey) {
      event.preventDefault();
      adjustNoclipSpeed(-Math.sign(event.deltaY));
      return;
    }
    const knob = getHoveredKnob();
    if (!knob) return;
    event.preventDefault();
    const rawDelta = -event.deltaY * config.controls.wheelPercentPerDelta;
    const delta = THREE.MathUtils.clamp(
      rawDelta,
      -config.controls.wheelMaxStepPercent,
      config.controls.wheelMaxStepPercent,
    );
    adjustControlKnob(knob, delta);
    window.dispatchEvent(new CustomEvent("operatorgame:knob-adjusted", {
      detail: { levelId: getActiveLevelId(), name: knob.name, percent: knob.userData.controlPercent },
    }));
  }

  function handleMouseDown(event) {
    unlockAudio();
    if (isDebugTransformEditing()) return;
    if (isInputLocked()) {
      event.preventDefault();
      return;
    }
    if (isLookOnly()) {
      if (event.button === 0 && document.pointerLockElement !== canvas) requestPointerLock();
      event.preventDefault();
      return;
    }
    if (event.button === 2) {
      event.preventDefault();
      if (!canLean()) return;
      setZoomActive(true);
      window.dispatchEvent(new CustomEvent("operatorgame:input-action", {
        detail: { action: "lean", levelId: getActiveLevelId() },
      }));
      if (document.pointerLockElement !== canvas) requestPointerLock();
      return;
    }
    if (event.button !== 0) return;
    if (document.pointerLockElement !== canvas) updatePointerFromEvent(event);
    updateHoverTarget();
    const target = getHoveredInteractive();
    const levelPrefabKey = target?.userData.levelPrefabKey ?? "";
    window.dispatchEvent(new CustomEvent("operatorgame:input-action", {
      detail: {
        action: "primary",
        levelId: getActiveLevelId(),
        kind: target?.userData.kind,
        name: target?.name,
        prefabName: levelPrefabKey.split(":").slice(1).join(":"),
      },
    }));
    if (beginItemPrimary(target)) return;
    activateInteractive(target);
  }

  function handleMouseUp(event) {
    if (event.button === 2) setZoomActive(false);
    if (event.button === 0) {
      releaseItemPrimary();
      releasePrimaryInteractions();
    }
    releaseAllControls();
  }

  function handleBlur() {
    setZoomActive(false);
    cancelItemPrimary();
    cancelInventorySelection();
    dropPressedAt = null;
    releasePrimaryInteractions();
    releaseAllControls();
  }

  function handleCanvasClick() {
    unlockAudio();
    if (isInputLocked() || isUiOpen()) return;
    if (document.pointerLockElement !== canvas) requestPointerLock();
  }

  function handlePointerLockChange() {
    lockButton.textContent = document.pointerLockElement === canvas ? "Pointer Locked" : "Enter First Person";
    if (document.pointerLockElement === canvas) pointer.set(0, 0);
    setZoomActive(false);
    if (document.pointerLockElement !== canvas) {
      cancelItemPrimary();
      cancelInventorySelection();
      dropPressedAt = null;
    }
    releaseAllControls();
  }

  function updatePointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  }

  return { wire, dispose, updatePointerFromEvent };
}

export function isMovementCode(code) {
  return MOVEMENT_CODES.has(code);
}

export function getThrowStrength(heldSeconds) {
  const duration = Math.max(0, Number(heldSeconds) || 0);
  return duration < 0.35 ? 0 : Math.min(1, (duration - 0.35) / 0.65);
}

export function isTextEditingTarget(target) {
  const tagName = target?.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || Boolean(target?.isContentEditable);
}
