import * as THREE from "three";

const CLIP_SECONDS = {
  startup: 27.85,
  turnDown: 20.15,
  trip: 10.266667,
};
const DEFAULT_LOOP_VOLUME = 0.64;

export class CoreAudioRuntime {
  constructor({ audio, getCoreAnchor, playSound }) {
    Object.assign(this, { audio, getCoreAnchor, playSound });
    this.previousMode = "standby";
    this.transition = null;
  }

  update(dt, { levelId, active, snapshot }) {
    const mode = snapshot?.mode ?? "standby";
    this.#handleModeTransition(mode, levelId);
    this.#advanceTransition(dt);

    const coreAnchor = this.getCoreAnchor();
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
    this.previousMode = mode;
  }

  reset() {
    this.previousMode = "standby";
    this.transition = null;
  }

  #handleModeTransition(mode, levelId) {
    if (mode === this.previousMode) return;
    const coreAnchor = this.getCoreAnchor();
    if (this.previousMode === "standby" && (mode === "starting" || mode === "running")) {
      this.playSound(coreAnchor, "Core1_StartupNormal1", { levelId, maxDistance: 20 });
      this.transition = { kind: "startup", elapsed: 0, duration: CLIP_SECONDS.startup };
    } else if ((this.previousMode === "running" || this.previousMode === "starting") && mode === "startupFault") {
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

}
