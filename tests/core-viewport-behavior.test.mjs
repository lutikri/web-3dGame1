import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import {
  createCoreViewportRuntime,
  requestCoreViewportToggle,
  updateCoreViewportRuntime,
} from "../src/prefabs/behaviors/CoreViewportBehavior.js";
import {
  activateStatusViewportAlarmSilence,
  activateStatusViewportShutter,
  getStatusViewportButtonPressDirection,
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
  const alarmSilenceButton = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  const shutter = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  shutter.name = "SM_CoreViewport1_Shutter1";
  const coreViewport = createCoreViewportRuntime(new Map([[shutter.name, shutter]]));
  const statusViewport = {
    shutterButton: button,
    shutterButtonPressRemaining: 0,
    alarmSilenceButton,
    alarmSilenced: false,
  };
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
  assert.equal(alarmSilenceButton.userData.kind, "alarmSilenceButton");
  assert.equal(interactive.length, 2);
  assert.equal(activateStatusViewportShutter(button, instances), true);
  assert.equal(coreViewport.targetProgress, 1);
  assert.equal(statusViewport.shutterButtonPressRemaining, 0.16);
  assert.equal(activateStatusViewportAlarmSilence(alarmSilenceButton, instances, () => true), true);
  assert.equal(statusViewport.alarmSilenced, true);
  assert.equal(activateStatusViewportAlarmSilence(alarmSilenceButton, instances, () => false), true);
  assert.equal(statusViewport.alarmSilenced, false);
});

test("status viewport button maps authored Blender Z to the glTF local Y axis", () => {
  const button = new THREE.Object3D();
  button.rotation.x = THREE.MathUtils.degToRad(45);
  const direction = getStatusViewportButtonPressDirection(button, "y");

  assert.ok(Math.abs(direction.x) < 1e-9);
  assert.ok(Math.abs(direction.y) > 0.7);
  assert.ok(Math.abs(direction.z) > 0.7);
});
