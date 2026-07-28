import assert from "node:assert/strict";
import test from "node:test";

import { chooseMenuMusic, MenuAudioRuntime } from "../src/audio/MenuAudioRuntime.js";
import { SOUND_REGISTRY } from "../src/audio/SoundRegistry.js";

test("menu music gives the rare loop an explicit one-in-twenty chance", () => {
  assert.equal(chooseMenuMusic({ random: () => 0.049 }), "Menu_Musical3_rare");
  const rolls = [0.5, 0];
  assert.equal(chooseMenuMusic({ previousKey: "Menu_Musical1", random: () => rolls.shift() }), "Menu_Musical2");
});

test("menu audio owns ambience and one stable music loop per menu visit", () => {
  const calls = [];
  const rolls = [0.5, 0, 0.5, 0];
  const runtime = new MenuAudioRuntime({
    audio: { setLoop: (...args) => calls.push(args) },
    random: () => rolls.shift(),
  });

  assert.equal(runtime.setActive(true), "Menu_Musical1");
  runtime.setActive(true);
  runtime.setActive(false);
  assert.equal(runtime.setActive(true), "Menu_Musical2");

  assert.deepEqual(calls, [
    ["Menu_Ambience1", true],
    ["Menu_Musical1", true],
    ["Menu_Ambience1", false],
    ["Menu_Musical1", false],
    ["Menu_Ambience1", true],
    ["Menu_Musical2", true],
  ]);
});

test("menu sound definitions use converted runtime OGG assets", () => {
  assert.equal(SOUND_REGISTRY.Menu_Ambience1.path, "assets/sounds/ambience/Menu_Ambience1.ogg");
  assert.equal(SOUND_REGISTRY.Menu_Musical3_rare.loop, true);
});
