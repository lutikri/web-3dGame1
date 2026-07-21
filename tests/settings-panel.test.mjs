import test from "node:test";
import assert from "node:assert/strict";

import { createSettingsPanel, qualityLabel } from "../src/app/panels/SettingsPanel.js";

test("settings panel applies normalized settings through the game API", () => {
  const calls = [];
  const panel = createSettingsPanel({
    settings: {
      fov: 75,
      uiScale: 110,
      shadowQuality: "med",
      gtaoQuality: "off",
      ssgiQuality: "off",
      ssrQuality: "off",
      screenSpaceShadowQuality: "off",
      sensitivity: 120,
    },
    gameApi: {
      setBaseFov: (value) => calls.push(["fov", value]),
      setMouseSensitivity: (value) => calls.push(["sensitivity", value]),
    },
    save: () => {},
    root: { querySelector: () => null },
    body: { style: { setProperty: (key, value) => calls.push([key, value]) } },
  });
  panel.apply();
  assert.ok(calls.some(([key, value]) => key === "fov" && value === 75));
  assert.ok(calls.some(([key, value]) => key === "sensitivity" && value === 1.2));
  assert.equal(qualityLabel("med"), "MED");
});
