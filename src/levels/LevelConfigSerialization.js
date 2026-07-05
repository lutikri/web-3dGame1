const REGISTRY_OWNED_PREFAB_KEYS = new Set([
  "assetPath",
  "materialKey",
  "behavior",
  "interaction",
  "prefabType",
]);

export function createLevelOverrideSnapshot(environmentConfig) {
  const snapshot = JSON.parse(JSON.stringify(environmentConfig));
  delete snapshot.session;
  snapshot.prefabs = (snapshot.prefabs ?? []).map((prefab) =>
    Object.fromEntries(
      Object.entries(prefab).filter(([key]) => !REGISTRY_OWNED_PREFAB_KEYS.has(key)),
    ),
  );
  return snapshot;
}
