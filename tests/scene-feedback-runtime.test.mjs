import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SceneFeedbackRuntime } from "../src/lighting/SceneFeedbackRuntime.js";

test("scene feedback runtime applies light, emergency post effects and camera shake", () => {
  const camera = new THREE.PerspectiveCamera();
  const light = { intensity: 0, userData: { baseIntensity: 2, roomLightControlled: true } };
  const post = {
    bloomPass: { strength: 0 },
    chromaticAberrationPass: { uniforms: { amount: { value: 0 } } },
    lensDistortionPass: { uniforms: { barrelAmount: { value: 0 }, fisheyeAmount: { value: 0 } } },
    lutPass: { intensity: 0 },
    sharpenPass: { uniforms: { amount: { value: 0 } } },
  };
  let emergencyApplied = null;
  const runtime = new SceneFeedbackRuntime({
    config: {
      feedback: {
        outputLow: { lightFlicker: 0.2, cameraShake: 0 },
        thermalEmergency: { bloomBoost: 2, chromaticBoost: 0.1, cameraShake: 0.2 },
        startup: { cameraShake: 0 }, ignitionPulse: { cameraShake: 0 },
        startupFault: { resetSeconds: 2, cameraShake: 0 },
      },
      postProcessing: {
        bloom: { strength: 1 }, chromaticAberration: { amount: 0.01 },
        lut: { intensity: 0.8 }, sharpen: { amount: 0.2, zoomBoost: 0.1 },
      },
    },
    camera, controlledLights: [light], postProcessing: post,
    realism: { applyEmergency: (value) => { emergencyApplied = value; } },
    diagnostics: { getBlackoutFactor: () => 1 },
    roomLighting: { getVisualFactor: () => 0.5 },
    getSnapshot: () => ({ mode: "running", warning: {} }),
    getTime: () => 0.1, getZoomActive: () => true,
    getStartupAmount: () => 0, getIgnitionPulseAmount: () => 0,
    getEmergencyAmount: () => 1, getStartupLightFactor: () => 1,
    getTerminalLightFactor: () => 1, getFixtureFactor: () => 1,
    flickerWave: () => 1, updateRoomMaterials: () => {},
    applyColorAdjustments: () => {},
    applyLensDistortion: (pass) => { pass.uniforms.fisheyeAmount.value = 0.1; },
  });
  runtime.updateLighting();
  runtime.updateCamera();
  assert.ok(Math.abs(light.intensity - 1.18) < 0.0001);
  assert.equal(post.bloomPass.strength, 3);
  assert.ok(Math.abs(post.sharpenPass.uniforms.amount.value - 0.3) < 0.0001);
  assert.equal(emergencyApplied, 1);
  assert.ok(Math.abs(post.chromaticAberrationPass.uniforms.amount.value - 0.11) < 0.0001);
  assert.ok(Math.abs(post.lensDistortionPass.uniforms.fisheyeAmount.value - 0.1) < 0.0001);
  assert.notEqual(camera.rotation.z, 0);
});

test("scene feedback runtime owns startup, ignition and indicator timers", () => {
  let selfTest = true;
  const runtime = new SceneFeedbackRuntime({
    config: {
      feedback: { startup: { duration: 2 }, ignitionPulse: { duration: 1 }, indicatorTest: { duration: 3 }, outputLow: {}, thermalEmergency: {} },
      postProcessing: { bloom: {}, chromaticAberration: {}, sharpen: {}, lensDistortion: {} },
    },
    camera: new THREE.PerspectiveCamera(), controlledLights: [], postProcessing: {},
    realism: { applyEmergency() {} }, diagnostics: { isSelfTestActive: () => selfTest, getBlackoutFactor: () => 1 },
    roomLighting: { update() {}, getVisualFactor: () => 1 }, getSnapshot: () => ({ mode: "standby" }), getTime: () => 0,
    getZoomActive: () => false, getStartupAmount: () => 0, getIgnitionPulseAmount: () => 0, getEmergencyAmount: () => 0,
    getStartupLightFactor: () => 1, getTerminalLightFactor: () => 1, getFixtureFactor: () => 1,
    flickerWave: () => 0, updateRoomMaterials() {}, applyColorAdjustments() {}, applyLensDistortion() {},
    createStartupPattern: () => [1], getStartupPatternFactor: () => 0.5,
  });
  runtime.triggerStartup();
  runtime.triggerIgnitionPulse();
  runtime.updateIndicatorTest(1);
  assert.equal(runtime.getStartupTimer(), 2);
  assert.equal(runtime.getIgnitionPulseTimer(), 1);
  assert.equal(runtime.getIndicatorTimer(), 1);
  assert.equal(runtime.getStartupLightFactor(), 0.5);
  selfTest = false;
  runtime.updateIndicatorTest(1);
  assert.equal(runtime.getIndicatorTimer(), 0);
});

test("scene startup gently restores room light across the long audio intro", () => {
  const runtime = new SceneFeedbackRuntime({
    config: { feedback: { startup: { duration: 3.2, roomDimSeconds: 18, roomMinLightFactor: 0.5 }, ignitionPulse: {}, indicatorTest: {} } },
    diagnostics: {}, roomLighting: {}, createStartupPattern: () => [],
  });
  runtime.triggerStartup();
  assert.equal(runtime.getStartupLightFactor(), 0.5);
  runtime.roomStartupTimer = 9;
  assert.ok(Math.abs(runtime.getStartupLightFactor() - 0.75) < 0.001);
  runtime.roomStartupTimer = 0;
  assert.equal(runtime.getStartupLightFactor(), 1);
});

test("scene feedback runtime applies combined room emissive factors", () => {
  const material = new THREE.MeshStandardMaterial({ emissiveIntensity: 2 });
  material.userData.roomLightControlled = true;
  material.userData.baseEmissiveIntensity = 2;
  const runtime = new SceneFeedbackRuntime({
    config: { feedback: { longTermLightFlicker: { emissiveExponent: 2 } } },
    getRoomMaterials: () => [material], roomLighting: { getVisualFactor: () => 0.5, getAfterglowFactor: () => 0.1 },
    diagnostics: { getBlackoutFactor: () => 0.5 }, getTerminalLightFactor: () => 0.8,
    getFixtureFactor: () => 0.5, getStartupPatternFactor: () => 0.5,
  });
  runtime.startupTimer = 1;
  runtime.startupPattern = [1];
  runtime.config.feedback.startup = { duration: 2 };
  const previousVersion = material.version;
  runtime.updateRoomMaterials();
  assert.equal(material.emissiveIntensity, 0.025);
  assert.equal(material.version, previousVersion + 1);
});
