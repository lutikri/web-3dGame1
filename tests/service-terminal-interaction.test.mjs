import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { createServiceTerminalInteractionRuntime } from "../src/prefabs/behaviors/ServiceTerminalInteractionRuntime.js";

function createHarness() {
  const calls = [];
  const screen = new THREE.Object3D();
  const terminalRenderer = {
    canvas: { width: 1600, height: 900 },
    state: { activeTab: "brief", activeDocumentId: null, guideIndex: 0, documentScroll: 0 },
    draw: () => calls.push("draw"),
    updateHover: (x, y) => x >= 0 && y >= 0 ? "tab:guide" : null,
    activateAt: (x, y) => {
      calls.push(["activate", x, y]);
      return { type: "tab", value: "guide" };
    },
    scroll: () => false,
    back: () => {
      if (!terminalRenderer.state.activeDocumentId) return false;
      terminalRenderer.state.activeDocumentId = null;
      return true;
    },
  };
  const serviceTerminal = {
    screen,
    renderer: terminalRenderer,
    setLanguage: (language) => calls.push(["language", language]),
  };
  let rayHits = [{ uv: new THREE.Vector2(0.25, 0.75) }];
  const runtime = createServiceTerminalInteractionRuntime({
    canvas: {
      style: {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }),
    },
    camera: {},
    pointer: new THREE.Vector2(),
    raycaster: {
      setFromCamera() {},
      intersectObject: () => rayHits,
    },
    getLanguage: () => "en",
  });
  return {
    calls,
    runtime,
    terminalRenderer,
    target: { userData: { serviceTerminalRuntime: serviceTerminal } },
    setHits: (hits) => { rayHits = hits; },
  };
}

test("in-world terminal click is accepted only through a screen UV hit", () => {
  const harness = createHarness();
  harness.runtime.updateAimTarget(harness.target);
  assert.equal(harness.runtime.activate(harness.target, { levelId: "exploring-around" }), true);
  assert.deepEqual(harness.calls.find((call) => Array.isArray(call) && call[0] === "activate"), ["activate", 400, 675]);

  harness.calls.length = 0;
  harness.setHits([]);
  assert.equal(harness.runtime.activate(harness.target), false);
  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === "activate"), false);
});

test("terminal escape closes only the focused document and keeps aim controls active", () => {
  const harness = createHarness();
  harness.runtime.updateAimTarget(harness.target);
  harness.runtime.activate(harness.target);
  harness.terminalRenderer.state.activeDocumentId = "technical-brief";
  harness.terminalRenderer.isDocumentOpen = () => Boolean(harness.terminalRenderer.state.activeDocumentId);
  assert.equal(harness.runtime.handleKeyDown({ code: "Escape" }), true);
  assert.equal(harness.terminalRenderer.state.activeDocumentId, null);
  assert.equal(harness.runtime.handleKeyDown({ code: "Escape" }), false);
});
