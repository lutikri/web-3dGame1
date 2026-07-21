export class DebugTransformTargetResolver {
  constructor({ config, getPanelModel, getPrefabInstance, getPointLight }) {
    Object.assign(this, { config, getPanelModel, getPrefabInstance, getPointLight });
  }

  resolve = (descriptor) => {
    if (descriptor.type === "prefab") {
      const prefabConfig = this.config.levelEnvironments?.[descriptor.levelId]?.prefabs?.find(
        (prefab) => prefab.name === descriptor.key,
      );
      return prefabConfig?.behavior === "operatorPanel"
        ? this.getPanelModel()
        : this.getPrefabInstance(descriptor.levelId, descriptor.key)?.root ?? null;
    }
    if (descriptor.type === "prefabLightOffset") {
      return this.getPrefabInstance(descriptor.levelId, descriptor.key)?.light ?? null;
    }
    if (descriptor.type === "levelPointLight") {
      return this.getPointLight(descriptor.levelId, descriptor.key) ?? null;
    }
    if (descriptor.type === "globalPointLight") return this.getPointLight(null, descriptor.key) ?? null;
    return null;
  };
}
