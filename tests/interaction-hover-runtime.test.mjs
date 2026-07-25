import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  findInteractiveRoot,
  getInteractionMaxDistance,
  getTooltipTarget,
  createInteractionTooltipPolicy,
  isObjectHierarchyVisible,
  resolveVisibleInteractionHit,
  getSafeViewOffsetScale,
} from "../src/interactions/InteractionHoverRuntime.js";

test("interaction hover resolves hit proxies and distance policy", () => {
  const root = { userData: { kind: "controlKnob" }, parent: null };
  const proxy = { userData: { hitProxyFor: "knob" }, parent: root };
  assert.equal(findInteractiveRoot(proxy), root);
  assert.equal(getInteractionMaxDistance(root, { panelMaxDistance: 2, maxDistance: 4 }), 2);
  root.userData.maxInteractionDistance = 0.75;
  assert.equal(getInteractionMaxDistance(root, { panelMaxDistance: 2 }), 0.75);
  assert.equal(getTooltipTarget(root), root);
  assert.equal(getTooltipTarget({ userData: { kind: "hingedDoor" } }), null);
});

test("dynamic view obstruction continuously limits an active lean offset", () => {
  assert.ok(Math.abs(getSafeViewOffsetScale(0.16, 0.2, 0.12) - 0.5) < 1e-9);
  assert.equal(getSafeViewOffsetScale(0.16, 0.1, 0.12), 0);
  assert.equal(getSafeViewOffsetScale(0.16, Infinity, 0.12), 1);
});

test("interaction tooltip policy describes knob, prefab light and latch state", () => {
  const policy = createInteractionTooltipPolicy({
    translateControlLabel: (value) => value,
    translate: (key) => key.endsWith("on") ? "ON" : "OFF",
    prefabInstances: new Map([["room:door", { door: { latched: true, interaction: {} } }]]),
    config: { levelEnvironments: { room: { prefabs: [{ name: "lamp", light: { enabled: false } }] } } },
    getActiveLevelId: () => "room", getLevelEnvironmentId: (id) => id, getRoomLightsEnabled: () => true,
  });
  assert.equal(policy.getText({ userData: { kind: "controlKnob", controlLabel: "FUEL", controlPercent: 42.2 } }), "FUEL 42%");
  assert.equal(policy.getText({ userData: { kind: "roomLightButton", controlLabel: "LIGHT", levelBindings: [{ action: "togglePrefabLight", target: "lamp" }] } }), "LIGHT OFF");
  assert.equal(policy.getText({ userData: { kind: "doorLatchHandle", controlLabel: "LATCH", levelPrefabKey: "room:door" } }), "LATCH ON");
});

test("object hierarchy visibility rejects hidden ancestors", () => {
  const scene = new THREE.Scene();
  const parent = new THREE.Group();
  const child = new THREE.Object3D();
  scene.add(parent);
  parent.add(child);
  assert.equal(isObjectHierarchyVisible(child, scene), true);
  parent.visible = false;
  assert.equal(isObjectHierarchyVisible(child, scene), false);
});

test("interaction hover rejects a handle hidden behind the nearest visible mesh", () => {
  const handle = { isMesh: true, userData: { kind: "doorLatchHandle", levelId: "room" }, parent: null };
  const blocker = { isMesh: true, userData: {}, parent: null };
  const options = {
    interactionLevelId: "room",
    interactionConfig: {},
    isObjectVisible: () => true,
    isInteractiveRoot: (root) => root === handle,
  };
  assert.equal(resolveVisibleInteractionHit([
    { object: blocker, distance: 0.5 },
    { object: handle, distance: 0.8 },
  ], options), null);
  assert.equal(resolveVisibleInteractionHit([
    { object: handle, distance: 0.5 },
    { object: blocker, distance: 0.8 },
  ], options).root, handle);
  assert.equal(resolveVisibleInteractionHit([
    { object: blocker, distance: 0.5 },
    { object: handle, distance: 0.515 },
  ], options).root, handle);
});
