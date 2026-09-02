import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import viteConfig from "../vite.config.js";

test("local static development keeps dependency versions aligned with the production build", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const packageJson = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const importMapSource = html.match(/<script type="importmap">\s*([\s\S]*?)\s*<\/script>/)?.[1];

  assert.ok(importMapSource, "index.html must contain an import map");

  const imports = JSON.parse(importMapSource).imports;
  const threeCdnRoot = "https://cdn.jsdelivr.net/npm/three@0.165.0/";

  assert.equal(imports.three, `${threeCdnRoot}build/three.module.js`);
  assert.equal(imports["three/addons/"], `${threeCdnRoot}examples/jsm/`);
  assert.equal(packageJson.dependencies.three, "^0.165.0");
  assert.equal(packageJson.dependencies.postprocessing, "^6.36.3");
  assert.equal(packageJson.dependencies["realism-effects"], "^1.1.2");
  assert.equal(packageJson.scripts.build, "vite build");

  assert.equal(viteConfig.base, "/web-3dGame1/");
  assert.equal(viteConfig.publicDir, false);
  const productionHtml = viteConfig.plugins[0].transformIndexHtml.handler(html);
  assert.doesNotMatch(productionHtml, /type="importmap"/);
  assert.doesNotMatch(productionHtml, /cdn\.jsdelivr|esm\.sh/);
});
