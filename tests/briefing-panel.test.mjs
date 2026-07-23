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
  assert.equal(typeof panel.showSheet, "function");
  assert.equal(panel.isActive(), false);
});

test("briefing inspect hit test uses the rendered sheet rectangle", () => {
  const rect = { left: 10, right: 110, top: 20, bottom: 220 };
  assert.equal(isPointInsideRect(60, 100, rect), true);
  assert.equal(isPointInsideRect(5, 100, rect), false);
});

test("briefing panel reports a sheet when its image becomes visible", () => {
  const previousWindow = globalThis.window;
  globalThis.window = { clearTimeout() {}, setTimeout() {} };
  const shown = [];
  const classList = { add() {}, remove() {}, toggle() {} };
  const overlay = {
    hidden: true,
    classList,
    style: { setProperty() {} },
    getBoundingClientRect() { return {}; },
  };
  const image = { complete: false, removeAttribute() {} };
  const sheetFrame = { getBoundingClientRect() { return {}; } };
  const panel = createBriefingPanel({
    levels: { intro: { title: "Intro", briefingImage: "brief.png" } },
    root: { querySelector: (selector) => ({
      "#briefingOverlay": overlay,
      "#briefingSheetFrame": sheetFrame,
      "#briefingImage": image,
    })[selector] },
    getLanguage: () => "en",
    onSheetShown: (event) => shown.push(event),
  });

  assert.equal(panel.show("intro"), true);
  assert.deepEqual(shown, []);
  image.onload();
  assert.deepEqual(shown, [{ levelId: "intro", source: "brief.png" }]);
  globalThis.window = previousWindow;
});
