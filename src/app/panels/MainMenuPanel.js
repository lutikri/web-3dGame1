const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;

export function createMainMenuPanel({ root = document } = {}) {
  const panel = root.querySelector("#mainMenuPanel");
  const view = root.defaultView ?? globalThis.window;
  let wired = false;
  let viewportObserver = null;

  function updateScale() {
    if (!panel || !view) return;
    panel.style.setProperty("--main-menu-scale", String(getMainMenuScale(view.innerWidth, view.innerHeight)));
  }

  function wire() {
    if (wired || !panel) return;
    wired = true;
    view?.addEventListener("resize", updateScale);
    if (view?.ResizeObserver && root.documentElement) {
      viewportObserver = new view.ResizeObserver(updateScale);
      viewportObserver.observe(root.documentElement);
    }
    updateScale();
  }

  function dispose() {
    view?.removeEventListener("resize", updateScale);
    viewportObserver?.disconnect();
    viewportObserver = null;
    wired = false;
  }

  return { wire, updateScale, dispose };
}

export function getMainMenuScale(viewportWidth, viewportHeight) {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const height = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  return Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
}
