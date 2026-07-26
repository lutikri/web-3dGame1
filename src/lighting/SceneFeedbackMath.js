import * as THREE from "three";

export function createSceneFeedbackMath({
  config,
  getTime,
  getSnapshot,
  getTerminalElapsed,
  getIgnitionPulseTimer,
  getStartupTimer,
  getTerminalStartupPattern,
  getStartupDuration,
  getStartupFactor,
}) {
  return {
    flickerWave: (frequency, seed = 0) => flickerWave(getTime(), frequency, seed),
    getIgnitionPulseAmount: () =>
      getIgnitionPulseAmount(
        getIgnitionPulseTimer(),
        config.feedback.ignitionPulse.duration,
        getTime(),
      ),
    getStartupAmount: () => getStartupAmount(getStartupTimer(), config.feedback.startup.duration),
    getThermalEmergencyAmount: () =>
      getThermalEmergencyAmount(
        getSnapshot(),
        getTerminalElapsed(),
        config.feedback.terminal.emergencyEffectFadeSeconds,
      ),
    getTerminalLightFactor: () =>
      getTerminalLightFactor({
        snapshot: getSnapshot(),
        terminalElapsed: getTerminalElapsed(),
        terminalConfig: config.feedback.terminal,
        startupPattern: getTerminalStartupPattern(),
        getStartupDuration,
        getStartupFactor,
      }),
    getDangerNeedleJitter: (needle, snapshot) =>
      getDangerNeedleJitter(needle, snapshot, getTime()),
    getOperationalNeedleJitter: (needle, snapshot, dt) =>
      getOperationalNeedleJitter({
        needle,
        snapshot,
        dt,
        time: getTime(),
        needleConfig: config.needleAnimation,
        ignitionAmount: getIgnitionPulseAmount(
          getIgnitionPulseTimer(),
          config.feedback.ignitionPulse.duration,
          getTime(),
        ),
        ignitionConfig: config.feedback.ignitionPulse,
      }),
  };
}

export function flickerWave(time, frequency, seed = 0) {
  const a = Math.sin(time * frequency + seed) * 0.5 + 0.5;
  const b = Math.sin(time * frequency * 2.37 + seed * 3.1) * 0.5 + 0.5;
  return Math.pow(a * 0.65 + b * 0.35, 1.8);
}

export function getIgnitionPulseAmount(timer, duration, time) {
  if (timer <= 0 || duration <= 0) return 0;
  const progress = 1 - timer / duration;
  return Math.pow(1 - progress, 1.7) * (0.72 + flickerWave(time, 31, 4.2) * 0.28);
}

export function getStartupAmount(timer, duration) {
  if (timer <= 0 || duration <= 0) return 0;
  return THREE.MathUtils.clamp(timer / duration, 0, 1);
}

export function getThermalEmergencyAmount(snapshot, terminalElapsed, fadeSeconds) {
  const temp = THREE.MathUtils.clamp((snapshot.plasmaTemp - 158) / 34, 0, 1);
  const soak = THREE.MathUtils.clamp(((snapshot.thermalSoak ?? 0) - 55) / 45, 0, 1);
  const surge = THREE.MathUtils.clamp(((snapshot.outputSurge ?? 0) - 34) / 55, 0, 1) * 0.7;
  const amount = Math.max(temp, soak, surge);
  if (snapshot.mode === "running") return amount;
  if (terminalElapsed < 0) return 0;
  return amount * THREE.MathUtils.clamp(1 - terminalElapsed / fadeSeconds, 0, 1);
}

export function getTerminalLightFactor({
  snapshot,
  terminalElapsed,
  terminalConfig,
  startupPattern,
  getStartupDuration,
  getStartupFactor,
}) {
  if (terminalElapsed < 0) return 1;
  if (snapshot.mode === "complete") return 1;
  if (snapshot.failureType === "qualityFailure") return 1;
  if (snapshot.failureType === "coreDestroyed") {
    if (terminalElapsed < terminalConfig.destroyedBlackoutSeconds) return 0;
    const bootElapsed = terminalElapsed - terminalConfig.destroyedBlackoutSeconds;
    const bootDuration = getStartupDuration(startupPattern);
    if (bootElapsed <= bootDuration) return getStartupFactor(startupPattern, bootElapsed);
    return THREE.MathUtils.lerp(
      1,
      terminalConfig.destroyedLightFactor,
      THREE.MathUtils.smoothstep(
        bootElapsed,
        bootDuration,
        bootDuration + terminalConfig.emergencyLightSettleSeconds,
      ),
    );
  }
  return THREE.MathUtils.lerp(
    1,
    terminalConfig.failedLightFactor,
    THREE.MathUtils.smoothstep(terminalElapsed, 0.1, 1.6),
  );
}

export function getDangerNeedleJitter(needle, snapshot, time) {
  const key = needle.userData.gaugeKey;
  if (snapshot.mode !== "running" || (key !== "plasmaTemp" && key !== "coreStress")) return 0;
  const tempDanger = THREE.MathUtils.clamp((snapshot.plasmaTemp - 145) / 28, 0, 1);
  const soakDanger = THREE.MathUtils.clamp((snapshot.thermalSoak ?? 0) / 100, 0, 1);
  const stressDanger = THREE.MathUtils.clamp((snapshot.coreStress - 45) / 55, 0, 1);
  const amountDegrees = key === "plasmaTemp"
    ? 1.5 + tempDanger * 10 + soakDanger * 7
    : 1 + stressDanger * 8 + soakDanger * 9;
  return (
    (1 - (snapshot.shutdownLevel ?? 0)) *
    THREE.MathUtils.degToRad(amountDegrees) *
    (Math.sin(time * 47 + needle.userData.needleNoiseSeed) * 0.65 +
      Math.sin(time * 91 + needle.userData.needleNoiseSeed * 0.7) * 0.35)
  );
}

export function getOperationalNeedleJitter({
  needle,
  snapshot,
  dt,
  time,
  needleConfig,
  ignitionAmount,
  ignitionConfig,
}) {
  if (snapshot.mode !== "running") {
    needle.userData.needleJitterOffset = THREE.MathUtils.damp(needle.userData.needleJitterOffset ?? 0, 0, 10, dt);
    return needle.userData.needleJitterOffset ?? 0;
  }
  needle.userData.needleJitterTimer = (needle.userData.needleJitterTimer ?? 0) - dt;
  if (needle.userData.needleJitterTimer <= 0) {
    const interval = needleConfig.jitterRetargetInterval;
    needle.userData.needleJitterTimer = THREE.MathUtils.randFloat(interval * 0.65, interval * 1.45);
    needle.userData.needleJitterTarget = THREE.MathUtils.degToRad(
      THREE.MathUtils.randFloatSpread(needleConfig.jitterDegrees * 2),
    );
  }
  const vibration =
    THREE.MathUtils.degToRad(needleConfig.jitterDegrees * 0.28) *
    Math.sin(time * needleConfig.jitterFrequency + needle.userData.needleNoiseSeed);
  needle.userData.needleJitterOffset = THREE.MathUtils.damp(
    needle.userData.needleJitterOffset ?? 0,
    needle.userData.needleJitterTarget ?? 0,
    18,
    dt,
  );
  const pulseKick =
    ignitionAmount *
    THREE.MathUtils.degToRad(ignitionConfig.needleKickDegrees) *
    Math.sin(time * 64 + needle.userData.needleNoiseSeed);
  return (
    ((needle.userData.needleJitterOffset ?? 0) + vibration) * (1 - (snapshot.shutdownLevel ?? 0)) +
    pulseKick
  );
}
