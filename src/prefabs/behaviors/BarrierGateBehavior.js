export function createBarrierGateRuntime(parts, config = {}) {
  const gate = parts.get(config.gateName ?? "SM_Barrier1_Gate") ?? null;
  return {
    ...config,
    gate,
    elapsed: 0,
    unlocked: !Boolean(config.locked),
    unlockSequenceStarted: !Boolean(config.locked),
    beepPlayed: false,
    nudgeIssued: !Boolean(config.locked),
  };
}

export function resetBarrierGateRuntime(runtime) {
  if (!runtime) return;
  runtime.elapsed = 0;
  runtime.unlocked = !Boolean(runtime.locked);
  runtime.unlockSequenceStarted = !Boolean(runtime.locked);
  runtime.beepPlayed = false;
  runtime.nudgeIssued = !Boolean(runtime.locked);
}

export function updateBarrierGateRuntime(runtime, dt) {
  if (!runtime?.enabled) return [];
  runtime.elapsed = (runtime.elapsed ?? 0) + dt;
  const events = [];

  if (!runtime.unlocked && runtime.elapsed >= Math.max(0, runtime.unlockDelaySeconds ?? 20)) {
    runtime.unlocked = true;
    runtime.unlockSequenceStarted = true;
    runtime.nudgeIssued = true;
    events.push({
      type: "unlockGate",
      targetDegrees: Number(runtime.targetDegreesOnUnlock ?? 10),
    });
    if (runtime.unlockMotorSoundKey) {
      events.push({
        type: "sound",
        object: runtime.gate,
        soundKey: runtime.unlockMotorSoundKey,
        refDistance: runtime.refDistance,
        maxDistance: runtime.maxDistance,
      });
    }
  }

  const beepAt = Math.max(0, runtime.unlockDelaySeconds ?? 20) + Math.max(0, runtime.soundGapSeconds ?? 0.35);
  if (runtime.unlocked && !runtime.beepPlayed && runtime.elapsed >= beepAt) {
    runtime.beepPlayed = true;
    if (runtime.unlockBeepSoundKey) {
      events.push({
        type: "sound",
        object: runtime.gate,
        soundKey: runtime.unlockBeepSoundKey,
        refDistance: runtime.refDistance,
        maxDistance: runtime.maxDistance,
      });
    }
  }

  return events;
}
