export function createAppPanelController({ overlay, panels, onBeforeShow, onVisibilityChange }) {
  let currentPanel = null;

  function show(panelName) {
    onBeforeShow?.(panelName);
    currentPanel = panelName;
    overlay.hidden = false;
    document.body.classList.add("app-ui-open");
    panels.forEach((panel, name) => {
      panel.hidden = name !== panelName;
    });
    onVisibilityChange?.({ open: true, panelName });
  }

  function hide() {
    currentPanel = null;
    overlay.hidden = true;
    document.body.classList.remove("app-ui-open");
    panels.forEach((panel) => {
      panel.hidden = true;
    });
    onVisibilityChange?.({ open: false, panelName: null });
  }

  return {
    show,
    hide,
    isOpen: () => Boolean(!overlay.hidden && currentPanel),
    getCurrentPanel: () => currentPanel,
  };
}
