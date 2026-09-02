import { getPrefabPlacement } from "../prefabs/PrefabPlacementMetadata.js?v=pause-full-texture-upgrades";

const REGISTRY_OWNED_PREFAB_KEYS = new Set([
  "assetPath",
  "materialKey",
  "materialOverrides",
  "behavior",
  "clock",
  "elevator",
  "interaction",
  "radio",
  "prefabType",
]);

export function cloneSerializable(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function createLevelOverrideSnapshot(environmentConfig) {
  const snapshot = cloneSerializable(environmentConfig);
  delete snapshot.session;
  snapshot.prefabs = (snapshot.prefabs ?? []).map((prefab) => {
    const sourcePrefab = environmentConfig.prefabs?.find((entry) => entry.name === prefab.name);
    const markerPlaced = getPrefabPlacement(sourcePrefab)?.source === "marker";
    return Object.fromEntries(
      Object.entries(prefab).filter(([key]) =>
        !REGISTRY_OWNED_PREFAB_KEYS.has(key)
        && !(markerPlaced && ["position", "rotation", "scale"].includes(key))),
    );
  });
  return snapshot;
}
