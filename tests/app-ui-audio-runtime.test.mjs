import assert from "node:assert/strict";
import test from "node:test";

import { createUiAudioInteractionRuntime, resolveUiAudioControl } from "../src/app/UiAudioInteractionRuntime.js";
import { SOUND_GROUPS, SOUND_REGISTRY } from "../src/audio/SoundRegistry.js";

test("app UI audio accepts enabled controls only inside the app overlay", () => {
  const control = { disabled: false, getAttribute: () => null };
  const target = { closest: () => control };
  assert.equal(resolveUiAudioControl({ contains: () => true }, target), control);
  assert.equal(resolveUiAudioControl({ contains: () => false }, target), null);
  control.disabled = true;
  assert.equal(resolveUiAudioControl({ contains: () => true }, target), null);
});

test("app UI hover sounds once per control and click remains immediate", () => {
  const calls = [];
  let unlocked = false;
  const controlA = { disabled: false, getAttribute: () => null };
  const controlB = { disabled: false, getAttribute: () => null };
  const runtime = createUiAudioInteractionRuntime({
    root: { contains: () => true },
    isAudioUnlocked: () => unlocked,
    playHover: () => calls.push("hover"),
    playClick: () => calls.push("click"),
  });
  const eventFor = (control) => ({ target: { closest: () => control } });

  runtime.handlePointerMove(eventFor(controlA));
  unlocked = true;
  runtime.handlePointerMove(eventFor(controlA));
  runtime.handlePointerMove(eventFor(controlB));
  runtime.handlePointerMove(eventFor(controlB));
  runtime.handleClick(eventFor(controlB));

  assert.deepEqual(calls, ["hover", "click"]);
});

test("menu UI sounds resolve to converted UI assets", () => {
  assert.deepEqual(SOUND_GROUPS.menuClick, ["Menu_Click1"]);
  assert.equal(SOUND_REGISTRY.Menu_Hover1.path, "assets/sounds/ui/Menu_Hover1.ogg");
  assert.equal(SOUND_REGISTRY.Menu_SetupComlete1.path, "assets/sounds/ui/Menu_SetupComlete1.ogg");
  assert.equal(SOUND_REGISTRY.Menu_Click1.volume, 0.76);
  assert.equal(SOUND_REGISTRY.Menu_Hover1.volume, 0.44);
});
