import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveCinematicQualityCommand,
  resolvePauseShortcutAction,
  shouldAutoShowLevelBriefing,
} from "../src/app/AppShell.js";

test("pause shortcut cannot close menu and mail panels", () => {
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "main-menu" }), null);
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "level-select" }), null);
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "credits" }), null);
});

test("dev console recognizes cinematic post-processing quality commands", () => {
  assert.equal(resolveCinematicQualityCommand("cinematic", ["max"]), "max");
  assert.equal(resolveCinematicQualityCommand("quality", ["cinematic", "med"]), "med");
  assert.equal(resolveCinematicQualityCommand("levels", []), null);
});

test("pause shortcut only toggles gameplay pause and its settings child", () => {
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "pause" }), "resume");
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "settings", previousPanel: "pause" }), "back");
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "settings", previousPanel: "main-menu" }), null);
  assert.equal(resolvePauseShortcutAction({ panelOpen: false, activeGameplayLevelId: "exploring-around" }), "pause");
  assert.equal(resolvePauseShortcutAction({ panelOpen: false, activeGameplayLevelId: null }), null);
});

test("level briefing auto-show can be disabled without removing the authored document", () => {
  const levels = {
    physicalOnly: { autoShowBriefing: false, briefingImage: { en: ["brief.png"] } },
    legacy: { briefingImage: { en: ["legacy.png"] } },
  };
  assert.equal(shouldAutoShowLevelBriefing(levels, "physicalOnly"), false);
  assert.equal(shouldAutoShowLevelBriefing(levels, "legacy"), true);
});
