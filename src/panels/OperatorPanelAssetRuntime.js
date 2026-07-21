export class OperatorPanelAssetRuntime {
  constructor(options) {
    Object.assign(this, options);
    this.model = null;
  }

  load() {
    this.loader.load(
      this.assetPath,
      (gltf) => this.handleLoaded(gltf.scene),
      (event) => this.handleProgress(event),
      (error) => this.handleError(error),
    );
  }

  handleLoaded(model) {
    this.model = model;
    model.name = "Panel1";
    model.traverse((object) => {
      if (object.isMesh && /coll/i.test(object.name)) {
        object.material = this.collisionDebugMaterial;
        object.visible = Boolean(this.getCollisionVisible());
        object.renderOrder = 1000;
        this.panelCollisionMeshes.push(object);
        return;
      }
      this.registerPanelObject(object);
    });
    this.onModelLoaded(model);
    this.applyActiveLevel();
    this.scene.add(model);
    this.getCollisionLevelIds().forEach((levelId) => this.rebuildLevelStaticPhysics(levelId));
    this.finishLoading();
    this.logLoaded();
    return model;
  }

  handleProgress(event) {
    if (!event.lengthComputable) {
      this.setLoadingProgress(62);
      return;
    }
    this.setLoadingProgress(20 + (event.loaded / event.total) * 74);
  }

  handleError(error) {
    this.setLoadingStatus("PANEL LOAD FAILURE");
    this.reportError("[OperatorGame] Failed to load SM_Panel1.glb", error);
  }

  getLevelConfig(levelId) {
    const environmentId = this.getLevelEnvironmentId(levelId);
    return this.config.levelEnvironments?.[environmentId]?.prefabs?.find(
      (prefab) => prefab.behavior === "operatorPanel",
    ) ?? null;
  }

  applyBaseTransform(model = this.model) {
    if (!model) return false;
    model.position.copy(this.config.panel.position);
    model.rotation.copy(this.config.panel.rotation);
    model.scale.copy(this.config.panel.scale);
    return true;
  }

  applyActiveTransform(levelId, viewMode) {
    if (!this.model) return false;
    this.applyBaseTransform();
    const panelLevelId = viewMode === "menu" ? "intro-shift" : levelId;
    const panelConfig = this.getLevelConfig(panelLevelId);
    this.model.visible = Boolean(panelConfig);
    this.panelCollisionMeshes.forEach((mesh) => {
      mesh.visible = Boolean(panelConfig) && Boolean(this.getCollisionVisible());
    });
    if (!panelConfig) return false;
    if (panelConfig.position) this.model.position.copy(panelConfig.position);
    if (panelConfig.rotation) this.model.rotation.copy(panelConfig.rotation);
    if (panelConfig.scale) this.model.scale.copy(panelConfig.scale);
    this.model.updateMatrixWorld(true);
    return true;
  }
}
