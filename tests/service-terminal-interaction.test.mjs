import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { createServiceTerminalInteractionRuntime } from "../src/prefabs/behaviors/ServiceTerminalInteractionRuntime.js";

function createHarness() {
  const calls = [];
  const screen = new THREE.Object3D();
  const viewSocket = new THREE.Object3D();
  viewSocket.position.set(0, 1.2, -0.8);
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
    viewSocket,
    focusFovDegrees: 52,
    enterDurationSeconds: 0.4,
    exitDurationSeconds: 0.3,
    renderer: terminalRenderer,
    setLanguage: (language) => calls.push(["language", language]),
  };
  let rayHits = [{ uv: new THREE.Vector2(0.25, 0.75) }];
  const camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.05, 80);
  camera.position.set(1, 1.7, 1);
  const playerStates = [];
  let pointerLockRequests = 0;
  let currentTime = 10;
  const runtime = createServiceTerminalInteractionRuntime({
    canvas: {
      style: {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }),
    },
    camera,
    pointer: new THREE.Vector2(),
    raycaster: {
      setFromCamera() {},
      intersectObject: () => rayHits,
    },
    getLanguage: () => "en",
    setPlayerEnabled: (enabled) => playerStates.push(enabled),
    requestPointerLock: () => { pointerLockRequests += 1; },
    now: () => currentTime,
  });
  return {
    calls,
    runtime,
    camera,
    playerStates,
    getPointerLockRequests: () => pointerLockRequests,
    advanceTime: (seconds) => { currentTime += seconds; },
    terminalRenderer,
    target: { userData: { serviceTerminalRuntime: serviceTerminal } },
    setHits: (hits) => { rayHits = hits; },
  };
}

test("in-world terminal click is accepted only through a screen UV hit", () => {
  const harness = createHarness();
  harness.runtime.updateAimTarget(harness.target);
  assert.equal(harness.runtime.activate(harness.target, { levelId: "exploring-around" }), true);
  assert.equal(harness.runtime.getPhase(), "entering");
  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === "activate"), false);
  harness.runtime.update(0.4);
  assert.equal(harness.runtime.getPhase(), "active");
  assert.equal(harness.runtime.activate(harness.target, { levelId: "exploring-around" }), true);
  assert.deepEqual(harness.calls.find((call) => Array.isArray(call) && call[0] === "activate"), ["activate", 400, 675]);

  harness.calls.length = 0;
  harness.setHits([]);
  assert.equal(harness.runtime.activate(harness.target), false);
  assert.equal(harness.calls.some((call) => Array.isArray(call) && call[0] === "activate"), false);
});

test("generic screens share focus transitions, right-click exit, and re-entry cooldown", () => {
  const harness = createHarness();
  const screenFocusRuntime = {
    viewSocket: new THREE.Object3D(),
    focusFovDegrees: 50,
    enterDurationSeconds: 0.2,
    exitDurationSeconds: 0.2,
  };
  const target = { userData: { screenFocusRuntime } };
  assert.equal(harness.runtime.activate(target), true);
  harness.runtime.update(0.2);
  assert.equal(harness.runtime.getPhase(), "active");
  assert.equal(harness.runtime.handlePointerDown({ button: 2 }), true);
  harness.runtime.update(0.2);
  assert.equal(harness.runtime.isActive(), false);
  assert.equal(harness.runtime.activate(target), false);
  harness.advanceTime(3);
  assert.equal(harness.runtime.activate(target), true);
});

test("terminal activation reuses the resolved aim UV while the camera is leaning", () => {
  const harness = createHarness();
  harness.target.userData.lastHitUv = new THREE.Vector2(0.75, 0.25);
  harness.runtime.updateAimTarget(harness.target);
  harness.runtime.activate(harness.target);
  harness.runtime.update(0.4);
  harness.setHits([]);

  assert.equal(harness.runtime.activate(harness.target), true);
  assert.deepEqual(
    harness.calls.find((call) => Array.isArray(call) && call[0] === "activate"),
    ["activate", 1200, 225],
  );
});

test("terminal escape closes its document and exits screen focus", () => {
  const harness = createHarness();
  harness.runtime.updateAimTarget(harness.target);
  harness.runtime.activate(harness.target);
  harness.runtime.update(0.4);
  harness.terminalRenderer.state.activeDocumentId = "technical-brief";
  harness.terminalRenderer.isDocumentOpen = () => Boolean(harness.terminalRenderer.state.activeDocumentId);
  assert.equal(harness.runtime.handleKeyDown({ code: "Escape" }), true);
  assert.equal(harness.terminalRenderer.state.activeDocumentId, null);
  assert.equal(harness.runtime.getPhase(), "exiting");
  assert.equal(harness.getPointerLockRequests(), 1);
  harness.runtime.update(0.3);
  assert.equal(harness.runtime.isActive(), false);
  assert.deepEqual(harness.playerStates, [false, true]);
});
