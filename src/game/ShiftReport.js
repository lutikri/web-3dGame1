export function createShiftRecorder() {
  return {
    active: false,
    elapsed: 0,
    sampleTimer: 0,
    sampleCount: 0,
    demandErrorSum: 0,
    efficiencySum: 0,
    tempSum: 0,
    outputSum: 0,
    underDemandTime: 0,
    overDemandTime: 0,
    tempHighTime: 0,
    tempCriticalTime: 0,
    thermalSoakTime: 0,
    outputSurgeTime: 0,
    coreStressTime: 0,
    quenchTime: 0,
    instabilityTime: 0,
    ventTime: 0,
    ventActivations: 0,
    fuelSum: 0,
    fieldSum: 0,
    coolantSum: 0,
    maxTemp: 0,
    maxCoreStress: 0,
    maxThermalSoak: 0,
    maxOutput: 0,
    knobMovement: 0,
    previousControls: null,
  };
}

export function updateShiftRecorder(recorder, dt, snapshot, controls) {
  if (snapshot.mode !== "running") return;

  recorder.active = true;
  recorder.elapsed += dt;
  recorder.sampleTimer += dt;
  recorder.demandErrorSum += Math.abs(snapshot.demandError ?? 0) * dt;
  recorder.efficiencySum += snapshot.reactionEfficiency * dt;
  recorder.tempSum += snapshot.plasmaTemp * dt;
  recorder.outputSum += snapshot.powerOutput * dt;
  recorder.fuelSum += controls.fuelInjection * dt;
  recorder.fieldSum += controls.magneticField * dt;
  recorder.coolantSum += controls.coolantFlow * dt;
  if (snapshot.warning?.underDemand) recorder.underDemandTime += dt;
  if (snapshot.warning?.overDemand) recorder.overDemandTime += dt;
  if (snapshot.warning?.tempHigh) recorder.tempHighTime += dt;
  if (snapshot.warning?.tempCritical) recorder.tempCriticalTime += dt;
  if (snapshot.warning?.thermalSoak) recorder.thermalSoakTime += dt;
  if (snapshot.warning?.outputSurge) recorder.outputSurgeTime += dt;
  if (snapshot.warning?.coreStress) recorder.coreStressTime += dt;
  if (snapshot.warning?.quenchRisk) recorder.quenchTime += dt;
  if (snapshot.warning?.instability) recorder.instabilityTime += dt;
  if (controls.ventActive) recorder.ventTime += dt;

  recorder.maxTemp = Math.max(recorder.maxTemp, snapshot.plasmaTemp);
  recorder.maxCoreStress = Math.max(recorder.maxCoreStress, snapshot.coreStress);
  recorder.maxThermalSoak = Math.max(recorder.maxThermalSoak, snapshot.thermalSoak ?? 0);
  recorder.maxOutput = Math.max(recorder.maxOutput, snapshot.powerOutput);

  if (recorder.previousControls) {
    recorder.knobMovement +=
      Math.abs(controls.fuelInjection - recorder.previousControls.fuelInjection) +
      Math.abs(controls.magneticField - recorder.previousControls.magneticField) +
      Math.abs(controls.coolantFlow - recorder.previousControls.coolantFlow);
    if (controls.ventActive && !recorder.previousControls.ventActive) recorder.ventActivations += 1;
  } else if (controls.ventActive) {
    recorder.ventActivations += 1;
  }
  recorder.previousControls = { ...controls };

  if (recorder.sampleTimer >= 2) {
    recorder.sampleCount += 1;
    recorder.sampleTimer = 0;
  }
}

