import test from "node:test";
import assert from "node:assert/strict";
import { PanelLampRuntime } from "../src/panels/PanelLampRuntime.js";

function createRuntime(overrides = {}) {
  const materials = { lampOff: "off", lampRed: "red", lampGreen: "green", lampAmber: "amber" };
  return new PanelLampRuntime({
    config: {
      feedback: {
        startup: { duration: 2 },
        startupFault: { resetSeconds: 3, greenLampSeconds: 1, redLampSeconds: 1 },
        indicatorTest: { duration: 3 },
        thermalEmergency: { lampFlickerFrequency: 10 },
        outputLow: { lampFlickerFrequency: 5 },
      },
    },
    materials,
    warningKeys: { TempLamp: "tempHigh" },
    diagnostics: {
      getBlackoutFactor: () => 1,
      getLampRuntimeOverride: () => null,
      getLampSelfTestOverride: () => null,
    },
    getIndicatorTimer: () => 0,
    getStartupTimer: () => 0,
    getTime: () => 0,
    flickerWave: () => 1,
    ...overrides,
  });
}

test("panel lamp runtime resolves demand, warning and terminal states", () => {
  const runtime = createRuntime();
  assert.equal(runtime.resolve(
    { name: "LightCase1_Light_UnderDemand" },
    { mode: "running", warning: { underDemandCritical: true } },
  ), "red");
  assert.equal(runtime.resolve(
    { name: "TempLamp" },
    { mode: "running", warning: { tempHigh: true } },
  ), "red");
  assert.equal(runtime.resolve(
    { name: "TempLamp" },
    { mode: "complete", terminalElapsed: 1, warning: {} },
  ), "off");
});

test("panel lamp runtime gives startup sequence precedence", () => {
  const runtime = createRuntime({ getStartupTimer: () => 1.9 });
  assert.equal(runtime.resolve({ name: "anything" }, { mode: "standby" }), "red");
});
