import test from "node:test";
import assert from "node:assert/strict";

import {
  createNarrationRuntime,
  parseSrtSubtitles,
  findLevelRadioRuntime,
  findLevelRadioRuntimes,
  findConfiguredNarrationLine,
} from "../src/audio/NarrationRuntime.js";

test("narration runtime parses SRT cues into scheduled subtitles", () => {
  assert.deepEqual(
    parseSrtSubtitles("1\r\n00:00:01,250 --> 00:00:03,500\r\nFirst line\r\ncontinued\r\n\r\n2\r\n00:00:04.000 --> 00:00:05.000\r\nSecond"),
    [
      { at: 1.25, duration: 2.25, text: "First line continued" },
      { at: 4, duration: 1, text: "Second" },
    ],
  );
});

test("narration runtime resolves radio ownership and localized configured lines", () => {
  const radio = { radio: {} };
  assert.equal(findLevelRadioRuntime(new Map([["room:Radio", radio], ["other:Radio", { radio: {} }]]), "room"), radio);
  assert.equal(findLevelRadioRuntimes(new Map([["room:A", radio], ["room:B", { radio: {} }]]), "room").length, 2);
  const config = { levelEnvironments: { room: { narration: { welcome: { en: { soundKey: "English" }, ru: { soundKey: "Russian" } } } } } };
  assert.equal(findConfiguredNarrationLine(config, "room", "ru").soundKey, "Russian");
  assert.equal(findConfiguredNarrationLine(config, "room", "de").soundKey, "English");
});

test("event narration interrupts ambient random speech and takes priority", async () => {
  const originalWindow = globalThis.window;
  const timers = [];
  globalThis.window = {
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
  };
  try {
    const started = [];
    const stopped = [];
    const runtime = createNarrationRuntime({
      getActiveLevelId: () => "room",
      isPlaybackAllowed: () => true,
      prefabInstances: new Map([["room:Radio", { root: { uuid: "radio" }, radio: {} }]]),
      config: {
        levelEnvironments: {
          room: { narration: { event: { en: { soundKey: "Event", duration: 2 } } } },
        },
      },
      getLanguage: () => "en",
      playLine: (_runtime, line, _levelId, token) => started.push([line.soundKey, token]),
      stopLine: (playback) => stopped.push(playback),
      startRadioSpeech: () => {},
      resetRadio: () => {},
    });

    await runtime.playRandomNarration("ambient", { soundKey: "Ambient", duration: 2 }, "room");
    assert.equal(runtime.isPlaying(), true);
    await runtime.playNarration("event", "room");

    assert.equal(stopped.length, 1);
    assert.equal(stopped[0].priority, "random");
    assert.deepEqual(started.map(([soundKey]) => soundKey), ["Ambient", "Event"]);
  } finally {
    globalThis.window = originalWindow;
  }
});
