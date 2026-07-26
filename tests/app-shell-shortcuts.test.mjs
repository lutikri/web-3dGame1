import test from "node:test";
import assert from "node:assert/strict";

import { resolvePauseShortcutAction } from "../src/app/AppShell.js";

test("pause shortcut cannot close menu and mail panels", () => {
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "main-menu" }), null);
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "level-select" }), null);
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "credits" }), null);
});

test("pause shortcut only toggles gameplay pause and its settings child", () => {
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "pause" }), "resume");
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "settings", previousPanel: "pause" }), "back");
  assert.equal(resolvePauseShortcutAction({ panelOpen: true, currentPanel: "settings", previousPanel: "main-menu" }), null);
  assert.equal(resolvePauseShortcutAction({ panelOpen: false, activeGameplayLevelId: "exploring-around" }), "pause");
  assert.equal(resolvePauseShortcutAction({ panelOpen: false, activeGameplayLevelId: null }), null);
});
