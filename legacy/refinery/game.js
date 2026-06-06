const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (current, target, rate) => current + (target - current) * rate;

const WIN_TARGETS = {
  production: 320,
  averagePurity: 75,
  maxDamage: 100,
};

const PHASES = [
  {
    name: "Startup",
    feed: "Warm prime",
    start: 300,
    pressure: [48, 68],
    temperature: [58, 74],
    flow: [20, 38],
    valve: [0.42, 0.68],
    dirty: 0.65,
    viscosity: 0.9,
    feedTemp: 64,
    solids: 0.18,
    heatBias: 4,
    outputBonus: 0.9,
  },
  {
    name: "Normal Feed",
    feed: "Steady crude",
    start: 245,
    pressure: [60, 78],
    temperature: [62, 80],
    flow: [32, 54],
    valve: [0.5, 0.72],
    dirty: 1,
    viscosity: 1,
    feedTemp: 70,
    solids: 0.28,
    heatBias: 0,
    outputBonus: 1,
  },
  {
    name: "Cold Viscous Feed",
    feed: "Heavy cold feed",
    start: 180,
    pressure: [66, 88],
    temperature: [76, 92],
    flow: [26, 48],
    valve: [0.36, 0.62],
    dirty: 1.15,
    viscosity: 1.65,
    feedTemp: 48,
    solids: 0.38,
    heatBias: 0,
    outputBonus: 0.88,
  },
  {
    name: "Dirty Feed",
    feed: "Solids carryover",
    start: 120,
    pressure: [58, 82],
    temperature: [66, 84],
    flow: [24, 46],
    valve: [0.34, 0.58],
    dirty: 2.5,
    viscosity: 1.2,
    feedTemp: 58,
    solids: 0.78,
    heatBias: -2,
    outputBonus: 0.82,
  },
  {
    name: "Final High Output",
    feed: "Dispatch push",
    start: 55,
    pressure: [72, 94],
    temperature: [72, 90],
    flow: [46, 74],
    valve: [0.56, 0.84],
    dirty: 1.35,
    viscosity: 1.05,
    feedTemp: 84,
    solids: 0.45,
    heatBias: 2,
    outputBonus: 1.22,
  },
];

const initialMachine = () => ({
  pressure: 55,
  temperature: 62,
  filterTemp: 62,
  flow: 36,
  filterClog: 0.1,
  filterWear: 0,
  pump: 0.5,
  coolant: 0.45,
  outputValve: 0.55,
  isFlushing: false,
  timeLeft: 300,
  production: 0,
  purity: 82,
  purityTotal: 0,
  flushReserve: 100,
  phaseIndex: 0,
  phaseTime: 0,
  lineResistance: 0,
  viscosityLoad: 0,
  qualityParts: {
    pressure: 80,
    temperature: 80,
    flow: 80,
    filter: 90,
  },
  damage: 0,
  lowPumpTime: 0,
  sediment: 0,
  restartArmed: false,
  restartSpike: 0,
  gameOver: false,
  failReason: "",
  maxPressure: 55,
  maxTemperature: 62,
});

let machine = initialMachine();
let lastTime = performance.now();
let eventMemory = initialEventMemory();
let recorder = {
  active: false,
  startedAt: 0,
  nextSampleAt: 0,
  events: [],
  samples: [],
};

const els = {
  roomCanvas: document.querySelector("#roomCanvas"),
  pressureGauge: document.querySelector("#pressureGauge"),
  tempGauge: document.querySelector("#tempGauge"),
  flowGauge: document.querySelector("#flowGauge"),
  pressureValue: document.querySelector("#pressureValue"),
  tempValue: document.querySelector("#tempValue"),
  flowValue: document.querySelector("#flowValue"),
  phaseName: document.querySelector("#phaseName"),
  phaseFeed: document.querySelector("#phaseFeed"),
  currentBatch: document.querySelector("#currentBatch"),
  currentPhase: document.querySelector("#currentPhase"),
  inputFeedTemp: document.querySelector("#inputFeedTemp"),
  preFilterTemp: document.querySelector("#preFilterTemp"),
  viscosityValue: document.querySelector("#viscosityValue"),
  solidsValue: document.querySelector("#solidsValue"),
  filterTempTarget: document.querySelector("#filterTempTarget"),
  filterLamp: document.querySelector("#filterLamp"),
  filterLoadFill: document.querySelector("#filterLoadFill"),
  lineResistanceText: document.querySelector("#lineResistanceText"),
  pressureQuality: document.querySelector("#pressureQuality"),
  temperatureQuality: document.querySelector("#temperatureQuality"),
  flowQuality: document.querySelector("#flowQuality"),
  filterQuality: document.querySelector("#filterQuality"),
  pressureQualityValue: document.querySelector("#pressureQualityValue"),
  temperatureQualityValue: document.querySelector("#temperatureQualityValue"),
  flowQualityValue: document.querySelector("#flowQualityValue"),
  filterQualityValue: document.querySelector("#filterQualityValue"),
  pump: document.querySelector("#pump"),
  coolant: document.querySelector("#coolant"),
  outputValve: document.querySelector("#outputValve"),
  pumpValue: document.querySelector("#pumpValue"),
  coolantValue: document.querySelector("#coolantValue"),
  valveValue: document.querySelector("#valveValue"),
  flushButton: document.querySelector("#flushButton"),
  flushFill: document.querySelector("#flushFill"),
  timeLeft: document.querySelector("#timeLeft"),
  statusText: document.querySelector("#statusText"),
  productionValue: document.querySelector("#productionValue"),
  purityValue: document.querySelector("#purityValue"),
  avgPurityValue: document.querySelector("#avgPurityValue"),
  clogValue: document.querySelector("#clogValue"),
  filterWearValue: document.querySelector("#filterWearValue"),
  filterTempValue: document.querySelector("#filterTempValue"),
  flushReserveValue: document.querySelector("#flushReserveValue"),
  damageValue: document.querySelector("#damageValue"),
  eventLog: document.querySelector("#eventLog"),
  recordButton: document.querySelector("#recordButton"),
  restartButton: document.querySelector("#restartButton"),
  overlayRestartButton: document.querySelector("#overlayRestartButton"),
  resultOverlay: document.querySelector("#resultOverlay"),
  resultKicker: document.querySelector("#resultKicker"),
  resultTitle: document.querySelector("#resultTitle"),
  resultProduction: document.querySelector("#resultProduction"),
  resultPurity: document.querySelector("#resultPurity"),
  resultDamage: document.querySelector("#resultDamage"),
  resultPressure: document.querySelector("#resultPressure"),
  resultTemperature: document.querySelector("#resultTemperature"),
};

