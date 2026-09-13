import assert from "node:assert/strict";
import test from "node:test";

import { createPausePanel, isGameplayPausePanel } from "../src/app/panels/PausePanel.js";

test("pause stays active in its settings child and clears outside gameplay", () => {
  const base = { levelId: "exploring-around", open: true, previousPanel: "main-menu" };
  assert.equal(isGameplayPausePanel({ ...base, panelName: "pause" }), true);
  assert.equal(isGameplayPausePanel({ ...base, panelName: "settings", previousPanel: "pause" }), true);
  assert.equal(isGameplayPausePanel({ ...base, panelName: "settings" }), false);
  assert.equal(isGameplayPausePanel({ ...base, panelName: "main-menu" }), false);
  assert.equal(isGameplayPausePanel({ ...base, panelName: "pause", open: false }), false);
  assert.equal(isGameplayPausePanel({ ...base, panelName: "pause", levelId: null }), false);
});

test("pause panel displays the frozen assignment and elapsed time", () => {
  const assignment = { textContent: "" };
  const elapsed = { textContent: "" };
  const panel = {
    style: { setProperty() {} },
    querySelector: (selector) => selector === "[data-pause-assignment]" ? assignment : elapsed,
  };
  const root = {
    querySelector: () => panel,
    defaultView: { innerWidth: 1920, innerHeight: 1080 },
  };
  const pausePanel = createPausePanel({
    root,
    gameApi: { getState: () => ({ levelSession: { elapsedSeconds: 102 } }) },
    levels: { qualification: { assignment: { titleKey: "qualification.title" } } },
    translate: () => "OPERATOR QUALIFICATION",
  });
  pausePanel.show("qualification");
  assert.equal(assignment.textContent, "OPERATOR QUALIFICATION");
  assert.equal(elapsed.textContent, "01:42");
});
