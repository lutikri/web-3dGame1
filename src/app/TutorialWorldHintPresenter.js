export function createTutorialWorldHintPresenter({ element, getAnchor }) {
  let target = null;
  let frame = 0;

  function show(nextTarget) {
    target = nextTarget;
    if (element) element.textContent = nextTarget?.indicator ?? "!";
    if (!frame) frame = window.requestAnimationFrame(update);
  }

  function clear() {
    target = null;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    if (element) element.hidden = true;
  }

  function update() {
    frame = 0;
    if (!target || !element) return;
    const anchor = getAnchor?.(target);
    element.hidden = !anchor?.visible;
    if (anchor?.visible) {
      element.style.left = `${anchor.x}px`;
      element.style.top = `${anchor.y}px`;
    }
    frame = window.requestAnimationFrame(update);
  }

  return { show, clear };
}