function initialEventMemory() {
  return {
    pressure: "safe",
    temperature: "safe",
    flow: "usable",
    clog: "normal",
    purity: "good",
    reserve: "full",
    sediment: "clear",
    phase: "Startup",
    filterDp: "normal",
    wear: "normal",
    flushing: false,
  };
}

function logEvent(message, level = "info") {
  const stamp = formatTime(machine.timeLeft);
  const line = `[${stamp}] ${message}`;
  const snapshot = getRecordingSnapshot();
  console.log(`[Operator Room] ${line}`, {
    pressure: Math.round(machine.pressure),
    filterTemp: Math.round(machine.filterTemp),
    flow: Math.round(machine.flow),
    filterTemp: Math.round(machine.filterTemp),
    purity: Math.round(machine.purity),
    averagePurity: Math.round(getAveragePurity()),
    filterClog: Number(machine.filterClog.toFixed(2)),
    filterWear: Number(machine.filterWear.toFixed(2)),
    flushReserve: Math.round(machine.flushReserve),
    sediment: Number(machine.sediment.toFixed(2)),
    damage: Math.round(machine.damage),
  });

  const node = document.createElement("div");
  node.className = level;
  node.textContent = line;
  els.eventLog.prepend(node);
  els.eventLog.scrollTop = 0;

  if (recorder.active) {
    recorder.events.push({
      t: Math.round((300 - machine.timeLeft) * 10) / 10,
      timeLeft: Math.round(machine.timeLeft * 10) / 10,
      level,
      message,
      snapshot,
    });
  }

  while (els.eventLog.children.length > 34) {
    els.eventLog.lastElementChild.remove();
  }
}

function setHeldFlush(isHeld) {
  if (machine.gameOver) return;
  const canFlush = isHeld && machine.flushReserve > 0;
  machine.isFlushing = canFlush;
  els.flushButton.classList.toggle("is-held", canFlush);

  if (eventMemory.flushing !== canFlush) {
    eventMemory.flushing = canFlush;
    if (canFlush) {
      logEvent("Filter flush started. Load is being washed out.", "good");
    } else if (isHeld && machine.flushReserve <= 0) {
      logEvent("Flush reserve depleted.", "danger");
    } else {
      logEvent("Filter flush released.", "info");
    }
  }
}

