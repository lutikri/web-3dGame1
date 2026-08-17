import { getPrefabDefinition } from "../prefabs/PrefabRegistry.js?v=open-facility-bulkheads";

export const LEVEL_CONFIG_SCHEMA_VERSION = 1;

export function migrateLevelOverrides(overrides) {
  const migrated = structuredClone(overrides ?? {});
  let version = Number(migrated.schemaVersion ?? 0);
  if (!Number.isInteger(version) || version < 0) {
    throw new Error("[LevelConfig] Invalid override schemaVersion");
  }
  if (version > LEVEL_CONFIG_SCHEMA_VERSION) {
    throw new Error(
      `[LevelConfig] Override schemaVersion ${version} is newer than supported ${LEVEL_CONFIG_SCHEMA_VERSION}`,
    );
  }
  while (version < LEVEL_CONFIG_SCHEMA_VERSION) {
    const migration = LEVEL_OVERRIDE_MIGRATIONS[version];
    if (!migration) throw new Error(`[LevelConfig] Missing migration from schemaVersion ${version}`);
    migration(migrated);
    version += 1;
    migrated.schemaVersion = version;
  }
  return migrated;
}

export function validateLevelEnvironmentConfig(levelId, config) {
  const fail = (message) => {
    throw new Error(`[LevelConfig:${levelId}] ${message}`);
  };
  if (!config || typeof config !== "object") fail("environment must be an object");
  if (config.schemaVersion !== LEVEL_CONFIG_SCHEMA_VERSION) {
    fail(`schemaVersion must be ${LEVEL_CONFIG_SCHEMA_VERSION}`);
  }
  if (!config.assetPath || !config.collisionAssetPath) fail("environment asset paths are required");
  assertVector(config.position, "position", fail);
  assertVector(config.rotation, "rotation", fail);
  assertVector(config.scale, "scale", fail);
  assertVector(config.player?.spawnPosition, "player.spawnPosition", fail);
  assertVector(config.player?.rotationDegrees, "player.rotationDegrees", fail);
  if (!config.world?.backgroundColor || !config.world?.fogColor) {
    fail("world backgroundColor and fogColor are required");
  }
  if (!Number.isFinite(config.world.fogNear) || !Number.isFinite(config.world.fogFar)) {
    fail("world fogNear/fogFar must be finite");
  }

  const names = new Set();
  (config.prefabs ?? []).forEach((prefab, index) => {
    const label = `prefabs[${index}]`;
    if (!prefab?.name || !prefab.prefabType || !prefab.assetPath || !prefab.behavior) {
      fail(`${label} is incomplete`);
    }
    if (names.has(prefab.name)) fail(`duplicate prefab name "${prefab.name}"`);
    names.add(prefab.name);
    assertVector(prefab.position, `${label}.position`, fail);
    assertVector(prefab.rotation, `${label}.rotation`, fail);
    assertVector(prefab.scale, `${label}.scale`, fail);
    if (prefab.light?.localOffset) assertVector(prefab.light.localOffset, `${label}.light.localOffset`, fail);
  });
  const markerReferences = new Map();
  (config.prefabMarkerReferences ?? []).forEach((reference, index) => {
    const label = `prefabMarkerReferences[${index}]`;
    const definition = getPrefabDefinition(reference?.prefabType);
    if (!reference?.name || !definition) fail(`${label} is incomplete or uses an unknown prefab type`);
    if (names.has(reference.name) || markerReferences.has(reference.name)) {
      fail(`duplicate prefab name "${reference.name}"`);
    }
    markerReferences.set(reference.name, definition);
  });

  const objectiveIds = new Set();
  (config.session?.objectives ?? []).forEach((objective, index) => {
    if (!objective?.id || !objective.type) fail(`session.objectives[${index}] is incomplete`);
    if (objectiveIds.has(objective.id)) fail(`duplicate objective id "${objective.id}"`);
    objectiveIds.add(objective.id);
    if (objective.type === "survive" && !(objective.seconds > 0)) {
      fail(`session objective "${objective.id}" requires positive seconds`);
    }
  });
  (config.session?.bindings ?? []).forEach((binding, index) => {
    if (!binding?.source || !binding.action || !binding.target) {
      fail(`session.bindings[${index}] is incomplete`);
    }
    if (
      binding.action === "togglePrefabLight" &&
      !(config.prefabs ?? []).some((prefab) => prefab.name === binding.target && prefab.light) &&
      !markerReferences.get(binding.target)?.light
    ) {
      fail(`session binding target "${binding.target}" is not a light prefab`);
    }
  });

  Object.entries(config.lighting?.pointLights ?? {}).forEach(([name, light]) => {
    assertVector(light.position, `lighting.pointLights.${name}.position`, fail);
    ["intensity", "distance", "decay"].forEach((key) => {
      if (!Number.isFinite(light[key])) fail(`lighting.pointLights.${name}.${key} must be finite`);
    });
  });
  return config;
}

const LEVEL_OVERRIDE_MIGRATIONS = {
  0(config) {
    // Version 0 is the original generated debug-panel format.
    config.schemaVersion = 1;
  },
};

function assertVector(value, path, fail) {
  if (
    !value ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  ) {
    fail(`${path} must contain finite x/y/z values`);
  }
}
