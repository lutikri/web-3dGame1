export class LevelBindingRuntime {
  constructor(options) {
    Object.assign(this, options);
  }

  execute(binding, activeLevelId) {
    const environmentId = this.getLevelEnvironmentId(activeLevelId);
    if (binding.action === "togglePrefabLight") return this.togglePrefabLight(environmentId, binding.target);
    if (binding.action === "toggleRoomLights") {
      this.toggleRoomLights();
      return true;
    }
    this.warn("[LevelSession] Unknown binding action", binding);
    return false;
  }

  togglePrefabLight(levelId, prefabName) {
    const prefab = this.findPrefab(levelId, prefabName);
    if (!prefab?.light) return false;
    return this.setPrefabLightEnabled(levelId, prefabName, prefab.light.enabled === false);
  }

  setPrefabLightEnabled(levelId, prefabName, enabled) {
    const prefab = this.findPrefab(levelId, prefabName);
    const runtime = this.levelPrefabInstances.get(`${levelId}:${prefabName}`);
    const lightConfig = prefab?.light;
    if (!lightConfig || !runtime?.light) return false;
    const wasEnabled = lightConfig.enabled !== false;
    const nextEnabled = Boolean(enabled);
    lightConfig.enabled = nextEnabled;
    if (nextEnabled && !wasEnabled) {
      this.playSoundAtObject(runtime.root, "LampTurnOn1", { maxDistance: 5 });
      this.resetStartup(runtime, lightConfig);
      runtime.afterglowRemaining = 0;
      runtime.fixtureFlicker = this.createFixtureFlickerState(lightConfig.flicker);
      runtime.wasFlickerEnabled = Boolean(lightConfig.flicker?.enabled);
      runtime.startupPattern = lightConfig.fluorescentStartup ? this.createFluorescentStartupPattern() : [];
    } else if (!nextEnabled && wasEnabled) {
      runtime.afterglowRemaining = lightConfig.afterglow?.enabled === false ? 0 : lightConfig.afterglow?.durationSeconds ?? 3;
    }
    this.applyLevelPrefabConfig(levelId, prefabName, false);
    if (nextEnabled && !wasEnabled) this.resetStartup(runtime, lightConfig);
    // Pool slots stay in Three.js' layout; pooled prefab lights remain authored emitters only.
    runtime.light.visible = runtime.light.userData?.pooledEmitter !== true;
    if (!nextEnabled) runtime.light.intensity = 0;
    this.updateControlTooltip();
    return true;
  }

  findPrefab(levelId, prefabName) {
    return this.config.levelEnvironments?.[levelId]?.prefabs?.find((prefab) => prefab.name === prefabName);
  }

  resetStartup(runtime, lightConfig) {
    runtime.startupElapsed = Math.max(0, lightConfig.startupDelaySeconds ?? 0);
    runtime.faultyStarterElapsed = 0;
  }
}
