const UI_CONTROL_SELECTOR = "button, [role='button'], [data-app-action]";

export function resolveUiAudioControl(root, target) {
  const control = target?.closest?.(UI_CONTROL_SELECTOR) ?? null;
  if (!control || !root?.contains?.(control)) return null;
  if (control.disabled || control.getAttribute?.("aria-disabled") === "true") return null;
  return control;
}

export function createUiAudioInteractionRuntime({ root, isAudioUnlocked, playHover, playClick }) {
  let hoveredControl = null;

  function handlePointerMove(event) {
    const control = resolveUiAudioControl(root, event?.target);
    if (control === hoveredControl) return false;
    hoveredControl = control;
    if (!control || !isAudioUnlocked?.()) return false;
    playHover?.();
    return true;
  }

  function handleClick(event) {
    const control = resolveUiAudioControl(root, event?.target);
    if (!control) return false;
    playClick?.();
    return true;
  }

  return {
    handlePointerMove,
    handleClick,
    reset: () => {
      hoveredControl = null;
    },
  };
}
