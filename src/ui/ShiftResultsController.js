const PERFORMANCE_KEYS = [
  "results.stats.stability",
  "results.stats.warningEvents",
  "results.stats.criticalEvents",
  "results.stats.emergencyInterventions",
];

const KEY_METRIC_KEYS = [
  "results.stats.shiftTime",
  "results.stats.maxCoreStress",
  "results.stats.maxTemp",
  "results.stats.avgOutput",
  "results.stats.maxOutput",
];

const REPORT_COPY_FAMILY_BY_LEVEL = Object.freeze({
  "intro-shift": "qualification",
  "exploring-around": "qualification",
  "unexpected-stuff": "reliability",
  "fuel-problems": "cost",
  freeplay: "freeplay",
});

export class ShiftResultsController {
  constructor({ documentRef = document, windowRef = window, translate, buildReport, getRecorder, getContext, releaseControls, clearZoom, enterReportView = () => false, createEvent = (type, init) => new CustomEvent(type, init) }) {
    this.document = documentRef;
    this.window = windowRef;
    this.translate = translate;
    this.buildReport = buildReport;
    this.getRecorder = getRecorder;
    this.getContext = getContext;
    this.releaseControls = releaseControls;
    this.clearZoom = clearZoom;
    this.enterReportView = enterReportView;
    this.createEvent = createEvent;
    this.overlay = documentRef.querySelector("#resultsOverlay");
    this.outcome = documentRef.querySelector("#resultsOutcome");
    this.profile = documentRef.querySelector("#resultsProfile");
    this.summary = documentRef.querySelector("#resultsSummary");
    this.stats = documentRef.querySelector("#resultsStats");
    this.shiftIdentity = documentRef.querySelector("#resultsShiftIdentity");
    this.shiftTime = documentRef.querySelector("#resultsShiftTime");
    this.complianceValue = documentRef.querySelector("#resultsComplianceValue");
    this.complianceBar = documentRef.querySelector("#resultsComplianceBar");
    this.phaseValue = documentRef.querySelector("#resultsPhaseValue");
    this.phaseSegments = documentRef.querySelector("#resultsPhaseSegments");
    this.keyMetrics = documentRef.querySelector("#resultsKeyMetrics");
    this.operatorComment = documentRef.querySelector("#resultsOperatorComment");
    this.visible = false;
    this.scaleWired = false;
  }

  show = (snapshot) => {
    this.document.exitPointerLock?.();
    this.clearZoom();
    this.releaseControls();
    const report = this.buildReport(this.getRecorder(), snapshot);
    const context = this.getContext();
    const stats = new Map(report.stats);
    const copyKeys = getShiftResultsCopyKeys(context.levelId, snapshot.mode);
    this.enterReportView();
    if (this.outcome) this.outcome.textContent = this.translate(
      snapshot.mode === "complete" ? "results.outcome.complete" : "results.outcome.failed",
    );
    if (this.profile) this.profile.textContent = this.translate(copyKeys.title);
    if (this.summary) this.summary.textContent = this.translate(copyKeys.summary);
    if (this.shiftIdentity) this.shiftIdentity.textContent = this.translate(`results.shift.${context.levelId}`);
    if (this.shiftTime) this.shiftTime.textContent = this.translate(`results.schedule.${context.levelId}`);
    this.renderCompliance(stats.get("results.stats.gridCompliance"));
    this.renderPhases(stats.get("results.stats.phasesPassed"));
    this.renderRows(this.stats, PERFORMANCE_KEYS, stats);
    this.renderRows(this.keyMetrics, KEY_METRIC_KEYS, stats);
    if (this.operatorComment) this.operatorComment.textContent = snapshot.mode === "complete"
      ? this.translate(copyKeys.comment)
      : report.failureReasons.map((reason) => this.translate(`results.failure.${reason}`)).join(" ");
    if (this.overlay) {
      this.updateScale();
      if (!this.scaleWired) {
        this.window.addEventListener?.("resize", this.updateScale);
        this.scaleWired = true;
      }
      this.overlay.hidden = false;
      this.overlay.classList.add("is-visible");
    }
    this.document.body?.classList?.add("shift-results-open");
    this.visible = true;
    this.window.dispatchEvent(this.createEvent("operatorgame:shift-results", {
      detail: { ...context, snapshot, report },
    }));
    return report;
  };

  hide = ({ immediate = false } = {}) => {
    if (!this.overlay) return;
    this.overlay.classList.remove("is-visible");
    if (this.scaleWired) {
      this.window.removeEventListener?.("resize", this.updateScale);
      this.scaleWired = false;
    }
    this.document.body?.classList?.remove("shift-results-open");
    if (immediate) this.overlay.hidden = true;
    else this.window.setTimeout(() => {
      if (!this.overlay.classList.contains("is-visible")) this.overlay.hidden = true;
    }, 1200);
    this.visible = false;
  };

  updateScale = () => {
    const scale = getShiftResultsScale(this.window.innerWidth, this.window.innerHeight);
    this.overlay?.style?.setProperty("--shift-report-scale", String(scale));
  };

  renderRows(container, keys, stats) {
    if (!container) return;
    container.innerHTML = "";
    keys.forEach((labelKey) => {
      const value = stats.get(labelKey);
      if (value == null) return;
      const item = this.document.createElement("div");
      item.className = "results-stat";
      const displayValue = String(value).startsWith("results.") ? this.translate(value) : value;
      item.innerHTML = `<span>${this.translate(labelKey)}</span><strong>${displayValue}</strong>`;
      container.appendChild(item);
    });
  }

  renderCompliance(value = "0%") {
    const ratio = Math.max(0, Math.min(100, Number.parseFloat(value) || 0));
    if (this.complianceValue) this.complianceValue.textContent = value;
    this.complianceBar?.style?.setProperty("--results-compliance", `${ratio}%`);
  }

  renderPhases(value = "0 / 0") {
    const [passed = 0, total = 0] = String(value).split("/").map((part) => Number.parseInt(part.trim(), 10) || 0);
    if (this.phaseValue) this.phaseValue.textContent = value;
    if (!this.phaseSegments) return;
    this.phaseSegments.innerHTML = "";
    for (let index = 0; index < total; index += 1) {
      const segment = this.document.createElement("i");
      if (index < passed) segment.className = "is-passed";
      this.phaseSegments.appendChild(segment);
    }
  }
}

export function getShiftResultsScale(viewportWidth, viewportHeight) {
  const width = Number.isFinite(viewportWidth) ? viewportWidth : 1920;
  const height = Number.isFinite(viewportHeight) ? viewportHeight : 1080;
  return Math.min(width / 1920, height / 1080);
}

export function getShiftResultsCopyKeys(levelId, mode) {
  const family = REPORT_COPY_FAMILY_BY_LEVEL[levelId] ?? "qualification";
  const outcome = mode === "complete" ? "complete" : "failed";
  return {
    title: `results.title.${family}.${outcome}`,
    summary: `results.summary.${family}.${outcome}`,
    comment: `results.comment.${family}.${outcome}`,
  };
}
