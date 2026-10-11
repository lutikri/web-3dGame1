import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import viteConfig from "../vite.config.js";

test("local static development keeps dependency versions aligned with the production build", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const githubPagesWorkflow = await readFile(
    new URL("../.github/workflows/deploy-pages.yml", import.meta.url),
    "utf8",
  );
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
  assert.equal(packageJson.scripts["build:game"], "vite build --mode game");
  assert.equal(packageJson.scripts["build:landing"], "vite build --mode landing");

  const productionConfig = viteConfig({ mode: "production" });
  const gameConfig = viteConfig({ mode: "game" });
  const landingConfig = viteConfig({ mode: "landing" });

  assert.equal(productionConfig.base, "/");
  assert.equal(productionConfig.build.sourcemap, false);
  assert.equal(productionConfig.publicDir, false);
  assert.equal(productionConfig.build.outDir, "dist");
  assert.equal(gameConfig.build.outDir, "dist-game");
  assert.equal(landingConfig.build.outDir, "dist-landing");
  assert.match(githubPagesWorkflow, /DEPLOY_BASE_PATH:\s*\/web-3dGame1\//);
  const productionHtml = productionConfig.plugins[0].transformIndexHtml.handler(html);
  assert.doesNotMatch(productionHtml, /type="importmap"/);
  assert.doesNotMatch(productionHtml, /cdn\.jsdelivr|esm\.sh/);

  const landingHtml = await readFile(new URL("../landing.html", import.meta.url), "utf8");
  const deployedLandingHtml = landingConfig.plugins[0].transformIndexHtml.handler(landingHtml);
  assert.match(deployedLandingHtml, /href="https:\/\/play\.baseloadgame\.com\/"/);
  assert.doesNotMatch(deployedLandingHtml, /href="\.\/index\.html"/);
});
