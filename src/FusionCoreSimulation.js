const TOTAL_TIME = 300;

const PHASES = [
  {
    name: "FIELD PRECHARGE",
    start: 0,
    end: 35,
    temp: [20, 55],
    powerTemp: [25, 70],
    output: [0, 250],
    containmentMin: 75,
    demand: 140,
  },
  {
    name: "PLASMA IGNITION",
    start: 35,
    end: 80,
    temp: [75, 105],
    powerTemp: [85, 120],
    output: [300, 550],
    containmentMin: 65,
    demand: 430,
  },
  {
    name: "STABLE BURN",
    start: 80,
    end: 160,
    temp: [100, 135],
    powerTemp: [118, 148],
    output: [500, 750],
    containmentMin: 70,
    demand: 650,
  },
  {
    name: "DEMAND SURGE",
    start: 160,
    end: 235,
    temp: [125, 155],
    powerTemp: [150, 166],
    output: [750, 950],
    containmentMin: 60,
    demand: 850,
  },
  {
    name: "SUSTAINED HIGH LOAD",
    start: 235,
    end: TOTAL_TIME,
    temp: [138, 162],
    powerTemp: [158, 172],
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
    thermalSoak: 0,
    outputSurge: 0,
    burnRate: 0.18,
    coreStall: 0,
    stallLockTimer: 0,
    pulseCharge: 100,
    pulseCooldown: 0,
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
  const pulse = controls.pulseActive && state.pulseCooldown <= 0 && state.pulseCharge >= 18 ? 1 : 0;

  const tempMid = (phase.temp[0] + phase.temp[1]) * 0.5;
  const outputMid = (phase.output[0] + phase.output[1]) * 0.5;
  const heatSinkFactor = Math.max(0.25, state.heatSinkCapacity / 100);
  const heatSoakCoolingPenalty = 1 - (state.thermalSoak / 100) * 0.42;
  const coolantEffect = coolant * 82 * heatSinkFactor;
  const fuelHeat = fuel * 172;
  const fieldHeat = field * 11;
  const ventCooling = vent * 76;
  const pulseHeat = pulse * 42;
  const overDemandHeat = Math.max(0, state.powerOutput - phase.demand * 1.05) * 0.055;
  const targetTemp =
    18 +
    fuelHeat +
    fieldHeat +
    pulseHeat +
    overDemandHeat +
    state.thermalSoak * 0.16 -
    coolantEffect * heatSoakCoolingPenalty -
    ventCooling;

  const coolingLambda = (0.045 + coolant * 0.08 + vent * 0.5) * (1 - (state.thermalSoak / 100) * 0.48);
  const heatingLambda = 0.42 + fuel * 0.08;
  state.plasmaTemp = clamp(
    damp(state.plasmaTemp, targetTemp, targetTemp > state.plasmaTemp ? heatingLambda : Math.max(0.08, coolingLambda), dt),
    0,
    205,
  );
  const tempLow = Math.max(0, phase.temp[0] - state.plasmaTemp);
  const tempHigh = Math.max(0, state.plasmaTemp - phase.temp[1]);
  const coldFade = Math.max(0, phase.powerTemp[0] - state.plasmaTemp) / Math.max(phase.powerTemp[0], 1);
  const coolantFlood = Math.max(0, coolant - 0.72) * 1.55;
  const overFielded = Math.max(0, field - fuel - 0.24) * 1.4;
  const fuelStarved = fuel < 0.16 && state.elapsed > 12 ? (0.16 - fuel) * 2.2 : 0;
  const stallPressure = clamp(coldFade + coolantFlood + overFielded + fuelStarved + vent * 0.22 - pulse * 1.15, 0, 2.4);
  state.coreStall = clamp(state.coreStall + (stallPressure * 8.5 - fuel * 8 - Math.max(0, state.plasmaTemp - 92) * 0.07) * dt, 0, 100);
  const stallSeverity = clamp(state.coreStall / 100, 0, 1);
  const burnTarget = clamp(1 - stallSeverity * 0.88 + pulse * 0.5 - vent * 0.18, 0.04, 1.18);
  state.burnRate = clamp(damp(state.burnRate, burnTarget, pulse ? 3.8 : 0.7, dt), 0.02, 1.16);
  if (pulse) {
    state.coreStall = clamp(state.coreStall - 26, 0, 100);
    state.stallLockTimer = Math.max(0, state.stallLockTimer - 1.2);
    state.burnRate = clamp(state.burnRate + 0.34, 0.02, 1.16);
    state.pulseCharge = clamp(state.pulseCharge - 18, 0, 100);
    state.pulseCooldown = 2.4;
    state.coreStress = clamp(state.coreStress + 0.75 + stallSeverity * 0.55, 0, 100);
  }
  state.pulseCooldown = Math.max(0, state.pulseCooldown - dt);
  state.pulseCharge = clamp(state.pulseCharge + dt * (state.coreStall > 35 ? 2.2 : 4.8), 0, 100);

  const stabilityTarget =
    92 +
    field * 40 -
    fuel * 31 -
    tempHigh * 0.45 -
    tempLow * 0.28 -
    stallSeverity * 18 -
    vent * 10;
  state.containment = clamp(damp(state.containment, stabilityTarget, 0.85, dt), 0, 100);

  const tempQuality = bandQuality(state.plasmaTemp, phase.temp[0], phase.temp[1], 55);
  const powerTempQuality = bandQuality(state.plasmaTemp, phase.powerTemp[0], phase.powerTemp[1], 58);
  const containmentQuality = clamp((state.containment - 35) / 60, 0, 1);
  const fieldDrain = 1 - field * 0.24;
  const stallPenalty = clamp(1 - stallSeverity * 0.82, 0.05, 1);
  const ventPenalty = vent ? 0.05 : 1;
  const thermalInstability = clamp((state.plasmaTemp - 158) / 34, 0, 1);
  const fieldInstability = clamp((62 - state.containment) / 40, 0, 1);
  const surgeAmount = Math.max(thermalInstability, fieldInstability);
  const surgeWave =
    Math.sin(state.elapsed * 5.7) * 0.55 + Math.sin(state.elapsed * 13.3 + 1.4) * 0.3 + Math.sin(state.elapsed * 29.1) * 0.15;
  state.outputSurge = damp(state.outputSurge, Math.abs(surgeWave) * surgeAmount * 100, 2.2, dt);
  const surgeMultiplier = clamp(1 + surgeWave * surgeAmount * 0.22, 0.62, 1.2);
  const rawOutput =
    fuel * 1260 * state.burnRate * powerTempQuality * containmentQuality * fieldDrain * stallPenalty * ventPenalty * surgeMultiplier;
  state.powerOutput = damp(state.powerOutput, rawOutput, 0.75, dt);

  const outputQuality = bandQuality(state.powerOutput, phase.output[0], phase.output[1], 420);
  const burnQuality = clamp(state.burnRate - stallSeverity * 0.35, 0, 1);
  state.reactionEfficiency = clamp(
    (tempQuality * 0.26 + containmentQuality * 0.25 + outputQuality * 0.25 + powerTempQuality * 0.08 + burnQuality * 0.16) * 100,
    0,
    100,
  );
  state.averageEfficiency =
    (state.averageEfficiency * state.efficiencySamples + state.reactionEfficiency * dt) /
    (state.efficiencySamples + dt);
  state.efficiencySamples += dt;

  state.fuelReserve = clamp(state.fuelReserve - fuel * dt * 0.072 - pulse * 0.18, 0, 100);
  state.heatSinkCapacity = clamp(
    state.heatSinkCapacity - coolant * dt * 0.09 - Math.max(0, state.plasmaTemp - 135) * dt * 0.012 + (1 - coolant) * dt * 0.025,
    0,
    100,
  );

  const redHeat = Math.max(0, state.plasmaTemp - 140);
  const deepRedHeat = Math.max(0, state.plasmaTemp - 155);
  const criticalHeat = Math.max(0, state.plasmaTemp - 170);
  const soakGain = Math.pow(redHeat / 24, 2.2) * 2.5 + Math.pow(deepRedHeat / 14, 2.8) * 4;
  const soakRecovery = (coolant * 1.8 + vent * 4.5) * Math.max(0.25, 1 - criticalHeat / 20);
  state.thermalSoak = clamp(state.thermalSoak + (soakGain - soakRecovery) * dt, 0, 100);

  const stressRate =
    Math.pow(redHeat / 18, 2.15) * 0.25 +
    Math.pow(deepRedHeat / 10, 3.1) * 0.12 +
    state.thermalSoak * 0.025 +
    Math.max(0, 55 - state.containment) * 0.026 +
    Math.max(0, state.coreStall - 65) * 0.006 +
    Math.max(0, state.powerOutput - 1120) * 0.008 +
    vent * 0.025;
  state.coreStress = clamp(state.coreStress + stressRate * dt, 0, 100);
  state.stallLockTimer = state.coreStall >= 96 ? state.stallLockTimer + dt : Math.max(0, state.stallLockTimer - dt * 1.4);

  state.elapsed = clamp(state.elapsed + dt, 0, TOTAL_TIME);
  state.targetOutput = phase.demand;
  const underDemandRatio = phase.demand > 0 ? Math.max(0, (phase.demand - state.powerOutput) / phase.demand) : 0;
  const overDemandRatio = phase.demand > 0 ? Math.max(0, (state.powerOutput - phase.demand) / phase.demand) : 0;

  state.warning = {
    tempHigh: state.plasmaTemp > 140,
    tempCritical: state.plasmaTemp > 155,
    fieldWeak: state.containment < phase.containmentMin,
    outputLow: state.powerOutput < phase.demand * 0.9 && state.elapsed > 8,
    underDemand: underDemandRatio > 0.05 && state.elapsed > 8,
    underDemandCritical: underDemandRatio > 0.25 && state.elapsed > 8,
    overDemand: overDemandRatio > 0.06 && state.elapsed > 8,
    overDemandCritical: overDemandRatio > 0.25 && state.elapsed > 8,
    instability: state.containment < 50,
    coreStall: state.coreStall > 45,
    coreStallCritical: state.coreStall > 72,
    thermalSoak: state.thermalSoak > 45,
    outputSurge: state.outputSurge > 34,
    coreStress: state.coreStress > 70 || state.thermalSoak > 70,
  };
  state.status = pickStatus(state, phase, tempLow, tempHigh);

  if (state.coreStress >= 100 || state.fuelReserve <= 0 || state.containment <= 5 || state.stallLockTimer >= 5) {
    state.mode = "failed";
    state.status =
      state.coreStress >= 100 ? "CORE STRESS LIMIT EXCEEDED" : state.stallLockTimer >= 5 ? "CORE STALL LOCKED" : "REACTION LOST";
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
    thermalSoak: state.thermalSoak,
    outputSurge: state.outputSurge,
    burnRate: state.burnRate,
    coreStall: state.coreStall,
    stallLockTimer: state.stallLockTimer,
    pulseCharge: state.pulseCharge,
    pulseCooldown: state.pulseCooldown,
    reactionEfficiency: state.reactionEfficiency,
    averageEfficiency: state.averageEfficiency,
    status: state.status,
    warning: { ...state.warning },
  };
}

function getPhase(elapsed) {
  return PHASES.find((phase) => elapsed >= phase.start && elapsed < phase.end) ?? PHASES[PHASES.length - 1];
}

function pickStatus(state, phase, tempLow, tempHigh) {
  if (state.thermalSoak > 75) return "CORE HEAT SOAK RUNAWAY";
  if (state.warning.coreStallCritical) return "CORE STALL - PULSE REQUIRED";
  if (state.warning.coreStall) return "BURN RATE COLLAPSING";
  if (state.warning.outputSurge && state.warning.tempCritical) return "THERMAL OUTPUT SURGING";
  if (state.warning.coreStress) return "CORE STRESS ACCUMULATING";
  if (state.warning.tempCritical) return "PLASMA DEEP IN RED BAND";
  if (state.warning.instability && state.warning.tempHigh) return "HOT PLASMA DESTABILIZING FIELD";
  if (state.warning.instability) return "FIELD HOLDING MARGIN LOW";
  if (state.warning.overDemandCritical) return "EXCESS BUS POWER HEATING CORE";
  if (state.warning.overDemand) return "OUTPUT ABOVE GRID DRAW";
  if (tempHigh > 0) return "FUEL HEAT EXCEEDS COOLING";
  if (state.burnRate < 0.45) return "PLASMA BURN WEAK";
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
