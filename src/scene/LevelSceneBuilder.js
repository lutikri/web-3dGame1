import * as THREE from "three";
import {
  mergeMarkerPrefabs,
  resolveNestedPrefabMarkers,
  resolvePrefabMarkers,
} from "../prefabs/PrefabMarkerResolver.js?v=pause-full-texture-upgrades";
import {
  applyPrefabOverrideEntries,
  applyPrefabStatePolicies,
  getPendingPrefabOverrides,
} from "../levels/LevelConfigOverrides.js?v=pause-full-texture-upgrades";
import { resolveBriefSocketPrefabs } from "../game/BriefPlacementRuntime.js?v=pause-full-texture-upgrades";

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
  lightingZones,
  getLanguage = () => "en",
}) {
  return {
    async build(levelRuntime, levelId, environmentConfig) {
      const timings = createLevelBuildTimings();
      const prefabGroup = new THREE.Group();
      prefabGroup.name = `${levelId}_Prefabs`;
      environmentModels.set(`${levelId}:prefabs`, prefabGroup);
      scene.add(prefabGroup);

      const markerPrefabs = await buildEnvironment(levelId, environmentConfig, timings);
      const configuredPrefabs = environmentConfig.prefabs ?? [];
      const pendingPrefabOverrides = getPendingPrefabOverrides(configuredPrefabs);
      environmentConfig.prefabs = resolveLevelPrefabs(
        mergeMarkerPrefabs(configuredPrefabs, markerPrefabs),
        pendingPrefabOverrides,
        environmentConfig.prefabStatePolicies,
      );
      const tasks = [
        buildCollision(levelId, environmentConfig, timings),
        ...(environmentConfig.prefabs ?? [])
          .filter((prefabConfig) => prefabConfig.behavior !== "operatorPanel")
          .map((prefabConfig) =>
            buildPrefab(levelRuntime, levelId, environmentConfig, prefabConfig,
              prefabGroup, prefabGroup, pendingPrefabOverrides, timings),
          ),
      ];
      const results = await Promise.allSettled(tasks);
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
      levelRuntime.loadTimings = timings;
      return levelRuntime;
    },
  };

  async function buildEnvironment(levelId, config, timings) {
    const model = await loadSceneAsset(config.assetPath, {
      kind: "environment",
      name: levelId,
      onTiming: (entry) => recordAssetTiming(timings, entry),
    });
    const setupStarted = nowMilliseconds();
    model.name = `${levelId}_Environment`;
    applyTransform(model, config);
    const excludedNameParts = config.render?.meshNameExcludes ?? [];
    const excludedMeshes = [];
    model.traverse((object) => {
      if (object.name.startsWith("TRGVOL_") || object.name.startsWith("LZONE_")) {
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
    lightingZones?.registerLevel(levelId, model);
    timings.environmentSetupMs += nowMilliseconds() - setupStarted;
    return [
      ...resolvePrefabMarkers(model),
      ...resolveBriefSocketPrefabs(model, config.physicalBriefing, getLanguage()),
    ];
  }

  async function buildCollision(levelId, config, timings) {
    const model = await loadSceneAsset(config.collisionAssetPath, {
      kind: "collision",
      name: levelId,
      onTiming: (entry) => recordAssetTiming(timings, entry),
    });
    const setupStarted = nowMilliseconds();
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
    timings.collisionSetupMs += nowMilliseconds() - setupStarted;
  }

  async function buildPrefab(
    levelRuntime,
    levelId,
    environmentConfig,
    prefabConfig,
    prefabGroup,
    parentObject = prefabGroup,
    pendingPrefabOverrides = [],
    timings,
  ) {
    const prefab = await loadSceneAsset(prefabConfig.assetPath, {
      kind: "prefab",
      name: prefabConfig.name,
      onTiming: (entry) => recordAssetTiming(timings, entry),
    });
    const setupStarted = nowMilliseconds();
    isolatePrefabRoot(prefab, prefabConfig.rootName, [prefabConfig.light?.markerName]);
    prefab.name = prefabConfig.name;
    prefab.userData.levelId = levelId;
    prefab.position.copy(prefabConfig.position ?? new THREE.Vector3());
    prefab.rotation.copy(prefabConfig.rotation ?? new THREE.Euler());
    prefab.scale.copy(prefabConfig.scale ?? new THREE.Vector3(1, 1, 1));
    timings.prefabSetupMs += nowMilliseconds() - setupStarted;

    const createStarted = nowMilliseconds();
    const runtime = createPrefabRuntime(prefab, prefabConfig);
    timings.prefabCreateMs += nowMilliseconds() - createStarted;
    const readyStarted = nowMilliseconds();
    await runtime.ready;
    timings.prefabReadyMs += nowMilliseconds() - readyStarted;
    timings.prefabCount += 1;
    const registrationStarted = nowMilliseconds();
    if (runtime.light?.userData?.cookieTexture) {
      levelRuntime.own?.(() => runtime.light.userData.cookieTexture.dispose());
    }
    prefabInstances.set(`${levelId}:${prefabConfig.name}`, runtime);
    registerPrefabInteraction(levelId, prefabConfig, runtime);
    parentObject.add(prefab);
    applyPrefabConfig(levelId, prefabConfig.name, true);
    timings.prefabSetupMs += nowMilliseconds() - registrationStarted;

    const nestedPrefabs = resolveNestedPrefabMarkers(prefab, { parentName: prefabConfig.name });
    if (!nestedPrefabs.length) return;
    environmentConfig.prefabs = resolveLevelPrefabs(
      mergeMarkerPrefabs(environmentConfig.prefabs ?? [], nestedPrefabs),
      pendingPrefabOverrides,
      environmentConfig.prefabStatePolicies,
    );
    const nestedTasks = nestedPrefabs
      .filter((nestedPrefabConfig) => nestedPrefabConfig.behavior !== "operatorPanel")
      .map((nestedPrefabConfig) =>
        buildPrefab(levelRuntime, levelId, environmentConfig, nestedPrefabConfig,
          prefabGroup, prefab, pendingPrefabOverrides, timings),
      );
    const results = await Promise.allSettled(nestedTasks);
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }
}

function createLevelBuildTimings() {
  return {
    assetRequests: 0,
    assetCacheHits: 0,
    assetCacheMisses: 0,
    assetBytes: 0,
    glbFetchMs: 0,
    glbParseDracoMs: 0,
    assetCloneMs: 0,
    slowestAssetName: "",
    slowestAssetMs: 0,
    environmentSetupMs: 0,
    collisionSetupMs: 0,
    prefabCount: 0,
    prefabCreateMs: 0,
    prefabReadyMs: 0,
    prefabSetupMs: 0,
  };
}

function recordAssetTiming(timings, entry) {
  timings.assetRequests += 1;
  timings.assetCacheHits += entry.cacheHit ? 1 : 0;
  timings.assetCacheMisses += entry.cacheHit ? 0 : 1;
  timings.assetBytes += entry.bytes ?? 0;
  timings.glbFetchMs += entry.fetchMs ?? 0;
  timings.glbParseDracoMs += entry.parseMs ?? 0;
  timings.assetCloneMs += entry.cloneMs ?? 0;
  const totalMs = (entry.fetchMs ?? 0) + (entry.parseMs ?? 0) + (entry.cloneMs ?? 0);
  if (totalMs > timings.slowestAssetMs) {
    timings.slowestAssetMs = totalMs;
    timings.slowestAssetName = entry.name ?? entry.key;
  }
}

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function resolveLevelPrefabs(prefabs, pendingPrefabOverrides, statePolicies) {
  return applyPrefabStatePolicies(
    applyPrefabOverrideEntries(prefabs, pendingPrefabOverrides),
    statePolicies,
  );
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
