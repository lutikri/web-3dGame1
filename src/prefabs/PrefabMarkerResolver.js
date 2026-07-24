import * as THREE from "three";
import { createPrefabInstance, getPrefabDefinition } from "./PrefabRegistry.js?v=subtitle-route-fades";

const MARKER_PREFIX = "PF_";

export function parsePrefabMarkerName(name) {
  if (!String(name).startsWith(MARKER_PREFIX)) return null;
  const separator = name.indexOf("_", MARKER_PREFIX.length);
  if (separator < 0) {
    const shorthandType = name.slice(MARKER_PREFIX.length);
    if (getPrefabDefinition(shorthandType)) {
      return { prefabType: shorthandType, instanceName: shorthandType, stableName: shorthandType };
    }
    throw new Error(`[PrefabMarker] "${name}" must use PF_<prefabType>_<instanceName>`);
  }
  const prefabType = name.slice(MARKER_PREFIX.length, separator);
  const instanceName = name.slice(separator + 1);
  if (!prefabType || !instanceName) {
    throw new Error(
      `[PrefabMarker] "${name}" must use PF_<prefabType>_<instanceName>`,
    );
  }
  if (!getPrefabDefinition(prefabType)) {
    throw new Error(`[PrefabMarker] "${name}" uses unknown prefab type "${prefabType}"`);
  }
  return { prefabType, instanceName };
}

export function resolvePrefabMarkers(root) {
  root.updateMatrixWorld(true);
  const markers = [];
  const names = new Set();

  root.traverse((object) => {
    const parsed = parsePrefabMarkerName(object.name);
    if (!parsed) return;
    if (object.isMesh) {
      throw new Error(`[PrefabMarker] "${object.name}" must be an Empty, not a mesh`);
    }
    const stableName = parsed.stableName ?? `${parsed.prefabType}_${parsed.instanceName}`;
    if (names.has(stableName)) {
      throw new Error(`[PrefabMarker] Duplicate instance name "${stableName}"`);
    }
    names.add(stableName);

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    object.matrixWorld.decompose(position, quaternion, scale);
    const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
    markers.push(
      createPrefabInstance(parsed.prefabType, {
        name: stableName,
        position,
        rotation,
        scale,
      }),
    );
  });

  return markers;
}

export function resolveNestedPrefabMarkers(root, { parentName } = {}) {
  if (!parentName) throw new Error("[PrefabMarker] Nested prefab markers require parentName");
  root.updateMatrixWorld(true);
  const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const markers = [];
  const names = new Set();

  root.traverse((object) => {
    const parsed = parsePrefabMarkerName(object.name);
    if (!parsed) return;
    if (object.isMesh) {
      throw new Error(`[PrefabMarker] "${object.name}" must be an Empty, not a mesh`);
    }
    const markerName = parsed.stableName ?? `${parsed.prefabType}_${parsed.instanceName}`;
    const stableName = `${parentName}__${markerName}`;
    if (names.has(stableName)) {
      throw new Error(`[PrefabMarker] Duplicate nested instance name "${stableName}"`);
    }
    names.add(stableName);

    const localMatrix = new THREE.Matrix4().multiplyMatrices(inverseRoot, object.matrixWorld);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    localMatrix.decompose(position, quaternion, scale);
    const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
    markers.push(
      createPrefabInstance(parsed.prefabType, {
        name: stableName,
        position,
        rotation,
        scale,
      }),
    );
  });

  return markers;
}

export function mergeMarkerPrefabs(configuredPrefabs = [], markerPrefabs = []) {
  const configuredNames = new Set(configuredPrefabs.map((prefab) => prefab.name));
  return [
    ...configuredPrefabs,
    ...markerPrefabs.filter((prefab) => !configuredNames.has(prefab.name)),
  ];
}
