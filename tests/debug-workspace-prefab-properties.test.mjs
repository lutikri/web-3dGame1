import assert from "node:assert/strict";
import test from "node:test";

import {
  compareDebugPrefabs,
  getSuspendedLampDebugProperties,
} from "../src/ui/debug/workspace/DebugWorkspace.js";

test("debug workspace exposes suspended lamp config and shared bulb material", () => {
  const suspension = { maxAngleDegrees: 4 };
  const bulbMaterial = { emissiveIntensity: 8 };
  assert.deepEqual(getSuspendedLampDebugProperties(
    { behavior: "suspendedLamp", suspension },
    { lampDome1Bulb: bulbMaterial },
  ), { suspension, bulbMaterial });
  assert.equal(getSuspendedLampDebugProperties({ behavior: "radio" }, {}), null);
});

test("debug workspace groups Blender bulkhead aliases and uses natural name order", () => {
  const prefabs = [
    { prefabType: "DoorBulk1", name: "DoorBulk1_10" },
    { prefabType: "serviceDoor", name: "ServiceDoor_1" },
    { prefabType: "bulkheadDoor", name: "DoorBulk1_2" },
  ];
  assert.deepEqual(prefabs.sort(compareDebugPrefabs).map(({ name }) => name), [
    "ServiceDoor_1",
    "DoorBulk1_2",
    "DoorBulk1_10",
  ]);
});
