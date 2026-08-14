import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";
import { LevelPrefabConfigRuntime } from "../src/prefabs/LevelPrefabConfigRuntime.js";

test("level prefab config runtime applies transforms and light state", () => {
  const root = new THREE.Group();
  const part = new THREE.Group();
  part.userData.prefabInitialRotation = new THREE.Euler();
  const light = new THREE.PointLight(0xffffff, 0);
  light.userData.baseIntensity = 0;
  const placed = {
    root,
    parts: new Map([["Arm", part]]),
    light,
    wasLightEnabled: false,
  };
  let activationUpdates = 0;
  let shadowUpdates = 0;
  const runtime = new LevelPrefabConfigRuntime({
    config: {
      levelEnvironments: {
        room: {
          prefabs: [{
            name: "Lamp",
            position: new THREE.Vector3(1, 2, 3),
            rotation: new THREE.Euler(0, 0.25, 0),
            scale: new THREE.Vector3(2, 2, 2),
            parts: { Arm: { rotationDegrees: { x: 90 } } },
            light: {
              enabled: true,
              color: 0xff8800,
              intensity: 4,
              distance: 12,
              decay: 1.5,
              localOffset: new THREE.Vector3(0, 1, 0),
              fluorescentStartup: true,
            },
          }],
        },
      },
    },
    instances: new Map([["room:Lamp", placed]]),
    physics: null,
    getActiveLevelId: () => "room",
    applyPanelTransform: () => {},
    updateActivation: () => activationUpdates += 1,
    rebuildStaticPhysics: () => {},
    setDoorLatched: () => {},
    applyDoorRotation: () => {},
    applyShadowSettings: () => shadowUpdates += 1,
    createStartupPattern: () => [0.25, 1],
  });

  assert.equal(runtime.apply("room", "Lamp", true), true);

  assert.deepEqual(root.position.toArray(), [1, 2, 3]);
  assert.deepEqual(root.scale.toArray(), [2, 2, 2]);
  assert.ok(Math.abs(part.rotation.x - Math.PI / 2) < 1e-9);
  assert.equal(light.userData.baseIntensity, 4);
  assert.deepEqual(light.position.toArray(), [0, 1, 0]);
  assert.deepEqual(placed.startupPattern, [0.25, 1]);
  assert.equal(shadowUpdates, 1);
  assert.equal(activationUpdates, 1);
});

test("level prefab config runtime routes operator panel changes", () => {
  let panelUpdates = 0;
  let activationUpdates = 0;
  const runtime = new LevelPrefabConfigRuntime({
    config: {
      levelEnvironments: {
        room: { prefabs: [{ name: "Panel", behavior: "operatorPanel" }] },
      },
    },
    instances: new Map(),
    getActiveLevelId: () => "room",
    applyPanelTransform: () => panelUpdates += 1,
    updateActivation: () => activationUpdates += 1,
  });

  assert.equal(runtime.apply("room", "Panel", true), true);

  assert.equal(panelUpdates, 1);
  assert.equal(activationUpdates, 1);
});

test("level prefab config runtime reports unloaded prefabs instead of pretending to apply them", () => {
  const runtime = new LevelPrefabConfigRuntime({
    config: { levelEnvironments: { room: { prefabs: [{ name: "Missing" }] } } },
    instances: new Map(),
    getActiveLevelId: () => "room",
  });

  assert.equal(runtime.apply("room", "Missing"), false);
  assert.equal(runtime.apply("room", "Unknown"), false);
});

test("level prefab config runtime applies editable spotlight projection properties", () => {
  const root = new THREE.Group();
  const light = new THREE.SpotLight();
  root.add(light, light.target);
  const config = {
    levelEnvironments: {
      room: {
        prefabs: [{
          name: "FlashLight",
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
          light: {
            enabled: true,
            color: 0xfff1d2,
            intensity: 6,
            distance: 12,
            decay: 2,
            angle: 0.52,
            penumbra: 0.35,
            localOffset: new THREE.Vector3(-0.05, 0, 0),
            targetLocalOffset: new THREE.Vector3(-4, 0, 0),
            cookieRotationDegrees: 90,
          },
        }],
      },
    },
  };
  const runtime = new LevelPrefabConfigRuntime({
    config,
    instances: new Map([["room:FlashLight", {
      root,
      parts: new Map(),
      light,
      wasLightEnabled: true,
    }]]),
    getActiveLevelId: () => "room",
    applyPanelTransform: () => {},
    updateActivation: () => {},
    rebuildStaticPhysics: () => {},
    setDoorLatched: () => {},
    applyDoorRotation: () => {},
    applyShadowSettings: () => {},
    createStartupPattern: () => [],
  });

  runtime.apply("room", "FlashLight");

  assert.equal(light.angle, 0.52);
  assert.equal(light.penumbra, 0.35);
  assert.deepEqual(light.target.position.toArray(), [-4.05, 0, 0]);
  assert.ok(Math.abs(light.shadow.camera.up.z + 1) < 1e-9);
});
