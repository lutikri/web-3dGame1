import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";
import { DebugTransformRuntime } from "../src/ui/debug/DebugTransformRuntime.js";

class FakeTransformControls extends THREE.Object3D {
  setMode() {}
  setSize() {}
  attach(object) { this.object = object; }
  detach() { this.object = null; }
}

test("debug transform runtime owns edit lifecycle and temporary targets", () => {
  const scene = new THREE.Scene();
  const target = new THREE.Object3D();
  let suspended = 0;
  let restored = null;
  let changed = 0;
  const runtime = new DebugTransformRuntime({
    camera: new THREE.PerspectiveCamera(),
    renderer: { domElement: {} },
    scene,
    resolveObject: (descriptor) => descriptor.id === "real" ? target : null,
    suspendInput: () => { suspended += 1; return "previous"; },
    restoreInput: (snapshot) => { restored = snapshot; },
    createControls: () => new FakeTransformControls(),
  });
  const position = new THREE.Vector3(1, 2, 3);

  assert.equal(runtime.toggle({ id: "real", position, onChange: () => changed += 1 }), true);
  target.position.set(4, 5, 6);
  runtime.controls.dispatchEvent({ type: "objectChange" });
  assert.deepEqual(position.toArray(), [4, 5, 6]);
  assert.equal(changed, 1);
  assert.equal(suspended, 1);
  assert.equal(runtime.isEditing(), true);

  runtime.stop();
  assert.equal(restored, "previous");
  assert.equal(runtime.isEditing(), false);

  const temporaryPosition = new THREE.Vector3(7, 8, 9);
  runtime.toggle({ id: "missing", position: temporaryPosition });
  const temporary = runtime.controls.object;
  assert.equal(scene.getObjectByName("DebugPositionGizmo_missing"), temporary);
  runtime.stop();
  assert.equal(scene.getObjectByName("DebugPositionGizmo_missing"), undefined);
});
