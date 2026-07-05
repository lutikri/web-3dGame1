import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  LEVEL_CONFIG_SCHEMA_VERSION,
  migrateLevelOverrides,
  validateLevelEnvironmentConfig,
} from "../src/levels/LevelConfigSchema.js";

function validConfig() {
  return {
    schemaVersion: LEVEL_CONFIG_SCHEMA_VERSION,
    assetPath: "room.glb",
    collisionAssetPath: "room-collision.glb",
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    scale: new THREE.Vector3(1, 1, 1),
    player: {
      spawnPosition: new THREE.Vector3(),
      rotationDegrees: new THREE.Vector3(),
    },
    prefabs: [],
    lighting: { pointLights: {} },
  };
}

test("level schema rejects stale versions", () => {
  const config = validConfig();
  config.schemaVersion = 0;
  assert.throws(() => validateLevelEnvironmentConfig("test", config), /schemaVersion/);
});

test("level schema rejects malformed transforms", () => {
  const config = validConfig();
  config.player.spawnPosition.x = Number.NaN;
  assert.throws(() => validateLevelEnvironmentConfig("test", config), /spawnPosition/);
});

test("legacy generated overrides migrate to the current schema", () => {
  const migrated = migrateLevelOverrides({ world: { fogNear: 2 } });
  assert.equal(migrated.schemaVersion, LEVEL_CONFIG_SCHEMA_VERSION);
  assert.equal(migrated.world.fogNear, 2);
});

test("future override schemas fail loudly", () => {
  assert.throws(
    () => migrateLevelOverrides({ schemaVersion: LEVEL_CONFIG_SCHEMA_VERSION + 1 }),
    /newer than supported/,
  );
});
