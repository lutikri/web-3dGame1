import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("runtime texture pipeline has incremental npm entrypoints and dual progress", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const wrapper = await readFile(new URL("../tools/generate-runtime-textures.ps1", import.meta.url), "utf8");
  const compatibilityBat = await readFile(new URL("../tools/compress-panel-textures.bat", import.meta.url), "utf8");
  const pipeline = await readFile(new URL("../generate-runtime-textures.bat", import.meta.url), "utf8");

  assert.match(packageJson.scripts.textures, /generate-runtime-textures\.ps1/);
  assert.match(packageJson.scripts["textures:all"], /-All/);
  assert.match(wrapper, /TEXTURE_TOOL_MODE/);
  assert.match(compatibilityBat, /T_Panel1_\*/);
  assert.match(pipeline, /Test-JobOutputsCurrent/);
  assert.match(pipeline, /ALL \[/);
  assert.match(pipeline, /TEX \[/);
});
