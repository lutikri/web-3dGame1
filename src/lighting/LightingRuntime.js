import * as THREE from "three";

export class LightingRuntime {
  constructor({
    scene,
    controlledLights,
    pointLightsByKey,
    levelLights,
    applyShadowSettings,
  }) {
    this.scene = scene;
    this.controlledLights = controlledLights;
    this.pointLightsByKey = pointLightsByKey;
    this.levelLights = levelLights;
    this.applyShadowSettings = applyShadowSettings;
  }

  createLevel(levelId, lightingConfig) {
    if (!lightingConfig) return [];
    const lights = [];
    const ambient = new THREE.HemisphereLight(
      lightingConfig.ambientSky,
      lightingConfig.ambientGround,
      lightingConfig.ambientIntensity,
    );
    ambient.name = `HemisphereLight_${levelId}`;
    ambient.userData.levelId = levelId;
    ambient.userData.baseIntensity = ambient.intensity;
    this.addLevelLight(levelId, ambient, lights);

    Object.entries(lightingConfig.pointLights ?? {}).forEach(([key, config]) => {
      this.createPointLight(levelId, key, config, lights);
    });
    this.levelLights.set(levelId, lights);
    return lights;
  }

  createPointLight(levelId, key, config, targetLights = null) {
    const light = new THREE.PointLight(config.color, config.intensity, config.distance, config.decay);
    light.name = `PointLight_${levelId}_${key}`;
    light.position.copy(config.position);
    light.userData.levelId = levelId;
    light.userData.baseIntensity = light.intensity;
    light.userData.lightKey = key;
    light.userData.lightConfig = config;
    light.userData.roomLightControlled = Boolean(config.roomLightControlled);
    this.pointLightsByKey.set(`${levelId}:${key}`, light);
    this.applyShadowSettings(light, config);
    const lights = targetLights ?? this.levelLights.get(levelId) ?? [];
    this.addLevelLight(levelId, light, lights);
    this.levelLights.set(levelId, lights);
    return light;
  }

  applyAmbient(levelId, config) {
    const ambient = this.levelLights.get(levelId)?.find((light) => light.isHemisphereLight);
    if (!ambient || !config) return false;
    ambient.color.set(config.ambientSky);
    ambient.groundColor.set(config.ambientGround);
    ambient.intensity = config.ambientIntensity;
    ambient.userData.baseIntensity = ambient.intensity;
    return true;
  }

  disposeLevel(levelId) {
    const lights = this.levelLights.get(levelId) ?? [];
    lights.forEach((light) => {
      this.scene.remove(light);
      light.shadow?.dispose?.();
      const controlledIndex = this.controlledLights.indexOf(light);
      if (controlledIndex >= 0) this.controlledLights.splice(controlledIndex, 1);
    });
    this.levelLights.delete(levelId);
    [...this.pointLightsByKey.keys()]
      .filter((key) => key.startsWith(`${levelId}:`))
      .forEach((key) => this.pointLightsByKey.delete(key));
  }

  addLevelLight(levelId, light, lights) {
    light.userData.levelId = levelId;
    this.controlledLights.push(light);
    lights.push(light);
    this.scene.add(light);
  }
}
