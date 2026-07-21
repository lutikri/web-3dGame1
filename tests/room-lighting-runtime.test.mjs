import test from "node:test";
import assert from "node:assert/strict";
import { RoomLightingRuntime } from "../src/lighting/RoomLightingRuntime.js";

function createRuntime() {
  let time = 0;
  const events = [];
  const runtime = new RoomLightingRuntime({
    config: {
      interior: { lightToggleButton: { initialOn: true, fadeSeconds: 0.3 } },
      feedback: { roomLightSwitch: {
        afterglowSeconds: 3, afterglowInitialFactor: 0.2, afterglowExponent: 2,
        abuseWindowSeconds: 4, abuseToggleCount: 3, starterFaultSeconds: 5,
      } },
    },
    getTime: () => time,
    createStartupPattern: () => [{ duration: 1, value: 1 }],
    getStartupDuration: () => 1,
    getStartupFactor: (_pattern, elapsed) => elapsed,
    getStarterFaultFactor: () => 0.25,
    playTurnOn: () => events.push("sound"),
    onVisualChanged: () => events.push("visual"),
    onStateChanged: () => events.push("state"),
  });
  return { runtime, events, setTime: (value) => { time = value; } };
}

test("room lighting runtime owns fade, afterglow and starter-fault state", () => {
  const { runtime, setTime } = createRuntime();
  runtime.setEnabled(false);
  assert.equal(runtime.state.enabled, false);
  assert.ok(runtime.getAfterglowFactor() > 0);
  runtime.setEnabled(true);
  assert.equal(runtime.state.switchMode, "on");
  setTime(1);
  runtime.toggle();
  runtime.toggle();
  runtime.toggle();
  assert.equal(runtime.state.switchMode, "fault");
  assert.equal(runtime.state.starterFaultTimer, 5);
  runtime.update(1);
  assert.equal(runtime.state.currentFactor, 0.25);
});
