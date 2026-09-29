import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { LightingZoneRuntime } from "../src/lighting/LightingZoneRuntime.js";
import { RenderZoneRuntime } from "../src/scene/RenderZoneRuntime.js";

function addZone(root, name, position) {
  const zone = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 4), new THREE.MeshBasicMaterial());
  zone.name = `LZONE_${name}`;
  zone.position.fromArray(position);
  root.add(zone);
  return zone;
}

function addRoomMesh(root, name, position) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.name = name;
  mesh.position.fromArray(position);
  root.add(mesh);
  return mesh;
}

test("render zones combine authored visibility graph with distance culling", () => {
  const root = new THREE.Group();
  addZone(root, "Entry", [0, 0, 0]);
  addZone(root, "Hall", [5, 0, 0]);
  addZone(root, "Cave", [12, 0, 0]);
  const entry = addRoomMesh(root, "EntryMesh", [0, 0, 0]);
  const hall = addRoomMesh(root, "HallMesh", [5, 0, 0]);
  const cave = addRoomMesh(root, "CaveMesh", [12, 0, 0]);
  const lightingZones = new LightingZoneRuntime();
  lightingZones.registerLevel("level", root);
  const renderZones = new RenderZoneRuntime({ lightingZones });
  renderZones.registerLevel("level", root, {
    enabled: true,
    preloadDistance: 4,
    releaseDistance: 6,
    visibility: {
      Entry: { always: ["Hall"], nearby: ["Cave"] },
    },
  });

  const cameraPosition = new THREE.Vector3(0, 0, 0);
  lightingZones.update(cameraPosition);
  renderZones.update(cameraPosition);

  assert.equal(entry.visible, true);
  assert.equal(hall.visible, true);
  assert.equal(cave.visible, false);
  assert.deepEqual(renderZones.getDebugState().level.visible.sort(), ["Entry", "Hall"]);
});

test("render zones never reveal a geometrically close room missing from the active graph", () => {
  const root = new THREE.Group();
  addZone(root, "Corridor", [0, 0, 0]);
  addZone(root, "BehindWalls", [3, 0, 0]);
  const corridor = addRoomMesh(root, "CorridorMesh", [0, 0, 0]);
  const hidden = addRoomMesh(root, "HiddenMesh", [3, 0, 0]);
  const lightingZones = new LightingZoneRuntime();
  lightingZones.registerLevel("level", root);
  const renderZones = new RenderZoneRuntime({ lightingZones });
  renderZones.registerLevel("level", root, {
    enabled: true,
    preloadDistance: 20,
    releaseDistance: 24,
    visibility: { Corridor: {} },
  });

  const cameraPosition = new THREE.Vector3(0, 0, 0);
  lightingZones.update(cameraPosition);
  renderZones.update(cameraPosition);

  assert.equal(corridor.visible, true);
  assert.equal(hidden.visible, false);
});

test("render zone distance uses separate preload and release thresholds", () => {
  const root = new THREE.Group();
  addZone(root, "Corridor", [0, 0, 0]);
  addZone(root, "Room", [8, 0, 0]);
  addRoomMesh(root, "CorridorMesh", [0, 0, 0]);
  const room = addRoomMesh(root, "RoomMesh", [8, 0, 0]);
  const lightingZones = new LightingZoneRuntime({ exitPadding: 20 });
  lightingZones.registerLevel("level", root);
  const renderZones = new RenderZoneRuntime({ lightingZones });
  renderZones.registerLevel("level", root, {
    enabled: true,
    preloadDistance: 3,
    releaseDistance: 5,
    visibility: { Corridor: { nearby: ["Room"] } },
  });

  lightingZones.update(new THREE.Vector3(0, 0, 0));
  renderZones.update(new THREE.Vector3(5, 0, 0));
  assert.equal(room.visible, true);

  renderZones.update(new THREE.Vector3(4, 0, 0));
  assert.equal(room.visible, true);

  renderZones.update(new THREE.Vector3(0, 0, 0));
  assert.equal(room.visible, false);
});