function updateMachine(dt) {
  if (machine.gameOver) return;

  machine.timeLeft -= dt;
  updatePhase();
  updateSediment(dt);

  const phase = getCurrentPhase();
  const valveQuality = bandScore(machine.outputValve, phase.valve[0], phase.valve[1]);
  const tooOpen = Math.max(0, machine.outputValve - phase.valve[1]);
  const tooClosed = Math.max(0, phase.valve[0] - machine.outputValve);
  const filterTarget = phase.temperature;
  const preparedTempTarget = clamp(phase.feedTemp + machine.pump * 55 - machine.coolant * 42 + phase.heatBias, 8, 130);
  machine.filterTemp = lerp(machine.filterTemp, preparedTempTarget, clamp(dt * 0.22, 0, 1));
  const coldViscosity = Math.max(0, filterTarget[0] - machine.filterTemp) * 0.026 * phase.viscosity;
  const heatStress = Math.max(0, machine.filterTemp - filterTarget[1]) * 0.018;
  const highFlowStress = Math.max(0, machine.flow - phase.flow[1]) * 0.012;
  const valveFlow = 0.36 + machine.outputValve * 1.02 - tooOpen * 0.85 - tooClosed * 1.15;
  const valvePressureRelief = machine.outputValve * (34 + phase.outputBonus * 10);
  const resistance = 1 + machine.filterClog * 2.45 + machine.filterWear * 1.35 + coldViscosity + tooClosed * 2.2 + machine.sediment * 0.65;
  machine.lineResistance = lerp(machine.lineResistance, clamp((resistance - 1) / 2.9, 0, 1), clamp(dt * 1.6, 0, 1));
  machine.viscosityLoad = lerp(machine.viscosityLoad, clamp(coldViscosity / 1.8, 0, 1), clamp(dt * 1.2, 0, 1));

  const clogRate =
    machine.pump * machine.pump * 0.0035 +
    phase.solids * phase.dirty * 0.009 +
    coldViscosity * 0.015 +
    highFlowStress * 0.014 +
    machine.filterWear * 0.008;
  machine.filterClog += clogRate * dt;

  const tempDistance = Math.max(filterTarget[0] - machine.filterTemp, machine.filterTemp - filterTarget[1], 0);
  const wearRate =
    tempDistance * 0.0009 +
    heatStress * 0.01 +
    Math.max(0, machine.flow - phase.flow[1] - 8) * 0.00035 +
    Math.max(0, machine.pressure - phase.pressure[1] - 12) * 0.00045 +
    phase.solids * 0.001;
  machine.filterWear = clamp(machine.filterWear + wearRate * dt, 0, 1);

  if (machine.isFlushing) {
    const reserveUse = 5.2 * dt;
    machine.flushReserve = clamp(machine.flushReserve - reserveUse, 0, 100);
    if (machine.flushReserve <= 0) {
      machine.isFlushing = false;
      els.flushButton.classList.remove("is-held");
      logEvent("Flush reserve depleted.", "danger");
    } else {
      const dirtyBonus = phase.name === "Dirty Feed" ? 0.045 : 0;
      machine.filterClog -= (0.18 + dirtyBonus) * dt;
    }
  } else {
    const pumpPenalty = machine.pump > 0.7 ? 0.25 : machine.pump < 0.18 ? 0.2 : 0;
    machine.flushReserve = clamp(machine.flushReserve + (0.46 - pumpPenalty) * dt, 0, 100);
  }

  machine.filterClog = clamp(machine.filterClog, 0, 1);

  const targetFlow = clamp((machine.pump * 108 * valveFlow * phase.outputBonus) / resistance, 0, 110);
  const targetPressure = clamp(28 + machine.pump * 66 * resistance - valvePressureRelief + machine.restartSpike, 5, 138);
  const targetTemperature = clamp(machine.filterTemp + machine.pump * 18 - machine.coolant * 18 + machine.filterClog * 12 + machine.sediment * 8, 8, 130);

  machine.flow = lerp(machine.flow, targetFlow, clamp(dt * 0.72, 0, 1));
  machine.pressure = lerp(machine.pressure, targetPressure, clamp(dt * 0.55, 0, 1));
  machine.temperature = lerp(machine.temperature, targetTemperature, clamp(dt * 0.18, 0, 1));
  machine.restartSpike = Math.max(0, machine.restartSpike - dt * 18);

  const pressureQuality = targetBandScore(machine.pressure, phase.pressure);
  const temperatureQuality = targetBandScore(machine.filterTemp, phase.temperature);
  const flowQuality = targetBandScore(machine.flow, phase.flow);
  const filterQuality = clamp(100 - machine.filterClog * 46 - machine.filterWear * 42 - machine.lineResistance * 12, 0, 100);
  machine.qualityParts = {
    pressure: pressureQuality,
    temperature: temperatureQuality,
    flow: flowQuality,
    filter: filterQuality,
  };

  const valvePenalty = (1 - valveQuality) * 16 + tooOpen * 38;
  const purityTarget = clamp(
    pressureQuality * 0.3 + temperatureQuality * 0.3 + flowQuality * 0.24 + filterQuality * 0.16 - valvePenalty,
    22,
    98,
  );
  machine.purity = lerp(machine.purity, purityTarget, clamp(dt * 0.35, 0, 1));

  const producing =
    !machine.isFlushing &&
    machine.pressure >= phase.pressure[0] - 15 &&
    machine.pressure <= phase.pressure[1] + 18 &&
    machine.filterTemp >= phase.temperature[0] - 16 &&
    machine.filterTemp <= phase.temperature[1] + 18 &&
    machine.flow >= Math.max(14, phase.flow[0] - 14);
  if (producing) {
    const units = machine.flow * (0.055 + machine.purity / 3000) * phase.outputBonus * dt;
    machine.production += units;
    machine.purityTotal += units * machine.purity;
  }

  applyDamage(dt);

  machine.damage = clamp(machine.damage, 0, 100);
  machine.maxPressure = Math.max(machine.maxPressure, machine.pressure);
  machine.maxTemperature = Math.max(machine.maxTemperature, machine.filterTemp);

  if (machine.pressure >= 124) endGame("Pressure rupture");
  if (machine.filterTemp >= 118) endGame("Filter overheated");
  if (machine.damage >= 100) endGame("Machine damage critical");
  if (machine.timeLeft <= 0) endGame("Shift complete");
}

function updateSediment(dt) {
  if (machine.pump < 0.2) {
    machine.lowPumpTime += dt;
    if (machine.lowPumpTime > 5) {
      machine.restartArmed = true;
      machine.sediment = clamp(machine.sediment + (0.05 + (5 - machine.pump * 20) * 0.006) * dt, 0, 1);
    }
  } else {
    if (machine.restartArmed && machine.pump >= 0.25 && machine.sediment > 0.02) {
      machine.restartSpike += 22 + machine.sediment * 42;
      machine.filterClog += machine.sediment * 0.2;
      machine.damage += machine.sediment * 8;
      logEvent("Restart surge shook loose settled material.", "danger");
      machine.sediment *= 0.45;
      machine.restartArmed = false;
    }
    machine.lowPumpTime = Math.max(0, machine.lowPumpTime - dt * 2);
    machine.sediment = Math.max(0, machine.sediment - dt * 0.008);
  }
}

function applyDamage(dt) {
  if (machine.pressure > 105) machine.damage += (machine.pressure - 105) * dt * 0.16;
  if (machine.filterTemp > 102) machine.damage += (machine.filterTemp - 102) * dt * 0.14;
  if (machine.filterTemp < 30 && machine.pump > 0.35) machine.damage += (30 - machine.filterTemp) * dt * 0.04;
  if (machine.pressure < 28 && machine.pump > 0.45) machine.damage += (28 - machine.pressure) * dt * 0.03;
}

function bandScore(value, low, high) {
  if (value >= low && value <= high) return 1;
  const distance = value < low ? low - value : value - high;
  return clamp(1 - distance / 0.22, 0, 1);
}

function targetBandScore(value, band) {
  if (value >= band[0] && value <= band[1]) return 100;
  const distance = value < band[0] ? band[0] - value : value - band[1];
  return clamp(100 - distance * 5, 0, 100);
}

