import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { DoorInteractionSystem } from "../src/interactions/DoorInteractionSystem.js";
import { LightingRuntime, applyLightShadowSettings } from "../src/lighting/LightingRuntime.js";
import { createLevelSceneBuilder, isolatePrefabRoot } from "../src/scene/LevelSceneBuilder.js";
import { applyLevelOverrides, applyPrefabOverrideEntries } from "../src/levels/LevelConfigOverrides.js";
import { createLevelOverrideSnapshot } from "../src/levels/LevelConfigSerialization.js";
import { LEVEL_EXPLORING_AROUND_CONFIG } from "../src/levels/LevelExploringAroundConfig.js";
import {
  mergeMarkerPrefabs,
  parsePrefabMarkerName,
  resolvePrefabMarkers,
} from "../src/prefabs/PrefabMarkerResolver.js";
import {
  applyPrefabPlacementOffset,
  createPrefabPlacementOffset,
  getPrefabPlacement,
  resetPrefabToAuthoredPlacement,
} from "../src/prefabs/PrefabPlacementMetadata.js";

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
  assert.equal(getPrefabPlacement(prefab).markerName, "PF_fluorescentLamp_PowerHall1");
  prefab.position.set(99, 98, 97);
  assert.equal(resetPrefabToAuthoredPlacement(prefab), true);
  assert.deepEqual(prefab.position.toArray(), [11, 2, 3]);
});

test("marker prefabs expose an additive debug offset without changing their authored transform", () => {
  const root = new THREE.Group();
  const marker = new THREE.Object3D();
  marker.name = "PF_fluorescentLamp_OffsetTest";
  marker.position.set(4, 5, 6);
  root.add(marker);
  const [prefab] = resolvePrefabMarkers(root);
  const offset = createPrefabPlacementOffset(prefab);

  offset.position.set(0.25, -0.5, 1);
  offset.rotation.set(0, Math.PI / 2, 0);
  offset.scale.set(2, 1, 0.5);
  assert.equal(applyPrefabPlacementOffset(prefab, offset), true);
  assert.deepEqual(prefab.position.toArray(), [4.25, 4.5, 7]);
  assert.deepEqual(prefab.scale.toArray(), [2, 1, 0.5]);

  const roundTrip = createPrefabPlacementOffset(prefab);
  assert.deepEqual(roundTrip.position.toArray(), offset.position.toArray());
  assert.ok(Math.abs(roundTrip.rotation.y - Math.PI / 2) < 1e-8);
});

test("marker prefab offsets persist separately and legacy absolute saves migrate", () => {
  const root = new THREE.Group();
  const marker = new THREE.Object3D();
  marker.name = "PF_fluorescentLamp_PersistedOffset";
  marker.position.set(3, 4, 5);
  root.add(marker);
  const [prefab] = resolvePrefabMarkers(root);

  applyPrefabOverrideEntries([prefab], [{
    name: prefab.name,
    position: { x: 4, y: 6, z: 8 },
  }]);
  assert.deepEqual(prefab.position.toArray(), [4, 6, 8]);
  assert.deepEqual(prefab.placementOffset.position.toArray(), [1, 2, 3]);

  const snapshot = createLevelOverrideSnapshot({ prefabs: [prefab], session: {} });
  assert.equal("position" in snapshot.prefabs[0], false);
  assert.deepEqual(snapshot.prefabs[0].placementOffset.position, { x: 1, y: 2, z: 3 });
});

