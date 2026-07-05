const REGISTRY_OWNED_PREFAB_KEYS = new Set([
  "assetPath",
  "materialKey",
  "behavior",
  "interaction",
  "prefabType",
]);

export function applyLevelOverrides(target, overrides, path = "") {
  Object.entries(overrides ?? {}).forEach(([key, value]) => {
    if (!(key in target)) return;
    const nextPath = path ? `${path}.${key}` : key;
    if (Array.isArray(value) && Array.isArray(target[key])) {
      mergeNamedArray(target[key], value, nextPath);
      return;
    }
    if (isMergeable(value) && isMergeable(target[key])) {
      applyLevelOverrides(target[key], value, nextPath);
      return;
    }
    target[key] = value;
  });
  return target;
}

function mergeNamedArray(target, overrides, path) {
  overrides.forEach((entry) => {
    if (!entry || typeof entry !== "object" || !entry.name) return;
    const targetEntry = target.find((candidate) => candidate?.name === entry.name);
    if (!targetEntry) return;
    const safeEntry = Object.fromEntries(
      Object.entries(entry).filter(
        ([key]) => path !== "prefabs" || !REGISTRY_OWNED_PREFAB_KEYS.has(key),
      ),
    );
    applyLevelOverrides(targetEntry, safeEntry, `${path}.${entry.name}`);
  });
}

function isMergeable(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
