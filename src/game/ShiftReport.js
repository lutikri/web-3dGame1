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
    pulseTime: 0,
    pulseActivations: 0,
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
  if (snapshot.warning?.coreStall) recorder.quenchTime += dt;
  if (snapshot.warning?.instability) recorder.instabilityTime += dt;
  if (controls.ventActive) recorder.ventTime += dt;
  if (controls.pulseActive) recorder.pulseTime += dt;

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
    if (controls.pulseActive && !recorder.previousControls.pulseActive) recorder.pulseActivations += 1;
  } else if (controls.ventActive) {
    recorder.ventActivations += 1;
    if (controls.pulseActive) recorder.pulseActivations += 1;
  } else if (controls.pulseActive) {
    recorder.pulseActivations += 1;
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
    coreStallTime: Number(recorder.quenchTime.toFixed(1)),
    ventTime: Number(recorder.ventTime.toFixed(1)),
    ventActivations: recorder.ventActivations,
    pulseTime: Number(recorder.pulseTime.toFixed(1)),
    pulseActivations: recorder.pulseActivations,
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
    pulseRatio: recorder.pulseTime / duration,
    pulseActivations: recorder.pulseActivations,
    movementRate,
    maxTemp: recorder.maxTemp,
    maxCoreStress: recorder.maxCoreStress,
    maxThermalSoak: recorder.maxThermalSoak,
    maxOutput: recorder.maxOutput,
    snapshot,
  });

  return {
    profileId: profile.id,
    profile: profile.title,
    summary: profile.summary,
    stats: [
      ["results.stats.shiftTime", formatDuration(snapshot.elapsed)],
      ["results.stats.avgEfficiency", `${Math.round(avgEfficiency)}%`],
      ["results.stats.avgOutput", `${Math.round(avgOutput)} MW`],
      ["results.stats.avgDemandError", `${Math.round(avgDemandError * 100)}%`],
      ["results.stats.maxTemp", `${Math.round(recorder.maxTemp)} MK`],
      ["results.stats.maxCoreStress", `${Math.round(recorder.maxCoreStress)}%`],
      ["results.stats.maxHeatSoak", `${Math.round(recorder.maxThermalSoak)}%`],
      ["results.stats.criticalTemp", `${Math.round(tempCriticalRatio * 100)}%`],
      ["results.stats.outputSurge", `${Math.round(outputSurgeRatio * 100)}%`],
      ["results.stats.overDemand", `${Math.round(overRatio * 100)}%`],
      ["results.stats.underDemand", `${Math.round(underRatio * 100)}%`],
      ["results.stats.coreStall", `${Math.round(quenchRatio * 100)}%`],
      ["results.stats.ventHeld", `${Math.round((recorder.ventTime / duration) * 100)}%`],
      ["results.stats.ventPulses", `${recorder.ventActivations}`],
      ["results.stats.pulseUses", `${recorder.pulseActivations}`],
      ["results.stats.avgTemp", `${Math.round(avgTemp)} MK`],
      ["results.stats.controlMotion", `${Math.round(movementRate)}%/s`],
    ],
  };
}

