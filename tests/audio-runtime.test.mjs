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

test("audio runtime can stop selected attached one-shots immediately", () => {
  const runtime = new AudioRuntime({ sounds: {} });
  const stopped = [];
  runtime.stopOneShotState = (state) => stopped.push(state.id);
  runtime.attachedOneShots.set("alarm", { id: "alarm" });
  runtime.attachedOneShots.set("narration", { id: "narration" });

  assert.equal(runtime.stopAttachedOneShots((state) => state.id === "alarm"), 1);
  assert.deepEqual(stopped, ["alarm"]);
  assert.equal(runtime.attachedOneShots.has("alarm"), false);
  assert.equal(runtime.attachedOneShots.has("narration"), true);
});

test("audio runtime drops blocked scene one-shots instead of queueing them behind presentation mute", () => {
  const runtime = new AudioRuntime({
    sounds: { lamp: { path: "lamp.ogg" } },
    groups: { lampGroup: ["lamp"] },
    blockedScopes: ["scene"],
  });
  runtime.getContext = () => {
    throw new Error("blocked audio must not create an AudioContext");
  };

  assert.equal(runtime.play("lamp", { scope: "scene" }), null);
  assert.equal(runtime.playAttached({}, "lamp", null, { scope: "scene" }), null);
  assert.equal(runtime.playRandom("lampGroup", { scope: "scene" }), null);
  assert.equal(runtime.playRandomAttached({}, "lampGroup", null, { scope: "scene" }), null);
  assert.equal(runtime.attachedOneShots.size, 0);
  assert.equal(runtime.lastGroupChoice.size, 0);
  assert.deepEqual(runtime.getDebugState().blockedScopes, ["scene"]);
});

test("blocking a scene scope stops already active attached scene one-shots", () => {
  const runtime = new AudioRuntime({ sounds: {} });
  const stopped = [];
  runtime.stopOneShotState = (state) => stopped.push(state.id);
  runtime.attachedOneShots.set("scene", { id: "scene", scope: "scene" });
  runtime.attachedOneShots.set("ui", { id: "ui", scope: null });

  assert.equal(runtime.setScopeBlocked("scene", true), true);
  assert.deepEqual(stopped, ["scene"]);
  assert.equal(runtime.attachedOneShots.has("scene"), false);
  assert.equal(runtime.attachedOneShots.has("ui"), true);
  assert.equal(runtime.setScopeBlocked("scene", false), false);
});

test("audio debug state combines active voices with sounds played during the recent window", () => {
  let now = 1_000;
  const runtime = new AudioRuntime({
    sounds: {
      click: { path: "assets/sounds/ui/click.ogg", volume: 0.5 },
      hum: { path: "assets/sounds/machinery/hum.ogg", volume: 0.2 },
    },
    now: () => now,
    recentSeconds: 8,
  });

  runtime.recordPlayback("click", "one-shot");
  runtime.loops.set("hum", { soundKey: "hum", source: {}, levelId: null });
  let recent = runtime.getDebugState().recentSounds;
  assert.deepEqual(recent.map(({ soundKey }) => soundKey), ["hum", "click"]);
  assert.equal(recent[0].activeVoices, 1);
  assert.equal(recent[1].recentPlays, 1);

  now = 9_100;
  recent = runtime.getDebugState().recentSounds;
  assert.deepEqual(recent.map(({ soundKey }) => soundKey), ["hum"]);
});

test("live sound config refresh updates voices that inherit registry volume", () => {
  const sounds = { hum: { path: "assets/sounds/machinery/hum.ogg", volume: 0.2 } };
  const runtime = new AudioRuntime({ sounds });
  runtime.loops.set("hum", {
    soundKey: "hum",
    active: true,
    baseVolume: 0.2,
    currentVolume: 0.2,
    targetVolume: 0.2,
    gain: { gain: { value: 0.2 } },
  });

  sounds.hum.volume = 0.65;
  runtime.refreshSoundConfig("hum");

  assert.equal(runtime.loops.get("hum").baseVolume, 0.65);
  assert.equal(runtime.loops.get("hum").targetVolume, 0.65);
});

test("saved sound volume acts as a trim for runtime-authored dynamic volume", () => {
  const sound = { path: "assets/sounds/machinery/hum.ogg", volume: 0.2 };
  Object.defineProperty(sound, "__defaultVolume", { value: 0.2 });
  const runtime = new AudioRuntime({ sounds: { hum: sound } });
  runtime.loops.set("hum", {
    soundKey: "hum",
    active: true,
    authoredVolume: 0.1,
    baseVolume: 0.1,
    currentVolume: 0.1,
    targetVolume: 0.1,
    gain: null,
  });

  sound.volume = 0.3;
  runtime.refreshSoundConfig("hum");

  assert.equal(runtime.loops.get("hum").baseVolume, 0.15);
  assert.equal(runtime.loops.get("hum").targetVolume, 0.15);
});
