import assert from "node:assert/strict";
import test from "node:test";

import { RandomSpeechRuntime } from "../src/audio/RandomSpeechRuntime.js";

test("random speech selects eligible weighted lines and respects cooldowns and recent history", async () => {
  let elapsed = 40;
  const played = [];
  const runtime = new RandomSpeechRuntime({
    getActiveLevelId: () => "unexpected-stuff",
    getLevelConfig: () => ({
      narration: {
        randomSpeech: {
          enabled: true,
          checkIntervalSeconds: 1,
          chance: 1,
          cooldownRangeSeconds: [50, 50],
          recentHistorySize: 2,
          lines: [
            {
              id: "eligible",
              shift: "unexpected-stuff",
              minTime: 30,
              maxTime: 70,
              weight: 1,
              cooldown: 80,
              once: true,
              reactor: { modes: ["running"] },
              en: { soundKey: "Eligible", duration: 1 },
            },
            {
              id: "wrong-shift",
              shift: "other-shift",
              weight: 99,
              en: { soundKey: "WrongShift", duration: 1 },
            },
          ],
        },
      },
    }),
    getShiftElapsed: () => elapsed,
    getCoreSnapshot: () => ({ mode: "running" }),
    getLanguage: () => "en",
    isPlaybackAllowed: () => true,
    isNarrationActive: () => false,
    playNarration: async (id, line) => {
      played.push([id, line.soundKey]);
      return line;
    },
    random: () => 0,
  });

  runtime.update(1);
  await Promise.resolve();
  assert.deepEqual(played, [["eligible", "Eligible"]]);

  elapsed = 100;
  runtime.update(1);
  await Promise.resolve();
  assert.equal(played.length, 1);
});

test("random speech waits while authored narration is active", async () => {
  let playCalls = 0;
  const runtime = new RandomSpeechRuntime({
    getActiveLevelId: () => "unexpected-stuff",
    getLevelConfig: () => ({
      narration: {
        randomSpeech: {
          enabled: true,
          checkIntervalSeconds: 1,
          chance: 1,
          lines: [{ id: "line", weight: 1, en: { soundKey: "Line", duration: 1 } }],
        },
      },
    }),
    getShiftElapsed: () => 60,
    getCoreSnapshot: () => ({ mode: "running" }),
    isPlaybackAllowed: () => true,
    isNarrationActive: () => true,
    playNarration: async () => { playCalls += 1; return true; },
    random: () => 0,
  });

  runtime.update(1);
  await Promise.resolve();
  assert.equal(playCalls, 0);
});

test("random speech never falls back to Russian while the game is in English", async () => {
  const played = [];
  const runtime = new RandomSpeechRuntime({
    getActiveLevelId: () => "unexpected-stuff",
    getLevelConfig: () => ({
      narration: {
        randomSpeech: {
          enabled: true,
          checkIntervalSeconds: 1,
          chance: 1,
          lines: [{ id: "ru-only", weight: 1, ru: { soundKey: "RussianLine", duration: 1 } }],
        },
      },
    }),
    getShiftElapsed: () => 60,
    getCoreSnapshot: () => ({ mode: "running" }),
    getLanguage: () => "en-US",
    playNarration: async (...args) => { played.push(args); return true; },
    random: () => 0,
  });

  runtime.update(1);
  await Promise.resolve();
  assert.deepEqual(played, []);
});
