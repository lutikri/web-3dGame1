import * as THREE from "three";
import {
  getDoorLatchBaseDegrees,
  getDoorLatchRestDegrees,
} from "../prefabs/behaviors/DoorLatchBehavior.js?v=passive-flashlight-prefab";

export class DoorInteractionSystem {
  constructor({
    prefabInstances,
    interactive,
    physics,
    resolveEnvironmentId,
    applyVisualRotation,
    applyLatchRotation,
    setLatched,
    toggleDoor,
    playSound,
    canOperateLatch = () => true,
    onCollisionOwnershipChanged = () => {},
    onDoorOpened,
  }) {
    this.prefabInstances = prefabInstances;
    this.interactive = interactive;
    this.physics = physics;
    this.resolveEnvironmentId = resolveEnvironmentId;
    this.applyVisualRotation = applyVisualRotation;
    this.applyLatchRotation = applyLatchRotation;
    this.setLatched = setLatched;
    this.toggleDoor = toggleDoor;
    this.playSound = playSound;
    this.canOperateLatch = canOperateLatch;
    this.onCollisionOwnershipChanged = onCollisionOwnershipChanged;
    this.onDoorOpened = onDoorOpened;
    this.draggedRuntime = null;
  }

  beginLatchInteraction(handle) {
    const runtime = this.getRuntime(handle);
    const door = runtime?.door;
    if (!door) return false;
    door.activeLatchHandle = handle ?? door.latchHandle ?? door.latchHandles?.[0] ?? null;
    if (door.interaction.latchAction !== "holdOpen") {
      this.playSound(door.activeLatchHandle ?? door.mesh, "DoorBulk1_LatchCrank1", { maxDistance: 4.5 });
    }
    if (!this.canOperateLatch(runtime)) {
      this.#triggerBlockedAttempt(runtime);
      return false;
    }
    const turnDegrees =
      door.interaction.latchHandleDegreesByName?.[door.activeLatchHandle?.name] ??
      door.interaction.latchTurnDegrees ??
      28;
    if (door.interaction.latchAction === "toggleDoor") {
      door.latchBlockedAttempt = null;
      door.latchOperation = { action: "toggleDoor", held: true, progress: 0, fromDegrees: 0, toDegrees: turnDegrees };
      this.applyLatchRotation(runtime);
      return true;
    }
    if (door.interaction.latchAction === "holdOpen") {
      this.playSound(door.activeLatchHandle ?? door.mesh, "DoorPushbar_Open1", { maxDistance: 4 });
      door.latchBlockedAttempt = null;
      door.latched = false;
      if (runtime.physicsDoorKey) this.physics?.setDoorLocked(runtime.physicsDoorKey, false);
      door.latchOperation = { action: "holdOpen", held: true, progress: 0, fromDegrees: 0, toDegrees: turnDegrees };
      this.physics?.setDoorDragTarget(runtime.physicsDoorKey, door.interaction.openDegrees ?? 80, true);
      this.applyLatchRotation(runtime);
      return true;
    }
    const currentDegrees = this.physics?.getDoorDegrees(runtime.physicsDoorKey) ?? door.degrees;
    door.degrees = currentDegrees;
    const initialDegrees = door.interaction.initialDegrees ?? 0;
    const closedTolerance = door.interaction.latchClosedToleranceDegrees ?? 7;
    if (!door.latched && Math.abs(currentDegrees - initialDegrees) > closedTolerance) {
      this.#triggerBlockedAttempt(runtime);
      return false;
    }
    door.latchBlockedAttempt = null;
    const targetLatched = !door.latched;
    const fullTurnDegrees = door.interaction.latchTurnDegrees ?? 360;
    const baseDegrees = getDoorLatchBaseDegrees(door, door.latched, door.activeLatchHandle);
    const targetBaseDegrees = getDoorLatchBaseDegrees(door, targetLatched, door.activeLatchHandle);
    const finalSpinOffsetDegrees = (door.latchHandleSpinOffsetDegrees ?? 0) + (targetLatched ? -1 : 1) * fullTurnDegrees;
    door.latchOperation = {
      held: true,
      progress: 0,
      targetLatched,
      fromDegrees: baseDegrees + (door.latchHandleSpinOffsetDegrees ?? 0),
      toDegrees: targetBaseDegrees + finalSpinOffsetDegrees,
      finalSpinOffsetDegrees,
    };
    this.applyLatchRotation(runtime);
    return true;
  }

