const TOTAL_TIME = 180;

const PHASES = [
  {
    name: "FIELD PRECHARGE",
    start: 0,
    end: 24,
    temp: [20, 55],
    powerTemp: [25, 70],
    output: [0, 250],
    containmentMin: 75,
    demand: 140,
  },
  {
    name: "PLASMA IGNITION",
    start: 24,
    end: 52,
    temp: [75, 105],
    powerTemp: [85, 120],
    output: [300, 550],
    containmentMin: 65,
    demand: 430,
  },
  {
    name: "STABLE BURN",
    start: 52,
    end: 90,
    temp: [100, 135],
    powerTemp: [118, 148],
    output: [500, 750],
    containmentMin: 70,
    demand: 650,
  },
  {
    name: "DEMAND SURGE",
    start: 90,
    end: 135,
    temp: [125, 155],
    powerTemp: [150, 166],
    output: [750, 950],
    containmentMin: 60,
    demand: 850,
  },
  {
    name: "SUSTAINED HIGH LOAD",
    start: 135,
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
    reactionStalled: false,
    shutdownLevel: 0,
    flameoutTimer: 0,
    ignitionHold: 0,
    pulseLatched: false,
    ignitionPulseCount: 0,
    pulseCharge: 100,
    pulseCooldown: 0,
    reactionEfficiency: 0,
    failureType: null,
    status: "AWAITING START COMMAND",
    warning: {},
    averageEfficiency: 0,
    efficiencySamples: 0,
  };
}

