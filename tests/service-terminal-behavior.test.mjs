import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  createServiceTerminalRuntime,
  registerServiceTerminalInteraction,
} from "../src/prefabs/behaviors/ServiceTerminalBehavior.js";
import { uvToTerminalPixels } from "../src/prefabs/behaviors/ServiceTerminalCanvasRenderer.js";

function createRendererStub() {
  return {
    texture: new THREE.Texture(),
    canvas: { width: 1600, height: 900 },
    setLanguage() {},
    dispose() {},
  };
}

test("service terminal behavior resolves and registers its authored screen mesh", () => {
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  screen.name = "SM_Terminal_Screen";
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  glass.name = "SM_Terminal_ScreenGlass";
  const runtime = {
    serviceTerminal: createServiceTerminalRuntime(
      new Map([[screen.name, screen], [glass.name, glass]]),
      {},
      "Terminal1",
      { createRenderer: createRendererStub },
    ),
  };
  const interactive = [];

  assert.equal(registerServiceTerminalInteraction("exploring-around", {
    name: "Terminal1",
    behavior: "serviceTerminal",
    serviceTerminal: { maxDistance: 2.15 },
  }, runtime, interactive), true);
  assert.deepEqual(interactive, [screen]);
  assert.equal(screen.userData.kind, "serviceTerminal");
  assert.equal(screen.userData.levelId, "exploring-around");
  assert.equal(screen.userData.levelPrefabKey, "exploring-around:Terminal1");
  assert.equal(screen.userData.maxInteractionDistance, 2.15);
  assert.equal(runtime.serviceTerminal.glowLight, undefined);
  assert.equal(runtime.serviceTerminal.glass, glass);
  assert.equal(glass.renderOrder, 0);
  assert.equal(screen.children.length, 0);
  assert.equal(screen.material.userData.runtimeTextureOwned, true);
});

test("service terminal converts screen UV coordinates to top-left canvas pixels", () => {
  assert.deepEqual(uvToTerminalPixels({ x: 0.25, y: 0.75 }), { x: 400, y: 675 });
});

test("service terminal behavior fails loudly when the screen mesh is missing", () => {
  assert.throws(
    () => createServiceTerminalRuntime(new Map(), {}, "Terminal1"),
    /Missing screen mesh "SM_Terminal_Screen"/,
  );
});
