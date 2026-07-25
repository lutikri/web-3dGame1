import * as THREE from "three";

const CLIP_SECONDS = {
  startup: 27.85,
  turnDown: 20.15,
  trip: 10.266667,
  highTemp: 2.3,
};
const DEFAULT_LOOP_VOLUME = 0.64;

export class CoreAudioRuntime {
  constructor({ audio, getCoreAnchor, getPanel, playSound }) {
    Object.assign(this, { audio, getCoreAnchor, getPanel, playSound });
    this.previousMode = "standby";
    this.transition = null;
    this.highTempRepeats = 0;
    this.highTempTimer = 0;
  }

  update(dt, { levelId, active, snapshot }) {
    const mode = snapshot?.mode ?? "standby";
    this.#handleModeTransition(mode, levelId);
    this.#advanceTransition(dt);

    const coreAnchor = this.getCoreAnchor();
    const panel = this.getPanel();
    const runningState = mode === "running" || mode === "startupFault";
    const defaultVolume = active ? this.#getDefaultLoopMix(mode) * DEFAULT_LOOP_VOLUME : 0;
    this.audio.setAttachedLoop("core:default", coreAnchor, "Core1_DefaultLoop1", defaultVolume > 0.001, {
      levelId, volume: defaultVolume, refDistance: 1.2, maxDistance: 20, fadeSeconds: 0.04,
    });
    this.audio.setAttachedLoop("core:stress", coreAnchor, "Core1_Stress_Loop",
      active && runningState && (snapshot?.coreStress ?? 0) > 70, {
        levelId,
        volume: THREE.MathUtils.smoothstep(snapshot?.coreStress ?? 0, 70, 100) * 0.34,
        refDistance: 1.2,
        maxDistance: 20,
        fadeSeconds: 0.7,
      });

    this.audio.setAttachedLoop("panel:core", panel, "Core1_Panel1_Loop", active, {
      levelId, volume: 0.18, refDistance: 0.8, maxDistance: 4.5, fadeSeconds: 0.8,
    });
    this.audio.setAttachedLoop("panel:alarm:stress", panel, "Core1_Panel1_AlarmHighCoreStress1",
      active && runningState && (snapshot?.coreStress ?? 0) > 90, {
        levelId, volume: 0.62, refDistance: 0.8, maxDistance: 5.5, fadeSeconds: 0.2,
      });
    this.audio.setAttachedLoop("panel:alarm:stall", panel, "Core1_Panel1_AlarmCoreStall",
      active && runningState && Boolean(snapshot?.warning?.coreStall), {
        levelId, volume: 0.66, refDistance: 0.8, maxDistance: 5.5, fadeSeconds: 0.15,
      });
    this.#updateHighTempAlarm(dt, active && runningState, snapshot, panel, levelId);
    this.previousMode = mode;
  }

  reset() {
    this.previousMode = "standby";
    this.transition = null;
    this.highTempRepeats = 0;
    this.highTempTimer = 0;
  }

  #handleModeTransition(mode, levelId) {
    if (mode === this.previousMode) return;
    const coreAnchor = this.getCoreAnchor();
    if (this.previousMode === "standby" && mode === "running") {
      this.playSound(coreAnchor, "Core1_StartupNormal1", { levelId, maxDistance: 20 });
      this.transition = { kind: "startup", elapsed: 0, duration: CLIP_SECONDS.startup };
    } else if (this.previousMode === "running" && mode === "startupFault") {
      this.playSound(coreAnchor, "Core1_StartupFailed1", { levelId, maxDistance: 20 });
    } else if (mode === "complete") {
      this.playSound(coreAnchor, "Core1_TurnDown", { levelId, maxDistance: 20 });
      this.transition = { kind: "turnDown", elapsed: 0, duration: CLIP_SECONDS.turnDown };
    } else if (mode === "failed") {
      this.playSound(coreAnchor, "Core1_Trip1", { levelId, maxDistance: 20 });
      this.transition = { kind: "trip", elapsed: 0, duration: CLIP_SECONDS.trip };
    } else if (mode === "standby") {
      this.transition = null;
    }
  }

  #advanceTransition(dt) {
    if (!this.transition) return;
    this.transition.elapsed = Math.min(this.transition.duration, this.transition.elapsed + Math.max(0, dt));
  }

  #getDefaultLoopMix(mode) {
    if (this.transition) {
      const ratio = THREE.MathUtils.clamp(this.transition.elapsed / this.transition.duration, 0, 1);
      if (this.transition.kind === "startup") return ratio;
      return 1 - ratio;
    }
    return mode === "running" || mode === "startupFault" ? 1 : 0;
  }

  #updateHighTempAlarm(dt, active, snapshot, panel, levelId) {
    const alarmActive = active && ((snapshot?.plasmaTemp ?? 0) > 155 || (snapshot?.coreStress ?? 0) > 98);
    if (!alarmActive) {
      this.highTempRepeats = 0;
      this.highTempTimer = 0;
      return;
    }
    this.highTempTimer -= Math.max(0, dt);
    if (this.highTempRepeats >= 8 || this.highTempTimer > 0) return;
    this.playSound(panel, "Core1_Panel1_AlarmHighTemp1", { levelId, maxDistance: 5.5 });
    this.highTempRepeats += 1;
    this.highTempTimer = CLIP_SECONDS.highTemp;
  }
}
