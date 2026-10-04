import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";

import {
  configureGtaoGeometryCoverage,
  createPresentationPassAlias,
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
  const inspection = runtime.inspect();
  assert.equal(inspection.composer, false);
  assert.equal(inspection.realismComposer, false);
  assert.equal(inspection.performance.cpu.samples, 1);
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

test("presentation pass aliases preserve the public tuning API without extra passes", () => {
  const pass = {
    material: { name: "presentation" },
    uniforms: {
      sharpenAmount: { value: 0.2 },
      chromaticAberrationAmount: { value: 0.001 },
    },
  };
  const sharpen = createPresentationPassAlias(pass, { amount: "sharpenAmount" });
  const chromatic = createPresentationPassAlias(pass, { amount: "chromaticAberrationAmount" });

  sharpen.uniforms.amount.value = 0.5;
  chromatic.uniforms.amount.value = 0.003;

  assert.equal(pass.uniforms.sharpenAmount.value, 0.5);
  assert.equal(pass.uniforms.chromaticAberrationAmount.value, 0.003);
  assert.equal(sharpen.material, pass.material);
});

function captureFixture() {
  let ratio = 0.6375;
  let width = 969;
  let height = 537;
  const canvas = {};
  const updateBuffer = () => { canvas.width = Math.floor(width * ratio); canvas.height = Math.floor(height * ratio); };
  updateBuffer();
  const renderer = {
    domElement: canvas,
    capabilities: { isWebGL2: true, maxSamples: 8, maxTextureSize: 16384 },
    getSize: (size) => size.set(width, height),
    getDrawingBufferSize: (size) => size.set(canvas.width, canvas.height),
    getPixelRatio: () => ratio,
    setPixelRatio: (value) => { ratio = value; updateBuffer(); },
    setSize: (w, h, style) => { assert.equal(style, false); width = w; height = h; updateBuffer(); },
    getRenderTarget: () => null,
    setRenderTarget() {},
    getContext: () => ({ MAX_VIEWPORT_DIMS: "viewport", MAX_RENDERBUFFER_SIZE: "target", getParameter: (key) => key === "viewport" ? [16384, 16384] : 16384 }),
  };
  const runtime = new PostProcessingRuntime({
    renderer,
    config: { postProcessing: { antiAliasing: { method: "fxaa", msaaSamples: 0 } } },
    getQuality: () => ({}),
    resizeRealism() {},
  });
  runtime.composer = { renderTarget1: { samples: 0 }, renderTarget2: { samples: 0 }, setPixelRatio() {}, setSize() {} };
  const fxaaResolution = new THREE.Vector2();
  runtime.fxaaPass = { material: { uniforms: { resolution: { value: fxaaResolution } } } };
  const frames = [];
  runtime.render = () => frames.push([canvas.width, canvas.height, runtime.composer.renderTarget1.samples]);
  return { runtime, renderer, canvas, frames, fxaaResolution };
}

test("capture doubles the exact physical buffer, adds maximum MSAA and restores before PNG encoding", () => {
  const f = captureFixture();
  const before = { width: f.canvas.width, height: f.canvas.height, ratio: f.renderer.getPixelRatio() };
  const result = f.runtime.captureFrame((canvas) => {
    assert.equal(canvas.width, before.width * 2);
    assert.equal(canvas.height, before.height * 2);
    assert.equal(f.fxaaResolution.x, 1 / canvas.width);
    assert.equal(f.runtime.composer.renderTarget1.samples, 8);
    return "copied-frame";
  });
  assert.equal(result.canvas, "copied-frame");
  assert.equal(result.samples, 8);
  assert.deepEqual(f.frames, [[before.width * 2, before.height * 2, 8], [before.width, before.height, 0]]);
  assert.equal(f.renderer.getPixelRatio(), before.ratio);
  assert.equal(f.runtime.config.postProcessing.antiAliasing.method, "fxaa");
  assert.equal(f.runtime.composer.renderTarget2.samples, 0);
});

test("failed frame copying still restores render size and MSAA", () => {
  const f = captureFixture();
  assert.throws(() => f.runtime.captureFrame(() => { throw new Error("copy failed"); }), /copy failed/);
  assert.equal(f.renderer.getPixelRatio(), 0.6375);
  assert.equal(f.canvas.width, 617);
  assert.equal(f.runtime.composer.renderTarget1.samples, 0);
});

test("capture refuses oversized GPU buffers without changing current render settings", () => {
  const f = captureFixture();
  f.renderer.capabilities.maxTextureSize = 1024;
  assert.throws(() => f.runtime.captureFrame(() => {}), /exceeds GPU render limits/);
  assert.equal(f.renderer.getPixelRatio(), 0.6375);
  assert.equal(f.frames.length, 0);
});