export function getShiftRecorderDebugState(recorder) {
  return {
    elapsed: Number(recorder.elapsed.toFixed(1)),
    underDemandTime: Number(recorder.underDemandTime.toFixed(1)),
    overDemandTime: Number(recorder.overDemandTime.toFixed(1)),
    tempHighTime: Number(recorder.tempHighTime.toFixed(1)),
    tempCriticalTime: Number(recorder.tempCriticalTime.toFixed(1)),
    thermalSoakTime: Number(recorder.thermalSoakTime.toFixed(1)),
    outputSurgeTime: Number(recorder.outputSurgeTime.toFixed(1)),
    coreStressTime: Number(recorder.coreStressTime.toFixed(1)),
    ventTime: Number(recorder.ventTime.toFixed(1)),
    ventActivations: recorder.ventActivations,
  };
}

export function buildShiftReport(recorder, snapshot) {
  const duration = Math.max(1, recorder.elapsed);
  const avgDemandError = recorder.demandErrorSum / duration;
  const avgEfficiency = recorder.efficiencySum / duration;
  const avgTemp = recorder.tempSum / duration;
  const avgOutput = recorder.outputSum / duration;
  const overRatio = recorder.overDemandTime / duration;
  const underRatio = recorder.underDemandTime / duration;
  const tempCriticalRatio = recorder.tempCriticalTime / duration;
  const outputSurgeRatio = recorder.outputSurgeTime / duration;
  const quenchRatio = recorder.quenchTime / duration;
  const movementRate = recorder.knobMovement / duration;
  const profile = pickOperatorProfile({
    avgDemandError,
    avgEfficiency,
    avgOutput,
    avgTemp,
    avgFuel: recorder.fuelSum / duration,
    avgField: recorder.fieldSum / duration,
    avgCoolant: recorder.coolantSum / duration,
    overRatio,
    underRatio,
    tempCriticalRatio,
    thermalSoakRatio: recorder.thermalSoakTime / duration,
    outputSurgeRatio,
    coreStressRatio: recorder.coreStressTime / duration,
    quenchRatio,
    instabilityRatio: recorder.instabilityTime / duration,
    ventRatio: recorder.ventTime / duration,
    ventActivations: recorder.ventActivations,
    movementRate,
    maxTemp: recorder.maxTemp,
    maxCoreStress: recorder.maxCoreStress,
    maxThermalSoak: recorder.maxThermalSoak,
    maxOutput: recorder.maxOutput,
    snapshot,
  });

  return {
    profile: profile.title,
    summary: profile.summary,
    stats: [
      ["SHIFT TIME", formatDuration(snapshot.elapsed)],
      ["AVG EFFICIENCY", `${Math.round(avgEfficiency)}%`],
      ["AVG OUTPUT", `${Math.round(avgOutput)} MW`],
      ["AVG DEMAND ERROR", `${Math.round(avgDemandError * 100)}%`],
      ["MAX TEMP", `${Math.round(recorder.maxTemp)} MK`],
      ["MAX CORE STRESS", `${Math.round(recorder.maxCoreStress)}%`],
      ["MAX HEAT SOAK", `${Math.round(recorder.maxThermalSoak)}%`],
      ["CRITICAL TEMP", `${Math.round(tempCriticalRatio * 100)}%`],
      ["OUTPUT SURGE", `${Math.round(outputSurgeRatio * 100)}%`],
      ["OVER DEMAND", `${Math.round(overRatio * 100)}%`],
      ["UNDER DEMAND", `${Math.round(underRatio * 100)}%`],
      ["QUENCH RISK", `${Math.round(quenchRatio * 100)}%`],
      ["VENT HELD", `${Math.round((recorder.ventTime / duration) * 100)}%`],
      ["VENT PULSES", `${recorder.ventActivations}`],
      ["AVG TEMP", `${Math.round(avgTemp)} MK`],
      ["CONTROL MOTION", `${Math.round(movementRate)}%/s`],
    ],
  };
}

