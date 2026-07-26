import * as THREE from "three";
import { updateAnalogClockRuntime } from "./behaviors/AnalogClockBehavior.js?v=cinematic-screen-space-stability";
import { updateBarrierGateRuntime } from "./behaviors/BarrierGateBehavior.js?v=cinematic-screen-space-stability";
import { updateControlPostRuntime } from "./behaviors/ControlPostBehavior.js?v=cinematic-screen-space-stability";
import { updateElevatorRuntime } from "./behaviors/ElevatorBehavior.js?v=cinematic-screen-space-stability";
import { updateSuspendedLampRuntime } from "./behaviors/SuspendedLampBehavior.js?v=cinematic-screen-space-stability";

export class LevelPrefabUpdateRuntime {
  constructor(options) {
    Object.assign(this, options);
  }

  updateLights = (dt) => {
    this.instances.forEach((runtime, key) => {
      if (!runtime.light) return;
      const [levelId, prefabName] = key.split(":");
      const prefab = this.config.levelEnvironments?.[levelId]?.prefabs?.find((entry) => entry.name === prefabName);
      const light = prefab?.light;
      if (!light) return;
      runtime.startupElapsed += dt;
      runtime.afterglowRemaining = Math.max(0, (runtime.afterglowRemaining ?? 0) - dt);
      const poweredElapsed = runtime.startupElapsed - Math.max(0, light.startupDelaySeconds ?? 0);
      let factor = poweredElapsed < 0 ? 0 : 1;
      if (poweredElapsed >= 0 && light.faultyStarterLoop) {
        runtime.faultyStarterElapsed += dt;
        factor = this.getStarterFaultFactor({
          elapsed: runtime.faultyStarterElapsed,
          visualTime: this.getTime(),
          config: this.config.feedback.roomLightSwitch,
          seed: runtime.flickerSeed,
        });
      } else if (poweredElapsed >= 0) {
        runtime.flickerTime += dt;
        const flicker = light.flicker ?? {};
        if (flicker.enabled && !runtime.wasFlickerEnabled) {
          runtime.fixtureFlicker.nextIn = THREE.MathUtils.randFloat(0.12, 0.45);
        }
        runtime.wasFlickerEnabled = Boolean(flicker.enabled);
        this.updateFlicker(runtime.fixtureFlicker, dt, flicker);
        factor = flicker.enabled ? this.getFlickerFactor(runtime.light) : 1;
      }
      if (poweredElapsed >= 0 && !light.faultyStarterLoop && light.fluorescentStartup && runtime.startupPattern.length) {
        if (poweredElapsed <= this.getStartupDuration(runtime.startupPattern)) {
          factor *= this.getStartupFactor(runtime.startupPattern, poweredElapsed);
        }
      }
      const afterglow = light.afterglow ?? {};
      const duration = Math.max(0.001, afterglow.durationSeconds ?? 3);
      const progress = THREE.MathUtils.clamp(runtime.afterglowRemaining / duration, 0, 1);
      const localAfterglow = afterglow.enabled === false
        ? 0 : (afterglow.initialFactor ?? 0.2) * Math.pow(progress, afterglow.exponent ?? 2.4);
      const roomPoint = light.roomLightControlled ? this.getRoomLightVisualFactor() : 1;
      const roomEmissive = light.roomLightControlled
        ? Math.max(this.getRoomLightVisualFactor(), this.getRoomLightAfterglowFactor()) : 1;
      const sceneFactor = this.getSceneLightFactor();
      runtime.light.visible = true;
      runtime.light.intensity = light.intensity * (light.enabled === false ? 0 : factor) * roomPoint * sceneFactor;
      runtime.emissiveMaterials.forEach((material) => {
        const base = material.userData.baseEmissiveIntensity ?? 1;
        material.emissiveIntensity = base * (light.enabled === false ? localAfterglow : factor) * roomEmissive * sceneFactor;
      });
    });
  };

  updateClocks = () => {
    const now = new Date();
    this.instances.forEach((runtime) => updateAnalogClockRuntime(runtime.clock, now));
  };

