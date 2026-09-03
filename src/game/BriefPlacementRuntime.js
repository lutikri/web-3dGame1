import * as THREE from "three";

import { registerPrefabPlacement } from "../prefabs/PrefabPlacementMetadata.js?v=route-progress-reporting";
import { createPrefabInstance } from "../prefabs/PrefabRegistry.js?v=route-progress-reporting";

export function resolveBriefSocketPrefabs(root, config = {}, language = "en") {
  if (!root || config.enabled === false) return [];
  root.updateMatrixWorld(true);
  const prefix = config.socketPrefix ?? "SOCKET_Brief_";
  const sockets = [];
  root.traverse((object) => {
    if (object.name?.startsWith(prefix)) sockets.push(object);
  });
  sockets.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const normalizedLanguage = language === "ru" ? "ru" : "en";
  const localized = config.sheets?.[normalizedLanguage] ?? config.sheets?.en ?? [];
  const sheets = Array.isArray(localized) ? localized : localized ? [localized] : [];
  if (sheets.length > sockets.length) {
    console.warn(`[BriefPlacement] ${sheets.length} sheets configured, but only ${sockets.length} sockets exist`);
  }

  return sheets.slice(0, sockets.length).map((texturePath, sheetIndex) => {
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const socket = sockets[sheetIndex];
    socket.matrixWorld.decompose(position, quaternion, scale);
    const prefab = createPrefabInstance(config.prefabType ?? "briefSheet", {
      name: `Brief_${socket.name.slice(prefix.length)}`,
      position,
      rotation: new THREE.Euler().setFromQuaternion(quaternion, "XYZ"),
      scale,
      overrides: {
        briefSheet: {
          texturePath,
          sheetIndex,
          briefingLevelId: config.briefingLevelId ?? "intro-shift",
          holdSeconds: config.holdSeconds ?? 0.5,
          maxDistance: config.maxDistance ?? 1.65,
        },
      },
    });
    return registerPrefabPlacement(prefab, { source: "socket", markerName: socket.name });
  });
}
