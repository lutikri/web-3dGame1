import * as THREE from "three";
import { applyAxisRotation } from "../scene/TransformUtils.js?v=debug-lil-gui";
import { applyDoorLatchHandleRotation } from "../prefabs/behaviors/DoorLatchBehavior.js?v=debug-lil-gui";

export class DoorStateRuntime {
  constructor(options) {
    Object.assign(this, options);
    this.interactions = null;
    this.hoveredDoor = null;
  }

  attach(interactions) {
    this.interactions = interactions;
  }

  applyRotation = (placed) => {
    const door = placed?.door;
    if (!door) return;
    door.mesh.rotation.copy(door.mesh.userData.prefabInitialRotation);
    applyAxisRotation(door.mesh, door.interaction.axis ?? "y", THREE.MathUtils.degToRad(door.degrees));
    placed.root.updateMatrixWorld(true);
    if (door.collider && door.colliderFromDoor) {
      door.mesh.updateWorldMatrix(true, false);
      door.collider.parent?.updateWorldMatrix(true, false);
      const colliderWorld = new THREE.Matrix4().multiplyMatrices(door.mesh.matrixWorld, door.colliderFromDoor);
      const parentInverse = new THREE.Matrix4().copy(door.collider.parent.matrixWorld).invert();
      const colliderLocal = new THREE.Matrix4().multiplyMatrices(parentInverse, colliderWorld);
      colliderLocal.decompose(door.collider.position, door.collider.quaternion, door.collider.scale);
    }
    applyDoorLatchHandleRotation(placed);
    placed.root.updateMatrixWorld(true);
  };

  applyLatchRotation = (placed) => applyDoorLatchHandleRotation(placed);

  setHovered = (doorMesh) => {
    if (this.hoveredDoor === doorMesh) return;
    this.hoveredDoor = doorMesh;
    this.setHoverClass(Boolean(doorMesh));
  };

  toggle = (doorMesh) => {
    const placed = this.instances.get(doorMesh?.userData.levelPrefabKey);
    if (placed?.door?.latched) return false;
    const result = this.interactions?.toggle(doorMesh) ?? false;
    if (result && placed?.door && isBulkheadDoor(placed.door)) {
      this.playSound(
        placed.door.mesh,
        placed.door.commandedOpen ? "DoorBulk1_Open1" : "DoorBulk1_Close1",
        { maxDistance: 5 },
      );
    }
    return result;
  };

  reset = (levelId = null) => {
    const result = this.interactions?.reset(levelId);
    const environmentId = levelId == null ? null : this.resolveEnvironmentId(levelId);
    this.instances.forEach((placed, key) => {
      if (environmentId != null && key.split(":")[0] !== environmentId) return;
      if (placed.door) this.setLatched(placed, Boolean(placed.door.defaultLatched), { resetHandleSpin: true });
    });
    return result;
  };

  canOperateLatch = (placed) => {
    const door = placed?.door;
    const objectives = this.getSessionConfig()?.objectives ?? [];
    const exitObjective = door?.prefabName && objectives.find(
      (objective) => objective.type === "event" && objective.event === "doorUnlocked" && objective.target === door.prefabName,
    );
    const mode = this.getGameMode();
    if (exitObjective && mode !== "complete" && mode !== "failed") {
      door.blockedLatchStopDegrees = exitObjective.blockedStopDegrees;
      this.emitThought("door-shift-incomplete", 2, 2.8);
      return false;
    }
    if (door) door.blockedLatchStopDegrees = null;
    return true;
  };

  setLatched = (placed, latched, options = {}) => {
    const door = placed?.door;
    if (!door) return false;
    const wasLatched = Boolean(door.latched);
    door.latchOperation = null;
    door.latchBlockedAttempt = null;
    if (options.resetHandleSpin) door.latchHandleSpinOffsetDegrees = 0;
    door.latched = Boolean(latched);
    door.commandedOpen = false;
    if (door.latched) {
      door.degrees = door.interaction.initialDegrees ?? 0;
      door.releaseAngularVelocity = 0;
      if (placed.physicsDoorKey) this.physics?.setDoorLocked(placed.physicsDoorKey, true, door.degrees);
      else this.applyRotation(placed);
    } else if (placed.physicsDoorKey) {
      this.physics?.setDoorLocked(placed.physicsDoorKey, false);
    }
    applyDoorLatchHandleRotation(placed);
    this.refreshTooltip();
    if (wasLatched && !door.latched) {
      this.emitSessionEvent("doorUnlocked", { target: door.prefabName });
      this.#showDeferredResults(door.prefabName);
    }
    return true;
  };

  onDoorOpened = (prefabKey) => {
    this.emitSessionEvent("doorOpened", { target: prefabKey?.split(":").slice(1).join(":") });
  };

  #showDeferredResults(prefabName) {
    const isExitTarget = (this.getSessionConfig()?.objectives ?? []).some(
      (objective) => objective.type === "event"
        && objective.event === "doorUnlocked"
        && objective.target === prefabName,
    );
    const results = this.getResults();
    if (isExitTarget && results && this.shouldWaitForExit()) this.showResults(results);
  }
}


function isBulkheadDoor(door) {
  return door.prefabName?.startsWith("DoorBulk") || door.mesh?.name?.includes("DoorBulk");
}