  releaseLatches() {
    this.prefabInstances.forEach((runtime) => {
      if (runtime.door?.latchOperation) runtime.door.latchOperation.held = false;
    });
  }

  getDraggedRuntime = () => this.draggedRuntime;

  beginDrag(doorMesh) {
    const runtime = this.getRuntime(doorMesh);
    if (!runtime?.door || runtime.door.latched) return false;
    this.draggedRuntime = runtime;
    const door = runtime.door;
    door.releaseAngularVelocity = 0;
    door.grabPoint =
      doorMesh.userData.lastHitPoint?.clone() ??
      doorMesh.localToWorld(new THREE.Vector3(0.5, 0, 0));
    door.grabLocalPoint = doorMesh.worldToLocal(door.grabPoint.clone());
    door.grabStartDegrees = this.physics?.getDoorDegrees(runtime.physicsDoorKey) ?? door.degrees;
    door.degrees = door.grabStartDegrees;
    door.grabLastDegrees = door.degrees;
    if (runtime.physicsDoorKey) {
      this.physics?.setDoorDragTarget(runtime.physicsDoorKey, door.degrees, true);
      return true;
    }
    runtime.collisionDisabled = true;
    this.onCollisionOwnershipChanged();
    return true;
  }

  updateDrag(camera) {
    const runtime = this.draggedRuntime;
    const door = runtime?.door;
    if (!door) return false;
    const physicalDegrees = this.physics?.getDoorDegrees(runtime.physicsDoorKey);
    if (physicalDegrees != null) door.degrees = physicalDegrees;
    door.mesh.updateWorldMatrix(true, false);
    const hinge = door.mesh.getWorldPosition(new THREE.Vector3());
    const grabbedPoint = door.mesh.localToWorld(door.grabLocalPoint.clone());
    const screenPoint = grabbedPoint.clone().project(camera);
    const sampleRadians = 0.01;
    const sampledPoint = grabbedPoint.clone().sub(hinge)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), sampleRadians)
      .add(hinge).project(camera);
    const derivativeX = (sampledPoint.x - screenPoint.x) / sampleRadians;
    const derivativeY = (sampledPoint.y - screenPoint.y) / sampleRadians;
    const derivativeLengthSq = derivativeX * derivativeX + derivativeY * derivativeY;
    if (derivativeLengthSq < 0.000001) return false;
    const correctionRadians = THREE.MathUtils.clamp(
      -(screenPoint.x * derivativeX + screenPoint.y * derivativeY) / derivativeLengthSq,
      -0.08,
      0.08,
    );
    const nextDegrees = THREE.MathUtils.clamp(
      door.degrees + THREE.MathUtils.radToDeg(correctionRadians),
      door.interaction.minDegrees ?? -105,
      door.interaction.maxDegrees ?? 105,
    );
    const deltaRadians = THREE.MathUtils.degToRad(nextDegrees - door.grabLastDegrees);
    door.degrees = nextDegrees;
    door.grabLastDegrees = nextDegrees;
    door.releaseAngularVelocity = THREE.MathUtils.lerp(
      door.releaseAngularVelocity ?? 0,
      THREE.MathUtils.clamp(deltaRadians * 60, -1.5, 1.5),
      0.25,
    );
    if (runtime.physicsDoorKey) {
      this.physics?.setDoorDragTarget(runtime.physicsDoorKey, door.degrees, true);
    } else {
      this.applyVisualRotation(runtime);
    }
    return true;
  }

  endDrag() {
    const runtime = this.draggedRuntime;
    if (!runtime) return false;
    if (runtime.physicsDoorKey) {
      this.physics?.setDoorDragTarget(
        runtime.physicsDoorKey,
        runtime.door.degrees,
        false,
        runtime.door.releaseAngularVelocity ?? 0,
      );
      runtime.door.releaseAngularVelocity = 0;
      this.draggedRuntime = null;
      return true;
    }
    runtime.collisionDisabled = false;
    this.applyVisualRotation(runtime);
    this.draggedRuntime = null;
    this.onCollisionOwnershipChanged();
    return true;
  }

  #triggerBlockedAttempt(runtime) {
    const door = runtime?.door;
    if (!door) return;
    door.latchOperation = null;
    const restDegrees = getDoorLatchRestDegrees(door, door.activeLatchHandle);
    const blockedTurnDegrees = door.blockedLatchStopDegrees
      ?? door.interaction.latchBlockedStopDegrees
      ?? Math.min(Math.abs(door.interaction.latchTurnDegrees ?? 360) * 0.25, 95);
    door.latchBlockedAttempt = {
      elapsed: 0,
      fromDegrees: restDegrees,
      toDegrees: restDegrees + (door.latched ? 1 : -1) * blockedTurnDegrees,
      sign: door.latched ? 1 : -1,
    };
    this.applyLatchRotation(runtime);
  }

  update(dt) {
    this.prefabInstances.forEach((runtime) => {
      const door = runtime.door;
      if (door?.latchBlockedAttempt) {
        door.latchBlockedAttempt.elapsed += dt;
        this.applyLatchRotation(runtime);
        if (door.latchBlockedAttempt.elapsed >= (door.interaction.latchBlockedAttemptSeconds ?? 0.55)) {
          door.latchBlockedAttempt = null;
          this.applyLatchRotation(runtime);
        }
      }
      if (!door?.latchOperation) return;
      const operation = door.latchOperation;
      const interaction = door.interaction;
      const direction = operation.held
        ? 1 / (interaction.latchHoldSeconds ?? 0.5)
        : -1 / (interaction.latchReturnSeconds ?? 0.35);
      operation.progress = THREE.MathUtils.clamp(operation.progress + direction * dt, 0, 1);
      this.applyLatchRotation(runtime);
      if (operation.action === "holdOpen") {
        this.#updateHoldOpen(runtime);
        return;
      }
      if (operation.progress >= 1) {
        if (operation.action === "toggleDoor") {
          if (!operation.completed) {
            operation.completed = true;
            operation.held = false;
            this.toggleDoor(door.mesh);
          }
          return;
        }
        door.latchHandleSpinOffsetDegrees = operation.finalSpinOffsetDegrees ?? door.latchHandleSpinOffsetDegrees ?? 0;
        const targetLatched = operation.targetLatched;
        door.latchOperation = null;
        this.setLatched(runtime, targetLatched);
      } else if (operation.progress <= 0 && !operation.held) {
        door.latchOperation = null;
        door.activeLatchHandle = null;
        this.applyLatchRotation(runtime);
      }
    });
  }

  #updateHoldOpen(runtime) {
    const door = runtime?.door;
    const operation = door?.latchOperation;
    if (!door || operation?.action !== "holdOpen") return;
    if (operation.held) {
      this.physics?.setDoorDragTarget(runtime.physicsDoorKey, door.interaction.openDegrees ?? 80, true);
      return;
    }
    const closeDegrees = door.interaction.closeDegrees ?? door.interaction.initialDegrees ?? 0;
    const currentDegrees = this.physics?.getDoorDegrees(runtime.physicsDoorKey) ?? door.degrees;
    door.degrees = currentDegrees;
    this.physics?.setDoorDragTarget(runtime.physicsDoorKey, closeDegrees, true);
    if (Math.abs(currentDegrees - closeDegrees) <= (door.interaction.closeToleranceDegrees ?? 3)) {
      door.latchOperation = null;
      door.activeLatchHandle = null;
      door.latched = true;
      door.commandedOpen = false;
      this.physics?.setDoorLocked(runtime.physicsDoorKey, true, closeDegrees);
      this.playSound(door.mesh, "DoorPushbar_Close1", { maxDistance: 4 });
      this.applyLatchRotation(runtime);
    }
  }

  register(levelId, prefabConfig, runtime) {
    const interaction = prefabConfig.interaction;
    if (interaction?.type !== "hingedDoor") return false;
    const doorMesh = runtime.parts.get(interaction.meshName);
    const colliderMesh = runtime.parts.get(interaction.colliderName);
    const latchHandleNames = [
      ...(interaction.latchHandleName ? [interaction.latchHandleName] : []),
      ...(interaction.latchHandleNames ?? []),
    ];
    const latchHandles = latchHandleNames.map((name) => runtime.parts.get(name)).filter(Boolean);
    const latchHandle = latchHandles[0] ?? null;
    if (!doorMesh) return false;

    doorMesh.userData.kind = "hingedDoor";
    doorMesh.userData.levelId = levelId;
    const materials = Array.isArray(doorMesh.material) ? doorMesh.material : [doorMesh.material];
    materials.filter(Boolean).forEach((material) => {
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
    });
    doorMesh.userData.maxInteractionDistance = interaction.maxDistance ?? 2.8;
    doorMesh.userData.levelPrefabKey = `${levelId}:${prefabConfig.name}`;
    if (interaction.doorClickAction !== "none") this.interactive.push(doorMesh);
    runtime.root.updateMatrixWorld(true);
    doorMesh.updateWorldMatrix(true, false);
    colliderMesh?.updateWorldMatrix(true, false);
    runtime.door = {
      mesh: doorMesh,
      collider: colliderMesh,
      latchHandle,
      latchHandles,
      interaction,
      levelId,
      prefabName: prefabConfig.name,
      degrees: interaction.initialDegrees ?? 0,
      commandedOpen: false,
      latched: Boolean(prefabConfig.state?.latched),
      defaultLatched: Boolean(prefabConfig.state?.latched),
      releaseAngularVelocity: 0,
      colliderFromDoor: colliderMesh
        ? new THREE.Matrix4().copy(doorMesh.matrixWorld).invert().multiply(colliderMesh.matrixWorld)
        : null,
    };
    latchHandles.forEach((handle) => {
      handle.userData.kind = "doorLatchHandle";
      handle.userData.levelId = levelId;
      handle.userData.controlLabel = interaction.latchControlLabel ?? "DOOR HANDLE";
      handle.userData.maxInteractionDistance = interaction.maxDistance ?? 2.8;
      handle.userData.levelPrefabKey = `${levelId}:${prefabConfig.name}`;
      this.interactive.push(handle);
    });
    this.applyVisualRotation(runtime);
    if (this.physics && colliderMesh) {
      runtime.physicsDoorKey = `${levelId}:${prefabConfig.name}`;
      this.physics.createHingedDoor({
        key: runtime.physicsDoorKey,
        sceneKey: levelId,
        doorMesh,
        colliderMesh,
        initialDegrees: interaction.initialDegrees ?? 0,
        minDegrees: interaction.minDegrees ?? -105,
        maxDegrees: interaction.maxDegrees ?? 5,
        density: interaction.density,
        angularDamping: interaction.angularDamping,
        maxAngularVelocity: interaction.maxAngularVelocity,
        initialHoldSeconds: interaction.initialHoldSeconds,
        motorStiffness: interaction.motorStiffness,
        motorDamping: interaction.motorDamping,
      });
      if (runtime.door.latched) {
        this.physics.setDoorLocked(runtime.physicsDoorKey, true, interaction.initialDegrees ?? 0);
      }
    }
    return true;
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
