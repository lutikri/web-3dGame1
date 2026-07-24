import * as THREE from "three";
import {
  mergeMarkerPrefabs,
  resolveNestedPrefabMarkers,
  resolvePrefabMarkers,
} from "../prefabs/PrefabMarkerResolver.js?v=subtitle-route-fades";
import {
  applyPrefabOverrideEntries,
  getPendingPrefabOverrides,
} from "../levels/LevelConfigOverrides.js?v=subtitle-route-fades";
import { resolveBriefSocketPrefabs } from "../game/BriefPlacementRuntime.js?v=subtitle-route-fades";

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
  getLanguage = () => "en",
}) {
  return {
    async build(levelRuntime, levelId, environmentConfig) {
      const prefabGroup = new THREE.Group();
      prefabGroup.name = `${levelId}_Prefabs`;
      environmentModels.set(`${levelId}:prefabs`, prefabGroup);
      scene.add(prefabGroup);

      const markerPrefabs = await buildEnvironment(levelId, environmentConfig);
      const configuredPrefabs = environmentConfig.prefabs ?? [];
      const pendingPrefabOverrides = getPendingPrefabOverrides(configuredPrefabs);
      environmentConfig.prefabs = applyPrefabOverrideEntries(
        mergeMarkerPrefabs(
          configuredPrefabs,
          markerPrefabs,
        ),
        pendingPrefabOverrides,
      );
      const tasks = [
        buildCollision(levelId, environmentConfig),
        ...(environmentConfig.prefabs ?? [])
          .filter((prefabConfig) => prefabConfig.behavior !== "operatorPanel")
          .map((prefabConfig) =>
            buildPrefab(levelId, environmentConfig, prefabConfig, prefabGroup, prefabGroup, pendingPrefabOverrides),
          ),
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
      if (object.name.startsWith("TRGVOL_")) {
        object.visible = false;
        return;
      }
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
    return [
      ...resolvePrefabMarkers(model),
      ...resolveBriefSocketPrefabs(model, config.physicalBriefing, getLanguage()),
    ];
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

  async function buildPrefab(
    levelId,
    environmentConfig,
    prefabConfig,
    prefabGroup,
    parentObject = prefabGroup,
    pendingPrefabOverrides = [],
  ) {
    const prefab = await loadSceneAsset(prefabConfig.assetPath);
    isolatePrefabRoot(prefab, prefabConfig.rootName, [prefabConfig.light?.markerName]);
    prefab.name = prefabConfig.name;
    prefab.position.copy(prefabConfig.position ?? new THREE.Vector3());
    prefab.rotation.copy(prefabConfig.rotation ?? new THREE.Euler());
    prefab.scale.copy(prefabConfig.scale ?? new THREE.Vector3(1, 1, 1));

    const runtime = createPrefabRuntime(prefab, prefabConfig);
    prefabInstances.set(`${levelId}:${prefabConfig.name}`, runtime);
    registerPrefabInteraction(levelId, prefabConfig, runtime);
    parentObject.add(prefab);
    applyPrefabConfig(levelId, prefabConfig.name, true);

    const nestedPrefabs = resolveNestedPrefabMarkers(prefab, { parentName: prefabConfig.name });
    if (!nestedPrefabs.length) return;
    environmentConfig.prefabs = applyPrefabOverrideEntries(
      mergeMarkerPrefabs(environmentConfig.prefabs ?? [], nestedPrefabs),
      pendingPrefabOverrides,
    );
    const nestedTasks = nestedPrefabs
      .filter((nestedPrefabConfig) => nestedPrefabConfig.behavior !== "operatorPanel")
      .map((nestedPrefabConfig) =>
        buildPrefab(levelId, environmentConfig, nestedPrefabConfig, prefabGroup, prefab, pendingPrefabOverrides),
      );
    const results = await Promise.allSettled(nestedTasks);
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }
}

export function isolatePrefabRoot(prefab, rootName, preservedNames = []) {
  if (!rootName) return;
  const rootObject = prefab.getObjectByName(rootName);
  if (!rootObject || rootObject === prefab) {
    if (!rootObject) console.warn(`[LevelSceneBuilder] Prefab root "${rootName}" was not found in ${prefab.name}`);
    return;
  }
  prefab.updateWorldMatrix(true, true);
  prefab.attach(rootObject);
  const preserved = new Set(preservedNames.filter(Boolean));
  [...prefab.children].forEach((child) => {
    if (child !== rootObject && !preserved.has(child.name)) prefab.remove(child);
  });
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