function updateRunningState(state, dt, controls) {
  const phase = getPhase(state.elapsed);
  const operatingTargets = getOperatingTargets(state.elapsed);
  const fuel = controls.fuelInjection / 100;
  const field = controls.magneticField / 100;
  const coolant = controls.coolantFlow / 100;
  const vent = controls.ventActive ? 1 : 0;
  const pulseHeld = Boolean(controls.pulseActive);
  const canChargeIgnition = pulseHeld && !state.pulseLatched && state.pulseCooldown <= 0 && state.pulseCharge >= 18;
  state.ignitionHold = canChargeIgnition ? Math.min(0.5, state.ignitionHold + dt) : 0;
  const pulse = canChargeIgnition && state.ignitionHold >= 0.5 ? 1 : 0;
  if (!pulseHeld) state.pulseLatched = false;
  const event = getShiftEvent(state.elapsed);
  const demand = getLiveDemand(operatingTargets, state.elapsed, event);
  const quenchPressure =
    coolant > 0.68 && fuel < 0.24
      ? 0.25 + clamp((coolant - 0.68) / 0.32, 0, 1) * clamp((0.24 - fuel) / 0.14, 0, 1) * 1.35
      : 0;
  const flameoutPressure = fuel < 0.04 ? 1 : quenchPressure;
  state.flameoutTimer = !state.reactionStalled
    ? flameoutPressure > 0
      ? state.flameoutTimer + dt * flameoutPressure
      : Math.max(0, state.flameoutTimer - dt * 2)
    : state.flameoutTimer;
  if (state.flameoutTimer >= 1.1) {
    state.reactionStalled = true;
    state.coreStall = 100;
  }
  state.shutdownLevel = damp(state.shutdownLevel, state.reactionStalled ? 1 : 0, state.reactionStalled ? 2.6 : 3.8, dt);

  const heatSinkFactor = Math.max(0.25, state.heatSinkCapacity / 100);
  const heatSoakCoolingPenalty = 1 - (state.thermalSoak / 100) * 0.42;
  const coolantEffect = coolant * 82 * heatSinkFactor * event.coolantEfficiency;
  const fuelHeat = fuel * 172 * (state.reactionStalled ? 0.08 : 1);
  const fieldHeat = field * 11;
  const ventCooling = vent * 76;
  const pulseHeat = pulse * 42;
  const overDemandHeat = Math.max(0, state.powerOutput - demand * 1.05) * 0.055;
  const activeTargetTemp =
    18 +
      fuelHeat +
      fieldHeat +
      pulseHeat +
      overDemandHeat +
      state.thermalSoak * 0.16 -
      coolantEffect * heatSoakCoolingPenalty -
      ventCooling;
  const targetTemp = activeTargetTemp * (1 - state.shutdownLevel);

  const coolingLambda = (0.045 + coolant * 0.08 + vent * 0.5) * (1 - (state.thermalSoak / 100) * 0.48);
  const heatingLambda = 0.42 + fuel * 0.08;
  const temperatureLambda = state.shutdownLevel > 0
    ? lerp(targetTemp > state.plasmaTemp ? heatingLambda : Math.max(0.08, coolingLambda), 1.35, state.shutdownLevel)
    : targetTemp > state.plasmaTemp
      ? heatingLambda
      : Math.max(0.08, coolingLambda);
  state.plasmaTemp = clamp(
    damp(state.plasmaTemp, targetTemp, temperatureLambda, dt),
    0,
    205,
  );
  const tempLow = Math.max(0, operatingTargets.temp[0] - state.plasmaTemp);
  const tempHigh = Math.max(0, state.plasmaTemp - operatingTargets.temp[1]);
  const physicalTempLow = Math.max(0, 55 - state.plasmaTemp);
  const physicalTempHigh = Math.max(0, state.plasmaTemp - 155);
  const coldFade = Math.max(0, 75 - state.plasmaTemp) / 75;
  const coolantFlood = Math.max(0, coolant - 0.72) * 1.55;
  const overFielded = Math.max(0, field - fuel - 0.24) * 1.4;
  const fuelStarved = fuel < 0.16 && state.elapsed > 12 ? (0.16 - fuel) * 2.2 : 0;
  const stallPressure = clamp(coldFade + coolantFlood + overFielded + fuelStarved + vent * 0.22 - pulse * 1.15, 0, 2.4);
  state.coreStall = clamp(
    state.coreStall +
      (stallPressure * 8.5 - (state.reactionStalled ? 0 : fuel * 8) - Math.max(0, state.plasmaTemp - 92) * 0.07) * dt,
    0,
    100,
  );
  if (state.coreStall >= 92) state.reactionStalled = true;
  const stallSeverity = clamp(state.coreStall / 100, 0, 1);
  const activeBurnTarget = clamp(1 - stallSeverity * 0.88 + pulse * 0.5 - vent * 0.18, 0.04, 1.18);
  const burnTarget = activeBurnTarget * (1 - state.shutdownLevel);
  state.burnRate = clamp(damp(state.burnRate, burnTarget, lerp(pulse ? 3.8 : 0.7, 3.4, state.shutdownLevel), dt), 0, 1.16);
  if (pulse) {
    const restartReady = state.reactionStalled && fuel >= 0.3 && coolant <= 0.58;
    state.pulseLatched = true;
    state.ignitionHold = 0;
    state.ignitionPulseCount += 1;
    state.plasmaTemp = clamp(Math.max(state.plasmaTemp + 28, 102), 0, 205);
    if (restartReady) {
      state.reactionStalled = false;
      state.shutdownLevel = Math.min(state.shutdownLevel, 0.72);
      state.flameoutTimer = 0;
      state.coreStall = 34;
      state.burnRate = Math.max(state.burnRate, 0.42);
      state.containment = Math.max(state.containment, 35);
    } else if (!state.reactionStalled) {
      state.coreStall = clamp(state.coreStall - 26, 0, 100);
      state.burnRate = clamp(state.burnRate + 0.34, 0.02, 1.16);
    }
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
    clamp((demand - 400) / 600, 0, 1) * 8 -
    physicalTempHigh * 0.45 -
    physicalTempLow * 0.28 -
    stallSeverity * 18 -
    vent * 10 -
    event.fieldPenalty;
  state.containment = clamp(
    damp(state.containment, stabilityTarget * (1 - state.shutdownLevel), lerp(0.85, 1.8, state.shutdownLevel), dt),
    0,
    100,
  );

  const tempQuality = bandQuality(state.plasmaTemp, operatingTargets.temp[0], operatingTargets.temp[1], 55);
  const powerTempQuality = getBurnTemperatureQuality(state.plasmaTemp);
  const containmentQuality = clamp((state.containment - 35) / 60, 0, 1);
  const fieldDrain = 1 - field * 0.24;
  const stallPenalty = clamp(1 - stallSeverity * 0.82, 0.05, 1);
  const ventPenalty = vent ? 0.05 : 1;
  const thermalInstability = clamp((state.plasmaTemp - 158) / 34, 0, 1);
  const fieldInstability = clamp((62 - state.containment) / 40, 0, 1);
  const surgeAmount = Math.max(thermalInstability, fieldInstability);
  const surgeWave =
    Math.sin(state.elapsed * 5.7) * 0.55 + Math.sin(state.elapsed * 13.3 + 1.4) * 0.3 + Math.sin(state.elapsed * 29.1) * 0.15;
  state.outputSurge = damp(
    state.outputSurge,
    state.reactionStalled ? 0 : Math.abs(surgeWave) * surgeAmount * 100,
    state.reactionStalled ? 4 : 2.2,
    dt,
  );
  const surgeMultiplier = clamp(1 + surgeWave * surgeAmount * 0.22, 0.62, 1.2);
  const rawOutput =
    fuel *
      1260 *
      state.burnRate *
      powerTempQuality *
      containmentQuality *
      fieldDrain *
      stallPenalty *
      ventPenalty *
      surgeMultiplier *
      (1 - state.shutdownLevel);
  state.powerOutput = damp(state.powerOutput, rawOutput, lerp(0.75, 3.2, state.shutdownLevel), dt);

  const outputQuality = bandQuality(state.powerOutput, operatingTargets.output[0], operatingTargets.output[1], 420);
  const burnQuality = clamp(state.burnRate - stallSeverity * 0.35, 0, 1);
  const activeEfficiency = clamp(
        (tempQuality * 0.26 + containmentQuality * 0.25 + outputQuality * 0.25 + powerTempQuality * 0.08 + burnQuality * 0.16) *
          100,
        0,
        100,
      );
  state.reactionEfficiency = damp(
    state.reactionEfficiency,
    activeEfficiency * (1 - state.shutdownLevel),
    lerp(1.8, 4, state.shutdownLevel),
    dt,
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

  const activeStressRate =
    Math.pow(redHeat / 18, 2.15) * 0.25 +
    Math.pow(deepRedHeat / 10, 3.1) * 0.12 +
    state.thermalSoak * 0.025 +
    Math.max(0, 55 - state.containment) * 0.026 +
    Math.max(0, state.coreStall - 65) * 0.006 +
    Math.max(0, state.powerOutput - 1120) * 0.008 +
    vent * 0.025;
  const stressRate = activeStressRate * (1 - state.shutdownLevel) - state.shutdownLevel * 0.18;
  state.coreStress = clamp(state.coreStress + stressRate * dt, 0, 100);
  state.stallLockTimer = state.reactionStalled ? state.stallLockTimer + dt : Math.max(0, state.stallLockTimer - dt * 1.4);

  state.elapsed = clamp(state.elapsed + dt, 0, TOTAL_TIME);
  state.targetOutput = demand;
  const underDemandRatio = demand > 0 ? Math.max(0, (demand - state.powerOutput) / demand) : 0;
  const overDemandRatio = demand > 0 ? Math.max(0, (state.powerOutput - demand) / demand) : 0;

  state.warning = {
    tempHigh: state.plasmaTemp > 140,
    tempCritical: state.plasmaTemp > 155,
    fieldWeak: state.containment < operatingTargets.containmentMin,
    outputLow: state.powerOutput < demand * 0.9 && state.elapsed > 8,
    underDemand: underDemandRatio > 0.05 && state.elapsed > 8,
    underDemandCritical: underDemandRatio > 0.25 && state.elapsed > 8,
    overDemand: overDemandRatio > 0.06 && state.elapsed > 8,
    overDemandCritical: overDemandRatio > 0.25 && state.elapsed > 8,
    instability: state.containment < 50,
    coreStall: state.coreStall > 45 || state.reactionStalled,
    coreStallCritical: state.coreStall > 72 || state.reactionStalled,
    thermalSoak: state.thermalSoak > 45,
    outputSurge: state.outputSurge > 34,
    coreStress: state.coreStress > 70 || state.thermalSoak > 70,
  };
  state.status = pickStatus(state, operatingTargets, tempLow, tempHigh, event);

  if (state.coreStress >= 100 || state.fuelReserve <= 0 || (!state.reactionStalled && state.containment <= 5)) {
    state.mode = "failed";
    state.failureType = state.coreStress >= 100 ? "coreDestroyed" : "safeShutdown";
    state.status = state.failureType === "coreDestroyed" ? "CORE STRESS LIMIT EXCEEDED" : "REACTION LOST";
  } else if (state.elapsed >= TOTAL_TIME) {
    state.mode = state.averageEfficiency >= 62 && state.coreStress < 100 ? "complete" : "failed";
    state.failureType = state.mode === "failed" ? "qualityFailure" : null;
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
    reactionStalled: state.reactionStalled,
    shutdownLevel: state.shutdownLevel,
    flameoutTimer: state.flameoutTimer,
    ignitionHold: state.ignitionHold,
    ignitionPulseCount: state.ignitionPulseCount,
    pulseCharge: state.pulseCharge,
    pulseCooldown: state.pulseCooldown,
    reactionEfficiency: state.reactionEfficiency,
    failureType: state.failureType,
    averageEfficiency: state.averageEfficiency,
    status: state.status,
    warning: { ...state.warning },
  };
}

function getPhase(elapsed) {
  return PHASES.find((phase) => elapsed >= phase.start && elapsed < phase.end) ?? PHASES[PHASES.length - 1];
}

function getOperatingTargets(elapsed) {
  const foundPhaseIndex = PHASES.findIndex((phase) => elapsed >= phase.start && elapsed < phase.end);
  const phaseIndex = foundPhaseIndex >= 0 ? foundPhaseIndex : PHASES.length - 1;
  const current = PHASES[phaseIndex] ?? PHASES[PHASES.length - 1];
  if (phaseIndex === 0) return current;

  const previous = PHASES[phaseIndex - 1];
  const transition = smoothstep01((elapsed - current.start) / 9);
  return {
    ...current,
    temp: [lerp(previous.temp[0], current.temp[0], transition), lerp(previous.temp[1], current.temp[1], transition)],
    powerTemp: [
      lerp(previous.powerTemp[0], current.powerTemp[0], transition),
      lerp(previous.powerTemp[1], current.powerTemp[1], transition),
    ],
    output: [
      lerp(previous.output[0], current.output[0], transition),
      lerp(previous.output[1], current.output[1], transition),
    ],
    containmentMin: lerp(previous.containmentMin, current.containmentMin, transition),
    demand: lerp(previous.demand, current.demand, transition),
  };
}

function pickStatus(state, phase, tempLow, tempHigh, event) {
  if (state.thermalSoak > 75) return "CORE HEAT SOAK RUNAWAY";
  if (state.reactionStalled && state.ignitionHold > 0) return "IGNITION BANK CHARGING";
  if (state.reactionStalled) return "CORE STALLED - SET FUEL / REDUCE COOLANT / HOLD PULSE";
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
  if (event.status) return event.status;
  if (state.reactionEfficiency > 78 && bandQuality(state.powerOutput, phase.output[0], phase.output[1], 200) > 0.9) {
    return "BURN WINDOW STABLE";
  }
  return "PARAMETERS DRIFTING";
}

function getLiveDemand(phase, elapsed, event) {
  const gridWander = Math.sin(elapsed * 0.19) * 18 + Math.sin(elapsed * 0.071 + 1.2) * 12;
  return Math.max(0, Math.round(phase.demand + gridWander + event.demandOffset));
}

function getShiftEvent(elapsed) {
  if (elapsed >= 62 && elapsed < 76) {
    return { demandOffset: 35, coolantEfficiency: 0.62, fieldPenalty: 0, status: "HEAT SINK FLOW DEGRADED" };
  }
  if (elapsed >= 98 && elapsed < 112) {
    return { demandOffset: 125, coolantEfficiency: 1, fieldPenalty: 0, status: "GRID DRAW STEP DETECTED" };
  }
  if (elapsed >= 118 && elapsed < 128) {
    return { demandOffset: -80, coolantEfficiency: 1, fieldPenalty: 0, status: "GRID LOAD SHEDDING" };
  }
  if (elapsed >= 145 && elapsed < 162) {
    return { demandOffset: 55, coolantEfficiency: 1, fieldPenalty: 11, status: "FIELD BUS INTERFERENCE" };
  }
  return { demandOffset: 0, coolantEfficiency: 1, fieldPenalty: 0, status: "" };
}

function bandQuality(value, min, max, falloff) {
  if (value >= min && value <= max) return 1;
  const distance = value < min ? min - value : value - max;
  return clamp(1 - distance / falloff, 0, 1);
}

function getBurnTemperatureQuality(temperature) {
  const ignitionQuality = clamp((temperature - 45) / 50, 0, 1);
  const redlineQuality = 1 - clamp((temperature - 178) / 24, 0, 1);
  return ignitionQuality * redlineQuality;
}

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function smoothstep01(value) {
  const amount = clamp(value, 0, 1);
  return amount * amount * (3 - 2 * amount);
}
