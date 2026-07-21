import test from "node:test";
import assert from "node:assert/strict";

import { estimateTextureGpuBytes, formatMemoryMiB } from "../src/ui/debug/RuntimeMemoryProfiler.js";

test("runtime memory profiler estimates ordinary and compressed textures", () => {
  assert.equal(estimateTextureGpuBytes({ image: { width: 256, height: 128 }, generateMipmaps: false }), 131072);
  assert.equal(
    estimateTextureGpuBytes({ image: { width: 256, height: 128 }, generateMipmaps: false, isCompressedTexture: true }),
    16384,
  );
  assert.equal(formatMemoryMiB(1048576), "1.0 MiB");
});
