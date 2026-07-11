import * as THREE from "three";

const DEFAULT_SELF_TEST_DURATION = 10;

export class DiagnosticRuntime {
  constructor({ config = {} } = {}) {
    this.config = config;
    this.levelId = null;
    this.selfTest = null;
    this.events = [];
    this.elapsed = 0;
    this.timelineStarted = false;
    this.selfTestCompleted = false;
    this.blackout = null;
    this.lightRestartPending = false;
    this.faults = {
      lamps: new Map(),
      gauges: new Map(),
      knobs: new Map(),
    };
  }

  reset({ levelId = null, config = this.config } = {}) {
    this.levelId = levelId;
    this.config = config ?? {};
    this.selfTest = null;
    this.faults.lamps.clear();
    this.faults.gauges.clear();
    this.faults.knobs.clear();
    this.events = [];
    this.elapsed = 0;
    this.timelineStarted = false;
    this.selfTestCompleted = false;
    this.blackout = null;
    this.lightRestartPending = false;

    const diagnostics = this.config.diagnostics ?? {};
    const initialOptions = { startOnTimeline: true, revealAfterSelfTest: true };
    (diagnostics.initialFaults?.lamps ?? []).forEach((fault) => this.addLampFault({ ...initialOptions, ...fault }));
    (diagnostics.initialFaults?.gauges ?? []).forEach((fault) => this.addGaugeFault({ ...initialOptions, ...fault }));
    (diagnostics.initialFaults?.knobs ?? []).forEach((fault) => this.addKnobFault({ ...initialOptions, ...fault }));
    selectRandomTimelineEvents(diagnostics.initialRandomFaults ?? []).forEach((fault) => {
      this.triggerEvent({ ...initialOptions, ...fault });
    });
    this.events = [
      ...(diagnostics.timeline ?? []),
      ...selectRandomTimelineEvents(diagnostics.randomTimeline ?? []),
    ].map((event, index) => ({
      id: event.id ?? `${event.type}-${index}`,
      triggered: false,
      ...event,
    }));
  }

  startSelfTest({ duration = this.config.diagnostics?.selfTest?.durationSeconds } = {}) {
    const resolvedDuration = Math.max(0.1, Number(duration ?? DEFAULT_SELF_TEST_DURATION));
    this.selfTest = {
      elapsed: 0,
      duration: resolvedDuration,
    };
    return this.selfTest;
  }

  stopSelfTest() {
    this.selfTest = null;
  }

  startTimeline() {
    this.timelineStarted = true;
  }

  stopTimeline() {
    this.timelineStarted = false;
  }

  update(dt) {
    if (this.timelineStarted) {
      this.elapsed += dt;
      this.events.forEach((event) => {
        if (event.triggered || this.elapsed < Number(event.atSeconds ?? event.at ?? 0)) return;
        event.triggered = true;
        this.triggerEvent(event);
      });
    }
    this.updateTimedFaults(dt);
    if (this.blackout) {
      this.blackout.remaining = Math.max(0, this.blackout.remaining - dt);
      if (this.blackout.remaining <= 0) {
        if (this.blackout.restartLights) this.lightRestartPending = true;
        this.blackout = null;
      }
    }
    if (this.selfTest) {
      this.selfTest.elapsed += dt;
      if (this.selfTest.elapsed >= this.selfTest.duration) {
        this.selfTest = null;
        this.selfTestCompleted = true;
      }
    }
  }

  triggerEvent(event = {}) {
    if (event.type === "blackout") {
      this.blackout = {
        duration: Math.max(0.05, Number(event.durationSeconds ?? 0.6)),
        remaining: Math.max(0.05, Number(event.durationSeconds ?? 0.6)),
        restartLights: event.restartLights !== false,
      };
      return;
    }
    if (event.type === "lampFault") {
      this.addLampFault({
        name: event.name,
        force: event.force,
        material: event.material,
        blink: event.blink,
        durationSeconds: event.durationSeconds,
        failColors: event.failColors,
        startOnTimeline: event.startOnTimeline,
        revealAfterSelfTest: event.revealAfterSelfTest,
      });
      return;
    }
    if (event.type === "gaugeFault") {
      this.addGaugeFault({
        key: event.key,
        maxRatio: event.maxRatio,
        minRatio: event.minRatio,
        offsetRatio: event.offsetRatio,
        delaySeconds: event.delaySeconds,
        reverse: event.reverse,
        noiseDegrees: event.noiseDegrees,
        durationSeconds: event.durationSeconds,
        selfTestOnly: event.selfTestOnly,
        startOnTimeline: event.startOnTimeline,
        revealAfterSelfTest: event.revealAfterSelfTest,
      });
      return;
    }
    if (event.type === "knobFault") {
      this.addKnobFault({
        name: event.name,
        sensitivity: event.sensitivity,
        exercisePercent: event.exercisePercent,
        durationSeconds: event.durationSeconds,
        startOnTimeline: event.startOnTimeline,
        revealAfterSelfTest: event.revealAfterSelfTest,
      });
    }
  }

  updateTimedFaults(dt) {
    [
      this.faults.lamps,
      this.faults.gauges,
      this.faults.knobs,
    ].forEach((faultMap) => {
      [...faultMap.entries()].forEach(([key, fault]) => {
        if (!Number.isFinite(fault.durationSeconds)) return;
        if (fault.startOnTimeline && !this.timelineStarted) return;
        fault.durationSeconds = Math.max(0, fault.durationSeconds - dt);
        if (fault.durationSeconds <= 0) faultMap.delete(key);
      });
    });
  }

  isSelfTestActive() {
    return Boolean(this.selfTest);
  }

