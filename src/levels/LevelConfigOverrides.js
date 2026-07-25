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
const PENDING_PREFAB_OVERRIDES = Symbol.for("operatorGame.pendingPrefabOverrides");

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
    if (!targetEntry) {
      if (path === "prefabs") {
        if (!target[PENDING_PREFAB_OVERRIDES]) {
          Object.defineProperty(target, PENDING_PREFAB_OVERRIDES, {
            value: [],
            configurable: true,
          });
        }
        target[PENDING_PREFAB_OVERRIDES].push(entry);
      }
      return;
    }
    const safeEntry = Object.fromEntries(
      Object.entries(entry).filter(
        ([key]) => path !== "prefabs" || !REGISTRY_OWNED_PREFAB_KEYS.has(key),
      ),
    );
    applyLevelOverrides(targetEntry, safeEntry, `${path}.${entry.name}`);
  });
}

export function applyPendingPrefabOverrides(prefabs, sourcePrefabs = prefabs) {
  return applyPrefabOverrideEntries(prefabs, sourcePrefabs?.[PENDING_PREFAB_OVERRIDES] ?? []);
}

export function getPendingPrefabOverrides(sourcePrefabs = []) {
  return [...(sourcePrefabs?.[PENDING_PREFAB_OVERRIDES] ?? [])];
}

export function applyPrefabOverrideEntries(prefabs, entries = []) {
  entries.forEach((entry) => {
    const target = prefabs.find((prefab) => prefab?.name === entry.name);
    if (!target) return;
    const safeEntry = Object.fromEntries(
      Object.entries(entry).filter(([key]) => !REGISTRY_OWNED_PREFAB_KEYS.has(key)),
    );
    applyLevelOverrides(target, safeEntry, `prefabs.${entry.name}`);
  });
  return prefabs;
}

export function applyPrefabStatePolicies(prefabs, policies = []) {
  prefabs.forEach((prefab) => {
    policies.forEach((policy) => {
      if (!policy?.prefabTypes?.includes(prefab?.prefabType)) return;
      const state = policy.exceptions?.[prefab.name] ?? policy.state;
      if (state) applyLevelOverrides(prefab, { state }, `prefabs.${prefab.name}`);
    });
  });
  return prefabs;
}

function isMergeable(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
