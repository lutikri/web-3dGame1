import * as THREE from "three";

export function createLevelSceneBuilder({
  scene,
  loadSceneAsset,
  collisionDebugMaterial,
  isCollisionVisible,
  registerEnvironmentObject,
  createPrefabRuntime,
  registerPrefabInteraction,
  applyPrefabConfig,
  appendPanelPhysics,
  environmentModels,
  collisionModels,
  prefabInstances,
}) {
  return {
    async build(levelRuntime, levelId, environmentConfig) {
      const prefabGroup = new THREE.Group();
      prefabGroup.name = `${levelId}_Prefabs`;
      environmentModels.set(`${levelId}:prefabs`, prefabGroup);
      scene.add(prefabGroup);

      const tasks = [
        buildEnvironment(levelId, environmentConfig),
        buildCollision(levelId, environmentConfig),
        ...(environmentConfig.prefabs ?? [])
          .filter((prefabConfig) => prefabConfig.behavior !== "operatorPanel")
          .map((prefabConfig) => buildPrefab(levelId, prefabConfig, prefabGroup)),
      ];
      const results = await Promise.allSettled(tasks);
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
      return levelRuntime;
    },
  };

  async function buildEnvironment(levelId, config) {
    const model = await loadSceneAsset(config.assetPath);
    model.name = `${levelId}_Environment`;
    applyTransform(model, config);
    const excludedNameParts = config.render?.meshNameExcludes ?? [];
    const excludedMeshes = [];
    model.traverse((object) => {
      if (
        object.isMesh &&
        excludedNameParts.some((part) => object.name.toLowerCase().includes(String(part).toLowerCase()))
      ) {
        excludedMeshes.push(object);
        return;
      }
      registerEnvironmentObject(object, config, levelId);
    });
    excludedMeshes.forEach((object) => object.parent?.remove(object));
    environmentModels.set(levelId, model);
    scene.add(model);
  }

  async function buildCollision(levelId, config) {
    const model = await loadSceneAsset(config.collisionAssetPath);
    model.name = `${levelId}_Collision`;
    applyTransform(model, config);
    const requiredNameParts = config.collision?.meshNameIncludes ?? [];
    const excludedMeshes = [];
    model.traverse((object) => {
      if (!object.isMesh) return;
      const included =
        requiredNameParts.length === 0 ||
        requiredNameParts.some((part) => object.name.toLowerCase().includes(String(part).toLowerCase()));
      if (!included) {
        excludedMeshes.push(object);
        return;
      }
      object.castShadow = false;
      object.receiveShadow = false;
      object.material = collisionDebugMaterial;
      object.renderOrder = 1000;
    });
    excludedMeshes.forEach((object) => object.parent?.remove(object));
    model.visible = isCollisionVisible();
    collisionModels.set(levelId, model);
    scene.add(model);
    appendPanelPhysics(levelId, model);
  }

  async function buildPrefab(levelId, prefabConfig, prefabGroup) {
    const prefab = await loadSceneAsset(prefabConfig.assetPath);
    prefab.name = prefabConfig.name;
    prefab.position.copy(prefabConfig.position ?? new THREE.Vector3());
    prefab.rotation.copy(prefabConfig.rotation ?? new THREE.Euler());
    prefab.scale.copy(prefabConfig.scale ?? new THREE.Vector3(1, 1, 1));

    const runtime = createPrefabRuntime(prefab, prefabConfig);
    prefabInstances.set(`${levelId}:${prefabConfig.name}`, runtime);
    registerPrefabInteraction(levelId, prefabConfig, runtime);
    prefabGroup.add(prefab);
    applyPrefabConfig(levelId, prefabConfig.name, true);
  }
}

function applyTransform(model, config) {
  model.position.copy(config.position ?? new THREE.Vector3());
  model.rotation.copy(config.rotation ?? new THREE.Euler());
  model.scale.copy(config.scale ?? new THREE.Vector3(1, 1, 1));
  model.updateMatrixWorld(true);
}
