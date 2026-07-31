import * as THREE from "three";

import { ItemInventoryRuntime, ITEM_STATES } from "./ItemInventoryRuntime.js?v=inventory-runtime";

const worldPosition = new THREE.Vector3();
const worldQuaternion = new THREE.Quaternion();
const cameraOffset = new THREE.Vector3();

export function createItemInteractionRuntime({
  interactive,
  physics,
  camera,
  openBriefingSheet,
  setHoldProgress,
  presentSelector,
  onStored,
  onSpecialViewOpened,
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
    const hidden = state === ITEM_STATES.INVENTORY || state === ITEM_STATES.SPECIAL_VIEW;
    item.root.visible = !hidden;
    const rigidKey = item.runtime.rigidPrefabKey;
    if (!rigidKey) {
      if (state === ITEM_STATES.WORLD && context.reason) applyDirectDropPose(item);
      return;
    }
    if (hidden) {
      physics.setRigidPrefabMode(rigidKey, "inventory");
      return;
    }
    if ([ITEM_STATES.GRABBED, ITEM_STATES.EQUIPPED].includes(state)) {
      physics.setRigidPrefabMode(rigidKey, state);
      updateHandledItem(item, state, 0, true);
      return;
    }
    const pose = getDropPose(item);
    physics.dropRigidPrefab(rigidKey, pose.position, pose.quaternion, getThrowVelocity(context.throwStrength));
  }

  function updateHandledItem(item, state, _dt, immediate = false) {
    const pose = getHandledPose(item, state);
    if (item.runtime.rigidPrefabKey) {
      physics.setRigidPrefabPose(item.runtime.rigidPrefabKey, pose.position, pose.quaternion, immediate);
    } else {
      setWorldTransform(item.root, pose.position, pose.quaternion);
    }
  }

  function getHandledPose(item, state) {
    camera.updateWorldMatrix(true, false);
    camera.getWorldPosition(worldPosition);
    camera.getWorldQuaternion(worldQuaternion);
    if (state === ITEM_STATES.EQUIPPED) {
      cameraOffset.copy(item.equippedOffset).applyQuaternion(worldQuaternion);
    } else {
      cameraOffset.set(item.grabOffset.x, item.grabOffset.y, -item.grabDistance).applyQuaternion(worldQuaternion);
    }
    const position = worldPosition.clone().add(cameraOffset);
    const quaternion = worldQuaternion.clone().multiply(new THREE.Quaternion().setFromEuler(item.rotationOffset));
    return { position, quaternion };
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
    return true;
  }

  function initializeLightState(item, configuredState) {
    const lights = collectLights(item.root);
    item.data.isOn = configuredState == null ? lights.some((light) => light.visible) : Boolean(configuredState);
    lights.forEach((light) => {
      light.userData.itemBaseIntensity = light.intensity;
    });
    setItemLights(item, item.data.isOn);
  }

  function setItemLights(item, enabled) {
    collectLights(item.root).forEach((light) => {
      light.visible = enabled;
      if (enabled && Number.isFinite(light.userData.itemBaseIntensity)) {
        light.intensity = light.userData.itemBaseIntensity;
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

function collectLights(root) {
  const lights = [];
  root.traverse((object) => {
    if (object.isLight) lights.push(object);
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
