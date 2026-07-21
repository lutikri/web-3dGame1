import test from "node:test";
import assert from "node:assert/strict";

import { parseSrtSubtitles, findLevelRadioRuntime, findConfiguredNarrationLine } from "../src/audio/NarrationRuntime.js";

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
  const config = { levelEnvironments: { room: { narration: { welcome: { en: { soundKey: "English" }, ru: { soundKey: "Russian" } } } } } };
  assert.equal(findConfiguredNarrationLine(config, "room", "ru").soundKey, "Russian");
  assert.equal(findConfiguredNarrationLine(config, "room", "de").soundKey, "English");
});
