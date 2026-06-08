const TOTAL_TIME = 300;

const PHASES = [
  {
    name: "FIELD PRECHARGE",
    start: 0,
    end: 35,
    temp: [20, 55],
    output: [0, 250],
    containmentMin: 75,
    demand: 140,
  },
  {
    name: "PLASMA IGNITION",
    start: 35,
    end: 80,
    temp: [75, 105],
    output: [300, 550],
    containmentMin: 65,
    demand: 430,
  },
  {
    name: "STABLE BURN",
    start: 80,
    end: 160,
    temp: [90, 125],
    output: [500, 750],
    containmentMin: 70,
    demand: 650,
  },
  {
    name: "DEMAND SURGE",
    start: 160,
    end: 235,
    temp: [105, 140],
    output: [750, 950],
    containmentMin: 60,
    demand: 850,
  },
  {
    name: "SUSTAINED HIGH LOAD",
    start: 235,
    end: TOTAL_TIME,
    temp: [115, 150],
    output: [850, 1100],
    containmentMin: 55,
    demand: 980,
  },
];

export function createFusionCoreSimulation() {
  const state = createInitialState();

  return {
    start() {
      Object.assign(state, createInitialState(), { mode: "running", status: "FIELD BUS CHARGING" });
    },

    reset() {
      Object.assign(state, createInitialState());
    },

    update(dt, controls) {
      if (state.mode !== "running") return getSnapshot(state);
      updateRunningState(state, dt, controls);
      return getSnapshot(state);
    },

    getSnapshot() {
      return getSnapshot(state);
    },
  };
}

function createInitialState() {
  return {
    mode: "standby",
    elapsed: 0,
    plasmaTemp: 22,
    containment: 82,
    powerOutput: 0,
    targetOutput: PHASES[0].demand,
    fuelReserve: 100,
    heatSinkCapacity: 100,
    coreStress: 0,
    reactionEfficiency: 0,
    status: "AWAITING START COMMAND",
    warning: {},
    averageEfficiency: 0,
    efficiencySamples: 0,
  };
}

function updateRunningState(state, dt, controls) {
  const phase = getPhase(state.elapsed);
  const fuel = controls.fuelInjection / 100;
  const field = controls.magneticField / 100;
  const coolant = controls.coolantFlow / 100;
  const vent = controls.ventActive ? 1 : 0;

  const tempMid = (phase.temp[0] + phase.temp[1]) * 0.5;
  const outputMid = (phase.output[0] + phase.output[1]) * 0.5;
  const heatSinkFactor = Math.max(0.25, state.heatSinkCapacity / 100);
  const coolantEffect = coolant * 82 * heatSinkFactor;
  const fuelHeat = fuel * 172;
  const fieldHeat = field * 11;
  const ventCooling = vent * 120;
  const overDemandHeat = Math.max(0, state.powerOutput - phase.demand * 1.05) * 0.055;
  const targetTemp = 18 + fuelHeat + fieldHeat + overDemandHeat - coolantEffect - ventCooling;

  state.plasmaTemp = damp(state.plasmaTemp, targetTemp, 0.45, dt);
  const tempLow = Math.max(0, phase.temp[0] - state.plasmaTemp);
  const tempHigh = Math.max(0, state.plasmaTemp - phase.temp[1]);
  const quenchRisk = Math.max(0, 55 - state.plasmaTemp) / 55 + Math.max(0, coolant - 0.78) * 1.4;

  const stabilityTarget =
    92 +
    field * 40 -
    fuel * 31 -
    tempHigh * 0.45 -
    tempLow * 0.28 -
    quenchRisk * 24 -
    vent * 10;
  state.containment = clamp(damp(state.containment, stabilityTarget, 0.85, dt), 0, 100);

  const tempQuality = bandQuality(state.plasmaTemp, phase.temp[0], phase.temp[1], 45);
  const containmentQuality = clamp((state.containment - 35) / 60, 0, 1);
  const fieldDrain = 1 - field * 0.24;
  const quenchPenalty = clamp(1 - quenchRisk * 0.62, 0, 1);
  const ventPenalty = vent ? 0.05 : 1;
  const rawOutput = fuel * 1160 * tempQuality * containmentQuality * fieldDrain * quenchPenalty * ventPenalty;
  state.powerOutput = damp(state.powerOutput, rawOutput, 0.75, dt);

  const outputQuality = bandQuality(state.powerOutput, phase.output[0], phase.output[1], 420);
  state.reactionEfficiency = clamp((tempQuality * 0.38 + containmentQuality * 0.32 + outputQuality * 0.3) * 100, 0, 100);
  state.averageEfficiency =
    (state.averageEfficiency * state.efficiencySamples + state.reactionEfficiency * dt) /
    (state.efficiencySamples + dt);
  state.efficiencySamples += dt;

  state.fuelReserve = clamp(state.fuelReserve - fuel * dt * 0.072, 0, 100);
  state.heatSinkCapacity = clamp(
    state.heatSinkCapacity - coolant * dt * 0.09 - Math.max(0, state.plasmaTemp - 135) * dt * 0.012 + (1 - coolant) * dt * 0.025,
    0,
    100,
  );

  const stressRate =
    Math.max(0, state.plasmaTemp - 140) * 0.018 +
    Math.max(0, 55 - state.containment) * 0.035 +
    Math.max(0, state.powerOutput - 1120) * 0.008 +
    vent * 0.06;
  state.coreStress = clamp(state.coreStress + stressRate * dt, 0, 100);

  state.elapsed = clamp(state.elapsed + dt, 0, TOTAL_TIME);
  state.targetOutput = phase.demand;
  const underDemandRatio = phase.demand > 0 ? Math.max(0, (phase.demand - state.powerOutput) / phase.demand) : 0;
  const overDemandRatio = phase.demand > 0 ? Math.max(0, (state.powerOutput - phase.demand) / phase.demand) : 0;

  state.warning = {
    tempHigh: state.plasmaTemp > 140,
    fieldWeak: state.containment < phase.containmentMin,
    outputLow: state.powerOutput < phase.demand * 0.9 && state.elapsed > 8,
    underDemand: underDemandRatio > 0.05 && state.elapsed > 8,
    underDemandCritical: underDemandRatio > 0.25 && state.elapsed > 8,
    overDemand: overDemandRatio > 0.06 && state.elapsed > 8,
    overDemandCritical: overDemandRatio > 0.25 && state.elapsed > 8,
    instability: state.containment < 50,
    quenchRisk: quenchRisk > 0.55,
    coreStress: state.coreStress > 70,
  };
  state.status = pickStatus(state, phase, tempLow, tempHigh, quenchRisk);

  if (state.coreStress >= 100 || state.fuelReserve <= 0 || state.containment <= 5) {
    state.mode = "failed";
    state.status = state.coreStress >= 100 ? "CORE STRESS LIMIT EXCEEDED" : "REACTION LOST";
  } else if (state.elapsed >= TOTAL_TIME) {
    state.mode = state.averageEfficiency >= 62 && state.coreStress < 100 ? "complete" : "failed";
    state.status = state.mode === "complete" ? "SHIFT COMPLETE" : "OUTPUT QUALITY BELOW LIMIT";
  }
}

