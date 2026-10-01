import * as THREE from "three";
import {
  clearPersistentRigidBodyStates,
  clearPersistentRigidBodyStorage,
  loadPersistentRigidBodyStates,
  savePersistentRigidBodyStates,
} from "../app/AppPersistence.js?v=compact-loading-game";

const colliderPrefix = /^(?:UBX|UCX|USP|UCP)_/i;

export function isLevelRigidRoot(object) {
  return object?.userData?.tg_kind === "level_rigid_body"
    || (String(object?.name ?? "").startsWith("RB_") && object?.userData?.tg_rigid_id);
}

export function isLevelRigidDescendant(object, boundary = null) {
  let current = object;
  while (current && current !== boundary) {
    if (isLevelRigidRoot(current)) return true;
    current = current.parent;
  }
  return false;
}

export class LevelRigidBodyRuntime {
  constructor({ physics, itemInteraction, warn = console.warn } = {}) {
    this.physics = physics;
    this.itemInteraction = itemInteraction;
    this.warn = warn;
    this.entriesByLevel = new Map();
    this.saveAccumulator = 0;
  }

  registerLevel(levelId, environmentRoot) {
    this.unregisterLevel(levelId);
    if (!this.physics || !environmentRoot) return [];
    environmentRoot.updateWorldMatrix(true, true);
    const roots = [];
    environmentRoot.traverse((object) => {
      if (isLevelRigidRoot(object) && !isLevelRigidDescendant(object.parent, environmentRoot)) roots.push(object);
    });

    const usedIds = new Set();
    const savedStates = loadPersistentRigidBodyStates();
    const entries = roots.flatMap((root) => {
      const entry = this.#registerRoot(levelId, root, usedIds);
      return entry ? [entry] : [];
    });
    entries.forEach((entry) => {
      if (!entry.persistent || !savedStates[entry.rigidId]) return;
      this.physics.restoreRigidPrefabState?.(entry.physicsKey, savedStates[entry.rigidId]);
    });
    if (entries.length) this.entriesByLevel.set(levelId, entries);
    return entries;
  }

  unregisterLevel(levelId) {
    const entries = this.entriesByLevel.get(levelId) ?? [];
    this.#saveEntries(levelId, entries);
    entries.forEach((entry) => {
      this.itemInteraction?.unregisterLevelRigidBody?.(entry.itemId);
      this.physics?.removeRigidPrefab?.(entry.physicsKey);
    });
    this.entriesByLevel.delete(levelId);
  }

  update(deltaSeconds) {
    this.saveAccumulator += Math.max(0, Number(deltaSeconds) || 0);
    if (this.saveAccumulator < 1) return;
    this.saveAccumulator = 0;
    this.entriesByLevel.forEach((entries, levelId) => this.#saveEntries(levelId, entries));
  }

  resetPersistentObjects() {
    clearPersistentRigidBodyStorage();
    this.entriesByLevel.forEach((entries) => entries.forEach((entry) => {
      if (entry.persistent) this.physics.resetRigidPrefab?.(entry.physicsKey);
    }));
  }

  resetLevelPersistentObjects(levelId) {
    const entries = this.entriesByLevel.get(levelId) ?? [];
    entries.forEach((entry) => {
      if (entry.persistent) this.physics.resetRigidPrefab?.(entry.physicsKey);
    });
    clearPersistentRigidBodyStates(entries.filter((entry) => entry.persistent).map((entry) => entry.rigidId));
  }

  #registerRoot(levelId, root, usedIds) {
    const rigidId = String(root.userData.tg_rigid_id || root.name.replace(/^RB_/, "")).trim();
    if (!rigidId) {
      this.warn(`[LevelRigidBody] Ignoring "${root.name}": missing tg_rigid_id`);
      return null;
    }
    if (usedIds.has(rigidId)) {
      this.warn(`[LevelRigidBody] Ignoring duplicate ID "${rigidId}" in ${levelId}`);
      return null;
    }
    usedIds.add(rigidId);

    const colliders = [];
    const visuals = [];
    root.traverse((object) => {
      if (!object.isMesh) return;
      const collider = object.userData.tg_kind === "collider" || colliderPrefix.test(object.name);
      if (collider) {
        object.visible = false;
        colliders.push(object);
      } else {
        visuals.push(object);
      }
    });
    if (!colliders.length || !visuals.length) {
      this.warn(`[LevelRigidBody] Ignoring "${root.name}": needs visual mesh and UBX collider`);
      return null;
    }

    const physicsKey = `${levelId}:levelRigid:${rigidId}`;
    const startLocked = Boolean(root.userData.tg_rigid_start_locked);
    const configuredType = String(root.userData.tg_rigid_body_type || "dynamic").toLowerCase();
    const bodyType = startLocked ? "fixed" : configuredType;
    this.physics.createRigidPrefab({
      key: physicsKey,
      sceneKey: levelId,
      root,
      colliderMeshes: colliders,
      bodyType: ["dynamic", "fixed", "kinematic"].includes(bodyType) ? bodyType : "dynamic",
      mass: finitePositive(root.userData.tg_rigid_mass, 6),
      linearDamping: finiteNonNegative(root.userData.tg_rigid_linear_damping, 0.8),
      angularDamping: finiteNonNegative(root.userData.tg_rigid_angular_damping, 1.2),
      friction: finiteNonNegative(root.userData.tg_rigid_friction, 0.75),
      restitution: finiteNonNegative(root.userData.tg_rigid_restitution, 0.02),
    });

    root.userData.levelId = levelId;
    root.userData.levelRigidPhysicsKey = physicsKey;
    const itemId = `${levelId}:levelRigid:${rigidId}`;
    const draggable = Boolean(root.userData.tg_rigid_draggable) && !startLocked;
    const target = visuals[0];
    if (draggable) {
      this.itemInteraction?.registerLevelRigidBody?.({
        id: itemId,
        levelId,
        root,
        target,
        physicsKey,
        label: rigidId,
      });
    }
    return {
      levelId,
      rigidId,
      root,
      colliders,
      visuals,
      physicsKey,
      itemId,
      draggable,
      persistent: Boolean(root.userData.tg_rigid_persistent),
    };
  }

  #saveEntries(levelId, entries) {
    const states = Object.fromEntries(entries
      .filter((entry) => entry.persistent)
      .map((entry) => [entry.rigidId, this.physics.getRigidPrefabState?.(entry.physicsKey)])
      .filter(([, state]) => state));
    savePersistentRigidBodyStates(states);
  }
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNonNegative(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
