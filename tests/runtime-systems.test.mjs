import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { DoorInteractionSystem } from "../src/interactions/DoorInteractionSystem.js";
import { LightingRuntime } from "../src/lighting/LightingRuntime.js";
import { createLevelSceneBuilder } from "../src/scene/LevelSceneBuilder.js";
import { applyLevelOverrides } from "../src/levels/LevelConfigOverrides.js";
import {
  mergeMarkerPrefabs,
  parsePrefabMarkerName,
  resolvePrefabMarkers,
} from "../src/prefabs/PrefabMarkerResolver.js";

test("prefab markers resolve registry instances from Empty transforms", () => {
  const root = new THREE.Group();
  root.position.set(10, 0, 0);
  const marker = new THREE.Object3D();
  marker.name = "PF_fluorescentLamp_PowerHall1";
  marker.position.set(1, 2, 3);
  root.add(marker);

  const [prefab] = resolvePrefabMarkers(root);
  assert.equal(prefab.prefabType, "fluorescentLamp");
  assert.equal(prefab.name, "fluorescentLamp_PowerHall1");
  assert.deepEqual(prefab.position.toArray(), [11, 2, 3]);
});

test("manual prefab configs override markers with the same stable name", () => {
  const marker = { name: "PowerHall1", source: "marker" };
  const manual = { name: "PowerHall1", source: "manual" };
  assert.deepEqual(mergeMarkerPrefabs([manual], [marker]), [manual]);
  assert.throws(
    () => parsePrefabMarkerName("PF_missingType_Instance"),
    /unknown prefab type/,
  );
});

test("scene builder applies saved overrides to nested prefab markers", async () => {
  const scene = new THREE.Scene();
  const environmentModels = new Map();
  const collisionModels = new Map();
  const prefabInstances = new Map();
  const environmentConfig = {
    assetPath: "room.glb",
    collisionAssetPath: "collision.glb",
    position: new THREE.Vector3(),
    rotation: new THREE.Euler(),
    scale: new THREE.Vector3(1, 1, 1),
    prefabs: [],
  };
  applyLevelOverrides(environmentConfig, {
    prefabs: [
      {
        name: "Elevator1__fluorescentLamp_CabinCeiling",
        light: { intensity: 4.25 },
        position: { x: 0.25, y: 1.5, z: -0.5 },
      },
    ],
  });

  const builder = createLevelSceneBuilder({
    scene,
    loadSceneAsset: async (path) => {
      const group = new THREE.Group();
      if (path === "room.glb") {
        const marker = new THREE.Object3D();
        marker.name = "PF_Elevator1";
        group.add(marker);
      } else if (path.includes("SM_Elevator1")) {
        const marker = new THREE.Object3D();
        marker.name = "PF_fluorescentLamp_CabinCeiling";
        group.add(marker);
      }
      return group;
    },
    collisionDebugMaterial: new THREE.MeshBasicMaterial(),
    isCollisionVisible: () => false,
    registerEnvironmentObject: () => {},
    createPrefabRuntime: (root) => ({ root, collisionMeshes: [], parts: new Map() }),
    registerPrefabInteraction: () => {},
    applyPrefabConfig: () => {},
    appendPanelPhysics: () => {},
    environmentModels,
    collisionModels,
    prefabInstances,
  });

  await builder.build({ levelId: "level" }, "level", environmentConfig);
  const nested = environmentConfig.prefabs.find((prefab) => prefab.name === "Elevator1__fluorescentLamp_CabinCeiling");
  assert.equal(nested.light.intensity, 4.25);
  assert.deepEqual(nested.position.toArray(), [0.25, 1.5, -0.5]);
});

test("door interaction emits a level event and resets through shared physics", () => {
  const targets = [];
  const opened = [];
  const resets = [];
  const runtime = {
    door: {
      degrees: 0,
      commandedOpen: false,
      interaction: { initialDegrees: 0, openDegrees: -90, minDegrees: -105, maxDegrees: 5 },
    },
    physicsDoorKey: "level:Door",
  };
  const mesh = { userData: { levelPrefabKey: "level:Door" } };
  const system = new DoorInteractionSystem({
    prefabInstances: new Map([["level:Door", runtime]]),
    physics: {
      getDoorDegrees: () => 0,
      setDoorDragTarget: (...args) => {
        targets.push(args);
        return true;
      },
      resetDoors: (levelId) => resets.push(levelId),
    },
    resolveEnvironmentId: (levelId) => levelId,
    applyVisualRotation: () => {},
    onDoorOpened: (key) => opened.push(key),
  });
  assert.equal(system.toggle(mesh), true);
  assert.deepEqual(opened, ["level:Door"]);
  assert.equal(targets[0][1], -90);
  system.reset("level");
  assert.deepEqual(resets, ["level"]);
});

test("lighting runtime owns and disposes level lights", () => {
  const scene = new THREE.Scene();
  const controlled = [];
  const points = new Map();
  const levels = new Map();
  const runtime = new LightingRuntime({
    scene,
    controlledLights: controlled,
    pointLightsByKey: points,
    levelLights: levels,
    applyShadowSettings: () => {},
  });
  runtime.createLevel("level", {
    ambientSky: "#ffffff",
    ambientGround: "#000000",
    ambientIntensity: 0.1,
    pointLights: {
      Fill: {
        color: "#ffffff",
        intensity: 1,
        distance: 5,
        decay: 1,
        position: new THREE.Vector3(),
      },
    },
  });
  assert.equal(levels.get("level").length, 2);
  assert.equal(points.has("level:Fill"), true);
  runtime.disposeLevel("level");
  assert.equal(controlled.length, 0);
  assert.equal(points.size, 0);
});

test("scene builder waits for all branches before reporting a load failure", async () => {
  const scene = new THREE.Scene();
  const environmentModels = new Map();
  const collisionModels = new Map();
  const prefabInstances = new Map();
  let slowPrefabFinished = false;
  const builder = createLevelSceneBuilder({
    scene,
    loadSceneAsset: async (path) => {
      if (path === "broken-collision.glb") throw new Error("collision failed");
      if (path === "slow-prefab.glb") {
        await Promise.resolve();
        slowPrefabFinished = true;
      }
      const group = new THREE.Group();
      group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
      return group;
    },
    collisionDebugMaterial: new THREE.MeshBasicMaterial(),
    isCollisionVisible: () => false,
    registerEnvironmentObject: () => {},
    createPrefabRuntime: (root) => ({ root, collisionMeshes: [], parts: new Map() }),
    registerPrefabInteraction: () => {},
    applyPrefabConfig: () => {},
    appendPanelPhysics: () => {},
    environmentModels,
    collisionModels,
    prefabInstances,
  });
  await assert.rejects(
    builder.build({ levelId: "level" }, "level", {
      assetPath: "room.glb",
      collisionAssetPath: "broken-collision.glb",
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      scale: new THREE.Vector3(1, 1, 1),
      prefabs: [
        {
          name: "Slow",
          behavior: "staticLamp",
          assetPath: "slow-prefab.glb",
          position: new THREE.Vector3(),
          rotation: new THREE.Euler(),
          scale: new THREE.Vector3(1, 1, 1),
        },
      ],
    }),
    /collision failed/,
  );
  assert.equal(slowPrefabFinished, true);
});
