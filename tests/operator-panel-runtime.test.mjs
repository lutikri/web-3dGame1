import test from "node:test";
import assert from "node:assert/strict";
import { OperatorPanelRuntime } from "../src/panels/OperatorPanelRuntime.js";

test("operator panel runtime composes one simulation and presentation tick", () => {
  const calls = [];
  let snapshot = { mode: "running", elapsed: 1, ignitionPulseCount: 0 };
  const needle = { userData: {}, rotation: {} };
  const lamp = { userData: { initialScale: { marker: true } }, scale: { copy: () => calls.push("lamp-scale") } };
  const runtime = new OperatorPanelRuntime({
    load: () => {}, reset: () => {}, applyLevel: () => {}, hasModel: () => true,
    tick: {
      simulation: { update: () => ({ mode: "running", elapsed: 2, ignitionPulseCount: 1 }) },
      fuelBlend: { update: () => "blend" },
      diagnostics: {
        update: () => calls.push("diagnostics"),
        consumeLightRestartRequest: () => false,
        createSelfTestSnapshot: (value) => value,
        getBlackoutFactor: () => 1,
      },
      statusScreen: {
        setSnapshot: () => calls.push("screen"), setPowerFactor: () => {}, update: () => {},
      },
      controls: { update: () => calls.push("controls") },
      gauges: { update: () => calls.push("gauge"), applyRotation: () => {} },
      lampResolver: { resolve: () => "red" },
      needles: [needle], lamps: [lamp],
      getSnapshot: () => snapshot,
      setSnapshot: (value) => { snapshot = value; },
      getControlInputs: () => ({}),
      getPresentationSnapshot: (value) => value,
      areNeedlesFrozen: () => false,
      onIgnitionPulse: () => calls.push("pulse"),
      onLightRestart: () => {},
      updateThoughts: () => {}, updateRecorder: () => {}, updateCompletion: () => {},
    },
  });
  runtime.update(0.1);
  assert.equal(snapshot.elapsed, 2);
  assert.equal(lamp.material, "red");
  assert.deepEqual(calls, ["pulse", "diagnostics", "screen", "controls", "gauge", "lamp-scale"]);
});
