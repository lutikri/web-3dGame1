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
  return prefab;
}

export function getPrefabPlacement(prefab) {
  return prefab?.[PLACEMENT_METADATA] ?? null;
}

export function resetPrefabToAuthoredPlacement(prefab) {
  const placement = getPrefabPlacement(prefab);
  if (!placement || placement.source !== "marker") return false;
  if (placement.position && prefab.position?.copy) prefab.position.copy(placement.position);
  if (placement.rotation && prefab.rotation?.copy) prefab.rotation.copy(placement.rotation);
  if (placement.scale && prefab.scale?.copy) prefab.scale.copy(placement.scale);
  return true;
}

export function isSocketGeneratedPrefab(prefab) {
  return getPrefabPlacement(prefab)?.source === "socket";
}