function getSnapshot(state) {
  const phase = getPhase(state.elapsed);
  return {
    mode: state.mode,
    elapsed: state.elapsed,
    remaining: TOTAL_TIME - state.elapsed,
    phase,
    plasmaTemp: state.plasmaTemp,
    containment: state.containment,
    powerOutput: state.powerOutput,
    targetOutput: state.targetOutput,
    demandError: state.targetOutput > 0 ? (state.powerOutput - state.targetOutput) / state.targetOutput : 0,
    fuelReserve: state.fuelReserve,
    heatSinkCapacity: state.heatSinkCapacity,
    coreStress: state.coreStress,
    reactionEfficiency: state.reactionEfficiency,
    averageEfficiency: state.averageEfficiency,
    status: state.status,
    warning: { ...state.warning },
  };
}

function getPhase(elapsed) {
  return PHASES.find((phase) => elapsed >= phase.start && elapsed < phase.end) ?? PHASES[PHASES.length - 1];
}

function pickStatus(state, phase, tempLow, tempHigh, quenchRisk) {
  if (state.warning.coreStress) return "CORE STRESS ACCUMULATING";
  if (state.warning.instability && state.warning.tempHigh) return "HOT PLASMA DESTABILIZING FIELD";
  if (state.warning.instability) return "FIELD HOLDING MARGIN LOW";
  if (state.warning.overDemandCritical) return "EXCESS BUS POWER HEATING CORE";
  if (state.warning.overDemand) return "OUTPUT ABOVE GRID DRAW";
  if (tempHigh > 0) return "FUEL HEAT EXCEEDS COOLING";
  if (quenchRisk > 0.55) return "COOLANT QUENCHING PLASMA";
  if (tempLow > 0) return "PLASMA BELOW BURN WINDOW";
  if (state.warning.outputLow) return "GRID DRAW EXCEEDS CORE OUTPUT";
  if (state.reactionEfficiency > 78 && bandQuality(state.powerOutput, phase.output[0], phase.output[1], 200) > 0.9) {
    return "BURN WINDOW STABLE";
  }
  return "PARAMETERS DRIFTING";
}

function bandQuality(value, min, max, falloff) {
  if (value >= min && value <= max) return 1;
  const distance = value < min ? min - value : value - max;
  return clamp(1 - distance / falloff, 0, 1);
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
