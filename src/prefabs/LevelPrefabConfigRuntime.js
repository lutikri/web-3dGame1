import * as THREE from "three";
import { applyPrefabSpotTarget } from "./PrefabRuntimeFactory.js?v=locomotion-weight-pass";
import { resetBarrierGateRuntime } from "./behaviors/BarrierGateBehavior.js?v=locomotion-weight-pass";
import { resetControlPostRuntime } from "./behaviors/ControlPostBehavior.js?v=locomotion-weight-pass";
import { resetElevatorRuntime } from "./behaviors/ElevatorBehavior.js?v=locomotion-weight-pass";

export class LevelPrefabConfigRuntime {
  constructor(options) {
    Object.assign(this, options);
  }

  apply = (levelId, prefabName, structural = false) => {
    const environment = this.config.levelEnvironments?.[levelId];
    const prefab = environment?.prefabs?.find((entry) => entry.name === prefabName);
    if (prefab?.behavior === "operatorPanel") {
      this.applyPanelTransform();
      this.#refreshStructural(levelId, structural);
      return;
    }
    const runtime = this.instances.get(`${levelId}:${prefabName}`);
    if (!prefab || !runtime) return;
    this.#applyTransform(runtime, prefab);
    if (runtime.rigidPrefabKey) this.physics?.resetRigidPrefab(runtime.rigidPrefabKey, runtime.root, true);
    resetElevatorRuntime(runtime.elevator);
    this.#applyBarrier(runtime, prefab, levelId, structural);
    if (runtime.controlPost) {
      Object.assign(runtime.controlPost, prefab.controlPost ?? {});
      resetControlPostRuntime(runtime.controlPost);
    }
    runtime.elevatorCagePhysicsDisabled = false;
    this.physics?.setKinematicPrefabEnabled(runtime.elevatorCagePhysicsKey, true);
    this.physics?.setKinematicPrefabEnabled(runtime.elevatorDoorPhysicsKey, true);
    if (runtime.door) {
      const latched = Boolean(prefab.state?.latched);
      if (runtime.door.latched !== latched) this.setDoorLatched(runtime, latched);
      else this.applyDoorRotation(runtime);
    }
    this.#applyLight(runtime, prefab, levelId, structural);
  };

  #applyTransform(runtime, prefab) {
    runtime.root.position.copy(prefab.position ?? new THREE.Vector3());
    runtime.root.rotation.copy(prefab.rotation ?? new THREE.Euler());
    runtime.root.scale.copy(prefab.scale ?? new THREE.Vector3(1, 1, 1));
    Object.entries(prefab.parts ?? {}).forEach(([name, config]) => {
      const part = runtime.parts.get(name);
      if (!part) return;
      part.rotation.copy(part.userData.prefabInitialRotation);
      const rotation = config.rotationDegrees ?? {};
      part.rotateX(THREE.MathUtils.degToRad(rotation.x ?? 0));
      part.rotateY(THREE.MathUtils.degToRad(rotation.y ?? 0));
      part.rotateZ(THREE.MathUtils.degToRad(rotation.z ?? 0));
    });
    runtime.root.updateMatrixWorld(true);
  }

  #applyBarrier(runtime, prefab, levelId, structural) {
    if (!runtime.barrierGate) return;
    Object.assign(runtime.barrierGate, prefab.barrierGate ?? {});
    resetBarrierGateRuntime(runtime.barrierGate);
    if (!runtime.barrierGatePhysicsKey) return;
    const collider = runtime.parts.get(runtime.barrierGate.colliderName ?? "UBX_SM_Barrier1_Gate_01");
    if (collider) {
      const collection = runtime.staticWhileLockedColliderMeshes;
      if (runtime.barrierGate.locked === false) collection.delete(collider);
      else collection.add(collider);
    }
    this.physics?.resetDoor(runtime.barrierGatePhysicsKey);
    this.physics?.configureDoorRestMotor(runtime.barrierGatePhysicsKey, {
      enabled: runtime.barrierGate.returnToRest,
      degrees: runtime.barrierGate.restDegrees ?? 0,
      stiffness: runtime.barrierGate.restMotorStiffness,
      damping: runtime.barrierGate.restMotorDamping,
    });
    this.physics?.setDoorEnabled(runtime.barrierGatePhysicsKey, runtime.barrierGate.locked === false);
    if (structural && this.getActiveLevelId() === levelId) this.rebuildStaticPhysics(levelId);
  }

  #applyLight(runtime, prefab, levelId, structural) {
    const light = prefab.light;
    if (!light || !runtime.light) {
      this.#refreshStructural(levelId, structural);
      return;
    }
    // Pooled point lights are authored emitters; only fixed pool slots enter Three's light layout.
    runtime.light.visible = runtime.light.userData.pooledEmitter !== true;
    runtime.light.color.set(light.color);
    runtime.light.userData.baseIntensity = light.intensity;
    runtime.light.distance = light.distance;
    runtime.light.decay = light.decay;
    if (light.localOffset) runtime.light.position.copy(light.localOffset);
    if (runtime.light.isSpotLight) {
      runtime.light.angle = light.angle;
      runtime.light.penumbra = light.penumbra;
      applyPrefabSpotTarget(runtime.light, light, runtime.parts.get(light.markerName));
    }
    if (light.enabled !== false && !runtime.wasLightEnabled && light.fluorescentStartup) {
      runtime.startupPattern = this.createStartupPattern();
      runtime.startupElapsed = 0;
    }
    if (light.enabled === false && runtime.wasLightEnabled && light.afterglow?.enabled !== false) {
      runtime.afterglowRemaining = light.afterglow?.durationSeconds ?? 3;
    }
    runtime.wasLightEnabled = light.enabled !== false;
    if (light.enabled === false) runtime.light.intensity = 0;
    if (structural) this.applyShadowSettings(runtime.light, light);
    this.#refreshStructural(levelId, structural);
  }

  #refreshStructural(levelId, structural) {
    if (structural && this.getActiveLevelId() === levelId) this.updateActivation();
  }
}