function getCurrentPhase() {
  return PHASES[machine.phaseIndex] || PHASES[0];
}

function updatePhase() {
  const nextIndex = PHASES.reduce((found, phase, index) => (machine.timeLeft <= phase.start ? index : found), 0);
  if (nextIndex !== machine.phaseIndex) {
    machine.phaseIndex = nextIndex;
    machine.phaseTime = 0;
  }
}

function readControls() {
  machine.pump = Number(els.pump.value) / 100;
  machine.coolant = Number(els.coolant.value) / 100;
  machine.outputValve = Number(els.outputValve.value) / 100;
  els.pumpValue.textContent = `${Math.round(machine.pump * 100)}%`;
  els.coolantValue.textContent = `${Math.round(machine.coolant * 100)}%`;
  els.valveValue.textContent = `${Math.round(machine.outputValve * 100)}%`;
}

function zonePressure(value) {
  const band = getCurrentPhase().pressure;
  if (value < band[0] - 16) return "low";
  if (value <= band[1]) return value >= band[0] ? "safe" : "warning";
  if (value <= band[1] + 18) return "warning";
  return "danger";
}

function zoneTemperature(value) {
  const band = getCurrentPhase().temperature;
  if (value < band[0] - 15) return "low";
  if (value <= band[1]) return value >= band[0] ? "safe" : "warning";
  if (value <= band[1] + 16) return "warning";
  return "danger";
}

function zoneFlow(value) {
  const band = getCurrentPhase().flow;
  if (value < band[0] - 12) return "low";
  if (value <= band[1]) return value >= band[0] ? "usable" : "warning";
  return "high";
}

function statusFromZones(pressureZone, tempZone, flowZone) {
  const phase = getCurrentPhase();
  if (machine.gameOver && machine.failReason === "Shift complete") return didWin() ? "SHIFT WON" : "TARGET MISSED";
  if (machine.gameOver) return "FAILURE";
  if (machine.isFlushing) return "FILTER WASH ACTIVE";
  if (machine.lineResistance > 0.72 && machine.pump > 0.48 && flowZone !== "high") return "PUMP RESPONSE WEAK";
  if (machine.filterTemp < phase.temperature[0] - 8) return "FEED TOO COLD AT FILTER";
  if (machine.filterTemp > phase.temperature[1] + 8) return "FILTER TEMP HIGH";
  if (machine.filterWear > 0.55) return "FILTER MEDIA DEGRADED";
  if (pressureZone === "danger") return "PRESSURE UNSTABLE";
  if (tempZone === "danger") return "TEMPERATURE UNSTABLE";
  if (machine.filterClog > 0.55 || machine.lineResistance > 0.62 || (flowZone === "low" && pressureZone !== "low")) return "FLOW RESISTANCE RISING";
  if (tempZone === "low") return "FILTER TEMP LOW";
  if (tempZone === "warning") return "FILTER TEMP DRIFTING";
  if (pressureZone === "warning" || pressureZone === "low") return "PRESSURE UNSTABLE";
  if (flowZone === "warning") return "FLOW OFF TARGET";
  if (flowZone === "high") return "RESIDENCE TIME SHORT";
  if (machine.purity < 70) return "PRODUCT QUALITY DRIFTING";
  if (machine.lowPumpTime > 5) return "LINE SETTLING";
  return `${getCurrentPhase().name.toUpperCase()} STABLE`;
}

function checkEventTransitions(pressureZone, tempZone, flowZone) {
  const phase = getCurrentPhase();
  if (eventMemory.phase !== phase.name) {
    eventMemory.phase = phase.name;
    logEvent(`Now processing ${phase.name}: ${phase.feed}.`, "warning");
  }

  if (eventMemory.pressure !== pressureZone) {
    eventMemory.pressure = pressureZone;
    if (pressureZone === "warning") logEvent("Pressure unstable.", "warning");
    if (pressureZone === "danger") logEvent("Pressure surge approaching failure limits.", "danger");
    if (pressureZone === "safe") logEvent("Pressure returned to operating band.", "good");
    if (pressureZone === "low") logEvent("Pressure sag reducing product formation.", "warning");
  }

  if (eventMemory.temperature !== tempZone) {
    eventMemory.temperature = tempZone;
    if (tempZone === "warning") logEvent("Temperature drifting high.", "warning");
    if (tempZone === "danger") logEvent("Temperature near thermal failure.", "danger");
    if (tempZone === "safe") logEvent("Temperature returned to operating band.", "good");
    if (tempZone === "low") logEvent("Filter feed temperature low; mixture thickening.", "warning");
  }

  if (eventMemory.flow !== flowZone) {
    eventMemory.flow = flowZone;
    if (flowZone === "low") logEvent("Flow below production threshold.", "warning");
    if (flowZone === "warning") logEvent("Flow drifting outside batch target.", "warning");
    if (flowZone === "usable") logEvent("Flow recovered to usable output.", "good");
    if (flowZone === "high") logEvent("Flow running high; watch quality drift.", "warning");
  }

  const clogZone = machine.filterClog > 0.7 ? "heavy" : machine.filterClog > 0.45 ? "building" : "normal";
  if (eventMemory.clog !== clogZone) {
    eventMemory.clog = clogZone;
    if (clogZone === "building") logEvent("Flow resistance rising.", "warning");
    if (clogZone === "heavy") logEvent("Filter resistance is heavy.", "danger");
    if (clogZone === "normal") logEvent("Filter resistance back to normal.", "good");
  }

  const wearZone = machine.filterWear > 0.65 ? "high" : machine.filterWear > 0.35 ? "degraded" : "normal";
  if (eventMemory.wear !== wearZone) {
    eventMemory.wear = wearZone;
    if (wearZone === "degraded") logEvent("Filter media showing wear; load will build faster.", "warning");
    if (wearZone === "high") logEvent("Filter media heavily degraded.", "danger");
    if (wearZone === "normal") logEvent("Filter media condition stable.", "good");
  }

  const filterDpZone = machine.lineResistance > 0.72 ? "high" : machine.lineResistance > 0.5 ? "rising" : "normal";
  if (eventMemory.filterDp !== filterDpZone) {
    eventMemory.filterDp = filterDpZone;
    if (filterDpZone === "rising") logEvent("Line resistance rising; pump changes may have weak flow response.", "warning");
    if (filterDpZone === "high") logEvent("Filter delta pressure high.", "danger");
    if (filterDpZone === "normal") logEvent("Line resistance returned to normal.", "good");
  }

  const purityZone = machine.purity < 65 ? "poor" : machine.purity < 75 ? "thin" : "good";
  if (eventMemory.purity !== purityZone) {
    eventMemory.purity = purityZone;
    if (purityZone === "poor") logEvent("Product purity falling below target.", "danger");
    if (purityZone === "thin") logEvent("Product quality drifting.", "warning");
    if (purityZone === "good") logEvent("Product purity recovered.", "good");
  }

  const reserveZone = machine.flushReserve < 20 ? "low" : machine.flushReserve < 55 ? "used" : "full";
  if (eventMemory.reserve !== reserveZone) {
    eventMemory.reserve = reserveZone;
    if (reserveZone === "used") logEvent("Flush reserve partly depleted.", "warning");
    if (reserveZone === "low") logEvent("Flush reserve low.", "danger");
  }

  const sedimentZone = machine.sediment > 0.35 ? "heavy" : machine.lowPumpTime > 5 ? "settling" : "clear";
  if (eventMemory.sediment !== sedimentZone) {
    eventMemory.sediment = sedimentZone;
    if (sedimentZone === "settling") logEvent("Line settling from low pump speed.", "warning");
    if (sedimentZone === "heavy") logEvent("Sediment buildup is heavy.", "danger");
    if (sedimentZone === "clear") logEvent("Line movement cleared settling risk.", "good");
  }
}

