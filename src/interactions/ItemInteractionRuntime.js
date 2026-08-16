import * as THREE from "three";

import { ItemInventoryRuntime, ITEM_STATES } from "./ItemInventoryRuntime.js?v=prefab-marker-reset";

const worldPosition = new THREE.Vector3();
const worldQuaternion = new THREE.Quaternion();
const cameraOffset = new THREE.Vector3();
const rigidPosition = new THREE.Vector3();

export function createItemInteractionRuntime({
  interactive,
  physics,
  camera,
  openBriefingSheet,
  setHoldProgress,
  presentSelector,
  onStored,
  onSpecialViewOpened,
  getLocomotionPresentation = () => ({}),
  playSoundGroup = () => {},
}) {
  const itemIdsByLevel = new Map();
  const inventory = new ItemInventoryRuntime({
    applyItemState,
    updateHandledItem,
    activateItem,
    openSpecialView,
    setHoldProgress,
    presentSelector,
    onStored,
    onSpecialViewOpened,
  });

  function register(levelId, prefabConfig, runtime) {
    const config = prefabConfig?.item;
    if (!config?.enabled || !runtime?.root) return false;
    const target = resolveTarget(runtime, config);
    if (!target) return false;
    const id = `${levelId}:${prefabConfig.name}`;
    const kind = config.kind ?? (prefabConfig.behavior === "briefSheet" ? "briefSheet" : "physicalItem");
    target.userData.kind = kind;
    target.userData.levelId = levelId;
    target.userData.levelPrefabKey = id;
    target.userData.maxInteractionDistance = config.maxDistance;
    target.userData.holdInteractionSeconds = config.portable ? config.takeSeconds ?? 0.5 : 0;
    if (!interactive.includes(target)) interactive.push(target);
    const item = inventory.register({
      id,
      target,
      root: runtime.root,
      runtime,
      levelId,
      label: config.label ?? prefabConfig.name,
      icon: config.icon ?? "item",
      portable: Boolean(config.portable),
      activationMode: config.activationMode ?? "none",
      activationType: config.activationType ?? "none",
      grabDistance: config.grabDistance ?? 0.72,
      grabOffset: toVector3(config.grabOffset),
      equippedOffset: toVector3(config.equippedOffset, [0.25, -0.2, -0.48]),
      rotationOffset: toEuler(config.rotationOffset),
      equippedMotion: config.equippedMotion ? { ...config.equippedMotion } : null,
      equippedBreakDistance: Math.max(0.1, Number(config.equippedBreakDistance) || 1.25),
      equippedBreakDelay: Math.max(0, Number(config.equippedBreakDelay) || 0.2),
      briefingRequest: kind === "briefSheet" ? {
        levelId: runtime.briefSheet?.briefingLevelId ?? prefabConfig.briefSheet?.briefingLevelId ?? levelId,
        sheetIndex: runtime.briefSheet?.sheetIndex ?? prefabConfig.briefSheet?.sheetIndex ?? 0,
      } : null,
      data: {},
    });
    const levelItems = itemIdsByLevel.get(levelId) ?? new Set();
    levelItems.add(item.id);
    itemIdsByLevel.set(levelId, levelItems);
    if (item.activationType === "toggleLight") initializeLightState(item, config.defaultOn);
    return true;
  }

  function resolveTarget(runtime, config) {
    if (config.targetName) return runtime.parts?.get(config.targetName) ?? null;
    if (runtime.briefSheet?.mesh) return runtime.briefSheet.mesh;
    return runtime.root;
  }

  function applyItemState(item, state, context) {
    item.data.equippedSeparationSeconds = 0;
    const hidden = state === ITEM_STATES.INVENTORY || state === ITEM_STATES.SPECIAL_VIEW;
    item.root.visible = !hidden;
    const rigidKey = item.runtime.rigidPrefabKey;
    if (!rigidKey) {
      if (
        state === ITEM_STATES.WORLD
        && context.reason
        && context.previousState !== ITEM_STATES.GRABBED
      ) applyDirectDropPose(item);
      return;
    }
    if (hidden) {
      physics.setRigidPrefabMode(rigidKey, "inventory");
      return;
    }
    if (state === ITEM_STATES.GRABBED) {
      physics.setRigidPrefabMode(rigidKey, state);
      return;
    }
    if (state === ITEM_STATES.EQUIPPED) {
      physics.setRigidPrefabMode(rigidKey, state);
      updateHandledItem(item, state, 0, true);
      return;
    }
    if (context.previousState === ITEM_STATES.GRABBED) {
      physics.releaseRigidPrefab(rigidKey, getThrowVelocity(context.throwStrength));
      return;
    }
    if (context.previousState === ITEM_STATES.EQUIPPED && context.releaseInPlace) {
      physics.releaseRigidPrefab(rigidKey);
      return;
    }
    const pose = getDropPose(item);
    physics.dropRigidPrefab(rigidKey, pose.position, pose.quaternion, getThrowVelocity(context.throwStrength));
  }

  function updateHandledItem(item, state, dt, immediate = false) {
    const pose = getHandledPose(item, state, dt, immediate);
    if (item.runtime.rigidPrefabKey) {
      if (state === ITEM_STATES.GRABBED) {
        physics.driveRigidPrefab(item.runtime.rigidPrefabKey, pose.position, pose.quaternion, { dt });
      } else {
        physics.setRigidPrefabPose(item.runtime.rigidPrefabKey, pose.position, pose.quaternion, immediate, {
          sweep: state === ITEM_STATES.EQUIPPED,
          sweepOrigin: immediate ? pose.sweepOrigin : null,
        });
        if (state === ITEM_STATES.EQUIPPED && !immediate) {
          updateEquippedSeparation(item, pose.position, dt);
        }
      }
    } else if (state !== ITEM_STATES.GRABBED) {
      setWorldTransform(item.root, pose.position, pose.quaternion);
    }
  }

  function updateEquippedSeparation(item, targetPosition, dt) {
    const currentPosition = physics.getRigidPrefabPosition?.(item.runtime.rigidPrefabKey, rigidPosition);
    if (!currentPosition) return;
    const separated = currentPosition.distanceTo(targetPosition) > item.equippedBreakDistance;
    item.data.equippedSeparationSeconds = separated
      ? (item.data.equippedSeparationSeconds ?? 0) + Math.max(0, Number(dt) || 0)
      : 0;
    if (item.data.equippedSeparationSeconds < item.equippedBreakDelay) return;
    inventory.dropHandled({
      reason: "equipped-obstructed",
      releaseInPlace: true,
    });
  }

  function getHandledPose(item, state, dt = 0, immediate = false) {
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(worldPosition);
    camera.getWorldQuaternion(worldQuaternion);
    if (state === ITEM_STATES.EQUIPPED) {
      cameraOffset.copy(item.equippedOffset);
      const presentation = getLocomotionPresentation();
      const sway = item.equippedMotion?.swayScale ?? 0;
      if (sway > 0) {
        cameraOffset.x += (presentation.equipmentSide ?? 0) * sway;
        cameraOffset.y += (presentation.equipmentVertical ?? 0) * sway;
        cameraOffset.z -= (presentation.equipmentForward ?? 0) * sway;
      }
      cameraOffset.applyQuaternion(worldQuaternion);
    } else {
      cameraOffset.set(item.grabOffset.x, item.grabOffset.y, -item.grabDistance).applyQuaternion(worldQuaternion);
    }
    const position = worldPosition.clone().add(cameraOffset);
    const targetQuaternion = worldQuaternion.clone().multiply(new THREE.Quaternion().setFromEuler(item.rotationOffset));
    if (state === ITEM_STATES.EQUIPPED && item.equippedMotion) {
      const presentation = getLocomotionPresentation();
      targetQuaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
        (presentation.equipmentPitch ?? 0) * (item.equippedMotion.rotationScale ?? 1),
        (presentation.equipmentYaw ?? 0) * (item.equippedMotion.rotationScale ?? 1),
        (presentation.equipmentRoll ?? 0) * (item.equippedMotion.rotationScale ?? 1),
        "YXZ",
      )));
    }
    const lag = item.equippedMotion?.rotationLag ?? 0;
    if (state === ITEM_STATES.EQUIPPED && lag > 0 && !immediate) {
      item.data.handledQuaternion ??= targetQuaternion.clone();
      item.data.handledQuaternion.slerp(targetQuaternion, 1 - Math.exp(-lag * Math.max(0, dt)));
    } else {
      item.data.handledQuaternion = targetQuaternion.clone();
    }
    const quaternion = item.data.handledQuaternion.clone();
    return { position, quaternion, sweepOrigin: worldPosition.clone() };
  }

  function getDropPose(item) {
    if (item.state === ITEM_STATES.GRABBED || item.state === ITEM_STATES.EQUIPPED) {
      return getHandledPose(item, item.state);
    }
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(worldPosition);
    camera.getWorldQuaternion(worldQuaternion);
    cameraOffset.set(0, -0.22, -0.7).applyQuaternion(worldQuaternion);
    return { position: worldPosition.clone().add(cameraOffset), quaternion: worldQuaternion.clone() };
  }

  function applyDirectDropPose(item) {
    const pose = getDropPose(item);
    setWorldTransform(item.root, pose.position, pose.quaternion);
  }

  function getThrowVelocity(strength) {
    const normalized = Math.min(1, Math.max(0, Number(strength) || 0));
    if (normalized <= 0) return null;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    return direction.multiplyScalar(3.5 + normalized * 6.5);
  }

  function activateItem(item) {
    if (item.activationType !== "toggleLight") return false;
    item.data.isOn = !item.data.isOn;
    setItemLights(item, item.data.isOn);
    playSoundGroup(item.root, "flashlightToggle");
    return true;
  }

  function initializeLightState(item, configuredState) {
    const lights = collectLights(item.root);
    lights.forEach(repairSpotLightTarget);
    item.data.isOn = configuredState == null ? lights.some((light) => light.visible) : Boolean(configuredState);
    lights.forEach((light) => {
      light.userData.itemBaseIntensity = light.intensity;
    });
    setItemLights(item, item.data.isOn);
  }

  function setItemLights(item, enabled) {
    collectLights(item.root).forEach((light) => {
      if (light.userData.itemControlled) {
        light.visible = true;
        light.userData.itemEnabled = enabled;
        light.intensity = enabled && Number.isFinite(light.userData.itemBaseIntensity)
          ? light.userData.itemBaseIntensity
          : 0;
      } else {
        light.visible = enabled;
        if (enabled && Number.isFinite(light.userData.itemBaseIntensity)) {
          light.intensity = light.userData.itemBaseIntensity;
        }
      }
    });
  }

  function openSpecialView(item) {
    if (!item.briefingRequest) return false;
    return openBriefingSheet?.(item.briefingRequest) !== false;
  }

  function dispose() {
    inventory.cancelPrimary();
    inventory.cancelSelection();
  }

  function unregisterLevel(levelId) {
    const itemIds = itemIdsByLevel.get(levelId);
    if (!itemIds) return;
    itemIds.forEach((id) => inventory.unregister(id));
    itemIdsByLevel.delete(levelId);
  }

  return {
    register,
    update: (dt) => inventory.update(dt),
    beginPrimary: (target) => inventory.beginPrimary(target),
    releasePrimary: () => inventory.releasePrimary(),
    cancelPrimary: () => inventory.cancelPrimary(),
    activateRelevant: (target) => inventory.activateRelevant(target),
    dropHandled: (options) => inventory.dropHandled(options),
    beginSelection: () => inventory.beginSelection(),
    moveSelection: (direction) => inventory.moveSelection(direction),
    commitSelection: () => inventory.commitSelection(),
    cancelSelection: () => inventory.cancelSelection(),
    closeSpecialView: (options) => inventory.closeSpecialView(options),
    unregisterLevel,
    getSnapshot: () => inventory.getSnapshot(),
    dispose,
  };
}

