import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveLevelAttemptPresentation,
  resolveCinematicQualityCommand,
  resolveForcedShiftOutcomeCommand,
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

test("dev console recognizes forced active-shift outcomes", () => {
  assert.equal(resolveForcedShiftOutcomeCommand("shift", ["pass"]), "complete");
  assert.equal(resolveForcedShiftOutcomeCommand("shift", ["fail"]), "failed");
  assert.equal(resolveForcedShiftOutcomeCommand("complete", ["intro-shift"]), null);
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

test("menu entry presents authored onboarding while shift restart stays fast", () => {
  assert.deepEqual(resolveLevelAttemptPresentation("menu"), {
    startTutorial: true,
    autoShowBriefing: true,
  });
  ["exploring-around", "unexpected-stuff", "fuel-problems"].forEach(() => {
    assert.deepEqual(resolveLevelAttemptPresentation("restart"), {
      startTutorial: false,
      autoShowBriefing: false,
    });
  });
});
