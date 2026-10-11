import assert from "node:assert/strict";
import test from "node:test";

import * as THREE from "three";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";

import {
  bindGtaoToComposerDepth,
  configureGtaoContactAo,
  configureGtaoExclusionMask,
  createComposerTarget,
} from "../src/postprocessing/GtaoContactAo.js";

test("contact GTAO skips distant samples and fades before the cutoff", () => {
  const pass = new GTAOPass(new THREE.Scene(), new THREE.PerspectiveCamera(), 320, 180);
  assert.equal(configureGtaoContactAo(pass, { distanceFadeStart: 7, distanceFadeEnd: 11 }), true);
  assert.equal(pass.gtaoMaterial.uniforms.contactAoFadeStart.value, 7);
  assert.equal(pass.gtaoMaterial.uniforms.contactAoFadeEnd.value, 11);
  assert.match(pass.gtaoMaterial.fragmentShader, /contactAoDistance >= contactAoFadeEnd/);
  assert.match(pass.gtaoMaterial.fragmentShader, /smoothstep\(contactAoFadeStart/);
  pass.dispose();
});

test("contact GTAO reuses the current composer depth texture", () => {
  const received = [];
  const pass = {
    userData: {},
    depthTexture: null,
    setGBuffer: (depth, normal) => {
      received.push([depth, normal]);
      pass.depthTexture = depth;
    },
    render: () => received.push("render"),
  };
  const depthTexture = {};
  assert.equal(bindGtaoToComposerDepth(pass), true);
  pass.render(null, null, { depthTexture });
  assert.deepEqual(received, [[depthTexture, undefined], "render"]);
});

test("composer render targets expose reusable depth-stencil textures", () => {
  const target = createComposerTarget(640, 360, { samples: 4 });
  assert.equal(target.depthTexture.isDepthTexture, true);
  assert.equal(target.depthTexture.format, THREE.DepthStencilFormat);
  assert.equal(target.samples, 4);
  target.dispose();
});

test("GTAO exclusion blends in place against the stencil produced by visible plasma", () => {
  const camera = new THREE.PerspectiveCamera();
  const calls = [];
  const gtaoMaterial = {
    uniforms: {
      cameraNear: { value: 0 },
      cameraFar: { value: 0 },
      cameraProjectionMatrix: { value: new THREE.Matrix4() },
      cameraProjectionMatrixInverse: { value: new THREE.Matrix4() },
      cameraWorldMatrix: { value: new THREE.Matrix4() },
    },
  };
  const pdMaterial = {
    uniforms: { cameraProjectionMatrixInverse: { value: new THREE.Matrix4() } },
  };
  const blendMaterial = new THREE.MeshBasicMaterial();
  blendMaterial.uniforms = { intensity: { value: 0 }, tDiffuse: { value: null } };
  const gtaoRenderTarget = {};
  const pdRenderTarget = { texture: {} };
  const pass = {
    camera,
    output: 0,
    blendIntensity: 0.65,
    depthTexture: null,
    gtaoMaterial,
    gtaoRenderTarget,
    pdMaterial,
    pdRenderTarget,
    blendMaterial,
    _renderGBuffer: false,
    setGBuffer(depthTexture) {
      this.depthTexture = depthTexture;
    },
    renderPass: (renderer, material, target) => calls.push([material, target]),
    render: () => calls.push("gtao"),
  };
  const readBuffer = { depthTexture: {} };

  assert.equal(configureGtaoExclusionMask(pass), true);
  pass.render({}, {}, readBuffer);

  assert.equal(pass.needsSwap, false);
  assert.equal(pass.depthTexture, readBuffer.depthTexture);
  assert.equal(blendMaterial.stencilFunc, THREE.NotEqualStencilFunc);
  assert.equal(blendMaterial.stencilRef, 1);
  assert.equal(blendMaterial.uniforms.intensity.value, 0.65);
  assert.deepEqual(calls, [
    [gtaoMaterial, gtaoRenderTarget],
    [pdMaterial, pdRenderTarget],
    [blendMaterial, readBuffer],
  ]);
  blendMaterial.dispose();
});
