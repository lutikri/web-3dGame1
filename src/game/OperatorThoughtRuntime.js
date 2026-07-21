export class OperatorThoughtRuntime {
  constructor({ getActiveLevelId, translate, dispatchTarget = window }) {
    this.getActiveLevelId = getActiveLevelId;
    this.translate = translate;
    this.dispatchTarget = dispatchTarget;
    this.shown = new Set();
  }

  update = (previous, snapshot, controls) => {
    if (this.getActiveLevelId() !== "intro-shift" || snapshot.mode !== "running") return;
    if (!previous.warning?.fieldWeak && snapshot.warning?.fieldWeak && snapshot.elapsed > 3) {
      this.emit("field-weak");
    }
    if (!previous.reactionStalled && snapshot.reactionStalled) this.emit("first-quench", 2, 4.2);
    if (snapshot.reactionStalled && controls.fuelInjection >= 30 && controls.coolantFlow <= 58) {
      this.emit("pulse-ready", 1, 2.8);
    }
    if (previous.reactionStalled && !snapshot.reactionStalled) this.emit("restart-success", 2, 2.4);
    if (!previous.warning?.tempCritical && snapshot.warning?.tempCritical) this.emit("first-redline", 2, 3);
    if (previous.phase?.name !== snapshot.phase?.name && snapshot.phase?.name === "SUSTAINED HIGH LOAD") {
      this.emit("high-load", 1, 3.6);
    }
  };

  emit = (id, priority = 0, duration = 3.4) => {
    if (this.shown.has(id)) return false;
    this.shown.add(id);
    this.dispatchTarget.dispatchEvent(new CustomEvent("operatorgame:subtitle", {
      detail: { id, text: this.translate(`subtitles.${id}`), priority, duration },
    }));
    return true;
  };

  reset = () => {
    this.shown.clear();
    this.dispatchTarget.dispatchEvent(new CustomEvent("operatorgame:subtitle-clear", {
      detail: { resetSeen: true },
    }));
  };
}