function repairSpotLightTarget(light) {
  if (!light.isSpotLight || !light.target || light.target.parent) return;
  light.add(light.target);
  light.target.updateMatrixWorld(true);
}

function collectLights(root) {
  const lights = [];
  root.traverse((object) => {
    if (object.isLight && !object.userData.prefabLightMarker) lights.push(object);
  });
  return lights;
}

function toVector3(value, fallback = [0, 0, 0]) {
  const source = Array.isArray(value) ? value : fallback;
  return new THREE.Vector3(Number(source[0]) || 0, Number(source[1]) || 0, Number(source[2]) || 0);
}

function toEuler(value) {
  const source = Array.isArray(value) ? value : [0, 0, 0];
  return new THREE.Euler(
    THREE.MathUtils.degToRad(Number(source[0]) || 0),
    THREE.MathUtils.degToRad(Number(source[1]) || 0),
    THREE.MathUtils.degToRad(Number(source[2]) || 0),
    "YXZ",
  );
}

function setWorldTransform(root, position, quaternion) {
  root.parent?.updateWorldMatrix(true, false);
  const worldMatrix = new THREE.Matrix4().compose(position, quaternion, root.scale);
  const parentInverse = root.parent
    ? new THREE.Matrix4().copy(root.parent.matrixWorld).invert()
    : new THREE.Matrix4();
  const localMatrix = new THREE.Matrix4().multiplyMatrices(parentInverse, worldMatrix);
  localMatrix.decompose(root.position, root.quaternion, root.scale);
  root.updateWorldMatrix(true, true);
}