function pickOperatorProfile(stats) {
  if (stats.snapshot.mode === "failed" && stats.maxCoreStress > 96 && stats.maxTemp > 178) {
    return profile("CONTAINMENT POSTMORTEM", "You found the part of the operating envelope that writes reports in all caps.");
  }
  if (stats.ventActivations >= 4 || (stats.ventRatio > 0.06 && stats.maxTemp > 155)) {
    return profile("NERVOUS PURGE TECH", "Short purge pulses solved several problems and created several new entries in the logbook.");
  }
  if (stats.avgEfficiency > 82 && stats.avgDemandError < 0.12 && stats.maxCoreStress < 55 && stats.instabilityRatio < 0.08) {
    return profile("FIELD PHYSICIST", "Quiet hands, good coupling, acceptable grid discipline. Suspiciously competent.");
  }
  if (stats.avgOutput > 720 && stats.avgDemandError < 0.18 && stats.tempCriticalRatio > 0.04 && stats.coreStressRatio < 0.14) {
    return profile("HIGH LOAD SPECIALIST", "You ran the burn hot on purpose and mostly convinced the machinery it was planned.");
  }
  if (stats.thermalSoakRatio > 0.12 || stats.maxThermalSoak > 75 || stats.maxTemp > 185) {
    return profile("REDLINE PHILOSOPHER", "You treated heat soak as a philosophical disagreement between you and the panel. The panel had evidence.");
  }
  if (stats.outputSurgeRatio > 0.08) {
    return profile("BUS SURGE CONDUCTOR", "The grid received power in expressive waves. Some of them were even useful.");
  }
  if (stats.overRatio > 0.32) {
    return profile("GRID OVERFEEDER", "Demand was a target. You interpreted it as a lower bound.");
  }
  if (stats.avgFuel > 84 && stats.avgOutput < 650) {
    return profile("FUEL INTO NOISE", "A lot of fuel became heat, alarms, and character development before it became grid power.");
  }
  if (stats.avgField > 86 && stats.avgOutput < 820) {
    return profile("MAGNETIC ACCOUNTANT", "Containment was extremely well filed. Net output was less impressed.");
  }
  if (stats.avgCoolant < 28 && stats.maxTemp > 160 && stats.maxCoreStress < 75) {
    return profile("HEAT SINK GAMBLER", "You trusted the thermal mass longer than the manual recommends, but the lights stayed on.");
  }
  if (stats.quenchRatio > 0.18 || (stats.avgCoolant > 72 && stats.avgTemp < 110)) {
    return profile("COOLANT INTERN", "The plasma spent much of the shift wondering why it was being refrigerated instead of operated.");
  }
  if (stats.underRatio > 0.42) {
    return profile("UNDERPOWERED OPTIMIST", "The grid kept asking for more. You maintained a tasteful distance from the request.");
  }
  if (stats.movementRate > 12) {
    return profile("WHY IS THIS LAMP BLINKING", "You made many corrections and at least some of them were related to the problem at hand.");
  }
  if (stats.movementRate < 1.2 && stats.avgDemandError > 0.28) {
    return profile("CONTROL ROOM STATUE", "The panel changed phases. You respected its independence.");
  }
  if (stats.tempCriticalRatio > 0.16 && stats.maxCoreStress < 70) {
    return profile("EDGE WALKER", "You visited the red band often enough to learn the furniture, then left before it became permanent.");
  }
  if (stats.snapshot.mode === "failed") {
    return profile("UNSCHEDULED EXPERIMENT", "The shift ended with useful data, technically. The maintenance team may use different words.");
  }
  if (stats.avgDemandError < 0.18 && stats.avgEfficiency > 68) {
    return profile("SHIFT OPERATOR", "You kept the core moving, made some compromises, and left enough machine for the next person.");
  }
  if (stats.maxOutput > 980 && stats.maxCoreStress < 80) {
    return profile("PEAK OUTPUT TOURIST", "You went sightseeing near maximum output and brought back most of the equipment.");
  }
  if (stats.avgEfficiency < 45) {
    return profile("REACTION POET", "The numbers formed an emotional arc. The grid requested fewer metaphors.");
  }
  return profile("PANEL APPRENTICE", "You learned which lights matter and which lights merely judge.");
}

function profile(title, summary) {
  return {
    title: `OPERATOR TYPE: ${title}`,
    summary,
  };
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
