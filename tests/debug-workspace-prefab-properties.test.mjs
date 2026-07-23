import assert from "node:assert/strict";
import test from "node:test";

import { getSuspendedLampDebugProperties } from "../src/ui/debug/workspace/DebugWorkspace.js";

test("debug workspace exposes suspended lamp config and shared bulb material", () => {
  const suspension = { maxAngleDegrees: 4 };
  const bulbMaterial = { emissiveIntensity: 8 };
  assert.deepEqual(getSuspendedLampDebugProperties(
    { behavior: "suspendedLamp", suspension },
    { lampDome1Bulb: bulbMaterial },
  ), { suspension, bulbMaterial });
  assert.equal(getSuspendedLampDebugProperties({ behavior: "radio" }, {}), null);
});
