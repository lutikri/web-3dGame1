import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { createBriefSheetRuntime } from "../src/prefabs/behaviors/BriefSheetBehavior.js";

test("brief sheet behavior applies a localized texture to its cloned material", async () => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial());
  mesh.name = "SM_Brief1";
  mesh.material.color.set("#aaa69d");
  mesh.material.transparent = true;
  mesh.material.opacity = 0.5;
  mesh.material.depthWrite = false;
  const texture = new THREE.Texture();
  const runtime = createBriefSheetRuntime(new Map([[mesh.name, mesh]]), {
    texturePath: "brief.png",
  }, async () => texture);

  await runtime.texturePromise;
  assert.equal(mesh.material.map, texture);
  assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
  assert.equal(texture.flipY, false);
  assert.equal(mesh.material.color.getHexString(), "aaa69d");
  assert.equal(mesh.material.transparent, false);
  assert.equal(mesh.material.opacity, 1);
  assert.equal(mesh.material.alphaTest, 0.5);
  assert.equal(mesh.material.depthWrite, true);
  assert.equal(mesh.material.side, THREE.DoubleSide);
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
