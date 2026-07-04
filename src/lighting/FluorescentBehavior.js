import * as THREE from "three";

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
