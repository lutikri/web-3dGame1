import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("browser import map resolves Three core and addons from the same CORS-capable CDN", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const importMapSource = html.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];

  assert.ok(importMapSource, "index.html must contain an import map");

  const imports = JSON.parse(importMapSource).imports;
  const threeCdnRoot = "https://cdn.jsdelivr.net/npm/three@0.165.0/";

  assert.equal(imports.three, `${threeCdnRoot}build/three.module.js`);
  assert.equal(imports["three/addons/"], `${threeCdnRoot}examples/jsm/`);
});
