import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { buildPrimitiveRoom } from "../src/scene/PrimitiveRoomBuilder.js";

test("primitive room builder owns fallback floor geometry", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshStandardMaterial();
  const floor = buildPrimitiveRoom({
    scene, floorMaterial: material, roomConfig: { floorVisible: true, width: 8, depth: 6 },
  });
  assert.equal(floor.name, "Floor");
  assert.equal(floor.geometry.parameters.width, 8);
  assert.equal(floor.geometry.parameters.depth, 6);
  assert.equal(floor.position.y, -0.06);
  assert.equal(floor.receiveShadow, true);
  assert.equal(scene.children[0], floor);
});
