import assert from "node:assert/strict";
import test from "node:test";

import { assignPhotometricProfileSlots } from "../src/lighting/PhotometricPointLightRuntime.js";

test("photometric lights retain the profile assigned to each fixture type", () => {
  const fluorescentTexture = { name: "fluorescent" };
  const domeTexture = { name: "dome" };
  const { profiles, profileIndices } = assignPhotometricProfileSlots([
    { path: "fluorescent.hdr", texture: fluorescentTexture },
    { path: "dome.hdr", texture: domeTexture },
    { path: "dome.hdr", texture: domeTexture },
  ], 4);

  assert.deepEqual(profiles, [
    { path: "fluorescent.hdr", texture: fluorescentTexture },
    { path: "dome.hdr", texture: domeTexture },
  ]);
  assert.deepEqual(profileIndices, [0, 1, 1]);
});

test("photometric profile slots fail open when the texture-unit budget is exhausted", () => {
  const { profileIndices } = assignPhotometricProfileSlots([
    { path: "first.hdr", texture: {} },
    { path: "second.hdr", texture: {} },
  ], 1);

  assert.deepEqual(profileIndices, [0, -1]);
});
