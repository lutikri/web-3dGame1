import test from "node:test";
import assert from "node:assert/strict";

import { createBriefingPanel, isPointInsideRect } from "../src/app/panels/BriefingPanel.js";

test("briefing panel resolves localized sheets without owning level routing", () => {
  const panel = createBriefingPanel({
    levels: {
      intro: { briefingImage: { en: "brief-en.png", ru: ["brief-ru-1.png", "brief-ru-2.png"] } },
    },
    root: { querySelector: () => null },
    getLanguage: () => "ru",
  });
  assert.deepEqual(panel.getSheets("intro"), ["brief-ru-1.png", "brief-ru-2.png"]);
  assert.equal(panel.isActive(), false);
});

test("briefing inspect hit test uses the rendered sheet rectangle", () => {
  const rect = { left: 10, right: 110, top: 20, bottom: 220 };
  assert.equal(isPointInsideRect(60, 100, rect), true);
  assert.equal(isPointInsideRect(5, 100, rect), false);
});
