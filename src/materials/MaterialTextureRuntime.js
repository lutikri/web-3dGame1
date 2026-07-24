export class MaterialTextureRuntime {
  constructor({
    config,
    textureStreaming,
    upgradeQueue,
    loadingIndicator,
    textureSets,
    getMaterials,
    applyCustomMaps,
    applyPanelMaps,
    syncMaterialClones,
    updateRoomLightMaterials,
    createFixtureFlickerState,
    setLoadingStatus,
  }) {
    this.config = config;
    this.textureStreaming = textureStreaming;
    this.upgradeQueue = upgradeQueue;
    this.loadingIndicator = loadingIndicator;
    this.textureSets = textureSets;
    this.getMaterials = getMaterials;
    this.applyCustomMaps = applyCustomMaps;
    this.applyPanelMaps = applyPanelMaps;
    this.syncMaterialClones = syncMaterialClones;
    this.updateRoomLightMaterials = updateRoomLightMaterials;
    this.createFixtureFlickerState = createFixtureFlickerState;
    this.setLoadingStatus = setLoadingStatus;
    this.customMaps = {};
    this.panelMaps = null;
  }

  start() {
    this.#loadCustomMaterials();
    this.#loadPanel();
  }

  async #loadCustomMaterials() {
    try {
      const entries = await Promise.all(
        Object.entries(this.config.interior.specialMaterials ?? {}).map(async ([key, materialConfig]) => {
          const initialPaths = getInitialPaths(materialConfig.maps);
          return [key, await this.#load(initialPaths), getDeferredPaths(materialConfig.maps), initialPaths];
        }),
      );
      entries.forEach(([key, maps, deferredPaths, initialPaths]) => {
        this.customMaps[key] = maps;
        this.#register(`material:${key}`, maps, initialPaths, deferredPaths ? "preview" : "full");
        const material = this.getMaterials().interiorCustom[key];
        this.applyCustomMaps(material, maps, this.config.interior.specialMaterials?.[key]);
        material.userData.textureTier = deferredPaths ? "preview" : "full";
        this.syncMaterialClones(key);
        if (deferredPaths) this.#scheduleCustomUpgrade(key, deferredPaths);
      });
      Object.entries(this.getMaterials().interiorCustom).forEach(([key, material]) => {
        const materialConfig = this.config.interior.specialMaterials?.[key];
        if (materialConfig?.roomLightControlled && !material.userData.fixtureFlicker) {
          material.userData.fixtureFlicker = this.createFixtureFlickerState?.();
        }
      });
      this.updateRoomLightMaterials();
    } catch (error) {
      console.error("[OperatorGame] Failed to load custom interior texture maps", error);
    }
  }

  async #loadPanel() {
    const initialPaths = getInitialPaths(this.config.panel.maps);
    const deferredPaths = getDeferredPaths(this.config.panel.maps);
    try {
      const maps = await this.#load(initialPaths);
      this.panelMaps = maps;
      this.#register("panel:Panel1_PBR", maps, initialPaths, deferredPaths ? "preview" : "full");
      const material = this.getMaterials().panel;
      this.applyPanelMaps(material, maps);
      material.userData.textureTier = deferredPaths ? "preview" : "full";
      if (deferredPaths) this.#schedulePanelUpgrade(deferredPaths);
      console.log("[OperatorGame] Loaded Panel1 PBR texture maps");
    } catch (error) {
      this.setLoadingStatus("PANEL TEXTURE WARNING");
      console.error("[OperatorGame] Failed to load Panel1 texture maps", error);
    }
  }

  #scheduleCustomUpgrade(key, paths) {
    this.upgradeQueue.schedule(async () => {
      try {
        const maps = await this.#load(paths, true);
        const previous = this.customMaps[key];
        this.customMaps[key] = maps;
        this.#register(`material:${key}`, maps, paths, "full");
        const material = this.getMaterials().interiorCustom[key];
        this.applyCustomMaps(material, maps, this.config.interior.specialMaterials?.[key]);
        material.userData.textureTier = "full";
        this.syncMaterialClones(key);
        this.textureStreaming.disposeTextureMaps(previous);
      } catch (error) {
        console.warn(`[OperatorGame] Failed to upgrade ${key} textures`, error);
      }
    });
  }

  #schedulePanelUpgrade(paths) {
    this.upgradeQueue.schedule(async () => {
      try {
        const maps = await this.#load(paths, true);
        const previous = this.panelMaps;
        this.panelMaps = maps;
        this.#register("panel:Panel1_PBR", maps, paths, "full");
        const material = this.getMaterials().panel;
        this.applyPanelMaps(material, maps);
        material.userData.textureTier = "full";
        this.textureStreaming.disposeTextureMaps(previous);
      } catch (error) {
        console.warn("[OperatorGame] Failed to upgrade Panel1 textures", error);
      }
    });
  }

  #load(paths, tracked = false) {
    const options = tracked ? {
      onTextureStart: this.loadingIndicator.start,
      onTextureComplete: this.loadingIndicator.complete,
    } : {};
    return this.textureStreaming.loadTextureMaps(paths, options);
  }

  #register(label, maps, paths, tier) {
    if (!maps) return;
    const pathByMapName = {
      map: paths?.baseColor ?? null,
      normalMap: paths?.normal ?? null,
      ormMap: paths?.orm ?? null,
      roughnessMap: paths?.roughness ?? null,
      emissiveMap: paths?.emissive ?? null,
      maskMap: paths?.mask ?? null,
    };
    this.textureSets.set(label, {
      label,
      tier,
      textures: Object.entries(maps).filter(([, texture]) => Boolean(texture)).map(([mapName, texture]) => ({
        mapName,
        texture,
        path: pathByMapName[mapName] ?? texture?.source?.data?.src ?? "",
      })),
    });
  }
}

function getInitialPaths(paths = {}) {
  return paths?.preview ?? paths?.initial ?? paths;
}

function getDeferredPaths(paths = {}) {
  return paths.preview ? paths.full ?? null : null;
}
