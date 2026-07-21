import * as THREE from "three";

export function getRandomConfigRange(value, fallbackMin, fallbackMax) {
  if (Array.isArray(value)) return getRandomRangeValue(value[0] ?? fallbackMin, value[1] ?? fallbackMax);
  if (Number.isFinite(value)) return value;
  return getRandomRangeValue(fallbackMin, fallbackMax);
}

export function getRandomRangeValue(min, max) {
  return THREE.MathUtils.randFloat(Number(min), Number(max));
}

export function createFluorescentStartupPattern(config = {}) {
  const warmupSeconds = getRandomConfigRange(config.warmupSeconds, 0.12, 0.32);
  const attemptCount = Math.max(2, Math.round(getRandomConfigRange(config.attemptCount, 3, 6)));
  const pattern = [
    { time: 0, factor: 0 },
    { time: warmupSeconds * 0.55, factor: getRandomConfigRange(config.dimFactor, 0.04, 0.18) * 0.45 },
    { time: warmupSeconds, factor: getRandomConfigRange(config.dimFactor, 0.04, 0.18) },
  ];
  let time = warmupSeconds;

  for (let index = 0; index < attemptCount; index += 1) {
    const finalAttempt = index === attemptCount - 1;
    time += getRandomConfigRange(config.attemptOnSeconds, 0.055, 0.16);
    pattern.push({
      time,
      factor: finalAttempt
        ? getRandomConfigRange(config.finalOvershoot, 1, 1.06)
        : getRandomConfigRange(config.strikeFactor, 0.42, 0.92),
    });
    if (finalAttempt) break;
    time += getRandomConfigRange(config.attemptOffSeconds, 0.045, 0.13);
    pattern.push({ time, factor: getRandomConfigRange(config.dimFactor, 0.04, 0.18) });
  }

  time += getRandomConfigRange(config.settleSeconds, 0.16, 0.34);
  pattern.push({ time, factor: 1 });
  return pattern;
}

export function getFluorescentStartupDuration(pattern) {
  return pattern?.at(-1)?.time ?? 1.2;
}

export function getFluorescentStartupFactor(pattern, elapsed) {
  if (!pattern?.length) return 1;

  let factor = pattern[pattern.length - 1].factor;
  for (let index = 0; index < pattern.length - 1; index += 1) {
    const current = pattern[index];
    const next = pattern[index + 1];
    if (elapsed < current.time || elapsed > next.time) continue;
    const ratio = THREE.MathUtils.smoothstep(elapsed, current.time, next.time);
    factor = THREE.MathUtils.lerp(current.factor, next.factor, ratio);
    break;
  }
  return factor;
}

export function createFixtureFlickerState(baseConfig = {}, overrides = null) {
  const flickerConfig = {
    ...(baseConfig ?? {}),
    ...(overrides ?? {}),
  };
  return {
    seed: Math.random() * 1000,
    nextIn: getRandomRangeValue(flickerConfig?.minIntervalSeconds ?? 45, flickerConfig?.maxIntervalSeconds ?? 140),
    elapsed: 0,
    duration: 0,
    pulses: [],
  };
}

export function updateFixtureFlickerState(state, dt, baseConfig = {}, overrides = null) {
  const flickerConfig = {
    ...(baseConfig ?? {}),
    ...(overrides ?? {}),
  };
  if (!flickerConfig?.enabled) return;

  if (state.duration > 0) {
    state.elapsed += dt;
    if (state.elapsed >= state.duration) {
      state.elapsed = 0;
      state.duration = 0;
      state.pulses = [];
    }
    return;
  }

  state.nextIn -= dt;
  if (state.nextIn > 0) return;

  triggerFixtureFlickerState(state, flickerConfig);
  const retrySoon = Math.random() < (flickerConfig.retryChance ?? 0.35);
  state.nextIn = retrySoon
    ? THREE.MathUtils.randFloat(0.8, 3.5)
    : getRandomRangeValue(flickerConfig.minIntervalSeconds ?? 45, flickerConfig.maxIntervalSeconds ?? 140);
}

export function triggerFixtureFlickerState(state, flickerConfig = {}) {
  state.duration = getRandomConfigRange(flickerConfig.durationSeconds, 0.08, 0.42);
  state.elapsed = 0;
  state.pulses = createFixtureFlickerPulses(state.duration, flickerConfig);
}

export function createFixtureFlickerPulses(duration, flickerConfig = {}) {
  const pulseCount = Math.max(3, Math.round(getRandomConfigRange(flickerConfig.pulseCount, 4, 9)));
  const clusterEnd = THREE.MathUtils.randFloat(0.72, 0.94);

  return Array.from({ length: pulseCount }, (_, index) => {
    const sequenceProgress = pulseCount > 1 ? index / (pulseCount - 1) : 0;
    const center = THREE.MathUtils.clamp(
      0.035 + sequenceProgress * clusterEnd + THREE.MathUtils.randFloatSpread(0.075),
      0.015,
      0.98,
    );
    const pulseSeconds = THREE.MathUtils.randFloat(0.025, index === pulseCount - 1 ? 0.075 : 0.13);
    const width = THREE.MathUtils.clamp(pulseSeconds / Math.max(duration, 0.001), 0.018, 0.19);
    const minimumFactor = getRandomConfigRange(flickerConfig.minFactor, 0.04, 0.3);
    const strikeStrength = index === 0 || index === pulseCount - 1 ? 1 : THREE.MathUtils.randFloat(0.72, 1);

    return {
      center,
      width,
      depth: (1 - minimumFactor) * strikeStrength,
      edgePower: THREE.MathUtils.randFloat(0.85, 1.35),
      duration,
    };
  });
}

export function getFixtureFlickerFactor(target) {
  const state = target.userData.fixtureFlicker;
  if (!state || state.duration <= 0) return 1;

  const progress = THREE.MathUtils.clamp(state.elapsed / Math.max(state.duration, 0.001), 0, 1);
  const factor = state.pulses.reduce((currentFactor, pulse) => {
    const distance = Math.abs(progress - pulse.center) / pulse.width;
    if (distance >= 1) return currentFactor;
    const dip = Math.pow(1 - distance, pulse.edgePower ?? 0.3) * pulse.depth;
    return Math.min(currentFactor, 1 - dip);
  }, 1);
  return THREE.MathUtils.clamp(factor, 0, 1.08);
}

export function getFluorescentStarterFaultFactor({
  elapsed,
  visualTime = elapsed,
  config = {},
  seed = 0,
}) {
  const minimum = config.faultMinimumFactor ?? 0.025;
  const maximum = config.faultMaximumFactor ?? 0.3;
  const irregularPhase =
    elapsed * 5.4 +
    Math.sin(elapsed * 1.37 + seed * 0.17) * 2.1 +
    Math.sin(elapsed * 0.43 + seed * 0.31) * 1.4;
  const strike = THREE.MathUtils.smoothstep(Math.sin(irregularPhase), 0.48, 0.94);
  const a = Math.sin(visualTime * 21 + 8.2 + seed) * 0.5 + 0.5;
  const b = Math.sin(visualTime * 21 * 2.37 + (8.2 + seed) * 3.1) * 0.5 + 0.5;
  const starterChatter = THREE.MathUtils.lerp(0.55, 1, Math.pow(a * 0.65 + b * 0.35, 1.8));
  return THREE.MathUtils.lerp(minimum, maximum, strike * starterChatter);
}
