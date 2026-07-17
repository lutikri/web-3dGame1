import * as THREE from "three";
import {
  mergeMarkerPrefabs,
  resolvePrefabMarkers,
} from "../prefabs/PrefabMarkerResolver.js?v=20260717-radio-tight-fade-bright-lamp";
import { applyPendingPrefabOverrides } from "../levels/LevelConfigOverrides.js?v=20260717-radio-tight-fade-bright-lamp";

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

      const markerPrefabs = await buildEnvironment(levelId, environmentConfig);
      const configuredPrefabs = environmentConfig.prefabs ?? [];
      environmentConfig.prefabs = applyPendingPrefabOverrides(
        mergeMarkerPrefabs(
          configuredPrefabs,
          markerPrefabs,
        ),
        configuredPrefabs,
      );
      const tasks = [
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
    return resolvePrefabMarkers(model);
  }

  async function buildCollision(levelId, config) {
    const model = await loadSceneAsset(config.collisionAssetPath);
    model.name = `${levelId}_Collision`;
    applyTransform(model, config);
    const requiredNameParts = config.collision?.meshNameIncludes ?? [];
    const excludedNameParts = config.collision?.meshNameExcludes ?? [];
    const excludedMeshes = [];
    const includedMeshes = [];
    const excludedMeshSet = new Set();
    model.traverse((object) => {
      if (!object.isMesh) return;
      const excluded = excludedNameParts.some((part) =>
        object.name.toLowerCase().includes(String(part).toLowerCase()),
      );
      const included =
        requiredNameParts.length === 0 ||
        requiredNameParts.some((part) => object.name.toLowerCase().includes(String(part).toLowerCase()));
      if (!included || excluded) {
        excludedMeshes.push(object);
        excludedMeshSet.add(object);
        return;
      }
      includedMeshes.push(object);
      object.castShadow = false;
      object.receiveShadow = false;
      object.material = collisionDebugMaterial;
      object.renderOrder = 1000;
    });
    includedMeshes.forEach((object) => {
      if (hasExcludedMeshAncestor(object, excludedMeshSet, model)) model.attach(object);
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

function hasExcludedMeshAncestor(object, excludedMeshSet, stopAt) {
  let current = object.parent;
  while (current && current !== stopAt) {
    if (excludedMeshSet.has(current)) return true;
    current = current.parent;
  }
  return false;
}
