import test from "node:test";
import assert from "node:assert/strict";
import {
  getShiftResultsCopyKeys,
  getShiftResultsScale,
  ShiftResultsController,
} from "../src/ui/ShiftResultsController.js";

function createElement() {
  const classes = new Set();
  const styles = new Map();
  return {
    hidden: true, textContent: "", innerHTML: "", children: [],
    classList: {
      add: (name) => classes.add(name), remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    style: { setProperty: (name, value) => styles.set(name, value), getPropertyValue: (name) => styles.get(name) },
    appendChild(item) { this.children.push(item); },
  };
}

test("shift results controller renders report and owns visibility", () => {
  const elements = Object.fromEntries([
    "#resultsOverlay", "#resultsOutcome", "#resultsProfile", "#resultsSummary", "#resultsStats",
    "#resultsShiftIdentity", "#resultsShiftTime", "#resultsComplianceValue", "#resultsComplianceBar",
    "#resultsPhaseValue", "#resultsPhaseSegments", "#resultsKeyMetrics", "#resultsOperatorComment",
  ].map((key) => [key, createElement()]));
  const events = [];
  const body = createElement();
  const documentRef = {
    body, querySelector: (key) => elements[key], createElement,
    exitPointerLock: () => {},
  };
  let enteredReportView = false;
  let report = { profileId: "operator", failureReasons: [], stats: [
    ["results.stats.shiftTime", "3:00"], ["results.stats.gridCompliance", "87%"],
    ["results.stats.phasesPassed", "4 / 4"], ["results.stats.stability", "results.status.acceptable"],
    ["results.stats.warningEvents", "3"], ["results.stats.criticalEvents", "0"],
    ["results.stats.emergencyInterventions", "0"],
    ["results.stats.maxCoreStress", "42%"],
  ] };
  const controller = new ShiftResultsController({
    documentRef,
    windowRef: {
      innerWidth: 2833, innerHeight: 1351,
      dispatchEvent: (event) => events.push(event), setTimeout: (callback) => callback(),
      addEventListener() {}, removeEventListener() {},
    },
    translate: (key) => key,
    buildReport: () => report,
    getRecorder: () => ({}), getContext: () => ({ levelId: "level", mode: "shift" }),
    releaseControls: () => {}, clearZoom: () => {},
    enterReportView: () => { enteredReportView = true; },
    createEvent: (type, init) => ({ type, ...init }),
  });
  controller.show({ mode: "complete" });
  assert.equal(controller.visible, true);
  assert.equal(enteredReportView, true);
  assert.equal(elements["#resultsOverlay"].hidden, false);
  assert.equal(elements["#resultsProfile"].textContent, "results.title.qualification.complete");
  assert.equal(elements["#resultsSummary"].textContent, "results.summary.qualification.complete");
  assert.equal(elements["#resultsOperatorComment"].textContent, "results.comment.qualification.complete");
  assert.equal(elements["#resultsStats"].children.length, 4);
  assert.equal(elements["#resultsKeyMetrics"].children.length, 2);
  assert.equal(elements["#resultsPhaseSegments"].children.length, 4);
  assert.equal(elements["#resultsComplianceBar"].style.getPropertyValue("--results-compliance"), "87%");
  assert.equal(
    elements["#resultsOverlay"].style.getPropertyValue("--shift-report-scale"),
    String(1351 / 1080),
  );
  assert.equal(body.classList.contains("shift-results-open"), true);
  assert.equal(events[0].detail.levelId, "level");
  controller.hide({ immediate: true });
  assert.equal(controller.visible, false);
  assert.equal(elements["#resultsOverlay"].hidden, true);
  assert.equal(body.classList.contains("shift-results-open"), false);

  report = { ...report, failureReasons: ["gridCompliance", "phaseTracking"] };
  controller.show({ mode: "failed" });
  assert.equal(
    elements["#resultsOperatorComment"].textContent,
    "results.failure.gridCompliance results.failure.phaseTracking",
  );
});

test("shift report uses the same fixed 1920x1080 fit scale as settings", () => {
  assert.equal(getShiftResultsScale(1920, 1080), 1);
  assert.equal(getShiftResultsScale(3440, 1440), 1440 / 1080);
  assert.equal(getShiftResultsScale(1280, 1024), 1280 / 1920);
});

test("shift report copy follows the active assignment instead of always describing qualification", () => {
  assert.deepEqual(getShiftResultsCopyKeys("exploring-around", "complete"), {
    title: "results.title.qualification.complete",
    summary: "results.summary.qualification.complete",
    comment: "results.comment.qualification.complete",
  });
  assert.deepEqual(getShiftResultsCopyKeys("unexpected-stuff", "complete"), {
    title: "results.title.reliability.complete",
    summary: "results.summary.reliability.complete",
    comment: "results.comment.reliability.complete",
  });
  assert.deepEqual(getShiftResultsCopyKeys("fuel-problems", "failed"), {
    title: "results.title.cost.failed",
    summary: "results.summary.cost.failed",
    comment: "results.comment.cost.failed",
  });
});
