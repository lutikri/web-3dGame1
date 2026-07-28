import test from "node:test";
import assert from "node:assert/strict";

import {
  classifyGraphicsAdapter,
  createPreflightUiAudio,
  getPreflightScale,
  recommendGraphicsProfile,
} from "../src/app/Preflight.js";
import { isHighEndGraphicsAdapter } from "../src/config/GraphicsHardwareTiers.js";

test("preflight distinguishes discrete, integrated, software, and hidden adapters", () => {
  assert.equal(classifyGraphicsAdapter("ANGLE (NVIDIA GeForce RTX 4070 Direct3D11)"), "discrete");
  assert.equal(classifyGraphicsAdapter("Intel(R) Iris(R) Xe Graphics"), "integrated");
  assert.equal(classifyGraphicsAdapter("Google SwiftShader"), "software");
  assert.equal(classifyGraphicsAdapter("WebGL renderer"), "unknown");
});

test("hardware tiers reserve automatic high for known strong model families", () => {
  assert.equal(isHighEndGraphicsAdapter("NVIDIA GeForce RTX 4070"), true);
  assert.equal(isHighEndGraphicsAdapter("NVIDIA GeForce RTX 2060"), true);
  assert.equal(isHighEndGraphicsAdapter("NVIDIA GeForce RTX 4060"), true);
  assert.equal(isHighEndGraphicsAdapter("NVIDIA GeForce RTX 2050"), false);
  assert.equal(isHighEndGraphicsAdapter("AMD Radeon RX 7800 XT"), true);
  assert.equal(isHighEndGraphicsAdapter("AMD Radeon RX 9070 XT"), true);
  assert.equal(isHighEndGraphicsAdapter("AMD Radeon RX 9060"), false);
  assert.equal(isHighEndGraphicsAdapter("Intel Arc A770 Graphics"), true);
  assert.equal(isHighEndGraphicsAdapter("Apple M3 Pro"), true);
  assert.equal(isHighEndGraphicsAdapter("Intel Iris Xe Graphics"), false);
});

test("preflight recommends high only to the allowlist and medium to unknown hardware", () => {
  assert.equal(recommendGraphicsProfile({ gpuInfo: { renderer: "NVIDIA GeForce RTX 4070", webgl2: true } }), "high");
  assert.equal(recommendGraphicsProfile({ gpuInfo: { renderer: "NVIDIA GeForce RTX 2060", webgl2: true } }), "high");
  assert.equal(recommendGraphicsProfile({ gpuInfo: { renderer: "NVIDIA GeForce RTX 4060", webgl2: true } }), "high");
  assert.equal(recommendGraphicsProfile({ gpuInfo: { renderer: "WebGL renderer", webgl2: true } }), "medium");
  assert.equal(recommendGraphicsProfile({ gpuInfo: { renderer: "Intel Iris Xe Graphics", webgl2: true } }), "medium");
});

test("preflight recommendation is advisory and uses the two short quality probes", () => {
  const gpuInfo = { renderer: "NVIDIA GeForce RTX 4070", webgl2: true };
  assert.equal(recommendGraphicsProfile({
    gpuInfo,
    benchmark: { results: [{ preset: "PROFILE HIGH", avgFps: 60, p95FrameMs: 20 }] },
  }), "high");
  assert.equal(recommendGraphicsProfile({
    gpuInfo,
    benchmark: { results: [{ preset: "PROFILE MEDIUM", avgFps: 50, p95FrameMs: 25 }] },
  }), "medium");
  assert.equal(recommendGraphicsProfile({
    gpuInfo,
    benchmark: { results: [{ preset: "PROFILE MEDIUM", avgFps: 28, p95FrameMs: 42 }] },
  }), "low");
});

test("software rendering always receives the safe low profile", () => {
  assert.equal(recommendGraphicsProfile({
    gpuInfo: { renderer: "Google SwiftShader", webgl2: true },
    benchmark: { results: [{ preset: "PROFILE HIGH", avgFps: 120, p95FrameMs: 9 }] },
  }), "low");
});

test("preflight scales one fixed 1920 by 1080 composition uniformly", () => {
  assert.equal(getPreflightScale(1920, 1080), 1);
  assert.equal(getPreflightScale(2560, 1080), 1);
  assert.equal(getPreflightScale(1280, 1024), 2 / 3);
  assert.equal(getPreflightScale(960, 540), 0.5);
});

test("preflight owns and disposes its native UI button audio", () => {
  const listeners = new Map();
  const listenerOptions = new Map();
  const played = [];
  const paused = [];
  class FakeAudio {
    constructor(path) {
      this.path = path;
      this.currentTime = 0;
    }
    play() {
      played.push([this.path, this.volume]);
      return Promise.resolve();
    }
    pause() {
      paused.push(this.path);
    }
  }
  const controlA = { disabled: false, getAttribute: () => null };
  const controlB = { disabled: false, getAttribute: () => null };
  const setupControl = { disabled: false, dataset: { uiSound: "setupComplete" }, getAttribute: () => null };
  const eventFor = (control) => ({ target: { closest: () => control } });
  const root = {
    addEventListener: (type, listener, options) => {
      listeners.set(type, listener);
      listenerOptions.set(type, options);
    },
    removeEventListener: (type, listener, options) => {
      if (listeners.get(type) === listener) listeners.delete(type);
      if (listenerOptions.get(type) === options) listenerOptions.delete(type);
    },
    contains: () => true,
  };
  const runtime = createPreflightUiAudio({ root, AudioClass: FakeAudio });

  assert.equal(listenerOptions.get("click"), true);
  listeners.get("mousemove")(eventFor(controlA));
  listeners.get("click")(eventFor(controlA));
  listeners.get("mousemove")(eventFor(controlB));
  listeners.get("click")(eventFor(setupControl));
  assert.deepEqual(played, [
    ["assets/sounds/ui/Menu_Click1.ogg", 0.76],
    ["assets/sounds/ui/Menu_Hover1.ogg", 0.44],
    ["assets/sounds/ui/Menu_SetupComlete1.ogg", 0.78],
  ]);

  runtime.dispose();
  assert.equal(listeners.size, 0);
  assert.deepEqual(paused, [
    "assets/sounds/ui/Menu_Click1.ogg",
    "assets/sounds/ui/Menu_Hover1.ogg",
  ]);
});
