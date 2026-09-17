import assert from "node:assert/strict";
import test from "node:test";

import {
  applyStatusScreenMaterialConfig,
  createStatusScreenMaterial,
  DEFAULT_STATUS_SCREEN_EFFECTS,
  getStatusScreenPersistenceWeight,
  getStatusScreenUvTransform,
  normalizeStatusScreenEffects,
} from "../src/panels/StatusScreenMaterial.js";

test("status screen material config preserves defaults and clamps unsafe tuning", () => {
  assert.deepEqual(normalizeStatusScreenEffects(), DEFAULT_STATUS_SCREEN_EFFECTS);

  const config = normalizeStatusScreenEffects({
    brightness: 12,
    scanlineStrength: -1,
    persistenceDecay: 0,
    jitterStrength: "0.4",
  });
  assert.equal(config.brightness, 4);
  assert.equal(config.scanlineStrength, 0);
  assert.equal(config.persistenceDecay, 0.01);
  assert.equal(config.jitterStrength, 0.4);
  assert.equal("softness" in config, false);
  assert.equal("glowStrength" in config, false);
  assert.equal("glowRadius" in config, false);
});

test("status screen persistence decays without requiring canvas redraws", () => {
  const initial = getStatusScreenPersistenceWeight(0, 0.2, 0.25);
  const later = getStatusScreenPersistenceWeight(0.25, 0.2, 0.25);
  assert.equal(initial, 0.2);
  assert.ok(later > 0 && later < initial);
  assert.ok(Math.abs(later - 0.2 / Math.E) < 1e-12);
});

test("status screen can rotate authored content 180 degrees with both UV flips", () => {
  const transform = getStatusScreenUvTransform({ flipX: true, flipY: true });
  assert.deepEqual(transform.scale.toArray(), [-1, -1]);
  assert.deepEqual(transform.offset.toArray(), [1, 1]);

  const material = createStatusScreenMaterial({ width: 1024, height: 512 });
  applyStatusScreenMaterialConfig(material, { flipX: true, flipY: true });
  assert.deepEqual(material.uniforms.uUvScale.value.toArray(), [-1, -1]);
  assert.deepEqual(material.uniforms.uUvOffset.value.toArray(), [1, 1]);
  assert.deepEqual(material.userData.statusScreenUv, { flipX: true, flipY: true });
  material.dispose();
});
