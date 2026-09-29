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

test("hidden debug overlay does not collect memory or mutate DOM", () => {
  let memoryReads = 0;
  const element = { hidden: true, textContent: "unchanged" };
  const runtime = new DebugOverlayRuntime({
    element,
    memoryProfiler: { getSnapshot: () => { memoryReads += 1; return {}; } },
  });
  runtime.update();
  assert.equal(memoryReads, 0);
  assert.equal(element.textContent, "unchanged");
});

test("visible debug overlay is throttled independently from the render loop", () => {
  let now = 1000;
  let memoryReads = 0;
  const element = { hidden: false, textContent: "" };
  const runtime = new DebugOverlayRuntime({
    element,
    now: () => now,
    updateIntervalMs: 250,
    camera: { position: new THREE.Vector3(), rotation: new THREE.Euler() },
    renderer: { shadowMap: { enabled: false } },
    postProcessing: {},
    realismPostProcessing: {},
    memoryProfiler: { getSnapshot: () => {
      memoryReads += 1;
      return { textureObjectCount: 0, geometryObjectCount: 0 };
    } },
    getQuality: () => ({}),
    formatMemory: () => "n/a",
    formatTexture: () => "n/a",
    isNoclipEnabled: () => false,
    getNoclipSpeed: () => 1,
    getHoveredObject: () => null,
  });
  runtime.update();
  now += 100;
  runtime.update();
  now += 150;
  runtime.update();
  assert.equal(memoryReads, 2);
});