function pickOperatorProfile(stats) {
  if (stats.snapshot.mode === "failed" && stats.maxCoreStress > 96 && stats.maxTemp > 178) {
    return profile("containmentPostmortem", "CONTAINMENT POSTMORTEM", "You found the part of the operating envelope that writes reports in all caps.");
  }
  if (stats.ventActivations >= 4 || (stats.ventRatio > 0.06 && stats.maxTemp > 155)) {
    return profile("nervousPurgeTech", "NERVOUS PURGE TECH", "Short purge pulses solved several problems and created several new entries in the logbook.");
  }
  if (stats.avgEfficiency > 82 && stats.avgDemandError < 0.12 && stats.maxCoreStress < 55 && stats.instabilityRatio < 0.08) {
    return profile("fieldPhysicist", "FIELD PHYSICIST", "Quiet hands, good coupling, acceptable grid discipline. Suspiciously competent.");
  }
  if (stats.avgOutput > 720 && stats.avgDemandError < 0.18 && stats.tempCriticalRatio > 0.04 && stats.coreStressRatio < 0.14) {
    return profile("highLoadSpecialist", "HIGH LOAD SPECIALIST", "You ran the burn hot on purpose and mostly convinced the machinery it was planned.");
  }
  if (stats.thermalSoakRatio > 0.12 || stats.maxThermalSoak > 75 || stats.maxTemp > 185) {
    return profile("redlinePhilosopher", "REDLINE PHILOSOPHER", "You treated heat soak as a philosophical disagreement between you and the panel. The panel had evidence.");
  }
  if (stats.outputSurgeRatio > 0.08) {
    return profile("busSurgeConductor", "BUS SURGE CONDUCTOR", "The grid received power in expressive waves. Some of them were even useful.");
  }
  if (stats.overRatio > 0.32) {
    return profile("gridOverfeeder", "GRID OVERFEEDER", "Demand was a target. You interpreted it as a lower bound.");
  }
  if (stats.avgFuel > 84 && stats.avgOutput < 650) {
    return profile("fuelIntoNoise", "FUEL INTO NOISE", "A lot of fuel became heat, alarms, and character development before it became grid power.");
  }
  if (stats.avgField > 86 && stats.avgOutput < 820) {
    return profile("magneticAccountant", "MAGNETIC ACCOUNTANT", "Containment was extremely well filed. Net output was less impressed.");
  }
  if (stats.avgCoolant < 28 && stats.maxTemp > 160 && stats.maxCoreStress < 75) {
    return profile("heatSinkGambler", "HEAT SINK GAMBLER", "You trusted the thermal mass longer than the manual recommends, but the lights stayed on.");
  }
  if (stats.quenchRatio > 0.18 || (stats.avgCoolant > 72 && stats.avgTemp < 110)) {
    return profile("coolantIntern", "COOLANT INTERN", "The plasma spent much of the shift wondering why it was being refrigerated instead of operated.");
  }
  if (stats.underRatio > 0.42) {
    return profile("underpoweredOptimist", "UNDERPOWERED OPTIMIST", "The grid kept asking for more. You maintained a tasteful distance from the request.");
  }
  if (stats.movementRate > 12) {
    return profile("whyIsThisLampBlinking", "WHY IS THIS LAMP BLINKING", "You made many corrections and at least some of them were related to the problem at hand.");
  }
  if (stats.movementRate < 1.2 && stats.avgDemandError > 0.28) {
    return profile("controlRoomStatue", "CONTROL ROOM STATUE", "The panel changed phases. You respected its independence.");
  }
  if (stats.tempCriticalRatio > 0.16 && stats.maxCoreStress < 70) {
    return profile("edgeWalker", "EDGE WALKER", "You visited the red band often enough to learn the furniture, then left before it became permanent.");
  }
  if (stats.snapshot.mode === "failed") {
    return profile("unscheduledExperiment", "UNSCHEDULED EXPERIMENT", "The shift ended with useful data, technically. The maintenance team may use different words.");
  }
  if (stats.avgDemandError < 0.18 && stats.avgEfficiency > 68) {
    return profile("shiftOperator", "SHIFT OPERATOR", "You kept the core moving, made some compromises, and left enough machine for the next person.");
  }
  if (stats.maxOutput > 980 && stats.maxCoreStress < 80) {
    return profile("peakOutputTourist", "PEAK OUTPUT TOURIST", "You went sightseeing near maximum output and brought back most of the equipment.");
  }
  if (stats.avgEfficiency < 45) {
    return profile("reactionPoet", "REACTION POET", "The numbers formed an emotional arc. The grid requested fewer metaphors.");
  }
  return profile("panelApprentice", "PANEL APPRENTICE", "You learned which lights matter and which lights merely judge.");
}

function profile(id, title, summary) {
  return {
    id,
    title: `OPERATOR TYPE: ${title}`,
    summary,
  };
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
