import assert from "node:assert/strict";
import test from "node:test";
import { CompressedTexture, CubeTexture, DataTexture, LinearFilter, LinearMipmapLinearFilter, Texture } from "three";
import { POST_PROCESSING_CONFIG } from "../src/PostProcessingConfig.js";
import { AdaptiveQualityRuntime } from "../src/runtime/AdaptiveQualityRuntime.js";
import { PhotoModeRuntime } from "../src/runtime/PhotoModeRuntime.js";

function createFixture({ load = async () => {} } = {}) {
  let now = 0;
  let dpi = 2;
  const config = { postProcessing: structuredClone(POST_PROCESSING_CONFIG), shadows: { defaultQuality: "min" } };
  config.postProcessing.antiAliasing.method = "smaa";
  config.postProcessing.antiAliasing.msaaSamples = 0;
  config.postProcessing.bloom.enabled = false;
  const bootOptions = { qualityProfile: "medium", deferFullTextures: true, disableFullTextures: true };
  const quality = { shadows: "min", gtao: "med", ssgi: "off", ssr: "min", screenSpaceShadows: "off" };
  const adaptiveQuality = new AdaptiveQualityRuntime({
    getViewport: () => ({ width: 7680, height: 4320 }),
    now: () => now,
  });
  adaptiveQuality.configure("medium");
  adaptiveQuality.setRenderScale(125);
  const objects = [];
  const textureSets = new Map();
  let rebuilds = 0;
  const runtime = new PhotoModeRuntime({
    config, bootOptions, adaptiveQuality, textureSets,
    scene: { traverse: (callback) => objects.forEach(callback) },
    renderer: { capabilities: { getMaxAnisotropy: () => 16 } },
    materialTextures: { ensureFullResolution: load },
    postProcessingPolicy: {
      snapshot: () => ({ ...quality }),
      replace: (next) => Object.assign(quality, next),
      setShadowQuality: (shadows) => { quality.shadows = shadows; },
    },
    rebuildPostProcessing: () => { rebuilds += 1; },
    getDevicePixelRatio: () => dpi,
    now: () => now,
  });
  return {
    runtime, config, bootOptions, quality, adaptiveQuality, objects, textureSets,
    advance: () => { now += 1000; },
    setDpi: (value) => { dpi = value; },
    getRebuilds: () => rebuilds,
  };
}

test("photo mode renders at native DPI beyond Ultra's budget and restores custom graphics settings", async () => {
  const fixture = createFixture();
  const { runtime, config, bootOptions, quality, adaptiveQuality } = fixture;
  const originalConfig = structuredClone(config);
  const originalBoot = { ...bootOptions };
  const originalQuality = { ...quality };
  const originalAdaptive = adaptiveQuality.snapshot();

  assert.equal((await runtime.enable()).enabled, true);
  assert.equal(adaptiveQuality.snapshot().pixelRatio, 2);
  assert.equal(config.postProcessing.antiAliasing.msaaSamples, 8);
  assert.equal(config.postProcessing.bloom.resolutionScale, 1);
  assert.equal(config.postProcessing.gtao.presets.max.resolutionScale, 1);
  assert.equal(quality.gtao, "max");
  assert.equal(quality.shadows, "max");
  assert.equal(bootOptions.disableFullTextures, false);
  fixture.setDpi(1.5);
  runtime.update();
  adaptiveQuality.resize();
  assert.equal(adaptiveQuality.snapshot().pixelRatio, 1.5);

  runtime.disable();
  assert.deepEqual(config, originalConfig);
  assert.deepEqual(bootOptions, originalBoot);
  assert.deepEqual(quality, originalQuality);
  assert.deepEqual(adaptiveQuality.snapshot(), originalAdaptive);
  assert.equal(fixture.getRebuilds(), 2);
  runtime.disable();
  assert.equal(fixture.getRebuilds(), 2);
});

