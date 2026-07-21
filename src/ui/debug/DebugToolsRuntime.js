import { createDebugHub } from "./DebugHub.js?v=prototype-flow-1";
import { createPostProcessingDebugPanel } from "./panels/PostProcessingDebugPanel.js?v=prototype-flow-1";
import { createSceneDebugPanels } from "./panels/SceneDebugPanels.js?v=prototype-flow-1";
import { createDebugWorkspace } from "./workspace/DebugWorkspace.js?v=prototype-flow-1";

export class DebugToolsRuntime {
  constructor(options) {
    Object.assign(this, options);
    this.factories ??= { createDebugHub, createPostProcessingDebugPanel, createSceneDebugPanels, createDebugWorkspace };
    this.hub = null;
    this.visible = false;
  }

  setupConfiguredTools() {
    if (this.config.postProcessing.debugPanel?.enabled || this.config.sceneDebug?.enabled) {
      this.setupHub()?.ensureWorkspace?.();
    }
  }

  createPostProcessingPanel = () => {
    const panelConfig = this.config.postProcessing.debugPanel ?? {};
    if (!panelConfig.enabled) return null;
    const panel = this.factories.createPostProcessingDebugPanel({
      config: this.config.postProcessing,
      defaults: this.defaultPostProcessingConfig,
      rebuild: this.rebuildPostProcessing,
      update: this.applyPostProcessing,
    });
    if (panelConfig.startClosed) this.defer(() => panel?.gui.close());
    return panel;
  };

  createWorkspace = () => {
    if (!this.config.sceneDebug?.enabled) return null;
    const workspace = this.factories.createDebugWorkspace({
      levelEnvironmentConfigs: this.config.levelEnvironments,
      gameConfig: this.config.player,
      postProcessingConfig: this.config.postProcessing,
      getPostProcessingQualities: this.getPostProcessingQualities,
      setPostProcessingQuality: this.setPostProcessingQuality,
      soundRegistry: this.soundRegistry,
      soundMix: this.soundMix,
      getAudioDebugState: this.getAudioDebugState,
      getSceneSoundKeys: this.getSceneSoundKeys,
      applyLevelAmbient: this.applyLevelAmbient,
      applyLevelPrefab: this.applyLevelPrefab,
      applyLevelWorld: this.applyLevelWorld,
      applyPlayerCollisionSettings: this.applyPlayerCollisionSettings,
      applyPostProcessing: this.applyPostProcessing,
      rebuildPostProcessing: this.rebuildPostProcessing,
      applyAudioMix: this.applyAudioMix,
      togglePositionGizmo: this.togglePositionGizmo,
    });
    workspace.setActiveLevel(this.getActiveDebugLevel());
    return workspace;
  };

  createScenePanel = () => {
    const panelConfig = this.config.sceneDebug ?? {};
    if (!panelConfig.enabled) return null;
    const panel = this.factories.createSceneDebugPanels({
      levelId: panelConfig.levelId ?? "global",
      materialConfigs: this.config.interior.specialMaterials,
      materialInstances: this.materialInstances,
      lightingConfig: this.config.lighting,
      pointLights: this.pointLights,
      hemisphereLight: this.getHemisphereLight(),
      gameConfig: this.config.player,
      defaults: this.defaultSceneDebugConfig,
      startClosed: panelConfig.startClosed,
      applyShadowSettings: this.applyShadowSettings,
      applyCollisionSettings: this.applyCollisionSettings,
      applyPlayerCollisionSettings: this.applyPlayerCollisionSettings,
      levelEnvironmentConfigs: this.config.levelEnvironments,
      applyLevelAmbient: this.applyLevelAmbient,
      applyLevelPrefab: this.applyLevelPrefab,
      applyLevelWorld: this.applyLevelWorld,
      createLevelPointLight: this.createLevelPointLight,
      togglePositionGizmo: this.togglePositionGizmo,
      applyMaterialOverlay: this.applyMaterialOverlay,
    });
    panel.setActiveLevel(this.getActiveDebugLevel());
    return panel;
  };

  setupHub() {
    if (this.hub) return this.hub;
    this.hub = this.factories.createDebugHub({
      debugOverlay: this.debugOverlay,
      fpsMeter: this.fpsMeter,
      initialVisible: this.visible,
      onHide: (hidden) => { if (hidden) this.stopPositionGizmo(); },
      createScenePanel: this.createScenePanel,
      createPostProcessingPanel: this.createPostProcessingPanel,
      createWorkspace: this.createWorkspace,
    });
    return this.hub;
  }

  rebuildScenePanels() {
    this.hub?.destroyScenePanel?.();
    if (this.config.sceneDebug?.enabled) this.setupHub()?.ensureWorkspace?.();
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    return this.setupHub()?.setVisible(this.visible) ?? this.visible;
  }

  toggle() {
    this.visible = this.setupHub()?.toggle?.() ?? !this.visible;
    return this.visible;
  }

  getHub() { return this.hub; }
}
