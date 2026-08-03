import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";

import {
  configureGtaoGeometryCoverage,
  PostProcessingRuntime,
} from "../src/postprocessing/PostProcessingRuntime.js";

test("GTAO depth and normal coverage includes two-sided thin geometry", () => {
  const normalMaterial = new THREE.MeshNormalMaterial();
  const initialVersion = normalMaterial.version;

  assert.equal(configureGtaoGeometryCoverage({ normalMaterial }), true);
  assert.equal(normalMaterial.side, THREE.DoubleSide);
  assert.ok(normalMaterial.version > initialVersion);
  assert.equal(configureGtaoGeometryCoverage(null), false);
});

test("post-processing runtime owns disabled fallback lifecycle", () => {
  const calls = [];
  const runtime = new PostProcessingRuntime({
    config: { postProcessing: { enabled: false } },
    renderer: { render: () => calls.push("render"), getPixelRatio: () => 1 },
    scene: {},
    camera: {},
    assets: { dispose: () => calls.push("assets.dispose") },
    presets: {},
    getQuality: () => ({}),
    applyColorAdjustments: () => {},
    applyLensDistortion: () => {},
    applyLensEffects: () => {},
    setupRealism: () => calls.push("realism.setup"),
    renderRealism: () => false,
    resizeRealism: () => calls.push("realism.resize"),
    disposeRealism: () => calls.push("realism.dispose"),
    inspectRealism: () => ({ realismComposer: false }),
  });

  runtime.setup();
  runtime.render(0.016);
  runtime.resize(800, 600);
  assert.deepEqual(runtime.inspect(), { composer: false, realismComposer: false });
  runtime.dispose();
  assert.deepEqual(calls, [
    "realism.setup", "render", "realism.resize", "realism.dispose", "assets.dispose",
  ]);
});

test("post-processing targets follow the capped renderer pixel ratio", () => {
  const composerCalls = [];
  const gtaoSizes = [];
  const sharpenSizes = [];
  const realismSizes = [];
  const runtime = new PostProcessingRuntime({
    config: { postProcessing: { antiAliasing: { method: "off" } } },
    renderer: { getPixelRatio: () => 0.5 },
    scene: {},
    camera: {},
    assets: {},
    presets: {
      getGtao: () => ({ resolutionScale: 0.5 }),
      getSsr: () => ({ resolutionScale: 1 }),
    },
    getQuality: () => ({ gtao: "min", ssr: "off" }),
    resizeRealism: (...size) => realismSizes.push(size),
  });
  runtime.composer = {
    setPixelRatio: (ratio) => composerCalls.push(["ratio", ratio]),
    setSize: (...size) => composerCalls.push(["size", ...size]),
  };
  runtime.gtaoPass = { setSize: (...size) => gtaoSizes.push(size) };
  runtime.sharpenPass = { uniforms: { resolution: { value: { set: (...size) => sharpenSizes.push(size) } } } };

  runtime.resize(1920, 1080);

  assert.deepEqual(composerCalls, [["ratio", 0.5], ["size", 1920, 1080]]);
  assert.deepEqual(gtaoSizes, [[480, 270]]);
  assert.deepEqual(sharpenSizes, [[960, 540]]);
  assert.deepEqual(realismSizes, [[1920, 1080]]);
});
