import assert from "node:assert/strict";
import test from "node:test";

import { PostProcessingAssets } from "../src/postprocessing/PostProcessingAssets.js";

test("post-processing assets dispose owned GPU textures", () => {
  const assets = new PostProcessingAssets();
  let disposed = 0;
  assets.lutTexture = { dispose: () => { disposed += 1; } };
  assets.lensDirtTexture = { dispose: () => { disposed += 1; } };
  assets.dispose();
  assert.equal(disposed, 2);
  assert.equal(assets.lutTexture, null);
  assert.equal(assets.lensDirtTexture, null);
  assert.equal(assets.hasLut("missing.cube"), false);
});
