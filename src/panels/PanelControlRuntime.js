import * as THREE from "three";
import { applyAxisRotation } from "../scene/TransformUtils.js?v=inventory-runtime";

export class PanelControlRuntime {
  constructor({ config, knobs, buttons, auxiliaryButtons, diagnostics, onChanged, playSound = () => {}, getTime = () => performance.now() / 1000, runAction = () => {}, toggleRoomLights = () => {}, executeLevelBinding = () => {}, emitLevelEvent = () => {}, log = () => {} }) {
    this.config = config;
    this.knobs = knobs;
    this.buttons = buttons;
    this.auxiliaryButtons = auxiliaryButtons;
    this.diagnostics = diagnostics;
    this.onChanged = onChanged;
    Object.assign(this, { playSound, getTime, runAction, toggleRoomLights, executeLevelBinding, emitLevelEvent, log });
    this.lastKnobAdjustmentAt = -Infinity;
    this.knobTickStepPercent = 6;
  }

  getPercent = (name) => this.knobs.find((knob) => knob.name === name)?.userData.controlPercent ?? 0;

  isPressed = (name) => Boolean(this.buttons.find((button) => button.name === name)?.userData.pressed);

  getSimulationInputs = ({ fuelBlend = null, shiftProfile = null } = {}) => ({
    fuelInjection: this.getPercent("Control_Knob_FuelInjection"),
    magneticField: this.getPercent("Control_Knob_MagneticField"),
    coolantFlow: this.getPercent("Control_Knob_CoolantFlow"),
    ventActive: this.isPressed("Control_Btn_Vent"),
    pulseActive: this.isPressed("Control_Btn_Reset") || this.isPressed("Buttun_Reset"),
    fuelBlend,
    shiftProfile,
  });

  update = (dt) => {
    [...this.buttons, ...this.auxiliaryButtons].forEach((button) => {
      button.userData.pressProgress = THREE.MathUtils.damp(
        button.userData.pressProgress ?? 0,
        button.userData.pressed ? 1 : 0,
        button.userData.pressSpeed ?? 16,
        dt,
      );
      this.applyButtonTransform(button);
    });
  };

  applyButtonTransform(button) {
    const distance = button.userData.pressDistance * (button.userData.pressProgress ?? 0);
    button.position.copy(button.userData.initialPosition);
    applyPositionOffset(button, button.userData.pressAxis, distance);
  }

  adjustKnob = (knob, deltaPercent) => {
    const current = knob.userData.controlPercent ?? 0;
    const effectiveDelta = deltaPercent * this.diagnostics.getKnobSensitivity(knob.name);
    const next = THREE.MathUtils.clamp(current + effectiveDelta, 0, 100);
    if (next === current) return false;
    knob.userData.controlPercent = next;
    this.diagnostics.registerKnobMovement(knob.name, deltaPercent);
    this.applyKnobTransform(knob);
    const now = this.getTime();
    const startsGesture = now - this.lastKnobAdjustmentAt >= 0.14;
    const tickAnchor = knob.userData.knobTickAnchorPercent;
    const crossedTickStep = Number.isFinite(tickAnchor)
      && Math.abs(next - tickAnchor) >= this.knobTickStepPercent;
    if (startsGesture || crossedTickStep) {
      this.playSound("panelKnobTick", knob);
      knob.userData.knobTickAnchorPercent = next;
    }
    this.lastKnobAdjustmentAt = now;
    this.onChanged();
    return true;
  };

  applyKnobTransform = (knob) => {
    const percent = knob.userData.controlPercent ?? 0;
    const dialPercent = THREE.MathUtils.lerp(
      this.config.controls.knobValue0DialPercent ?? 0,
      this.config.controls.knobValue100DialPercent ?? 100,
      percent / 100,
    );
    const angle = THREE.MathUtils.degToRad(this.config.controls.knobDialDegrees ?? 360) * (dialPercent / 100);
    knob.rotation.copy(knob.userData.initialRotation);
    applyAxisRotation(knob, this.config.controls.knobRotationAxis, angle);
  };

  setControlButtonPressed = (button, pressed) => {
    if (!button || button.userData.kind !== "controlButton" || button.userData.pressed === pressed) return false;
    button.userData.pressed = pressed;
    if (pressed) {
      this.playSound("panelButtonLight");
      this.runAction(button);
      this.emitLevelEvent("buttonPressed", { target: button.name });
    }
    this.log(`[OperatorGame] ${button.userData.controlLabel} ${pressed ? "PRESSED" : "RELEASED"}`);
    return true;
  };

  setAuxiliaryButtonPressed = (button, pressed) => {
    if (!button || button.userData.kind !== "roomLightButton" || button.userData.pressed === pressed) return false;
    button.userData.pressed = pressed;
    if (!pressed) return true;
    this.playSound("mechanicalButton");
    const bindings = button.userData.levelBindings ?? [];
    if (bindings.length === 0) this.toggleRoomLights();
    else {
      bindings.forEach(this.executeLevelBinding);
      this.emitLevelEvent("buttonPressed", { target: button.name });
      this.onChanged();
    }
    return true;
  };

  releaseAll = () => {
    this.buttons.forEach((button) => this.setControlButtonPressed(button, false));
    this.auxiliaryButtons.forEach((button) => this.setAuxiliaryButtonPressed(button, false));
  };
}

function applyPositionOffset(object, axis, distance) {
  if (axis === "x") object.position.x += distance;
  else if (axis === "z") object.position.z += distance;
  else object.position.y += distance;
}
