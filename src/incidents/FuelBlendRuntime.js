import * as THREE from "three";

const DEFAULT_STATE = {
  state: "green",
  material: "green",
  fuelFeedFactor: 1,
  heatPerFuelFactor: 1,
  outputFactor: 1,
  coolantEfficiencyFactor: 1,
  containmentPenalty: 0,
  efficiencyPenalty: 0,
  temperatureBias: 0,
  stallPressureBonus: 0,
  fuelReserveCostFactor: 1,
  label: "STANDARD BLEND",
};

const STATE_MATERIALS = {
  green: "green",
  yellow: "amber",
  amber: "amber",
  red: "red",
  off: "off",
};

export class FuelBlendRuntime {
  constructor({ config = null } = {}) {
    this.config = null;
    this.enabled = false;
    this.active = false;
    this.elapsed = 0;
    this.current = { ...DEFAULT_STATE };
    this.reset({ config });
  }

  reset({ config = null } = {}) {
    this.config = config?.fuelBlend ?? config ?? null;
    this.enabled = Boolean(this.config?.enabled);
    this.active = false;
    this.elapsed = 0;
    this.current = { ...DEFAULT_STATE };
  }

  start() {
    this.active = this.enabled;
    this.elapsed = 0;
    this.current = { ...DEFAULT_STATE };
    return this.snapshot();
  }

  stop() {
    this.active = false;
    this.elapsed = 0;
    this.current = { ...DEFAULT_STATE };
  }

  update(dt, context = {}) {
    if (!this.enabled || !this.active || context.shiftMode !== "running") {
      this.current = smoothModifier(this.current, DEFAULT_STATE, dt, 10);
      return this.snapshot();
    }
    this.elapsed = Number.isFinite(context.shiftElapsed) ? context.shiftElapsed : this.elapsed + dt;
    const target = resolveFuelBlendState(this.config, this.elapsed);
    this.current = smoothModifier(this.current, target, dt, target.material === "off" ? 8 : 3.2);
    this.current.state = target.state;
    this.current.material = target.material;
    this.current.label = target.label;
    return this.snapshot();
  }

  snapshot() {
    return { ...this.current, enabled: this.enabled, active: this.active, elapsed: this.elapsed };
  }
}

function resolveFuelBlendState(config, elapsed) {
  const segment = (config.segments ?? []).find(
    (entry) => elapsed >= Number(entry.start ?? 0) && elapsed < Number(entry.end ?? Infinity),
  );
  const base = { ...DEFAULT_STATE, ...(segment ?? {}) };
  delete base.start;
  delete base.end;
  delete base.waves;
  delete base.pulses;

  const state = String(base.state ?? "green");
  base.state = state;
  base.material = segment?.material ?? STATE_MATERIALS[state] ?? "green";
  base.label = base.label ?? getDefaultLabel(state);

  for (const wave of segment?.waves ?? []) {
    const key = wave.property;
    if (!key || !Number.isFinite(base[key])) continue;
    const amplitude = Number(wave.amplitude ?? 0);
    const frequency = Number(wave.frequency ?? 0);
    const seed = Number(wave.seed ?? 0);
    base[key] += Math.sin(elapsed * frequency * Math.PI * 2 + seed) * amplitude;
  }

  for (const pulse of segment?.pulses ?? []) {
    const at = Number(pulse.at ?? 0);
    const duration = Math.max(0.001, Number(pulse.duration ?? pulse.durationSeconds ?? 1));
    if (elapsed < at || elapsed > at + duration) continue;
    const amount = Math.sin(THREE.MathUtils.clamp((elapsed - at) / duration, 0, 1) * Math.PI);
    for (const [key, value] of Object.entries(pulse)) {
      if (key === "at" || key === "duration" || key === "durationSeconds" || key === "label") continue;
      if (!Number.isFinite(base[key]) || !Number.isFinite(value)) continue;
      base[key] += value * amount;
    }
    if (pulse.label) base.label = pulse.label;
  }

  return clampModifier(base);
}

function smoothModifier(current, target, dt, lambda) {
  const next = { ...target };
  for (const key of [
    "fuelFeedFactor",
    "heatPerFuelFactor",
    "outputFactor",
    "coolantEfficiencyFactor",
    "containmentPenalty",
    "efficiencyPenalty",
    "temperatureBias",
    "stallPressureBonus",
    "fuelReserveCostFactor",
  ]) {
    next[key] = THREE.MathUtils.damp(
      Number(current[key] ?? DEFAULT_STATE[key]),
      Number(target[key] ?? DEFAULT_STATE[key]),
      lambda,
      dt,
    );
  }
  return clampModifier(next);
}

function clampModifier(modifier) {
  return {
    ...modifier,
    fuelFeedFactor: THREE.MathUtils.clamp(Number(modifier.fuelFeedFactor ?? 1), 0, 1.3),
    heatPerFuelFactor: THREE.MathUtils.clamp(Number(modifier.heatPerFuelFactor ?? 1), 0.35, 2.2),
    outputFactor: THREE.MathUtils.clamp(Number(modifier.outputFactor ?? 1), 0, 1.35),
    coolantEfficiencyFactor: THREE.MathUtils.clamp(Number(modifier.coolantEfficiencyFactor ?? 1), 0.4, 1.4),
    containmentPenalty: THREE.MathUtils.clamp(Number(modifier.containmentPenalty ?? 0), 0, 45),
    efficiencyPenalty: THREE.MathUtils.clamp(Number(modifier.efficiencyPenalty ?? 0), 0, 0.85),
    temperatureBias: THREE.MathUtils.clamp(Number(modifier.temperatureBias ?? 0), -70, 70),
    stallPressureBonus: THREE.MathUtils.clamp(Number(modifier.stallPressureBonus ?? 0), 0, 2.2),
    fuelReserveCostFactor: THREE.MathUtils.clamp(Number(modifier.fuelReserveCostFactor ?? 1), 0.35, 1.8),
  };
}

function getDefaultLabel(state) {
  if (state === "yellow" || state === "amber") return "ECONOMY BLEND";
  if (state === "red") return "UNSTABLE BLEND";
  if (state === "off") return "NO USABLE FEED";
  return "STANDARD BLEND";
}
