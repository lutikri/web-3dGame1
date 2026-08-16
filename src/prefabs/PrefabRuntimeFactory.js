import * as THREE from "three";

import { createAnalogClockRuntime } from "./behaviors/AnalogClockBehavior.js?v=prefab-marker-reset";
import { createBarrierGateRuntime } from "./behaviors/BarrierGateBehavior.js?v=prefab-marker-reset";
import { createBriefSheetRuntime } from "./behaviors/BriefSheetBehavior.js?v=prefab-marker-reset";
import { createControlPostRuntime } from "./behaviors/ControlPostBehavior.js?v=prefab-marker-reset";
import { createElevatorRuntime } from "./behaviors/ElevatorBehavior.js?v=prefab-marker-reset";
import { createNarratorRadioRuntime } from "./behaviors/NarratorRadioBehavior.js?v=prefab-marker-reset";
import { createPlasmaViewRuntime } from "./behaviors/PlasmaViewBehavior.js?v=prefab-marker-reset";
import { createSuspendedLampRuntime } from "./behaviors/SuspendedLampBehavior.js?v=prefab-marker-reset";

export function createPrefabRuntimeFactory({
  config,
  materials,
  collisionDebugMaterial,
  photometricLights,
  pointLightPool,
  isCollisionHelper,
  ensureSecondUvSet,
  getObjectMatchNames,
  getCustomMaterialKey,
  createStartupPattern,
  createFixtureFlickerState,
  applyShadowSettings,
  loadRuntimeTexture,
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
      pointLightPoolEntry: null,
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
    if (runtime.plasmaView?.materials?.length) {
      runtime.materialClones.push(...runtime.plasmaView.materials);
    }
    if (prefabConfig.light) createLight(prefab, prefabConfig, runtime);
    runtime.ready = attachLightCookie(runtime, prefabConfig.light);
    return runtime;
  }

  function attachLightCookie(runtime, lightConfig) {
    if (!runtime.light?.isSpotLight || !lightConfig?.cookiePath || !loadRuntimeTexture) {
      return Promise.resolve(runtime);
    }
    return loadRuntimeTexture(lightConfig.cookiePath, { colorSpace: THREE.SRGBColorSpace })
      .then((texture) => {
        texture.name = `${runtime.root.name}_SpotCookie`;
        runtime.light.map = texture;
        runtime.light.userData.cookieTexture = texture;
        runtime.light.userData.cookiePath = lightConfig.cookiePath;
        runtime.light.needsUpdate = true;
        return runtime;
      });
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
    } else if (prefabConfig.behavior === "plasmaView") {
      runtime.plasmaView = createPlasmaViewRuntime(runtime.root, runtime.parts, prefabConfig.plasma, prefabConfig.name);
    }
  }

  function createLight(prefab, prefabConfig, runtime) {
    const lightConfig = prefabConfig.light;
    const marker = lightConfig.markerName ? runtime.parts.get(lightConfig.markerName) : null;
    if (marker?.isLight) {
      marker.visible = false;
      marker.intensity = 0;
      marker.userData.prefabLightMarker = true;
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
    light.userData.itemControlled = Boolean(lightConfig.itemControlled);
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
    runtime.pointLightPoolEntry = light.isPointLight
      ? pointLightPool?.register(runtime, lightConfig, runtime.photometricPointLight) ?? null
      : null;
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
  applySpotCookieRotation(light, lightConfig.cookieRotationDegrees ?? 0);
  light.target.updateMatrixWorld(true);
}

export function applySpotCookieRotation(light, degrees = 0) {
  if (!light?.isSpotLight) return;
  const direction = light.target.position.clone().sub(light.position).normalize();
  if (direction.lengthSq() < 0.5) return;
  const baseUp = Math.abs(direction.y) > 0.98
    ? new THREE.Vector3(1, 0, 0)
    : new THREE.Vector3(0, 1, 0);
  light.shadow.camera.up.copy(baseUp.applyAxisAngle(direction, THREE.MathUtils.degToRad(degrees)));
}