test("marker prefab offsets apply when the marker already exists during config merge", () => {
  const root = new THREE.Group();
  const marker = new THREE.Object3D();
  marker.name = "PF_fluorescentLamp_KnownMarker";
  marker.position.set(1, 2, 3);
  root.add(marker);
  const [prefab] = resolvePrefabMarkers(root);

  applyLevelOverrides({ prefabs: [prefab] }, {
    prefabs: [{
      name: prefab.name,
      placementOffset: {
        position: { x: 2, y: -1, z: 0.5 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    }],
  });

  assert.deepEqual(prefab.position.toArray(), [3, 1, 3.5]);
  assert.deepEqual(prefab.placementOffset.position.toArray(), [2, -1, 0.5]);
});

test("exploring around relies on authored prefab markers instead of legacy manual placements", () => {
  const legacyNames = new Set([
    "Panel1", "DoorBulk1_A", "DoorBulk1_B", "Door2_ServiceA",
    "Lamp1_Corridor_1", "Lamp1_Corridor_2", "Lamp1_Corridor_3", "Lamp1_Corridor_4",
    "Lamp1_TutorialCabin", "LampBulkRed_Exploring", "Clock1_Exploring",
  ]);
  assert.equal(
    LEVEL_EXPLORING_AROUND_CONFIG.prefabs.some((prefab) => legacyNames.has(prefab.name)),
    false,
  );
  assert.equal(
    LEVEL_EXPLORING_AROUND_CONFIG.session.bindings[0].target,
    "fluorescentLamp_TutorialCabin",
  );
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
    loadSceneAsset: async (path, context) => {
      context?.onTiming?.({ cacheHit: false, fetchMs: 2, parseMs: 3, cloneMs: 1, bytes: 1024 });
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

  const levelRuntime = { levelId: "level" };
  const buildProgress = [];
  await builder.build(levelRuntime, "level", environmentConfig, {
    onProgress: (value) => buildProgress.push(value),
  });
  const nested = environmentConfig.prefabs.find((prefab) => prefab.name === "Elevator1__fluorescentLamp_CabinCeiling");
  assert.equal(nested.light.intensity, 4.25);
  assert.deepEqual(nested.position.toArray(), [0.25, 1.5, -0.5]);
  assert.equal(levelRuntime.loadTimings.assetRequests, 4);
  assert.equal(levelRuntime.loadTimings.assetCacheMisses, 4);
  assert.equal(levelRuntime.loadTimings.glbFetchMs, 8);
  assert.equal(levelRuntime.loadTimings.glbParseDracoMs, 12);
  assert.equal(levelRuntime.loadTimings.prefabCount, 2);
  assert.equal(buildProgress[0], 0);
  assert.equal(buildProgress.at(-1), 1);
  assert.ok(buildProgress.some((value) => value > 0.2 && value < 1));
  assert.ok(buildProgress.every((value, index) => index === 0 || value >= buildProgress[index - 1]));
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

test("door interaction system registers hinged door meshes and latch handles", () => {
  const interactive = [];
  const physicsCalls = [];
  const root = new THREE.Group();
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const collider = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const handle = new THREE.Object3D();
  root.add(doorMesh, collider, handle);
  root.updateMatrixWorld(true);
  const runtime = {
    root,
    parts: new Map([["Door", doorMesh], ["Collider", collider], ["Handle", handle]]),
  };
  const system = new DoorInteractionSystem({
    prefabInstances: new Map(),
    interactive,
    physics: {
      createHingedDoor: (config) => physicsCalls.push(config),
      setDoorLocked: (...args) => physicsCalls.push(args),
    },
    resolveEnvironmentId: (id) => id,
    applyVisualRotation: () => {},
  });
  assert.equal(system.register("level", {
    name: "Door1",
    state: { latched: true },
    interaction: {
      type: "hingedDoor", meshName: "Door", colliderName: "Collider",
      latchHandleName: "Handle", initialDegrees: 0,
    },
  }, runtime), true);
  assert.equal(runtime.physicsDoorKey, "level:Door1");
  assert.equal(runtime.door.latched, true);
  assert.deepEqual(interactive, [doorMesh, handle]);
  assert.equal(physicsCalls[0].sceneKey, "level");
});

test("door interaction system advances latch operations", () => {
  const latched = [];
  const runtime = {
    door: {
      interaction: { latchHoldSeconds: 0.5 },
      latchOperation: { held: true, progress: 0, targetLatched: true, finalSpinOffsetDegrees: 360 },
    },
  };
  const system = new DoorInteractionSystem({
    prefabInstances: new Map([["level:Door", runtime]]),
    interactive: [],
    physics: null,
    resolveEnvironmentId: (id) => id,
    applyVisualRotation: () => {},
    applyLatchRotation: () => {},
    setLatched: (_runtime, value) => latched.push(value),
    toggleDoor: () => {},
    playSound: () => {},
  });
  system.update(0.5);
  assert.deepEqual(latched, [true]);
  assert.equal(runtime.door.latchOperation, null);
  assert.equal(runtime.door.latchHandleSpinOffsetDegrees, 360);
});

test("bulkhead latch interactions start at the authored rest angle without snapping", () => {
  const handle = new THREE.Object3D();
  handle.userData.levelPrefabKey = "level:Door";
  const runtime = {
    door: {
      activeLatchHandle: handle,
      latchHandle: handle,
      latched: true,
      interaction: {
        latchHandleLatchedDegrees: -70,
        latchTurnDegrees: 180,
      },
    },
  };
  const system = new DoorInteractionSystem({
    prefabInstances: new Map([["level:Door", runtime]]),
    interactive: [],
    resolveEnvironmentId: (id) => id,
    applyVisualRotation: () => {},
    applyLatchRotation: () => {},
    playSound: () => {},
    canOperateLatch: () => true,
  });

  assert.equal(system.beginLatchInteraction(handle), true);
  assert.equal(runtime.door.latchOperation.fromDegrees, -70);

  runtime.door.latchOperation = null;
  system.canOperateLatch = () => false;
  assert.equal(system.beginLatchInteraction(handle), false);
  assert.equal(runtime.door.latchBlockedAttempt.fromDegrees, -70);
});

test("door interaction system owns physical drag lifecycle", () => {
  const calls = [];
  const mesh = new THREE.Object3D();
  mesh.userData.levelPrefabKey = "level:Door";
  mesh.userData.lastHitPoint = new THREE.Vector3(1, 0, 0);
  const runtime = {
    physicsDoorKey: "level:Door",
    door: {
      mesh,
      latched: false,
      degrees: 12,
      interaction: {},
    },
  };
  const system = new DoorInteractionSystem({
    prefabInstances: new Map([["level:Door", runtime]]),
    interactive: [],
    physics: {
      getDoorDegrees: () => 12,
      setDoorDragTarget: (...args) => calls.push(args),
    },
    resolveEnvironmentId: (id) => id,
    applyVisualRotation: () => {},
  });
  assert.equal(system.beginDrag(mesh), true);
  assert.equal(system.getDraggedRuntime(), runtime);
  runtime.door.releaseAngularVelocity = 0.4;
  assert.equal(system.endDrag(), true);
  assert.equal(system.getDraggedRuntime(), null);
  assert.deepEqual(calls, [
    ["level:Door", 12, true],
    ["level:Door", 12, false, 0.4],
  ]);
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
  const fillConfig = {
    color: "#ff8800",
    intensity: 3.5,
    distance: 12,
    decay: 2,
    position: new THREE.Vector3(1, 2, 3),
    roomLightControlled: true,
  };
  assert.equal(runtime.applyPointLight("level", "Fill", fillConfig), true);
  assert.equal(points.get("level:Fill").userData.baseIntensity, 3.5);
  assert.deepEqual(points.get("level:Fill").position.toArray(), [1, 2, 3]);
  assert.equal(runtime.applyPointLight("level", "Missing", fillConfig), false);
  runtime.disposeLevel("level");
  assert.equal(controlled.length, 0);
  assert.equal(points.size, 0);
});

test("lighting runtime owns default lights and shared fixture state", () => {
  const scene = new THREE.Scene();
  const controlled = [];
  const points = new Map();
  const runtime = new LightingRuntime({ scene, controlledLights: controlled, pointLightsByKey: points, levelLights: new Map(), applyShadowSettings: () => {} });
  const material = new THREE.MeshStandardMaterial();
  const ambient = runtime.createDefault({ ambientSky: "#fff", ambientGround: "#000", ambientIntensity: 0.2, pointLights: { Main: { color: "#fff", intensity: 1, distance: 4, decay: 2, position: new THREE.Vector3(), roomLightControlled: true } } }, () => ({ pulse: 1 }));
  runtime.configureFixtures({ Ceiling: { lightNames: ["Main"], materialKeys: ["lens"] } }, { lens: material }, () => ({ shared: true }));
  assert.equal(ambient.isHemisphereLight, true);
  assert.equal(controlled.length, 2);
  assert.equal(points.get("Main").userData.fixtureFlicker, material.userData.fixtureFlicker);
});

test("light shadow settings apply the selected quality preset", () => {
  const light = new THREE.PointLight();
  assert.equal(applyLightShadowSettings(light, { castShadow: true, distance: 8 }, { enabled: true, mapSize: 256 }), true);
  assert.equal(light.castShadow, true);
  assert.equal(light.shadow.mapSize.width, 256);
  assert.equal(light.shadow.camera.far, 8);
});

test("spotlight cookie projection near plane applies even when shadows are disabled", () => {
  const light = new THREE.SpotLight();
  light.map = new THREE.Texture();

  assert.equal(applyLightShadowSettings(light, {
    castShadow: false,
    shadowNear: 0.01,
    shadowFar: 12,
  }, { enabled: false }), false);
  assert.equal(light.castShadow, false);
  assert.equal(light.shadow.camera.near, 0.01);
  assert.equal(light.shadow.camera.far, 12);
});

test("hero-only shadow tier keeps ordinary lights off and the authored hero light on", () => {
  const ordinary = new THREE.PointLight();
  const hero = new THREE.PointLight();
  const preset = { enabled: true, heroOnly: true, mapSize: 512 };

  assert.equal(applyLightShadowSettings(ordinary, { castShadow: true }, preset), false);
  assert.equal(ordinary.castShadow, false);
  assert.equal(applyLightShadowSettings(hero, { castShadow: true, heroShadow: true }, preset), true);
  assert.equal(hero.castShadow, true);
  assert.equal(hero.shadow.mapSize.width, 512);
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

test("prefab root isolation preserves registry-declared sibling markers", () => {
  const prefab = new THREE.Group();
  const root = new THREE.Group();
  root.name = "SM_LampDesk1";
  const marker = new THREE.Object3D();
  marker.name = "LGT_DeskLamp1";
  const unrelated = new THREE.Object3D();
  unrelated.name = "Unused";
  prefab.add(root, marker, unrelated);

  isolatePrefabRoot(prefab, root.name, [marker.name]);

  assert.equal(prefab.getObjectByName(root.name), root);
  assert.equal(prefab.getObjectByName(marker.name), marker);
  assert.equal(prefab.getObjectByName(unrelated.name), undefined);
});
