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

  createDefault(lightingConfig, createFixtureFlickerState = () => null) {
    const ambient = new THREE.HemisphereLight(
      lightingConfig.ambientSky,
      lightingConfig.ambientGround,
      lightingConfig.ambientIntensity,
    );
    ambient.userData.levelId = "default";
    ambient.userData.baseIntensity = ambient.intensity;
    this.controlledLights.push(ambient);
    this.scene.add(ambient);

    Object.entries(lightingConfig.pointLights ?? {}).forEach(([key, config]) => {
      const light = new THREE.PointLight(config.color, config.intensity, config.distance, config.decay);
      light.name = `PointLight_${key}`;
      light.userData.levelId = "default";
      light.position.copy(config.position);
      light.userData.baseIntensity = light.intensity;
      light.userData.lightKey = key;
      light.userData.lightConfig = config;
      light.userData.roomLightControlled = Boolean(config.roomLightControlled);
      if (light.userData.roomLightControlled) light.userData.fixtureFlicker = createFixtureFlickerState();
      this.pointLightsByKey.set(key, light);
      this.controlledLights.push(light);
      this.applyShadowSettings(light, config);
      this.scene.add(light);
    });
    return ambient;
  }

  configureFixtures(fixtures = {}, materialsByKey = {}, createFixtureFlickerState = () => null) {
    Object.entries(fixtures).forEach(([fixtureName, fixtureConfig]) => {
      const fixtureState = createFixtureFlickerState();
      const targets = [
        ...(fixtureConfig.lightNames ?? []).map((key) => this.pointLightsByKey.get(key)),
        ...(fixtureConfig.materialKeys ?? []).map((key) => materialsByKey[key]),
      ].filter(Boolean);
      targets.forEach((target) => {
        target.userData.fixtureName = fixtureName;
        target.userData.fixtureFlicker = fixtureState;
        target.userData.roomLightControlled = true;
      });
    });
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

  applyPointLight(levelId, key, config, structural = false) {
    const light = this.pointLightsByKey.get(`${levelId}:${key}`);
    if (!light || !config) return false;
    light.color.set(config.color);
    light.intensity = config.intensity;
    light.userData.baseIntensity = config.intensity;
    light.distance = config.distance;
    light.decay = config.decay;
    if (config.position) light.position.copy(config.position);
    light.userData.roomLightControlled = Boolean(config.roomLightControlled);
    if (structural) this.applyShadowSettings(light, config);
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

export function applyLightShadowSettings(light, lightConfig, shadowPreset) {
  const allowedByTier = !shadowPreset.heroOnly || lightConfig.heroShadow === true;
  light.castShadow = Boolean(shadowPreset.enabled && allowedByTier && lightConfig.castShadow);
  if (light.shadow?.camera) {
    light.shadow.camera.near = lightConfig.shadowNear ?? 0.1;
    light.shadow.camera.far = lightConfig.shadowFar ?? lightConfig.distance ?? 10;
    light.shadow.camera.updateProjectionMatrix();
  }
  if (!light.castShadow) return false;
  const mapSize = shadowPreset.mapSize ?? lightConfig.shadowMapSize ?? 512;
  light.shadow.mapSize.set(mapSize, mapSize);
  light.shadow.bias = lightConfig.shadowBias ?? -0.0005;
  light.shadow.normalBias = lightConfig.shadowNormalBias ?? 0.03;
  light.shadow.radius = lightConfig.shadowRadius ?? 1;
  return true;
}
