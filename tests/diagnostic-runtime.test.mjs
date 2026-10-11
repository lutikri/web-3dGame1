import assert from "node:assert/strict";
import test from "node:test";

import { DiagnosticRuntime } from "../src/incidents/DiagnosticRuntime.js";

test("conditional light-panel trip waits for critical temperature after its timeline threshold", () => {
  const runtime = new DiagnosticRuntime({
    config: {
      diagnostics: {
        timeline: [{
          id: "critical-temperature-lighting-trip",
          type: "lightPanelTrip",
          atSeconds: 110,
          when: { modes: ["running"], warning: "tempCritical" },
        }],
      },
    },
  });
  runtime.reset();
  runtime.startTimeline();

  runtime.update(110, { mode: "running", warning: { tempCritical: false } });
  assert.equal(runtime.consumeLightPanelTripRequest(), null);

  runtime.update(0.1, { mode: "running", warning: { tempCritical: true } });
  assert.deepEqual(runtime.consumeLightPanelTripRequest(), {
    prefabName: undefined,
    circuitNames: undefined,
  });

  runtime.update(10, { mode: "running", warning: { tempCritical: true } });
  assert.equal(runtime.consumeLightPanelTripRequest(), null);
});
