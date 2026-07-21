import * as THREE from "three";

export function buildPrimitiveRoom({ scene, roomConfig, floorMaterial }) {
  if (!roomConfig.floorVisible) return null;
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(roomConfig.width, 0.12, roomConfig.depth),
    floorMaterial,
  );
  floor.name = "Floor";
  floor.position.set(0, -0.06, 0);
  floor.receiveShadow = true;
  scene.add(floor);
  return floor;
}
