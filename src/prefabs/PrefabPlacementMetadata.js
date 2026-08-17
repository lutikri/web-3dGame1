import * as THREE from "three";

const PLACEMENT_METADATA = Symbol.for("operatorGame.prefabPlacementMetadata");

export function registerPrefabPlacement(prefab, { source, markerName = null } = {}) {
  if (!prefab || !source) return prefab;
  Object.defineProperty(prefab, PLACEMENT_METADATA, {
    configurable: true,
    value: {
      source,
      markerName,
      position: prefab.position?.clone?.() ?? null,
      rotation: prefab.rotation?.clone?.() ?? null,
      scale: prefab.scale?.clone?.() ?? null,
    },
  });
  if (source === "marker") {
    prefab.placementOffset = {
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      scale: new THREE.Vector3(1, 1, 1),
    };
  }
  return prefab;
}

export function getPrefabPlacement(prefab) {
  return prefab?.[PLACEMENT_METADATA] ?? null;
}

export function resetPrefabToAuthoredPlacement(prefab) {
  const placement = getPrefabPlacement(prefab);
  if (!placement || placement.source !== "marker") return false;
  const offset = createPrefabPlacementOffset(prefab);
  offset.position.set(0, 0, 0);
  offset.rotation.set(0, 0, 0);
  offset.scale.set(1, 1, 1);
  return applyPrefabPlacementOffset(prefab, offset);
}

export function createPrefabPlacementOffset(prefab) {
  const placement = getPrefabPlacement(prefab);
  if (!placement || placement.source !== "marker") return null;
  return prefab.placementOffset;
}

export function applyPrefabPlacementOffset(prefab, offset) {
  const placement = getPrefabPlacement(prefab);
  if (!placement || placement.source !== "marker" || !offset) return false;
  prefab.position.copy(placement.position).add(offset.position);
  const authoredRotation = new THREE.Quaternion().setFromEuler(placement.rotation);
  const relativeRotation = new THREE.Quaternion().setFromEuler(offset.rotation);
  prefab.rotation.setFromQuaternion(authoredRotation.multiply(relativeRotation), "XYZ");
  prefab.scale.set(
    placement.scale.x * offset.scale.x,
    placement.scale.y * offset.scale.y,
    placement.scale.z * offset.scale.z,
  );
  return true;
}

export function applySavedPrefabPlacement(prefab, saved = {}) {
  const placement = getPrefabPlacement(prefab);
  if (!placement || placement.source !== "marker") return false;
  const offset = createPrefabPlacementOffset(prefab);
  if (saved.placementOffset) {
    copyVector(offset.position, saved.placementOffset.position, 0);
    copyEuler(offset.rotation, saved.placementOffset.rotation);
    copyVector(offset.scale, saved.placementOffset.scale, 1);
  } else {
    const absolutePosition = vectorFrom(saved.position, placement.position);
    offset.position.copy(absolutePosition).sub(placement.position);
    const absoluteRotation = eulerFrom(saved.rotation, placement.rotation);
    const authoredRotation = new THREE.Quaternion().setFromEuler(placement.rotation);
    const relativeRotation = authoredRotation.invert().multiply(
      new THREE.Quaternion().setFromEuler(absoluteRotation),
    );
    offset.rotation.setFromQuaternion(relativeRotation, "XYZ");
    const absoluteScale = vectorFrom(saved.scale, placement.scale);
    offset.scale.set(
      safeScaleRatio(absoluteScale.x, placement.scale.x),
      safeScaleRatio(absoluteScale.y, placement.scale.y),
      safeScaleRatio(absoluteScale.z, placement.scale.z),
    );
  }
  applyPrefabPlacementOffset(prefab, offset);
  return true;
}

export function isSocketGeneratedPrefab(prefab) {
  return getPrefabPlacement(prefab)?.source === "socket";
}

function safeScaleRatio(value, authoredValue) {
  return Math.abs(authoredValue) > 1e-8 ? value / authoredValue : 1;
}

function vectorFrom(value, fallback) {
  return new THREE.Vector3(
    Number(value?.x ?? fallback.x),
    Number(value?.y ?? fallback.y),
    Number(value?.z ?? fallback.z),
  );
}

function eulerFrom(value, fallback) {
  return new THREE.Euler(
    Number(value?._x ?? value?.x ?? fallback.x),
    Number(value?._y ?? value?.y ?? fallback.y),
    Number(value?._z ?? value?.z ?? fallback.z),
    value?._order ?? value?.order ?? fallback.order ?? "XYZ",
  );
}

function copyVector(target, value, fallback) {
  target.set(
    Number(value?.x ?? fallback),
    Number(value?.y ?? fallback),
    Number(value?.z ?? fallback),
  );
}

function copyEuler(target, value) {
  target.set(
    Number(value?._x ?? value?.x ?? 0),
    Number(value?._y ?? value?.y ?? 0),
    Number(value?._z ?? value?.z ?? 0),
    value?._order ?? value?.order ?? "XYZ",
  );
}
