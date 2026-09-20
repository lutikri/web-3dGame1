import { getMainMenuScale } from "./MainMenuPanel.js?v=alarm-silence";

export function isGameplayPausePanel({ levelId, open, panelName, previousPanel }) {
  return Boolean(levelId && open && (
    panelName === "pause" || (panelName === "settings" && previousPanel === "pause")
  ));
}

export function createPausePanel({ root = document, gameApi, levels, translate }) {
  const panel = root.querySelector("#pausePanel");
  const view = root.defaultView ?? globalThis.window;
  const assignment = panel?.querySelector("[data-pause-assignment]");
  const elapsed = panel?.querySelector("[data-pause-elapsed]");
  let wired = false;

  function updateScale() {
    if (!panel || !view) return;
    panel.style.setProperty("--main-menu-scale", String(getMainMenuScale(view.innerWidth, view.innerHeight)));
  }

  function show(levelId) {
    updateScale();
    const titleKey = levels[levelId]?.assignment?.titleKey;
    if (assignment) assignment.textContent = titleKey ? translate(titleKey) : levels[levelId]?.title ?? "—";
    const seconds = Math.max(0, Math.floor(gameApi.getState?.().levelSession?.elapsedSeconds ?? 0));
    if (elapsed) elapsed.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function wire() {
    if (wired || !panel) return;
    wired = true;
    view?.addEventListener("resize", updateScale);
    updateScale();
  }

  return { wire, show };
}
