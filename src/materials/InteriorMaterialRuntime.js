export class InteriorMaterialRuntime {
  constructor(options) { Object.assign(this, options); }

  syncPrefabClones(materialKey) {
    const textureMaps = this.textureMaps[materialKey];
    const materialConfig = this.configs?.[materialKey];
    if (!textureMaps || !materialConfig) return 0;
    let updated = 0;
    this.prefabInstances.forEach((runtime) => {
      const legacyEntries = runtime.materialKey === materialKey
        ? runtime.emissiveMaterials.map((material) => ({ material, materialKey }))
        : [];
      const entries = runtime.materialCloneEntries?.length ? runtime.materialCloneEntries : legacyEntries;
      entries.forEach((entry) => {
        if (entry.materialKey !== materialKey) return;
        this.applyTextureMaps(entry.material, textureMaps, materialConfig);
        entry.material.userData.baseEmissiveIntensity = materialConfig.emissiveIntensity ?? 0;
        updated += 1;
      });
    });
    return updated;
  }

  getDebugSnapshot() {
    return Object.fromEntries(Object.entries(this.materials).map(([key, material]) => {
      const config = this.configs?.[key] ?? {};
      const maps = this.textureMaps[key];
      return [key, {
        meshName: material.name, assignedTo: config.meshNames ?? [], mapsLoaded: Boolean(maps),
        maskLoaded: Boolean(maps?.maskMap), maskOverlay: Boolean(config.maskOverlay),
        maskOverlaySettings: config.maskOverlay ?? null, color: `#${material.color.getHexString()}`,
        roughness: material.roughness, metalness: material.metalness,
        emissive: `#${material.emissive.getHexString()}`, emissiveIntensity: material.emissiveIntensity,
        fixtureName: material.userData.fixtureName ?? "", textureRepeat: config.textureRepeat ?? 1,
        textureTier: material.userData.textureTier ?? "",
      }];
    }));
  }
}
