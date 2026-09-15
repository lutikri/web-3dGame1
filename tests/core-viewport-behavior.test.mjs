import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  createCoreViewportRuntime,
  requestCoreViewportToggle,
  updateCoreViewportRuntime,
} from "../src/prefabs/behaviors/CoreViewportBehavior.js";
import {
  activateStatusViewportShutter,
  registerStatusViewportInteraction,
} from "../src/prefabs/behaviors/StatusViewportBehavior.js";

test("core viewport shutter opens along converted Blender Z over ten seconds", () => {
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  shutter.name = "SM_CoreViewport1_Shutter1";
  const runtime = createCoreViewportRuntime(new Map([[shutter.name, shutter]]), {
    axis: "y",
    closedPosition: 0.000028,
    openPosition: 0.226287,
    travelDurationSeconds: 10,
  });

  assert.equal(requestCoreViewportToggle(runtime), true);
  updateCoreViewportRuntime(runtime, 5);
  assert.ok(Math.abs(shutter.position.y - ((0.000028 + 0.226287) / 2)) < 1e-9);
  updateCoreViewportRuntime(runtime, 5);
  assert.equal(runtime.progress, 1);
  assert.ok(Math.abs(shutter.position.y - 0.226287) < 1e-9);

  requestCoreViewportToggle(runtime);
  updateCoreViewportRuntime(runtime, 10);
  assert.equal(runtime.progress, 0);
  assert.ok(Math.abs(shutter.position.y - 0.000028) < 1e-9);
});

test("core viewport fails loudly when the authored shutter mesh is missing", () => {
  assert.throws(
    () => createCoreViewportRuntime(new Map(), {}, "MissingViewport"),
    /Missing shutter mesh.*MissingViewport/,
  );
});

test("status viewport button targets the placed core viewport prefab", () => {
  const button = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  shutter.name = "SM_CoreViewport1_Shutter1";
  const coreViewport = createCoreViewportRuntime(new Map([[shutter.name, shutter]]));
  const statusViewport = { shutterButton: button, shutterButtonPressRemaining: 0 };
  const panelRuntime = { statusViewport };
  const instances = new Map([
    ["room:PanelStatusViewport1", panelRuntime],
    ["room:CoreViewport1", { coreViewport }],
  ]);
  const interactive = [];

  assert.equal(registerStatusViewportInteraction("room", {
    name: "PanelStatusViewport1",
    statusViewport: { shutterTargetPrefabName: "CoreViewport1" },
  }, panelRuntime, interactive), true);
  assert.equal(button.userData.shutterTargetKey, "room:CoreViewport1");
  assert.equal(activateStatusViewportShutter(button, instances), true);
  assert.equal(coreViewport.targetProgress, 1);
  assert.equal(statusViewport.shutterButtonPressRemaining, 0.16);
});
