import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { PanelControlRuntime } from "../src/panels/PanelControlRuntime.js";

test("panel control runtime owns knob values and button animation", () => {
  const knob = new THREE.Object3D();
  knob.name = "Fuel";
  knob.userData.controlPercent = 20;
  knob.userData.initialRotation = knob.rotation.clone();
  const button = new THREE.Object3D();
  button.userData = {
    pressed: true,
    pressProgress: 0,
    pressSpeed: 100,
    pressDistance: -0.01,
    pressAxis: "z",
    initialPosition: button.position.clone(),
  };
  let changed = 0;
  const sounds = [];
  const runtime = new PanelControlRuntime({
    config: { controls: { knobValue0DialPercent: 0, knobValue100DialPercent: 100, knobDialDegrees: 180, knobRotationAxis: "z" } },
    knobs: [knob],
    buttons: [button],
    auxiliaryButtons: [],
    diagnostics: {
      getKnobSensitivity: () => 2,
      registerKnobMovement: () => {},
    },
    onChanged: () => { changed += 1; },
    playSound: (...args) => sounds.push(args),
    getTime: () => 1,
  });
  assert.equal(runtime.adjustKnob(knob, 10), true);
  assert.equal(runtime.getPercent("Fuel"), 40);
  assert.equal(changed, 1);
  assert.deepEqual(sounds, [["panelKnobTick", knob]]);
  assert.ok(Math.abs(knob.rotation.z - THREE.MathUtils.degToRad(72)) < 0.001);
  runtime.update(1);
  assert.ok(button.position.z < 0);
});

test("panel control runtime routes primary and level-bound auxiliary buttons", () => {
  const calls = [];
  const primary = { name: "Start", userData: { kind: "controlButton", controlLabel: "START", pressed: false } };
  const auxiliary = { name: "Lights", userData: { kind: "roomLightButton", pressed: false, levelBindings: [{ action: "toggleRoomLights" }] } };
  const runtime = new PanelControlRuntime({
    config: {}, knobs: [], buttons: [primary], auxiliaryButtons: [auxiliary], diagnostics: {}, onChanged: () => calls.push("changed"),
    playSound: (key) => calls.push(key), runAction: () => calls.push("action"), executeLevelBinding: (binding) => calls.push(binding.action),
    emitLevelEvent: (type, detail) => calls.push([type, detail.target]), log: () => {},
  });
  assert.equal(runtime.setControlButtonPressed(primary, true), true);
  assert.equal(runtime.setAuxiliaryButtonPressed(auxiliary, true), true);
  assert.deepEqual(calls, [
    "panelButtonLight",
    "action",
    ["buttonPressed", "Start"],
    "mechanicalButton",
    "toggleRoomLights",
    ["buttonPressed", "Lights"],
    "changed",
  ]);
  runtime.releaseAll();
  assert.equal(primary.userData.pressed, false);
  assert.equal(auxiliary.userData.pressed, false);
});

test("panel control runtime exposes simulation inputs from physical controls", () => {
  const knobs = [
    ["Control_Knob_FuelInjection", 35], ["Control_Knob_MagneticField", 60], ["Control_Knob_CoolantFlow", 45],
  ].map(([name, controlPercent]) => ({ name, userData: { controlPercent } }));
  const buttons = [
    { name: "Control_Btn_Vent", userData: { pressed: true } },
    { name: "Buttun_Reset", userData: { pressed: true } },
  ];
  const runtime = new PanelControlRuntime({
    config: {}, knobs, buttons, auxiliaryButtons: [], diagnostics: {}, onChanged() {},
  });
  const fuelBlend = { quality: 0.8 };
  const shiftProfile = { id: "high-load" };
  assert.deepEqual(runtime.getSimulationInputs({ fuelBlend, shiftProfile }), {
    fuelInjection: 35, magneticField: 60, coolantFlow: 45,
    ventActive: true, pulseActive: true, fuelBlend, shiftProfile,
  });
});

test("panel knob audio emits once for a burst of wheel adjustments", () => {
  let now = 1;
  const sounds = [];
  const knob = new THREE.Object3D();
  knob.name = "Fuel";
  knob.userData.controlPercent = 20;
  knob.userData.initialRotation = knob.rotation.clone();
  const runtime = new PanelControlRuntime({
    config: { controls: {} }, knobs: [knob], buttons: [], auxiliaryButtons: [],
    diagnostics: { getKnobSensitivity: () => 1, registerKnobMovement() {} },
    onChanged() {}, getTime: () => now, playSound: (...args) => sounds.push(args),
  });
  runtime.adjustKnob(knob, 1);
  now += 0.04;
  runtime.adjustKnob(knob, 2);
  now += 0.04;
  runtime.adjustKnob(knob, 4);
  assert.equal(sounds.length, 2);
  now += 0.15;
  runtime.adjustKnob(knob, 1);
  assert.equal(sounds.length, 3);
});
