import * as THREE from "three";

export class DoorInteractionSystem {
  constructor({ prefabInstances, physics, resolveEnvironmentId, applyVisualRotation, onDoorOpened }) {
    this.prefabInstances = prefabInstances;
    this.physics = physics;
    this.resolveEnvironmentId = resolveEnvironmentId;
    this.applyVisualRotation = applyVisualRotation;
    this.onDoorOpened = onDoorOpened;
  }

  getRuntime(doorMesh) {
    return this.prefabInstances.get(doorMesh?.userData.levelPrefabKey) ?? null;
  }

  toggle(doorMesh) {
    const runtime = this.getRuntime(doorMesh);
    if (!runtime?.door) return false;
    const door = runtime.door;
    if (door.latched) return false;
    const interaction = door.interaction;
    const currentDegrees = this.physics?.getDoorDegrees(runtime.physicsDoorKey) ?? door.degrees;
    door.degrees = currentDegrees;
    const shouldOpen = !(door.commandedOpen || Math.abs(currentDegrees) >= 25);
    const targetDegrees = THREE.MathUtils.clamp(
      shouldOpen ? interaction.openDegrees ?? -90 : interaction.initialDegrees ?? 0,
      interaction.minDegrees ?? -105,
      interaction.maxDegrees ?? 5,
    );
    door.commandedOpen = shouldOpen;
    door.degrees = targetDegrees;
    if (shouldOpen) this.onDoorOpened?.(doorMesh.userData.levelPrefabKey);

    if (runtime.physicsDoorKey) {
      return Boolean(this.physics?.setDoorDragTarget(runtime.physicsDoorKey, targetDegrees, true));
    }
    this.applyVisualRotation(runtime);
    return true;
  }

  reset(levelId = null) {
    const environmentId = levelId == null ? null : this.resolveEnvironmentId(levelId);
    this.prefabInstances.forEach((runtime, key) => {
      if (environmentId != null && key.split(":")[0] !== environmentId) return;
      if (!runtime.door) return;
      runtime.door.degrees = runtime.door.interaction.initialDegrees ?? 0;
      runtime.door.commandedOpen = false;
      runtime.door.releaseAngularVelocity = 0;
      runtime.door.latched = Boolean(runtime.door.defaultLatched);
      if (!runtime.physicsDoorKey) this.applyVisualRotation(runtime);
    });
    this.physics?.resetDoors(environmentId);
    this.prefabInstances.forEach((runtime, key) => {
      if (environmentId != null && key.split(":")[0] !== environmentId) return;
      if (!runtime.door?.latched || !runtime.physicsDoorKey) return;
      this.physics?.setDoorLocked(runtime.physicsDoorKey, true, runtime.door.interaction.initialDegrees ?? 0);
    });
  }
}