function renderUi() {
  const phase = getCurrentPhase();
  const pressureZone = zonePressure(machine.pressure);
  const tempZone = zoneTemperature(machine.filterTemp);
  const flowZone = zoneFlow(machine.flow);
  const status = statusFromZones(pressureZone, tempZone, flowZone);

  els.pressureValue.textContent = Math.round(machine.pressure);
  els.tempValue.textContent = Math.round(machine.filterTemp);
  els.flowValue.textContent = Math.round(machine.flow);
  els.timeLeft.textContent = formatTime(machine.timeLeft);
  els.statusText.textContent = status;
  els.statusText.style.color = statusColor(status);
  els.phaseName.textContent = phase.name;
  els.phaseFeed.textContent = phase.feed;
  els.currentBatch.textContent = phase.name;
  els.currentPhase.textContent = `${phase.feed}: P ${phase.pressure[0]}-${phase.pressure[1]}, T ${phase.temperature[0]}-${phase.temperature[1]}, F ${phase.flow[0]}-${phase.flow[1]}`;
  els.inputFeedTemp.textContent = `${Math.round(phase.feedTemp)}°`;
  els.preFilterTemp.textContent = `${Math.round(machine.filterTemp)}°`;
  els.viscosityValue.textContent = getViscosityText();
  els.solidsValue.textContent = getSolidsText(phase.solids);
  els.filterTempTarget.textContent = `Filter temp target ${phase.temperature[0]}-${phase.temperature[1]}°`;
  els.productionValue.textContent = `${Math.floor(machine.production)} / ${WIN_TARGETS.production}`;
  els.purityValue.textContent = `${Math.round(machine.purity)}%`;
  els.avgPurityValue.textContent = `${Math.round(getAveragePurity())}%`;
  els.clogValue.textContent = `${Math.round(machine.filterClog * 100)}%`;
  els.filterWearValue.textContent = `${Math.round(machine.filterWear * 100)}%`;
  els.filterTempValue.textContent = `${Math.round(machine.filterTemp)}°`;
  els.flushReserveValue.textContent = `${Math.round(machine.flushReserve)}%`;
  els.damageValue.textContent = `${Math.round(machine.damage)}%`;
  els.flushFill.style.height = `${machine.isFlushing ? clamp(machine.flushReserve, 2, 100) : 0}%`;
  els.filterLoadFill.style.width = `${Math.round(machine.lineResistance * 100)}%`;
  els.filterLamp.classList.toggle("is-on", machine.lineResistance > 0.72);
  els.lineResistanceText.textContent = getLineResistanceText();
  updateQualityMeter(els.pressureQuality, els.pressureQualityValue, machine.qualityParts.pressure);
  updateQualityMeter(els.temperatureQuality, els.temperatureQualityValue, machine.qualityParts.temperature);
  updateQualityMeter(els.flowQuality, els.flowQualityValue, machine.qualityParts.flow);
  updateQualityMeter(els.filterQuality, els.filterQualityValue, machine.qualityParts.filter);

  els.pressureGauge.closest(".gauge-card").dataset.zone = pressureZone;
  els.tempGauge.closest(".gauge-card").dataset.zone = tempZone;
  els.flowGauge.closest(".gauge-card").dataset.zone = flowZone;

  drawGauge(els.pressureGauge, machine.pressure, 0, 130, pressureZone, "PSI", phase.pressure);
  drawGauge(els.tempGauge, machine.filterTemp, 0, 125, tempZone, "C", phase.temperature);
  drawGauge(els.flowGauge, machine.flow, 0, 110, flowZone, "L/s", phase.flow);
  drawRoom();
  checkEventTransitions(pressureZone, tempZone, flowZone);
}

