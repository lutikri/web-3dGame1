import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createBriefSheetRuntime } from "../src/prefabs/behaviors/BriefSheetBehavior.js";

test("brief sheet behavior applies a localized texture to its cloned material", async () => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  mesh.name = "SM_Brief1";
  const texture = new THREE.Texture();
  const runtime = createBriefSheetRuntime(new Map([[mesh.name, mesh]]), {
    texturePath: "brief.png",
  }, async () => texture);

  await runtime.texturePromise;
  assert.equal(mesh.material.map, texture);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(texture.flipY, false);
});

test("brief sheet behavior disposes a texture that finishes loading after level unload", async () => {
  let resolveTexture;
  let disposed = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  mesh.name = "SM_Brief1";
  const runtime = createBriefSheetRuntime(new Map([[mesh.name, mesh]]), {
    texturePath: "late.png",
  }, () => new Promise((resolve) => { resolveTexture = resolve; }));

  runtime.dispose();
  resolveTexture({ dispose: () => { disposed = true; } });
  assert.equal(await runtime.texturePromise, null);
  assert.equal(disposed, true);
  assert.equal(runtime.texture, null);
});
