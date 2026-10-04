import assert from "node:assert/strict";
import test from "node:test";
import { Vector2 } from "three";
import { BloomResolutionPass } from "../src/postprocessing/BloomResolutionPass.js";

test("Ultra bloom extracts highlights and composites its finest level at full rendering resolution", () => {
  const pass = new BloomResolutionPass(new Vector2(3840, 2160), 0.4, 0.6, 0.8, 1);
  assert.equal(pass.renderTargetBright.width, 3840);
  assert.equal(pass.renderTargetBright.height, 2160);
  assert.deepEqual(pass.renderTargetsHorizontal.map((target) => [target.width, target.height]), [
    [3840, 2160], [1920, 1080], [960, 540], [480, 270], [240, 135],
  ]);
  assert.deepEqual(pass.renderTargetsVertical.map((target) => [target.width, target.height]),
    pass.renderTargetsHorizontal.map((target) => [target.width, target.height]));
  assert.equal(pass.separableBlurMaterials[0].uniforms.invSize.value.x, 1 / 3840);
  assert.equal(pass.separableBlurMaterials[0].uniforms.invSize.value.y, 1 / 2160);
  pass.dispose();
});

test("bloom remains full resolution across composer resizing and fractional pixel ratios", () => {
  const pass = new BloomResolutionPass(new Vector2(800, 600), 0.4, 0.6, 0.8, 1);
  pass.setSize(2560, 1440);
  assert.equal(pass.renderTargetBright.width, 2560);
  assert.equal(pass.renderTargetsHorizontal[0].height, 1440);
  pass.setSize(959.5, 539.5);
  assert.equal(pass.renderTargetBright.width, 960);
  assert.equal(pass.renderTargetBright.height, 540);
  pass.dispose();
});

test("non-Ultra bloom preserves the existing half-resolution pyramid", () => {
  const pass = new BloomResolutionPass(new Vector2(3840, 2160), 0.4, 0.6, 0.8);
  assert.equal(pass.renderTargetBright.width, 1920);
  assert.equal(pass.renderTargetBright.height, 1080);
  pass.setSize(1920, 1080);
  assert.equal(pass.renderTargetsHorizontal[0].width, 960);
  assert.equal(pass.renderTargetsHorizontal[0].height, 540);
  pass.dispose();
});