function updateQualityMeter(meter, label, value) {
  const rounded = Math.round(value);
  meter.value = rounded;
  label.textContent = `${rounded}%`;
}

function getLineResistanceText() {
  if (machine.lineResistance > 0.72) return "High delta pressure; pump response is restricted";
  if (machine.lineResistance > 0.5) return "Line resistance rising";
  if (machine.lineResistance > 0.28) return "Moderate load through filter";
  return "Line resistance nominal";
}

function getViscosityText() {
  if (machine.viscosityLoad > 0.72) return "Very High";
  if (machine.viscosityLoad > 0.45) return "High";
  if (machine.viscosityLoad > 0.18) return "Thick";
  return "Normal";
}

function getSolidsText(solids) {
  if (solids > 0.68) return "High";
  if (solids > 0.4) return "Medium";
  return "Low";
}

function statusColor(status) {
  if (status.includes("FAILURE") || status.includes("UNSTABLE") || status.includes("MISSED")) return "#ef665d";
  if (status.includes("DRIFTING") || status.includes("RISING") || status.includes("SETTLING") || status.includes("WEAK") || status.includes("OFF") || status.includes("SHORT")) return "#f2b35f";
  if (status.includes("WASH") || status.includes("WON")) return "#68b7ef";
  return "#67d787";
}

function zoneColor(zone) {
  if (zone === "danger" || zone === "low") return "#ef665d";
  if (zone === "warning") return "#f2b35f";
  if (zone === "high") return "#68b7ef";
  return "#67d787";
}

function drawGauge(canvas, value, min, max, zone, unit, targetBand) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h * 0.86;
  const radius = Math.min(w * 0.38, h * 0.68);
  const start = Math.PI * 1.12;
  const end = Math.PI * 1.88;
  const t = clamp((value - min) / (max - min), 0, 1);
  const angle = start + (end - start) * t;

  ctx.clearRect(0, 0, w, h);
  ctx.lineCap = "round";
  ctx.lineWidth = 13;
  ctx.strokeStyle = "#303940";
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, end);
  ctx.stroke();

  if (targetBand) {
    const bandStart = start + (end - start) * clamp((targetBand[0] - min) / (max - min), 0, 1);
    const bandEnd = start + (end - start) * clamp((targetBand[1] - min) / (max - min), 0, 1);
    ctx.strokeStyle = "rgba(103, 215, 135, 0.8)";
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1, bandStart, bandEnd);
    ctx.stroke();
  }

  ctx.strokeStyle = zoneColor(zone);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, start, angle);
  ctx.stroke();

  for (let i = 0; i <= 8; i += 1) {
    const markAngle = start + ((end - start) * i) / 8;
    const inner = radius - 17;
    const outer = radius - 4;
    ctx.strokeStyle = "#7b878e";
    ctx.lineWidth = i % 2 === 0 ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(markAngle) * inner, cy + Math.sin(markAngle) * inner);
    ctx.lineTo(cx + Math.cos(markAngle) * outer, cy + Math.sin(markAngle) * outer);
    ctx.stroke();
  }

  ctx.strokeStyle = "#e9eff1";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(angle) * (radius - 25), cy + Math.sin(angle) * (radius - 25));
  ctx.stroke();

  ctx.fillStyle = "#e9eff1";
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#9ba8ac";
  ctx.font = "700 16px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(unit, cx, h - 10);
}

