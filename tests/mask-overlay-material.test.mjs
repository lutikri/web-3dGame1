import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createMaskOverlayRuntime } from "../src/materials/MaskOverlayMaterial.js";

test("mask overlay runtime owns uniforms, shader patch and debug state", () => {
  const config = {
    maskOverlay: {
      red: { color: "#ff0000", opacity: 0.5, intensity: 2, blend: "multiply" },
      green: { blend: "overlay" },
    },
  };
  const material = new THREE.MeshStandardMaterial({ name: "Masked" });
  const runtime = createMaskOverlayRuntime({
    specialMaterials: { wall: config },
    getMaterials: () => ({ wall: material }),
  });
  runtime.setup(material, config);
  assert.equal(material.userData.maskOverlayUniforms.interiorMaskOpacityR.value, 1);
  assert.deepEqual(material.userData.maskOverlayUniforms.interiorMaskBlendMode.value.toArray(), [1, 2, 0]);
  assert.equal(runtime.setDebug("wall", true), true);
  assert.equal(material.userData.maskOverlayUniforms.interiorMaskDebugView.value, 1);
  const shader = {
    uniforms: {},
    vertexShader: "#include <uv_pars_vertex>\n#include <uv_vertex>",
    fragmentShader: "#include <map_pars_fragment>\n#include <map_fragment>",
  };
  material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader, /interiorMaskMap/);
});
