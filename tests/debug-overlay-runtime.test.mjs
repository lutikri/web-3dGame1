import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { DebugOverlayRuntime } from "../src/ui/debug/DebugOverlayRuntime.js";

test("debug overlay runtime renders camera, quality, memory and interaction state", () => {
  const element = { textContent: "" };
  const runtime = new DebugOverlayRuntime({
    element,
    camera: { position: new THREE.Vector3(1, 2, 3), rotation: new THREE.Euler() },
    renderer: { shadowMap: { enabled: true } },
    postProcessing: { gtaoPass: {} },
    realismPostProcessing: {},
    memoryProfiler: { getSnapshot: () => ({
      heapUsedBytes: 1, heapLimitBytes: 2, deviceMemoryGb: 8,
      textureObjectCount: 3, geometryObjectCount: 4, runtimeTextureBytes: 5,
      largestTexture: null, largestSet: null,
    }) },
    getQuality: () => ({ shadows: "high", gtao: "medium", ssgi: "off", ssr: "off", screenSpaceShadows: "off" }),
    formatMemory: (value) => `${value} B`,
    formatTexture: () => "n/a",
    isNoclipEnabled: () => true,
    getNoclipSpeed: () => 2,
    getHoveredObject: () => ({ name: "Button" }),
  });
  runtime.update();
  assert.match(element.textContent, /shadows: high/);
  assert.match(element.textContent, /hover: Button/);
});

