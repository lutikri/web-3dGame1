import assert from "node:assert/strict";
import test from "node:test";

import { AudioRuntime } from "../src/audio/AudioRuntime.js";

test("audio runtime keeps the game mix silent throughout first-boot presentation", () => {
  const runtime = new AudioRuntime({ sounds: {}, masterVolume: 0.8, suspended: true });
  runtime.masterGain = { gain: { value: 1 } };

  runtime.setMasterVolume(1.2);
  assert.equal(runtime.masterGain.gain.value, 0);

  runtime.setSuspended(false);
  assert.equal(runtime.masterGain.gain.value, 1.2);
});
