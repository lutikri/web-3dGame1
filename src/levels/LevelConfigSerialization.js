const REGISTRY_OWNED_PREFAB_KEYS = new Set([
  "assetPath",
  "materialKey",
  "behavior",
  "interaction",
  "prefabType",
]);

export function cloneSerializable(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function createLevelOverrideSnapshot(environmentConfig) {
  const snapshot = cloneSerializable(environmentConfig);
  delete snapshot.session;
  snapshot.prefabs = (snapshot.prefabs ?? []).map((prefab) =>
    Object.fromEntries(
      Object.entries(prefab).filter(([key]) => !REGISTRY_OWNED_PREFAB_KEYS.has(key)),
    ),
  );
  return snapshot;
}
