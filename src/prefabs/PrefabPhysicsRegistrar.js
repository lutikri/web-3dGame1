import {
  createDeskDrawerRuntimes,
  toggleDeskDrawerRuntime,
} from "./behaviors/DeskDrawerBehavior.js?v=global-rigid-world-state";
import {
  clearPersistentRigidBodyStates,
  clearPersistentRigidBodyStorage,
  loadPersistentRigidBodyStates,
  savePersistentRigidBodyStates,
} from "../app/AppPersistence.js?v=global-rigid-world-state";

export function createPrefabPhysicsRegistrar({
  physics,
  normalizeName,
  getMatchNames,
  doorInteractions = null,
  interactive = [],
  playSound = () => {},
}) {
  const deskDrawersByTarget = new WeakMap();
  const persistentRigidBodiesByLevel = new Map();
  let persistentSaveAccumulator = 0;

  function findColliders(runtime, prefixes = []) {
    const normalizedPrefixes = prefixes.map(normalizeName);
    return (runtime.collisionMeshes ?? []).filter((mesh) => {
      const names = getMatchNames(mesh).map(normalizeName);
      return normalizedPrefixes.some((prefix) => names.some((name) => name.startsWith(prefix)));
    });
  }

  function registerElevator(levelId, prefabConfig, runtime) {
    const elevator = runtime.elevator;
    if (!physics || !elevator) return;
    const config = prefabConfig.elevator ?? {};
    const cagePrefixes = config.cageColliderNamePrefixes ?? config.colliderNamePrefixes ?? [];
    const doorPrefixes = config.doorColliderNamePrefixes ?? [];
    const cageColliders = findColliders(runtime, cagePrefixes);
    const doorColliders = findColliders(runtime, doorPrefixes);
    if (!cageColliders.length) console.warn(`[Elevator] No cage colliders found for prefab "${prefabConfig.name}"`, cagePrefixes);
    runtime.elevatorCagePhysicsKey = `${levelId}:${prefabConfig.name}:cage`;
    runtime.elevatorDoorPhysicsKey = `${levelId}:${prefabConfig.name}:door`;
    if (cageColliders.length) {
      physics.createKinematicPrefab({
        key: runtime.elevatorCagePhysicsKey,
        sceneKey: levelId,
        root: elevator.cage ?? runtime.root,
        colliderMeshes: cageColliders,
        friction: config.friction ?? 1,
        colliderMode: config.cageColliderMode ?? "boxes",
        floorThickness: config.cageFloorThickness ?? 0.12,
        floorInset: config.cageFloorInset ?? 0,
      });
    }
    if (elevator.door && doorColliders.length) {
      physics.createKinematicPrefab({
        key: runtime.elevatorDoorPhysicsKey,
        sceneKey: levelId,
        root: elevator.door,
        colliderMeshes: doorColliders,
        friction: config.friction ?? 1,
      });
    }
  }

  function registerBarrierGate(levelId, prefabConfig, runtime) {
    if (!physics) return;
    const config = prefabConfig.barrierGate ?? {};
    if (config.enabled === false) return;
    const gateMesh = runtime.parts.get(config.gateName ?? "SM_Barrier1_Gate");
    const colliderMesh = runtime.parts.get(config.colliderName ?? "UBX_SM_Barrier1_Gate_01");
    if (!gateMesh || !colliderMesh) {
      console.warn(`[BarrierGate] Missing gate/collider for prefab "${prefabConfig.name}"`);
      return;
    }
    runtime.root.updateMatrixWorld(true);
    gateMesh.updateWorldMatrix(true, false);
    colliderMesh.updateWorldMatrix(true, false);
    runtime.dynamicColliderMeshes.add(colliderMesh);
    runtime.barrierGatePhysicsKey = `${levelId}:${prefabConfig.name}:barrierGate`;
    if (config.locked !== false) runtime.staticWhileLockedColliderMeshes.add(colliderMesh);
    physics.createHingedDoor({
      key: runtime.barrierGatePhysicsKey, sceneKey: levelId, doorMesh: gateMesh, colliderMesh,
      initialDegrees: config.initialDegrees ?? 0, minDegrees: config.minDegrees ?? -90,
      maxDegrees: config.maxDegrees ?? 90, density: config.density,
      angularDamping: config.angularDamping, maxAngularVelocity: config.maxAngularVelocity,
      initialHoldSeconds: config.initialHoldSeconds, motorStiffness: config.motorStiffness,
      motorDamping: config.motorDamping, restMotorEnabled: config.returnToRest,
      restDegrees: config.restDegrees ?? 0, restMotorStiffness: config.restMotorStiffness,
      restMotorDamping: config.restMotorDamping,
    });
    physics.configureDoorRestMotor(runtime.barrierGatePhysicsKey, {
      enabled: config.returnToRest, degrees: config.restDegrees ?? 0,
      stiffness: config.restMotorStiffness, damping: config.restMotorDamping,
    });
    physics.setDoorEnabled(runtime.barrierGatePhysicsKey, config.locked === false);
  }

  function registerRigid(levelId, prefabConfig, runtime, { excludedRoots = [] } = {}) {
    const config = prefabConfig.rigidBody;
    if (!physics || !config?.enabled) return;
    const prefixes = config.colliderNamePrefixes ?? ["UBX_", "COLL", "Coll"];
    const colliderMeshes = findColliders(runtime, prefixes).filter(
      (mesh) => !excludedRoots.some((root) => mesh === root || isDescendantOf(mesh, root)),
    );
    if (!colliderMeshes.length) {
      console.warn(`[RigidPrefab] No colliders found for prefab "${prefabConfig.name}"`, prefixes);
      return;
    }
    colliderMeshes.forEach((mesh) => runtime.dynamicColliderMeshes.add(mesh));
    runtime.rigidPrefabKey = `${levelId}:${prefabConfig.name}:rigid`;
    const body = physics.createRigidPrefab({
      key: runtime.rigidPrefabKey, sceneKey: levelId, root: runtime.root, colliderMeshes,
      bodyType: config.bodyType ?? "dynamic", density: config.density,
      linearDamping: config.linearDamping, angularDamping: config.angularDamping,
      friction: config.friction, restitution: config.restitution, canSleep: config.canSleep,
    });
    if (config.persistent) {
      const stateId = `prefab:${prefabConfig.name}`;
      const entries = persistentRigidBodiesByLevel.get(levelId) ?? new Map();
      entries.set(stateId, { stateId, physicsKey: runtime.rigidPrefabKey });
      persistentRigidBodiesByLevel.set(levelId, entries);
      const savedState = loadPersistentRigidBodyStates()[stateId];
      if (savedState) physics.restoreRigidPrefabState(runtime.rigidPrefabKey, savedState);
    }
    return body;
  }

  function registerDeskDrawers(levelId, prefabConfig, runtime) {
    const config = prefabConfig.drawers ?? {};
    runtime.deskDrawers = createDeskDrawerRuntimes(runtime.parts, config, prefabConfig.name);
    const deskBody = registerRigid(levelId, prefabConfig, runtime, {
      excludedRoots: runtime.deskDrawers.map((drawer) => drawer.mesh),
    });
    if (!physics || !deskBody) return null;
    runtime.deskDrawers.forEach((drawer) => {
      const colliderMeshes = (runtime.collisionMeshes ?? []).filter(
        (mesh) => mesh !== drawer.mesh && isDescendantOf(mesh, drawer.mesh),
      );
      if (!colliderMeshes.length) {
        console.warn(`[DeskDrawer] No colliders found below "${drawer.name}"`);
        return;
      }
      colliderMeshes.forEach((mesh) => runtime.dynamicColliderMeshes.add(mesh));
      drawer.physicsKey = `${levelId}:${prefabConfig.name}:drawer:${drawer.index + 1}`;
      physics.createPrismaticPrefabPart({
        key: drawer.physicsKey,
        sceneKey: levelId,
        parentKey: runtime.rigidPrefabKey,
        root: drawer.mesh,
        colliderMeshes,
        axis: config.axis ?? [0, 0, -1],
        minPosition: 0,
        maxPosition: Math.max(0, drawer.openPosition - drawer.closedPosition),
        density: config.density,
        linearDamping: config.linearDamping,
        angularDamping: config.angularDamping,
        motorStiffness: config.motorStiffness,
        motorDamping: config.motorDamping,
        friction: config.friction,
      });
      drawer.mesh.userData.kind = "slidingDrawer";
      drawer.mesh.userData.levelId = levelId;
      drawer.mesh.userData.levelPrefabKey = `${levelId}:${prefabConfig.name}`;
      drawer.mesh.userData.controlLabel = "DRAWER";
      drawer.mesh.userData.maxInteractionDistance = config.maxDistance ?? 1.85;
      if (!interactive.includes(drawer.mesh)) interactive.push(drawer.mesh);
      deskDrawersByTarget.set(drawer.mesh, drawer);
    });
    return deskBody;
  }

  function toggleDeskDrawer(target) {
    const drawer = deskDrawersByTarget.get(target);
    if (!drawer?.physicsKey) return false;
    const targetPosition = toggleDeskDrawerRuntime(drawer);
    if (targetPosition == null) return false;
    physics.setPrismaticPrefabPartTarget(drawer.physicsKey, targetPosition);
    const soundKey = drawer.open ? drawer.openSoundKey : drawer.closeSoundKey;
    if (soundKey) {
      playSound(drawer.mesh, soundKey, {
        refDistance: drawer.soundRefDistance,
        maxDistance: drawer.soundMaxDistance,
      });
    }
    return true;
  }

  function update(deltaSeconds) {
    persistentSaveAccumulator += Math.max(0, Number(deltaSeconds) || 0);
    if (persistentSaveAccumulator < 1) return;
    persistentSaveAccumulator = 0;
    persistentRigidBodiesByLevel.forEach((entries, levelId) => savePersistentEntries(levelId, entries));
  }

  function flushLevel(levelId) {
    savePersistentEntries(levelId, persistentRigidBodiesByLevel.get(levelId));
  }

  function resetPersistentObjects() {
    clearPersistentRigidBodyStorage();
    persistentRigidBodiesByLevel.forEach((entries) => entries.forEach((entry) => {
      physics.resetRigidPrefab(entry.physicsKey);
    }));
  }

  function resetLevelPersistentObjects(levelId) {
    const entries = [...(persistentRigidBodiesByLevel.get(levelId)?.values() ?? [])];
    clearPersistentRigidBodyStates(entries.map((entry) => entry.stateId));
    entries.forEach((entry) => {
      physics.resetRigidPrefab(entry.physicsKey);
    });
  }

  function register(levelId, prefabConfig, runtime) {
    if (prefabConfig.behavior === "elevator") return registerElevator(levelId, prefabConfig, runtime);
    if (prefabConfig.behavior === "barrierGate") return registerBarrierGate(levelId, prefabConfig, runtime);
    if (prefabConfig.behavior === "deskDrawers") return registerDeskDrawers(levelId, prefabConfig, runtime);
    if (prefabConfig.rigidBody?.enabled) registerRigid(levelId, prefabConfig, runtime);
    return doorInteractions?.register(levelId, prefabConfig, runtime);
  }

  return {
    findColliders,
    register,
    registerElevator,
    registerBarrierGate,
    registerRigid,
    registerDeskDrawers,
    toggleDeskDrawer,
    update,
    flushLevel,
    resetPersistentObjects,
    resetLevelPersistentObjects,
  };

  function savePersistentEntries(levelId, entries) {
    if (!entries?.size) return;
    const states = Object.fromEntries([...entries.values()]
      .map((entry) => [entry.stateId, physics.getRigidPrefabState(entry.physicsKey)])
      .filter(([, state]) => state));
    if (Object.keys(states).length) savePersistentRigidBodyStates(states);
  }
}

function isDescendantOf(object, ancestor) {
  let current = object?.parent;
  while (current) {
    if (current === ancestor) return true;
    current = current.parent;
  }
  return false;
}
