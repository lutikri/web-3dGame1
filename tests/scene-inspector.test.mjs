import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { createSceneInspector } from "../src/ui/debug/SceneInspector.js";

test("scene inspector finds, lists, and reports object transforms", () => {
  const scene = new THREE.Scene();
  const object = new THREE.Object3D();
  object.name = "Control_Test";
  object.position.set(1, 2, 3);
  scene.add(object);
  const inspector = createSceneInspector({ scene });
  assert.equal(inspector.findObject("Control_Test"), object);
  assert.deepEqual(inspector.listObjects("control"), ["Control_Test"]);
  assert.deepEqual(inspector.getObjectTransform(object).worldPosition, [1, 2, 3]);
});