  updateElevators = (dt) => {
    const displayed = this.getDisplayedLevelId();
    this.instances.forEach((runtime, key) => {
      const elevator = runtime.elevator;
      if (!elevator) return;
      const [levelId] = key.split(":");
      const state = updateElevatorRuntime(elevator, dt);
      if (levelId === displayed && this.isArrivalControlLocked() && state?.arrived
        && (elevator.doorElapsed ?? 0) >= (elevator.doorOpenSeconds ?? 0)) {
        this.releaseArrivalControl();
      }
      const disableCage = elevator.disableCageCollisionOnArrival !== false && Boolean(state?.arrived);
      if (disableCage !== Boolean(runtime.elevatorCagePhysicsDisabled)) {
        runtime.elevatorCagePhysicsDisabled = disableCage;
        this.physics?.setKinematicPrefabEnabled(runtime.elevatorCagePhysicsKey, !disableCage);
      }
      if (!disableCage) {
        this.physics?.updateKinematicPrefab(runtime.elevatorCagePhysicsKey, elevator.cage ?? runtime.root, { immediate: true });
      }
      this.physics?.updateKinematicPrefab(runtime.elevatorDoorPhysicsKey, elevator.door, { immediate: true });
      if (levelId !== displayed || !this.isLevelView() || elevator.carryPlayer === false || !state?.rideDelta) return;
      if (this.#isPlayerInsideElevator(elevator)) this.addMovingPlatformDelta(state.rideDelta);
    });
  };

  updateBehaviors = (dt) => {
    const displayed = this.getDisplayedLevelId();
    this.instances.forEach((runtime, key) => {
      const [levelId] = key.split(":");
      if (levelId !== displayed || !this.isLevelView()) return;
      updateSuspendedLampRuntime(runtime.suspendedLamp, dt);
      updateBarrierGateRuntime(runtime.barrierGate, dt).forEach((event) => {
        if (event.type === "unlockGate") this.#unlockBarrier(runtime, levelId, event);
        else if (event.type === "sound" && event.soundKey) this.#playEvent(runtime, levelId, event);
      });
      const event = updateControlPostRuntime(runtime.controlPost, dt, this.getPlayerPosition());
      if (event?.type === "sound" && event.soundKey) this.#playEvent(runtime, levelId, event);
    });
  };

  #unlockBarrier(runtime, levelId, event) {
    if (!runtime.barrierGatePhysicsKey) return;
    const collider = runtime.parts.get(runtime.barrierGate?.colliderName ?? "UBX_SM_Barrier1_Gate_01");
    if (collider) runtime.staticWhileLockedColliderMeshes?.delete(collider);
    this.rebuildStaticPhysics(levelId);
    this.physics?.resetDoor(runtime.barrierGatePhysicsKey);
    this.physics?.configureDoorRestMotor(runtime.barrierGatePhysicsKey, {
      enabled: runtime.barrierGate?.returnToRest,
      degrees: runtime.barrierGate?.restDegrees ?? 0,
      stiffness: runtime.barrierGate?.restMotorStiffness,
      damping: runtime.barrierGate?.restMotorDamping,
    });
    this.physics?.setDoorEnabled(runtime.barrierGatePhysicsKey, true);
    this.physics?.setDoorDragTarget(runtime.barrierGatePhysicsKey,
      event.targetDegrees ?? runtime.barrierGate?.targetDegreesOnUnlock ?? 10, true);
  }

  #playEvent(runtime, levelId, event) {
    this.playSound(event.object ?? runtime.root, event.soundKey, {
      levelId,
      refDistance: event.refDistance,
      maxDistance: event.maxDistance,
    });
  }

  #isPlayerInsideElevator(elevator) {
    const target = elevator.cage ?? elevator.root;
    if (!target) return false;
    const center = new THREE.Vector3();
    target.getWorldPosition(center);
    const player = this.getPlayerPosition();
    const dx = player.x - center.x;
    const dz = player.z - center.z;
    const dy = player.y - center.y;
    const radius = Number(elevator.carryRadius ?? 1.25);
    return dx * dx + dz * dz <= radius * radius && dy > -0.5 && dy < Number(elevator.carryHeight ?? 2.4);
  }
}
