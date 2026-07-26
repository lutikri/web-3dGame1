import * as THREE from "three";

import { createAnalogClockRuntime } from "./behaviors/AnalogClockBehavior.js?v=terminal-exit-presentation";
import { createBarrierGateRuntime } from "./behaviors/BarrierGateBehavior.js?v=terminal-exit-presentation";
import { createBriefSheetRuntime } from "./behaviors/BriefSheetBehavior.js?v=terminal-exit-presentation";
import { createControlPostRuntime } from "./behaviors/ControlPostBehavior.js?v=terminal-exit-presentation";
import { createElevatorRuntime } from "./behaviors/ElevatorBehavior.js?v=terminal-exit-presentation";
import { createNarratorRadioRuntime } from "./behaviors/NarratorRadioBehavior.js?v=terminal-exit-presentation";
import { createSuspendedLampRuntime } from "./behaviors/SuspendedLampBehavior.js?v=terminal-exit-presentation";

export function createPrefabRuntimeFactory({
  config,
  materials,
  collisionDebugMaterial,
  photometricLights,
  isCollisionHelper,
  ensureSecondUvSet,
  getObjectMatchNames,
  getCustomMaterialKey,
  createStartupPattern,
  createFixtureFlickerState,
  applyShadowSettings,
}) {
  function create(prefab, prefabConfig) {
    const emissiveMaterials = [];
    const materialClones = [];
    const materialCloneEntries = [];
    const collisionMeshes = [];
    const parts = new Map();
    prefab.traverse((object) => {
      if (object.name) {
        object.userData.prefabInitialRotation = object.rotation.clone();
        parts.set(object.name, object);
      }
      if (!object.isMesh) return;
      const isCollider = isCollisionHelper(object.name);
      object.userData.prefabCollider = isCollider;
      object.visible = isCollider ? Boolean(config.player?.collision?.show) : true;
      object.castShadow = !isCollider;
      object.receiveShadow = !isCollider;
      if (isCollider) {
        object.material = collisionDebugMaterial;
        object.renderOrder = 1000;
        collisionMeshes.push(object);
        return;
      }
      ensureSecondUvSet(object);
      const materialKey = resolveMaterialKey(object, prefabConfig);
      const sourceMaterial = materials.interiorCustom[materialKey] ?? materials.interior;
      const materialConfig = config.interior.specialMaterials?.[materialKey] ?? {};
      const shouldClone = prefabConfig.behavior === "briefSheet"
        || Boolean(prefabConfig.light) || materialKey !== prefabConfig.materialKey;
      object.material = shouldClone ? sourceMaterial.clone() : sourceMaterial;
      if (shouldClone) photometricLights.resetClonedMaterial(object.material);
      photometricLights.patchMaterial(object.material);
      object.castShadow = materialConfig.castShadow ?? object.castShadow;
      object.receiveShadow = materialConfig.receiveShadow ?? object.receiveShadow;
      if (shouldClone) {
        materialClones.push(object.material);
        materialCloneEntries.push({ material: object.material, materialKey });
      }
      if (prefabConfig.light) {
        object.material.userData.baseEmissiveIntensity = sourceMaterial.userData.baseEmissiveIntensity;
        emissiveMaterials.push(object.material);
      }
    });

    const runtime = {
      root: prefab,
      light: null,
      emissiveMaterials,
      materialClones,
      materialCloneEntries,
      materialKey: prefabConfig.materialKey,
      collisionMeshes,
      dynamicColliderMeshes: new Set(),
      staticWhileLockedColliderMeshes: new Set(),
      parts,
      flickerTime: Math.random() * 100,
      flickerSeed: Math.random() * 1000,
      startupPattern: prefabConfig.light?.fluorescentStartup ? createStartupPattern() : [],
      startupElapsed: 0,
      faultyStarterElapsed: 0,
      afterglowRemaining: 0,
      wasLightEnabled: prefabConfig.light?.enabled !== false,
      fixtureFlicker: createFixtureFlickerState(prefabConfig.light?.flicker),
      wasFlickerEnabled: Boolean(prefabConfig.light?.flicker?.enabled),
    };
    attachBehavior(runtime, prefabConfig);
    if (prefabConfig.light) createLight(prefab, prefabConfig, runtime);
    return runtime;
  }

  function attachBehavior(runtime, prefabConfig) {
    if (prefabConfig.behavior === "analogClock" && prefabConfig.clock?.enabled !== false) {
      runtime.clock = createAnalogClockRuntime(runtime.parts, prefabConfig.clock);
    } else if (prefabConfig.behavior === "elevator") {
      runtime.elevator = createElevatorRuntime(runtime.root, runtime.parts, prefabConfig.elevator);
      runtime.collisionDisabled = true;
    } else if (prefabConfig.behavior === "narratorRadio") {
      runtime.radio = createNarratorRadioRuntime(runtime.parts, prefabConfig.radio);
    } else if (prefabConfig.behavior === "barrierGate") {
      runtime.barrierGate = createBarrierGateRuntime(runtime.parts, prefabConfig.barrierGate);
    } else if (prefabConfig.behavior === "controlPost") {
      runtime.controlPost = createControlPostRuntime(runtime.parts, prefabConfig.controlPost);
    } else if (prefabConfig.behavior === "suspendedLamp") {
      runtime.suspendedLamp = createSuspendedLampRuntime(runtime.parts, prefabConfig.suspension, prefabConfig.name);
    } else if (prefabConfig.behavior === "briefSheet") {
      runtime.briefSheet = createBriefSheetRuntime(runtime.parts, prefabConfig.briefSheet);
    }
  }

  function createLight(prefab, prefabConfig, runtime) {
    const lightConfig = prefabConfig.light;
    const marker = lightConfig.markerName ? runtime.parts.get(lightConfig.markerName) : null;
    if (marker?.isLight) {
      marker.visible = false;
      marker.intensity = 0;
    }
    const type = lightConfig.type ?? (marker?.isSpotLight ? "spot" : "point");
    const light = type === "spot"
      ? new THREE.SpotLight(lightConfig.color, lightConfig.intensity, lightConfig.distance,
          lightConfig.angle ?? marker?.angle ?? Math.PI / 5,
          lightConfig.penumbra ?? marker?.penumbra ?? 0.35, lightConfig.decay)
      : new THREE.PointLight(lightConfig.color, lightConfig.intensity, lightConfig.distance, lightConfig.decay);
    light.name = `${prefabConfig.name}_${type === "spot" ? "SpotLight" : "PointLight"}`;
    const configuredParent = lightConfig.parentName ? runtime.parts.get(lightConfig.parentName) : null;
    const lightParent = configuredParent ?? marker?.parent ?? prefab;
    lightParent.add(light);
    if (marker) {
      light.position.copy(lightConfig.localOffset ?? marker.position);
      light.quaternion.copy(marker.quaternion);
    } else {
      light.position.copy(lightConfig.localOffset ?? new THREE.Vector3());
    }
    light.userData.baseIntensity = lightConfig.intensity;
    light.userData.lightConfig = lightConfig;
    light.userData.fixtureFlicker = runtime.fixtureFlicker;
    if (light.isSpotLight) {
      const target = new THREE.Object3D();
      target.name = `${prefabConfig.name}_SpotTarget`;
      lightParent.add(target);
      light.target = target;
      applyPrefabSpotTarget(light, lightConfig, marker);
    }
    applyShadowSettings(light, lightConfig);
    runtime.light = light;
    runtime.photometricPointLight = light.isPointLight ? photometricLights.register(runtime, lightConfig) : null;
  }

  function resolveMaterialKey(object, prefabConfig) {
    const overrides = prefabConfig.materialOverrides ?? {};
    const matchName = getObjectMatchNames(object).find((name) => overrides[name]);
    return matchName ? overrides[matchName] : getCustomMaterialKey(object) ?? prefabConfig.materialKey;
  }

  return { create };
}

export function applyPrefabSpotTarget(light, lightConfig, marker = null) {
  if (!light?.isSpotLight || !light.target) return;
  if (lightConfig.angle != null) light.angle = lightConfig.angle;
  if (lightConfig.penumbra != null) light.penumbra = lightConfig.penumbra;
  const distance = Math.max(0.25, Math.min(lightConfig.distance ?? 2, 4));
  const targetOffset = lightConfig.targetLocalOffset ?? new THREE.Vector3(0, 0, -distance);
  if (marker && !lightConfig.targetLocalOffset) {
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(marker.quaternion);
    light.target.position.copy(light.position).add(direction.multiplyScalar(distance));
  } else {
    light.target.position.copy(light.position).add(targetOffset);
  }
  light.target.updateMatrixWorld(true);
}
