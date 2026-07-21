import * as THREE from "three";

export class PanelGaugeRuntime {
  constructor({ config, ranges, diagnostics, getIndicatorTimer, getTime, getStartupAmount, getOperationalJitter, getDangerJitter }) {
    this.config = config;
    this.ranges = ranges;
    this.diagnostics = diagnostics;
    this.getIndicatorTimer = getIndicatorTimer;
    this.getTime = getTime;
    this.getStartupAmount = getStartupAmount;
    this.getOperationalJitter = getOperationalJitter;
    this.getDangerJitter = getDangerJitter;
  }

  update(needle, snapshot, dt) {
    const key = needle.userData.gaugeKey;
    const range = this.ranges[key];
    if (!range) return false;
    const indicatorTimer = this.getIndicatorTimer();
    if (indicatorTimer > 0) {
      this.#updateSelfTest(needle, key, indicatorTimer, dt);
      return true;
    }
    const value = snapshot[key] ?? 0;
    let ratio = THREE.MathUtils.clamp((value - range[0]) / (range[1] - range[0]), 0, 1);
    const modifier = this.diagnostics.getGaugeRuntimeModifier(key);
    ratio = applyModifierBounds(ratio, modifier);
    ratio = this.#applyLag(needle, "diagnosticLagRatio", ratio, modifier, dt);
    if (snapshot.mode === "startupFault" && this.config.feedback.startupFault.sweepGaugeKeys.includes(key)) {
      ratio = this.#getStartupFaultRatio(snapshot, ratio);
    }
    const targetAngle = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(
      this.config.needleAnimation.inactiveDegrees,
      this.config.needleAnimation.activeDegrees,
      ratio,
    ));
    const time = this.getTime();
    const seed = needle.userData.needleNoiseSeed;
    const startupJitter = this.getStartupAmount()
      * THREE.MathUtils.degToRad(this.config.feedback.startup.needleJitterDegrees)
      * Math.sin(time * (18 + seed));
    const diagnosticJitter = Number.isFinite(modifier?.noiseDegrees) && modifier.noiseDegrees > 0
      ? THREE.MathUtils.degToRad(modifier.noiseDegrees)
        * (Math.sin(time * (17 + seed)) * 0.6 + Math.sin(time * (43 + seed * 0.5)) * 0.4)
      : 0;
    needle.userData.needleAngle = THREE.MathUtils.damp(
      needle.userData.needleAngle ?? targetAngle,
      targetAngle
        + this.getOperationalJitter(needle, snapshot, dt)
        + this.getDangerJitter(needle, snapshot)
        + startupJitter
        + diagnosticJitter,
      8,
      dt,
    );
    return true;
  }

  applyRotation(needle) {
    needle.rotation.copy(needle.userData.initialRotation);
    const axis = needle.userData.needleDebugAxis ?? "z";
    if (axis === "x") needle.rotateX(needle.userData.needleAngle);
    else if (axis === "y") needle.rotateY(needle.userData.needleAngle);
    else needle.rotateZ(needle.userData.needleAngle);
  }

  setDebugRotation(needle, axis = "z", degrees = 0) {
    if (!needle) return null;
    needle.userData.needleDebugAxis = String(axis).toLowerCase();
    needle.userData.needleAngle = THREE.MathUtils.degToRad(degrees);
    this.applyRotation(needle);
    return needle;
  }

  #updateSelfTest(needle, key, timer, dt) {
    let ratio = THREE.MathUtils.smoothstep(
      timer,
      this.config.feedback.indicatorTest.duration * 0.18,
      this.config.feedback.indicatorTest.duration,
    );
    const modifier = this.diagnostics.getGaugeSelfTestModifier(key);
    ratio = applyModifierBounds(ratio, modifier);
    ratio = this.#applyLag(needle, "diagnosticSelfTestLagRatio", ratio, modifier, dt);
    const targetAngle = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(
      this.config.needleAnimation.inactiveDegrees,
      this.config.needleAnimation.activeDegrees,
      ratio,
    ));
    const noise = Number.isFinite(modifier?.noiseDegrees) && modifier.noiseDegrees > 0
      ? THREE.MathUtils.degToRad(modifier.noiseDegrees)
        * Math.sin(this.getTime() * (19 + needle.userData.needleNoiseSeed * 0.3))
      : 0;
    needle.userData.needleAngle = THREE.MathUtils.damp(needle.userData.needleAngle ?? targetAngle, targetAngle + noise, 10, dt);
  }

  #getStartupFaultRatio(snapshot, fallbackRatio) {
    const config = this.config.feedback.startupFault;
    const age = Math.max(0, config.resetSeconds - (snapshot.resetPending ?? 0));
    const upEnd = config.needleSweepUpSeconds;
    const holdEnd = upEnd + config.needleSweepHoldSeconds;
    const downEnd = holdEnd + config.needleSweepDownSeconds;
    if (age < upEnd) return THREE.MathUtils.smoothstep(age, 0, upEnd);
    if (age < holdEnd) return 1;
    if (age < downEnd) return 1 - THREE.MathUtils.smoothstep(age, holdEnd, downEnd);
    return fallbackRatio;
  }

  #applyLag(needle, stateKey, ratio, modifier, dt) {
    if (Number.isFinite(modifier?.delaySeconds) && modifier.delaySeconds > 0) {
      needle.userData[stateKey] = THREE.MathUtils.damp(
        needle.userData[stateKey] ?? ratio,
        ratio,
        1 / Math.max(0.001, modifier.delaySeconds),
        dt,
      );
      return needle.userData[stateKey];
    }
    needle.userData[stateKey] = ratio;
    return ratio;
  }
}

function applyModifierBounds(value, modifier) {
  let ratio = modifier?.reverse ? 1 - value : value;
  if (Number.isFinite(modifier?.offsetRatio)) ratio += modifier.offsetRatio;
  if (Number.isFinite(modifier?.maxRatio)) ratio = Math.min(ratio, THREE.MathUtils.clamp(modifier.maxRatio, 0, 1));
  if (Number.isFinite(modifier?.minRatio)) ratio = Math.max(ratio, THREE.MathUtils.clamp(modifier.minRatio, 0, 1));
  return THREE.MathUtils.clamp(ratio, 0, 1);
}