function drawRoom() {
  const ctx = els.roomCanvas.getContext("2d");
  const w = els.roomCanvas.width;
  const h = els.roomCanvas.height;
  const pulse = performance.now() * 0.004;
  const pipeFlow = Math.max(0.1, machine.flow / 100);
  const phase = getCurrentPhase();

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#10161a";
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = "#171d22";
  ctx.fillRect(0, h - 86, w, 86);
  ctx.strokeStyle = "#2b363d";
  ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 56) {
    ctx.beginPath();
    ctx.moveTo(x, h - 86);
    ctx.lineTo(x + 34, h);
    ctx.stroke();
  }

  drawPipe(ctx, 105, 72, 105, 160, feedColor(phase.feedTemp, phase.temperature));
  drawPipe(ctx, 105, 160, 105, 212, feedColor(machine.filterTemp, phase.temperature));
  drawPipe(ctx, 160, 212, 830, 212, feedColor(machine.filterTemp, phase.temperature));
  drawPipe(ctx, 458, 105, 458, 212, "#54616b");
  drawPipe(ctx, 764, 212, 764, 122, "#54616b");

  drawFeedIndicators(ctx, phase, pulse);
  drawPump(ctx, 170, 214, machine.pump);
  drawFilter(ctx, 470, 212, machine.filterClog, machine.filterWear);
  drawValve(ctx, 770, 212, machine.outputValve);
  drawTank(ctx, 940, 136, machine.production);

  ctx.strokeStyle = machine.isFlushing ? "#67d787" : "#3b4750";
  ctx.lineWidth = 8;
  ctx.setLineDash([18, 12]);
  ctx.lineDashOffset = -pulse * 12;
  ctx.beginPath();
  ctx.moveTo(458, 105);
  ctx.lineTo(458, 48);
  ctx.lineTo(600, 48);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 18; i += 1) {
    const x = 205 + ((i * 44 + pulse * 22) % 610);
    const alpha = clamp(pipeFlow, 0.12, 0.86);
    ctx.fillStyle = `rgba(104, 183, 239, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, 212, 3 + pipeFlow * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < Math.round(phase.solids * 16); i += 1) {
    const x = 130 + ((i * 51 + pulse * 14) % 665);
    const y = 204 + Math.sin(pulse + i) * 8;
    ctx.fillStyle = "rgba(44, 34, 27, 0.82)";
    ctx.beginPath();
    ctx.arc(x, y, 2 + phase.solids * 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawLabel(ctx, "PUMP", 170, 305);
  drawLabel(ctx, "FILTER", 470, 305);
  drawLabel(ctx, "OUTPUT", 770, 305);
  drawLabel(ctx, "PROCESSED", 940, 305);

  if (machine.pressure > 105 || machine.filterTemp > 104) {
    ctx.fillStyle = `rgba(239, 102, 93, ${0.14 + Math.sin(pulse * 3) * 0.08})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function feedColor(temp, targetBand) {
  if (temp < targetBand[0]) return "#68b7ef";
  if (temp > targetBand[1]) return "#ef665d";
  return "#67d787";
}

function drawFeedIndicators(ctx, phase, pulse) {
  ctx.fillStyle = "#202931";
  ctx.strokeStyle = "#71808a";
  ctx.lineWidth = 4;
  ctx.fillRect(28, 28, 156, 44);
  ctx.strokeRect(28, 28, 156, 44);
  ctx.fillStyle = "#edf1f2";
  ctx.font = "800 19px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("INPUT FEED", 40, 57);
  ctx.font = "900 42px Segoe UI, sans-serif";
  ctx.fillText(`${Math.round(phase.feedTemp)}°`, 205, 65);

  ctx.fillStyle = "#d9e1e3";
  ctx.strokeStyle = "#71808a";
  ctx.lineWidth = 4;
  ctx.fillRect(42, 162, 126, 64);
  ctx.strokeRect(42, 162, 126, 64);
  ctx.fillStyle = "#11161a";
  ctx.font = "900 18px Segoe UI, sans-serif";
  ctx.fillText("PREWARM", 56, 190);
  ctx.fillText("PRECOOL", 56, 214);
  ctx.fillStyle = "#edf1f2";
  ctx.font = "900 38px Segoe UI, sans-serif";
  ctx.fillText(`${Math.round(machine.filterTemp)}°`, 188, 214);

  ctx.fillStyle = feedColor(machine.filterTemp, phase.temperature);
  ctx.globalAlpha = 0.25 + Math.sin(pulse * 2) * 0.08;
  ctx.fillRect(308, 302, 212, 10);
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#edf1f2";
  ctx.font = "800 18px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`FILTER TEMP ${Math.round(machine.filterTemp)}°`, 412, 292);
}

function drawPipe(ctx, x1, y1, x2, y2, color) {
  ctx.strokeStyle = "#252f36";
  ctx.lineWidth = 38;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.strokeStyle = color;
  ctx.lineWidth = 23;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawPump(ctx, x, y, power) {
  ctx.fillStyle = "#202931";
  ctx.strokeStyle = "#71808a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(performance.now() * 0.003 * (0.4 + power * 2.5));
  ctx.fillStyle = power > 0.75 ? "#f2b35f" : "#68b7ef";
  for (let i = 0; i < 4; i += 1) {
    ctx.rotate(Math.PI / 2);
    ctx.fillRect(0, -8, 48, 16);
  }
  ctx.restore();
}

function drawFilter(ctx, x, y, clog, wear) {
  ctx.fillStyle = "#202931";
  ctx.strokeStyle = "#71808a";
  ctx.lineWidth = 5;
  ctx.fillRect(x - 62, y - 64, 124, 128);
  ctx.strokeRect(x - 62, y - 64, 124, 128);

  for (let i = 0; i < 7; i += 1) {
    const barX = x - 42 + i * 14;
    ctx.fillStyle = i / 7 < clog ? "#80654a" : wear > 0.45 ? "#f2b35f" : "#67d787";
    ctx.fillRect(barX, y - 46, 8, 92);
  }

  if (wear > 0.08) {
    ctx.strokeStyle = `rgba(239, 102, 93, ${clamp(wear, 0.18, 0.8)})`;
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      const yLine = y - 42 + i * 22;
      ctx.beginPath();
      ctx.moveTo(x - 50, yLine);
      ctx.lineTo(x + 50, yLine + Math.sin(i + wear * 8) * 9);
      ctx.stroke();
    }
  }
}

function drawValve(ctx, x, y, open) {
  ctx.fillStyle = "#202931";
  ctx.strokeStyle = "#71808a";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 58, y - 45);
  ctx.lineTo(x + 58, y + 45);
  ctx.lineTo(x + 58, y - 45);
  ctx.lineTo(x - 58, y + 45);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = open > 0.35 && open < 0.72 ? "#67d787" : "#f2b35f";
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(x, y - 62);
  ctx.lineTo(x, y + 62 - open * 84);
  ctx.stroke();
}

function drawTank(ctx, x, y, production) {
  const fill = clamp(production / WIN_TARGETS.production, 0, 1);
  ctx.fillStyle = "#202931";
  ctx.strokeStyle = "#71808a";
  ctx.lineWidth = 5;
  ctx.fillRect(x - 66, y - 18, 132, 154);
  ctx.strokeRect(x - 66, y - 18, 132, 154);
  ctx.fillStyle = machine.purity >= 75 ? "#68b7ef" : "#f2b35f";
  ctx.fillRect(x - 54, y + 124 - fill * 128, 108, fill * 128);
}