test("render zone warmup temporarily reveals hidden meshes and restores culling", () => {
  const root = new THREE.Group();
  addZone(root, "Entry", [0, 0, 0]);
  addZone(root, "Remote", [10, 0, 0]);
  addRoomMesh(root, "EntryMesh", [0, 0, 0]);
  const remote = addRoomMesh(root, "RemoteMesh", [10, 0, 0]);
  const lightingZones = new LightingZoneRuntime();
  lightingZones.registerLevel("level", root);
  const renderZones = new RenderZoneRuntime({ lightingZones });
  renderZones.registerLevel("level", root, {
    enabled: true,
    visibility: { Entry: {} },
  });

  const cameraPosition = new THREE.Vector3();
  lightingZones.update(cameraPosition);
  renderZones.update(cameraPosition);
  assert.equal(remote.visible, false);

  const releaseWarmup = renderZones.beginWarmup();
  assert.equal(remote.visible, true);
  assert.equal(renderZones.getDebugState().level.warmupOverride, true);

  releaseWarmup();
  assert.equal(remote.visible, false);
  assert.equal(renderZones.getDebugState().level.warmupOverride, false);
});

test("render zones retain the last valid visibility across a brief authored volume gap", () => {
  const root = new THREE.Group();
  addZone(root, "Entry", [0, 0, 0]);
  addZone(root, "Hall", [6, 0, 0]);
  addRoomMesh(root, "EntryMesh", [0, 0, 0]);
  const hall = addRoomMesh(root, "HallMesh", [6, 0, 0]);
  let nowMs = 0;
  const lightingZones = new LightingZoneRuntime({ exitPadding: 0 });
  lightingZones.registerLevel("level", root);
  const renderZones = new RenderZoneRuntime({ lightingZones, now: () => nowMs });
  renderZones.registerLevel("level", root, {
    enabled: true,
    zoneExitGraceMs: 750,
    visibility: { Entry: {} },
  });

  const entryPosition = new THREE.Vector3(0, 0, 0);
  lightingZones.update(entryPosition);
  renderZones.update(entryPosition);
  assert.equal(hall.visible, false);

  const gapPosition = new THREE.Vector3(3, 0, 0);
  nowMs = 100;
  lightingZones.update(gapPosition);
  renderZones.update(gapPosition);
  assert.equal(hall.visible, false);
  assert.equal(renderZones.getDebugState().level.active, "Entry");

  nowMs = 900;
  renderZones.update(gapPosition);
  assert.equal(hall.visible, true);
  assert.equal(renderZones.getDebugState().level.active, null);
});

test("render zones combine aliased physical volumes into one logical visibility zone", () => {
  const root = new THREE.Group();
  addZone(root, "Corridor", [0, 0, 0]);
  addZone(root, "CorridorLink", [5, 0, 0]);
  addZone(root, "Remote", [12, 0, 0]);
  const corridor = addRoomMesh(root, "CorridorMesh", [0, 0, 0]);
  const link = addRoomMesh(root, "CorridorLinkMesh", [5, 0, 0]);
  const remote = addRoomMesh(root, "RemoteMesh", [12, 0, 0]);
  const config = {
    enabled: true,
    volumeAliases: { CorridorLink: "Corridor" },
    visibility: { Corridor: {} },
  };
  const lightingZones = new LightingZoneRuntime();
  lightingZones.registerLevel("level", root, config);
  const renderZones = new RenderZoneRuntime({ lightingZones });
  renderZones.registerLevel("level", root, config);

  const linkPosition = new THREE.Vector3(5, 0, 0);
  lightingZones.update(linkPosition);
  renderZones.update(linkPosition);

  assert.equal(corridor.visible, true);
  assert.equal(link.visible, true);
  assert.equal(remote.visible, false);
  assert.equal(renderZones.getDebugState().level.active, "Corridor");
});

test("large room shells remain zone-owned instead of becoming globally visible by size", () => {
  const root = new THREE.Group();
  addZone(root, "Entry", [0, 0, 0]);
  addZone(root, "Cave", [20, 0, 0]);
  addRoomMesh(root, "EntryMesh", [0, 0, 0]);
  const caveShell = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 20), new THREE.MeshBasicMaterial());
  caveShell.name = "SM_CaveGeo1";
  caveShell.position.set(20, 0, 0);
  root.add(caveShell);
  const lightingZones = new LightingZoneRuntime();
  lightingZones.registerLevel("level", root);
  const renderZones = new RenderZoneRuntime({ lightingZones });
  renderZones.registerLevel("level", root, {
    enabled: true,
    sharedZoneCount: 3,
    visibility: { Entry: {} },
  });

  const entryPosition = new THREE.Vector3();
  lightingZones.update(entryPosition);
  renderZones.update(entryPosition);

  assert.equal(caveShell.visible, false);
});
