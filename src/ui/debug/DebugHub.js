export function createDebugHub({
  createScenePanel,
  createPostProcessingPanel,
  createWorkspace,
  debugOverlay = null,
  fpsMeter = null,
  onHide = null,
  initialVisible = true,
}) {
  let visible = Boolean(initialVisible);
  let scenePanel = null;
  let postProcessingPanel = null;
  let workspace = null;

  function applyVisibility() {
    onHide?.(!visible);
    if (debugOverlay) debugOverlay.hidden = !visible;
    if (fpsMeter) fpsMeter.hidden = !visible;
    document.body.classList.toggle("debug-hidden", !visible);
    scenePanel?.setVisible?.(visible);
    workspace?.setVisible?.(visible);
    if (postProcessingPanel) {
      if (visible) postProcessingPanel.show();
      else postProcessingPanel.hide();
    }
    return visible;
  }

  function ensureScenePanel() {
    if (!scenePanel) {
      scenePanel = createScenePanel?.() ?? null;
      if (scenePanel && !visible) scenePanel.setVisible?.(false);
    }
    return scenePanel;
  }

  function ensureWorkspace() {
    if (!workspace) {
      workspace = createWorkspace?.() ?? null;
      if (workspace) workspace.setVisible?.(visible);
    }
    return workspace;
  }

  function ensurePostProcessingPanel() {
    if (!postProcessingPanel) {
      postProcessingPanel = createPostProcessingPanel?.() ?? null;
      if (postProcessingPanel && !visible) postProcessingPanel.hide?.();
    }
    return postProcessingPanel;
  }

  function destroyScenePanel() {
    scenePanel?.destroy?.();
    scenePanel = null;
    workspace?.destroy?.();
    workspace = null;
  }

  function setVisible(nextVisible) {
    visible = Boolean(nextVisible);
    return applyVisibility();
  }

  return {
    ensureScenePanel,
    ensureWorkspace,
    ensurePostProcessingPanel,
    destroyScenePanel,
    setVisible,
    toggle: () => setVisible(!visible),
    isVisible: () => visible,
    setActiveLevel: (levelId) => {
      scenePanel?.setActiveLevel?.(levelId);
      ensureWorkspace()?.setActiveLevel?.(levelId);
    },
    scene: {
      save: () => ensureWorkspace()?.saveProject?.() ?? ensureScenePanel()?.save?.(),
      saveProject: () => ensureWorkspace()?.saveProject?.() ?? ensureScenePanel()?.saveProject?.(),
      load: () => ensureScenePanel()?.load?.(),
      reset: () => ensureScenePanel()?.reset?.(),
      copyConfig: () => ensureScenePanel()?.copyConfig?.(),
      getProjectConfig: () => ensureScenePanel()?.getProjectConfig?.(),
    },
    postProcessing: {
      show: () => ensureWorkspace()?.select?.("global:postfx"),
      hide: () => ensureWorkspace()?.setVisible?.(false),
      toggle: () => ensureWorkspace()?.select?.("global:postfx"),
      save: () => ensurePostProcessingPanel()?.save?.(),
      saveProject: () => ensureWorkspace()?.savePostProcessingToProject?.() ?? ensurePostProcessingPanel()?.saveProject?.(),
      load: () => ensurePostProcessingPanel()?.load?.(),
      reset: () => ensurePostProcessingPanel()?.reset?.(),
      copyConfig: () => ensureWorkspace()?.copyPostProcessingConfig?.() ?? ensurePostProcessingPanel()?.copyConfig?.(),
      getProjectConfig: () => null,
    },
  };
}