function drawLabel(ctx, text, x, y) {
  ctx.fillStyle = "#cbd4d7";
  ctx.font = "800 18px Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

function endGame(reason) {
  if (machine.gameOver) return;
  machine.gameOver = true;
  machine.failReason = reason;
  machine.isFlushing = false;
  const level = reason === "Shift complete" && didWin() ? "good" : "danger";
  logEvent(reason === "Shift complete" ? "Shift timer ended. Final report generated." : `Failure: ${reason}.`, level);
  showResult();
}

function showResult() {
  const complete = machine.failReason === "Shift complete";
  const win = complete && didWin();
  els.resultKicker.textContent = complete ? "Shift Complete" : "Failure";
  els.resultTitle.textContent = complete ? (win ? "Contract Fulfilled" : "Targets Missed") : machine.failReason;
  els.resultProduction.textContent = `${Math.floor(machine.production)} / ${WIN_TARGETS.production} units`;
  els.resultPurity.textContent = `${Math.round(getAveragePurity())}% / ${WIN_TARGETS.averagePurity}%`;
  els.resultDamage.textContent = `${Math.round(machine.damage)}%`;
  els.resultPressure.textContent = Math.round(machine.maxPressure);
  els.resultTemperature.textContent = Math.round(machine.maxTemperature);
  els.resultOverlay.hidden = false;
}

function didWin() {
  return machine.production >= WIN_TARGETS.production && getAveragePurity() >= WIN_TARGETS.averagePurity && machine.damage < WIN_TARGETS.maxDamage;
}

function getAveragePurity() {
  if (machine.production <= 0) return machine.purity;
  return machine.purityTotal / machine.production;
}

function getRecordingSnapshot() {
  const phase = getCurrentPhase();
  return {
    phase: phase.name,
    feed: phase.feed,
    timeLeft: Math.round(machine.timeLeft * 10) / 10,
    controls: {
      pump: Math.round(machine.pump * 100),
      coolant: Math.round(machine.coolant * 100),
      outputValve: Math.round(machine.outputValve * 100),
      flushing: machine.isFlushing,
    },
    targets: {
      pressure: phase.pressure,
      temperature: phase.temperature,
      flow: phase.flow,
      outputValve: phase.valve.map((value) => Math.round(value * 100)),
    },
    gauges: {
      pressure: Math.round(machine.pressure),
      temperature: Math.round(machine.filterTemp),
      flow: Math.round(machine.flow),
      filterLoad: Math.round(machine.lineResistance * 100),
      inputFeedTemp: Math.round(phase.feedTemp),
      viscosity: Math.round(machine.viscosityLoad * 100),
    },
    quality: {
      currentPurity: Math.round(machine.purity),
      averagePurity: Math.round(getAveragePurity()),
      pressure: Math.round(machine.qualityParts.pressure),
      temperature: Math.round(machine.qualityParts.temperature),
      flow: Math.round(machine.qualityParts.flow),
      filter: Math.round(machine.qualityParts.filter),
    },
    resources: {
      production: Math.floor(machine.production),
      filterClog: Math.round(machine.filterClog * 100),
      filterWear: Math.round(machine.filterWear * 100),
      flushReserve: Math.round(machine.flushReserve),
      damage: Math.round(machine.damage),
    },
    status: els.statusText?.textContent || "",
  };
}

function sampleRecording() {
  if (!recorder.active) return;
  const elapsed = 300 - machine.timeLeft;
  if (elapsed < recorder.nextSampleAt) return;
  recorder.samples.push({
    t: Math.round(elapsed * 10) / 10,
    ...getRecordingSnapshot(),
  });
  recorder.nextSampleAt = elapsed + 1;
}

function toggleRecording() {
  if (recorder.active) {
    finishRecording();
    return;
  }

  recorder = {
    active: true,
    startedAt: Date.now(),
    nextSampleAt: Math.max(0, 300 - machine.timeLeft),
    events: [],
    samples: [],
  };
  els.recordButton.classList.add("is-recording");
  els.recordButton.textContent = "Save Recording";
  logEvent("Gameplay recording started.", "good");
  sampleRecording();
}

function finishRecording() {
  recorder.active = false;
  els.recordButton.classList.remove("is-recording");
  els.recordButton.textContent = "Record Gameplay";

  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    result: {
      gameOver: machine.gameOver,
      failReason: machine.failReason,
      win: didWin(),
      production: Math.floor(machine.production),
      averagePurity: Math.round(getAveragePurity()),
      damage: Math.round(machine.damage),
      maxPressure: Math.round(machine.maxPressure),
      maxTemperature: Math.round(machine.maxTemperature),
    },
    events: recorder.events,
    samples: recorder.samples,
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `refinery-gameplay-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  logEvent("Gameplay recording saved.", "good");
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function restart() {
  const wasRecording = recorder.active;
  machine = initialMachine();
  lastTime = performance.now();
  eventMemory = initialEventMemory();
  els.pump.value = 50;
  els.coolant.value = 45;
  els.outputValve.value = 55;
  els.eventLog.textContent = "";
  els.resultOverlay.hidden = true;
  els.flushButton.classList.remove("is-held");
  logEvent("New shift started. Machine in nominal condition.", "good");
  if (wasRecording) {
    logEvent("Recording continued after restart.", "warning");
    recorder.nextSampleAt = 0;
  }
  renderUi();
}

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.08);
  lastTime = now;
  readControls();
  updateMachine(dt);
  renderUi();
  sampleRecording();
  requestAnimationFrame(frame);
}

els.flushButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  try {
    els.flushButton.setPointerCapture(event.pointerId);
  } catch {
    // Synthetic pointer events in tests do not always have an active pointer.
  }
  setHeldFlush(true);
});

els.flushButton.addEventListener("pointerup", (event) => {
  event.preventDefault();
  setHeldFlush(false);
});

els.flushButton.addEventListener("pointercancel", () => setHeldFlush(false));
els.flushButton.addEventListener("pointerleave", (event) => {
  if (event.buttons === 0) setHeldFlush(false);
});

for (const input of [els.pump, els.coolant, els.outputValve]) {
  input.addEventListener("input", () => {
    readControls();
  });
}

els.restartButton.addEventListener("click", restart);
els.recordButton.addEventListener("click", toggleRecording);
els.overlayRestartButton.addEventListener("click", restart);

restart();
requestAnimationFrame(frame);
