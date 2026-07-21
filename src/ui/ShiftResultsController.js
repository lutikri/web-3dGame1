export class ShiftResultsController {
  constructor({ documentRef = document, windowRef = window, translate, buildReport, getRecorder, getContext, releaseControls, clearZoom, createEvent = (type, init) => new CustomEvent(type, init) }) {
    this.document = documentRef;
    this.window = windowRef;
    this.translate = translate;
    this.buildReport = buildReport;
    this.getRecorder = getRecorder;
    this.getContext = getContext;
    this.releaseControls = releaseControls;
    this.clearZoom = clearZoom;
    this.createEvent = createEvent;
    this.overlay = documentRef.querySelector("#resultsOverlay");
    this.outcome = documentRef.querySelector("#resultsOutcome");
    this.profile = documentRef.querySelector("#resultsProfile");
    this.summary = documentRef.querySelector("#resultsSummary");
    this.stats = documentRef.querySelector("#resultsStats");
    this.visible = false;
  }

  show = (snapshot) => {
    this.document.exitPointerLock?.();
    this.clearZoom();
    this.releaseControls();
    const report = this.buildReport(this.getRecorder(), snapshot);
    if (this.outcome) this.outcome.textContent = this.translate(
      snapshot.mode === "complete" ? "results.outcome.complete" : "results.outcome.failed",
    );
    if (this.profile) this.profile.textContent = this.translate(`results.profile.${report.profileId}.title`);
    if (this.summary) this.summary.textContent = this.translate(`results.profile.${report.profileId}.summary`);
    if (this.stats) {
      this.stats.innerHTML = "";
      report.stats.forEach(([labelKey, value]) => {
        const item = this.document.createElement("div");
        item.className = "results-stat";
        item.innerHTML = `<span>${this.translate(labelKey)}</span><strong>${value}</strong>`;
        this.stats.appendChild(item);
      });
    }
    if (this.overlay) {
      this.overlay.hidden = false;
      this.overlay.classList.add("is-visible");
    }
    this.visible = true;
    const context = this.getContext();
    this.window.dispatchEvent(this.createEvent("operatorgame:shift-results", {
      detail: { ...context, snapshot, report },
    }));
    return report;
  };

  hide = ({ immediate = false } = {}) => {
    if (!this.overlay) return;
    this.overlay.classList.remove("is-visible");
    if (immediate) this.overlay.hidden = true;
    else this.window.setTimeout(() => {
      if (!this.overlay.classList.contains("is-visible")) this.overlay.hidden = true;
    }, 1200);
    this.visible = false;
  };
}