  getSelfTestProgress() {
    if (!this.selfTest) return 0;
    return THREE.MathUtils.clamp(this.selfTest.elapsed / this.selfTest.duration, 0, 1);
  }

  getBlackoutFactor() {
    if (!this.blackout) return 1;
    const progress = 1 - this.blackout.remaining / Math.max(0.001, this.blackout.duration);
    if (progress < 0.72) return 0;
    return THREE.MathUtils.smoothstep(progress, 0.72, 1);
  }

  consumeLightRestartRequest() {
    if (!this.lightRestartPending) return false;
    this.lightRestartPending = false;
    return true;
  }

  createSelfTestSnapshot(baseSnapshot) {
    if (!this.selfTest) return baseSnapshot;
    return {
      ...baseSnapshot,
      mode: "selfTest",
      selfTestElapsed: this.selfTest.elapsed,
      selfTestDuration: this.selfTest.duration,
      selfTestProgress: this.getSelfTestProgress(),
    };
  }

  addLampFault(fault = {}) {
    if (!fault.name) return false;
    const current = this.faults.lamps.get(fault.name) ?? {};
    this.faults.lamps.set(fault.name, { ...current, ...fault });
    return true;
  }

  addGaugeFault(fault = {}) {
    if (!fault.key) return false;
    const current = this.faults.gauges.get(fault.key) ?? {};
    this.faults.gauges.set(fault.key, { ...current, ...fault });
    return true;
  }

  addKnobFault(fault = {}) {
    if (!fault.name) return false;
    const current = this.faults.knobs.get(fault.name) ?? {};
    this.faults.knobs.set(fault.name, {
      exerciseTravel: 0,
      lastDirection: 0,
      recovery: 0,
      ...current,
      ...fault,
    });
    return true;
  }

  getLampSelfTestOverride(lampName, colorName) {
    const fault = this.faults.lamps.get(lampName);
    if (!fault) return null;
    const failedColors = fault.failColors ?? fault.failedColors ?? [];
    if (failedColors.includes(colorName) || failedColors.includes("all")) return "off";
    return null;
  }

  getLampRuntimeOverride(lampName, timeSeconds = 0) {
    const fault = this.faults.lamps.get(lampName);
    if (!this.isFaultRuntimeVisible(fault)) return null;
    if (!fault?.force && !fault?.material) return null;
    if (fault.blink && Math.floor(timeSeconds * Number(fault.blinkFrequency ?? 9)) % 2 === 0) return "off";
    return fault.material ?? fault.force;
  }

  getGaugeSelfTestModifier(gaugeKey) {
    return this.faults.gauges.get(gaugeKey) ?? null;
  }

  getGaugeRuntimeModifier(gaugeKey) {
    const fault = this.faults.gauges.get(gaugeKey);
    if (!this.isFaultRuntimeVisible(fault)) return null;
    return fault?.selfTestOnly ? null : fault ?? null;
  }

  getKnobSensitivity(knobName) {
    const fault = this.faults.knobs.get(knobName);
    if (!this.isFaultRuntimeVisible(fault)) return 1;
    if (!fault) return 1;
    const base = THREE.MathUtils.clamp(Number(fault.sensitivity ?? 1), 0.02, 1);
    const recovery = THREE.MathUtils.clamp(Number(fault.recovery ?? 0), 0, 1);
    return THREE.MathUtils.lerp(base, 1, recovery);
  }

  registerKnobMovement(knobName, deltaPercent) {
    const fault = this.faults.knobs.get(knobName);
    if (!this.isFaultRuntimeVisible(fault) || fault.recovery >= 1) return;
    const direction = Math.sign(deltaPercent);
    const travel = Math.abs(deltaPercent);
    const exerciseGoal = Math.max(1, Number(fault.exercisePercent ?? 130));
    const directionBonus = direction !== 0 && fault.lastDirection !== 0 && direction !== fault.lastDirection ? 2.4 : 1;
    fault.exerciseTravel += travel * directionBonus;
    fault.lastDirection = direction || fault.lastDirection;
    fault.recovery = THREE.MathUtils.clamp(fault.exerciseTravel / exerciseGoal, 0, 1);
    if (fault.recovery >= 1 && fault.autoClear !== false) {
      this.faults.knobs.delete(knobName);
    }
  }

  getDebugState() {
    return {
      levelId: this.levelId,
      selfTest: this.selfTest ? { ...this.selfTest, progress: this.getSelfTestProgress() } : null,
      elapsed: this.elapsed,
      timelineStarted: this.timelineStarted,
      selfTestCompleted: this.selfTestCompleted,
      blackout: this.blackout ? { ...this.blackout, factor: this.getBlackoutFactor() } : null,
      lightRestartPending: this.lightRestartPending,
      faults: {
        lamps: Object.fromEntries(this.faults.lamps),
        gauges: Object.fromEntries(this.faults.gauges),
        knobs: Object.fromEntries(this.faults.knobs),
      },
    };
  }

  isFaultRuntimeVisible(fault) {
    if (!fault) return false;
    return !fault.revealAfterSelfTest || this.selfTestCompleted || this.timelineStarted;
  }
}

function selectRandomTimelineEvents(groups) {
  return groups.flatMap((group) => {
    const pool = group?.pool ?? group?.events ?? [];
    if (pool.length === 0) return [];
    const count = Math.max(1, Math.min(pool.length, Math.round(Number(group.count ?? 1))));
    const available = [...pool];
    const picked = [];
    for (let index = 0; index < count; index += 1) {
      const pickedIndex = Math.floor(Math.random() * available.length);
      picked.push(available.splice(pickedIndex, 1)[0]);
    }
    return picked;
  });
}
