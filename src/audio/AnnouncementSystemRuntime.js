const HIGH_TEMP_CLIP_SECONDS = 2.3;
const DEMAND_SEVERITIES = ["underDemand", "overDemand"];
const CORE_DAMAGE_SOUND_KEY = "Core1_Panel1_AlarmHighTemp1";
const ONE_SHOT_ID_PREFIX = "announcement:oneshot:";

export class AnnouncementSystemRuntime {
  constructor({ audio, getEmitters, getFallbackEmitter, playSound }) {
    Object.assign(this, { audio, getEmitters, getFallbackEmitter, playSound });
    this.reset();
  }

  update(dt, { levelId, active, snapshot }) {
    const emitters = this.#resolveEmitters(levelId);
    const mode = snapshot?.mode ?? "standby";
    const running = active && (mode === "running" || mode === "startupFault");
    const coreStress = snapshot?.coreStress ?? 0;
    this.coreDamageActive = active
      && (snapshot?.failureType === "coreDestroyed" || coreStress > 98);
    const stressRiseRate = running && this.previousCoreStress != null && dt > 0
      ? Math.max(0, (coreStress - this.previousCoreStress) / dt)
      : 0;
    const rapidStressRise = coreStress >= 55 && stressRiseRate >= 6;

    this.#updateLoop("stress", "Core1_Panel1_AlarmHighCoreStress1", emitters,
      !this.silenced && running && (coreStress > 80 || rapidStressRise), levelId, 0.2);
    this.#updateLoop("stall", "Core1_Panel1_AlarmCoreStall", emitters,
      !this.silenced && running && Boolean(snapshot?.warning?.coreStall), levelId, 0.15);

    this.#updateHighTempAlarm(dt, active, running, snapshot, emitters, levelId);
    this.#updateDemandAlarms(running, snapshot?.warning, emitters, levelId);
    this.previousCoreStress = running ? coreStress : null;
    this.previousEmitters = emitters;
    this.previousLevelId = levelId;
  }

  reset() {
    this.silenced = false;
    this.coreDamageActive = false;
    this.oneShotSequence = 0;
    this.highTempRepeats = 0;
    this.highTempTimer = 0;
    this.previousCoreStress = null;
    this.demandSeverity = { underDemand: "off", overDemand: "off" };
    this.previousEmitters = [];
    this.previousLevelId = null;
  }

  setSilenced(value) {
    this.silenced = Boolean(value);
    if (this.silenced) {
      this.audio.stopAttachedOneShots?.((state) => (
        String(state.id).startsWith(ONE_SHOT_ID_PREFIX)
        && !(this.coreDamageActive && state.soundKey === CORE_DAMAGE_SOUND_KEY)
      ));
    }
    return this.silenced;
  }

  toggleSilenced() {
    return this.setSilenced(!this.silenced);
  }

  isSilenced() {
    return this.silenced;
  }

  #resolveEmitters(levelId) {
    const configured = (this.getEmitters?.(levelId) ?? []).filter((emitter) => emitter?.root);
    if (configured.length) return configured;
    const fallback = this.getFallbackEmitter?.();
    return fallback ? [{ root: fallback, radio: { refDistance: 0.8, maxDistance: 5.5 } }] : [];
  }

  #updateLoop(kind, soundKey, emitters, active, levelId, fadeSeconds) {
    const currentIds = new Set();
    emitters.forEach((emitter, index) => {
      const id = getEmitterId(emitter.root, index);
      currentIds.add(id);
      this.audio.setAttachedLoop(`announcement:alarm:${kind}:${id}`, emitter.root, soundKey, active, {
        levelId,
        refDistance: emitter.radio?.refDistance ?? 0.8,
        maxDistance: emitter.radio?.maxDistance ?? 5.5,
        fadeSeconds,
      });
    });
    if (this.previousLevelId !== levelId) return;
    this.previousEmitters.forEach((emitter, index) => {
      const id = getEmitterId(emitter.root, index);
      if (currentIds.has(id)) return;
      this.audio.setAttachedLoop(`announcement:alarm:${kind}:${id}`, emitter.root, soundKey, false, {
        levelId, fadeSeconds,
      });
    });
  }

  #playOnEmitters(emitters, soundKey, levelId, { safetyCritical = false } = {}) {
    if (this.silenced && !safetyCritical) return;
    emitters.forEach((emitter, index) => {
      this.playSound(emitter.root, soundKey, {
        id: `${ONE_SHOT_ID_PREFIX}${soundKey}:${getEmitterId(emitter.root, index)}:${this.oneShotSequence++}`,
        levelId,
        refDistance: emitter.radio?.refDistance ?? 0.8,
        maxDistance: emitter.radio?.maxDistance ?? 5.5,
      });
    });
  }

  #updateHighTempAlarm(dt, active, running, snapshot, emitters, levelId) {
    const alarmActive = active && (this.coreDamageActive || (running && (snapshot?.plasmaTemp ?? 0) > 155));
    if (!alarmActive) {
      this.highTempRepeats = 0;
      this.highTempTimer = 0;
      return;
    }
    if (this.silenced && !this.coreDamageActive) {
      this.highTempRepeats = 0;
      this.highTempTimer = 0;
      return;
    }
    this.highTempTimer -= Math.max(0, dt);
    if (this.highTempRepeats >= 8 || this.highTempTimer > 0) return;
    this.#playOnEmitters(emitters, CORE_DAMAGE_SOUND_KEY, levelId, {
      safetyCritical: this.coreDamageActive,
    });
    this.highTempRepeats += 1;
    this.highTempTimer = HIGH_TEMP_CLIP_SECONDS;
  }

  #updateDemandAlarms(running, warning = {}, emitters, levelId) {
    for (const warningKey of DEMAND_SEVERITIES) {
      const nextSeverity = running ? getDemandSeverity(warning, warningKey) : "off";
      if (nextSeverity !== this.demandSeverity[warningKey] && nextSeverity !== "off") {
        const soundKey = nextSeverity === "red"
          ? "SFX_Panel1_DemandRed1"
          : "SFX_Panel1_DemandYellow1";
        this.#playOnEmitters(emitters, soundKey, levelId);
      }
      this.demandSeverity[warningKey] = nextSeverity;
    }
  }
}

function getEmitterId(root, index) {
  return root?.uuid ?? root?.name ?? String(index);
}

export function getDemandSeverity(warning = {}, warningKey) {
  if (warning[`${warningKey}Critical`]) return "red";
  if (warning[warningKey]) return "yellow";
  return "off";
}
