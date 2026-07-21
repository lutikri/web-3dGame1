import test from "node:test";
import assert from "node:assert/strict";
import { ShiftResultsController } from "../src/ui/ShiftResultsController.js";

function createElement() {
  const classes = new Set();
  return {
    hidden: true, textContent: "", innerHTML: "", children: [],
    classList: {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    appendChild(item) { this.children.push(item); },
  };
}

test("shift results controller renders report and owns visibility", () => {
  const elements = Object.fromEntries([
    "#resultsOverlay", "#resultsOutcome", "#resultsProfile", "#resultsSummary", "#resultsStats",
  ].map((key) => [key, createElement()]));
  const events = [];
  const documentRef = {
    querySelector: (key) => elements[key], createElement,
    exitPointerLock: () => {},
  };
  const controller = new ShiftResultsController({
    documentRef,
    windowRef: { dispatchEvent: (event) => events.push(event), setTimeout: (callback) => callback() },
    translate: (key) => key,
    buildReport: () => ({ profileId: "operator", stats: [["score", "10"]] }),
    getRecorder: () => ({}), getContext: () => ({ levelId: "level", mode: "shift" }),
    releaseControls: () => {}, clearZoom: () => {},
    createEvent: (type, init) => ({ type, ...init }),
  });
  controller.show({ mode: "complete" });
  assert.equal(controller.visible, true);
  assert.equal(elements["#resultsOverlay"].hidden, false);
  assert.equal(elements["#resultsStats"].children.length, 1);
  assert.equal(events[0].detail.levelId, "level");
  controller.hide({ immediate: true });
  assert.equal(controller.visible, false);
  assert.equal(elements["#resultsOverlay"].hidden, true);
});
