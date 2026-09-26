import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { createConfigSaveTargets, resolveConfigSaveTarget } = require("../scripts/config-save-target.cjs");

test("new level save kinds derive safe generated module targets", () => {
  const target = resolveConfigSaveTarget("C:\\game", "serviceCorridor", {});
  assert.ok(target.filePath.endsWith(path.join("src", "generated", "LevelServiceCorridorOverrides.js")));
  assert.equal(target.exportName, "LEVEL_SERVICE_CORRIDOR_OVERRIDES");
});

test("invalid save kinds cannot escape the generated directory", () => {
  assert.equal(resolveConfigSaveTarget("C:\\game", "../outside", {}), null);
  assert.equal(resolveConfigSaveTarget("C:\\game", "bad-name", {}), null);
});

test("audio debug saves use the generated audio override module", () => {
  const targets = createConfigSaveTargets("C:\\game");
  assert.ok(targets.audio.filePath.endsWith(path.join("src", "generated", "AudioOverrides.js")));
  assert.equal(targets.audio.exportName, "AUDIO_OVERRIDES");
});
