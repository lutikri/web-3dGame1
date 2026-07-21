import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PanelGaugeRuntime } from "../src/panels/PanelGaugeRuntime.js";

function createNeedle() {
  const needle = new THREE.Object3D();
  needle.userData.gaugeKey = "value";
  needle.userData.needleNoiseSeed = 1;
  needle.userData.initialRotation = new THREE.Euler();
  return needle;
}

test("panel gauge runtime maps values and diagnostic modifiers to needle angles", () => {
  const runtime = new PanelGaugeRuntime({
    config: {
      needleAnimation: { inactiveDegrees: 0, activeDegrees: 180 },
      feedback: {
        startup: { needleJitterDegrees: 0 },
        startupFault: { sweepGaugeKeys: [] },
        indicatorTest: { duration: 3 },
      },
    },
    ranges: { value: [0, 100] },
    diagnostics: {
      getGaugeRuntimeModifier: () => ({ reverse: true }),
      getGaugeSelfTestModifier: () => null,
    },
    getIndicatorTimer: () => 0,
    getTime: () => 0,
    getStartupAmount: () => 0,
    getOperationalJitter: () => 0,
    getDangerJitter: () => 0,
  });
  const needle = createNeedle();
  runtime.update(needle, { mode: "running", value: 25 }, 1);
  assert.ok(Math.abs(needle.userData.needleAngle - THREE.MathUtils.degToRad(135)) < 0.001);
  runtime.applyRotation(needle);
  assert.ok(Math.abs(needle.rotation.z - needle.userData.needleAngle) < 0.001);
});

test("panel gauge runtime owns startup fault sweep timing", () => {
  const runtime = new PanelGaugeRuntime({
    config: {
      needleAnimation: { inactiveDegrees: 0, activeDegrees: 180 },
      feedback: {
        startup: { needleJitterDegrees: 0 },
        startupFault: {
          sweepGaugeKeys: ["value"], resetSeconds: 3,
          needleSweepUpSeconds: 1, needleSweepHoldSeconds: 1, needleSweepDownSeconds: 1,
        },
        indicatorTest: { duration: 3 },
      },
    },
    ranges: { value: [0, 100] },
    diagnostics: { getGaugeRuntimeModifier: () => null, getGaugeSelfTestModifier: () => null },
    getIndicatorTimer: () => 0, getTime: () => 0, getStartupAmount: () => 0,
    getOperationalJitter: () => 0, getDangerJitter: () => 0,
  });
  const needle = createNeedle();
  runtime.update(needle, { mode: "startupFault", value: 25, resetPending: 1.5 }, 1);
  assert.ok(Math.abs(needle.userData.needleAngle - Math.PI) < 0.001);
});

test("panel gauge runtime owns debug rotation", () => {
  const runtime = new PanelGaugeRuntime({
    config: {}, ranges: {}, diagnostics: {}, getIndicatorTimer: () => 0, getTime: () => 0,
    getStartupAmount: () => 0, getOperationalJitter: () => 0, getDangerJitter: () => 0,
  });
  const needle = createNeedle();
  assert.equal(runtime.setDebugRotation(needle, "x", 90), needle);
  assert.ok(Math.abs(needle.rotation.x - Math.PI / 2) < 1e-9);
  assert.equal(needle.userData.needleDebugAxis, "x");
});