test("mip0 supports compressed and late material textures while preserving unrelated render textures", async () => {
  const fixture = createFixture();
  const { runtime, objects, textureSets } = fixture;
  const map = new Texture();
  map.minFilter = LinearMipmapLinearFilter;
  map.anisotropy = 4;
  const compressed = new CompressedTexture([{ data: new Uint8Array(16), width: 4, height: 4 }], 4, 4);
  const renderTarget = new Texture();
  renderTarget.isRenderTargetTexture = true;
  const cube = new CubeTexture();
  const data = new DataTexture();
  objects.push({ material: [{ map, envMap: cube }, { map: renderTarget, alphaMap: data }] });
  textureSets.set("material", { textures: [{ texture: map }, { texture: compressed }] });
  await runtime.enable({ mip0: true });
  assert.equal(runtime.snapshot().textures, 2);
  assert.equal(map.minFilter, LinearFilter);
  assert.equal(compressed.minFilter, LinearFilter);
  assert.equal(map.anisotropy, 1);
  assert.equal(cube.anisotropy, 1);
  assert.equal(renderTarget.anisotropy, 1);

  const late = new Texture();
  late.minFilter = LinearMipmapLinearFilter;
  objects.push({ material: { map: late } });
  fixture.advance();
  runtime.update();
  assert.equal(late.minFilter, LinearFilter);

  await runtime.enable();
  assert.equal(map.minFilter, LinearMipmapLinearFilter);
  assert.equal(map.anisotropy, 16);
  assert.equal(fixture.getRebuilds(), 1);
  compressed.dispose();
  assert.equal(runtime.snapshot().textures, 2);
  runtime.disable();
  assert.equal(map.minFilter, LinearMipmapLinearFilter);
  assert.equal(map.anisotropy, 4);
  assert.equal(late.minFilter, LinearMipmapLinearFilter);
  assert.equal(late.anisotropy, 1);
  assert.equal(runtime.snapshot().textures, 0);
});

test("disabling during full texture loading prevents a late completion from re-enabling photo mode", async () => {
  let finish;
  const fixture = createFixture({ load: () => new Promise((resolve) => { finish = resolve; }) });
  const pending = fixture.runtime.enable({ mip0: true });
  assert.equal(fixture.runtime.snapshot().loading, true);
  fixture.runtime.disable();
  finish();
  assert.equal((await pending).enabled, false);
  assert.equal(fixture.bootOptions.qualityProfile, "medium");
  assert.equal(fixture.adaptiveQuality.snapshot().resolutionOverride, null);
});

test("failed full texture loading restores previous settings and reports the failure", async () => {
  const fixture = createFixture({ load: async () => { throw new Error("texture unavailable"); } });
  const originalConfig = structuredClone(fixture.config);
  await assert.rejects(fixture.runtime.enable(), /texture unavailable/);
  assert.deepEqual(fixture.config, originalConfig);
  assert.equal(fixture.runtime.snapshot().enabled, false);
});

test("rapid disable and re-enable keeps the latest mode even when older texture work finishes last", async () => {
  const completions = [];
  const fixture = createFixture({ load: () => new Promise((resolve) => completions.push(resolve)) });
  const first = fixture.runtime.enable({ mip0: true });
  fixture.runtime.disable();
  const second = fixture.runtime.enable();
  completions[1]();
  await second;
  completions[0]();
  await first;
  assert.equal(fixture.runtime.snapshot().enabled, true);
  assert.equal(fixture.runtime.snapshot().mip0, false);
  assert.equal(fixture.runtime.snapshot().loading, false);
  fixture.runtime.disable();
  assert.equal(fixture.bootOptions.qualityProfile, "medium");
});

test("texture filtering releases detached level textures before a new level uses the mode", async () => {
  const fixture = createFixture();
  const original = new Texture();
  original.anisotropy = 4;
  fixture.objects.push({ material: { map: original } });
  await fixture.runtime.enable({ mip0: true });
  assert.equal(original.minFilter, LinearFilter);
  fixture.objects.length = 0;
  const replacement = new Texture();
  fixture.objects.push({ material: { map: replacement } });
  fixture.advance();
  fixture.runtime.update();
  assert.equal(original.minFilter, LinearMipmapLinearFilter);
  assert.equal(original.anisotropy, 4);
  assert.equal(replacement.minFilter, LinearFilter);
  assert.equal(fixture.runtime.snapshot().textures, 1);
  fixture.runtime.disable();
  replacement.anisotropy = 8;
  replacement.dispose();
  assert.equal(replacement.anisotropy, 8);
});
