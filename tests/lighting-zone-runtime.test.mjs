import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { LightingZoneRuntime, boxGap } from "../src/lighting/LightingZoneRuntime.js";

function addZone(root, name, size, position) {
  const zone = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
  zone.name = `LZONE_${name}`;
  zone.position.fromArray(position);
  root.add(zone);
  return zone;
}

test("lighting zones select the smallest containing room and preactivate its neighbor", () => {
  const root = new THREE.Group();
  addZone(root, "Corridor", [10, 3, 4], [0, 0, 0]);
  addZone(root, "Booth", [3, 3, 3], [3.5, 0, -3.5]);
  const zones = new LightingZoneRuntime({ adjacencyMargin: 0.6, exitPadding: 0.5 });
  zones.registerLevel("level", root);

  zones.update(new THREE.Vector3(3.5, 0, -3.5));

  assert.equal(zones.getDebugState().active, "Booth");
  assert.deepEqual(zones.classifyEmitter("level", new THREE.Vector3(3.5, 0, -3.5), true), {
    zoneId: "Booth", tier: "fixture", priority: 0,
  });
  assert.deepEqual(zones.classifyEmitter("level", new THREE.Vector3(0, 0, 0), true), {
    zoneId: "Corridor", tier: "simple", priority: 1,
  });
});

test("lighting zone exit padding prevents boundary chatter", () => {
  const root = new THREE.Group();
  addZone(root, "Room", [2, 2, 2], [0, 0, 0]);
  const zones = new LightingZoneRuntime({ exitPadding: 0.5 });
  zones.registerLevel("level", root);
  zones.update(new THREE.Vector3(0, 0, 0));

  zones.update(new THREE.Vector3(1.25, 0, 0));

  assert.equal(zones.getDebugState().active, "Room");
  zones.update(new THREE.Vector3(1.6, 0, 0));
  assert.equal(zones.getDebugState().active, null);
});

test("box gap measures separation without treating overlaps as distant", () => {
  const left = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 1, 1));
  const touching = new THREE.Box3(new THREE.Vector3(1, 0, 0), new THREE.Vector3(2, 1, 1));
  const separated = new THREE.Box3(new THREE.Vector3(4, 0, 0), new THREE.Vector3(5, 1, 1));
  assert.equal(boxGap(left, touching), 0);
  assert.equal(boxGap(left, separated), 3);
});
