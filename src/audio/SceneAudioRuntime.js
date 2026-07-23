import * as THREE from "three";

export class SceneAudioRuntime {
  constructor({
    config,
    audio,
    camera,
    getPanel,
    keys,
    prefabInstances,
    getViewMode,
    getActiveLevelId,
    resolveEnvironmentId,
    hasPanel,
    getMovementVelocity,
    isNoclipEnabled,
    getLightFactor,
    getSnapshot,
    getTerminalElapsed,
    getTime,
    playSound,
  }) {
    Object.assign(this, {
      config, audio, camera, getPanel, keys, prefabInstances, getViewMode, getActiveLevelId,
      resolveEnvironmentId, hasPanel, getMovementVelocity, isNoclipEnabled, getLightFactor,
      getSnapshot, getTerminalElapsed, getTime, playSound,
    });
    this.previousLightFactor = 1;
    this.reactorPitch = 0.88;
  }

  update = (dt) => {
    const viewMode = this.getViewMode();
    const displayedLevelId = viewMode === "menu"
      ? "intro-shift"
      : this.resolveEnvironmentId(this.getActiveLevelId());
    this.audio.update(dt, this.camera.position, displayedLevelId);
    const lightFactor = this.getLightFactor();
    if (viewMode === "level" && this.previousLightFactor < 0.18 && lightFactor > 0.42) {
      this.playSound(this.getPanel(), "LampTurnOn1", { maxDistance: 12 });
    }
    this.previousLightFactor = lightFactor;
    this.#updatePanel(displayedLevelId, viewMode);
    this.#updateFootsteps(viewMode);
    this.#updatePrefabLoops(displayedLevelId, lightFactor);
    this.#updateCore(displayedLevelId, dt);
  };

  #updatePanel(levelId, viewMode) {
    this.audio.setAttachedLoop("panel:Panel1", this.getPanel(), "Panel1_SfxLoop1", this.hasPanel(levelId), {
      levelId,
      volume: viewMode === "menu" ? 0.08 : 0.18,
      refDistance: 0.8,
      maxDistance: 4.5,
      fadeSeconds: 0.8,
    });
  }

  #updateFootsteps(viewMode) {
    const velocity = this.getMovementVelocity();
    const speed = Math.hypot(velocity.x, velocity.z);
    const held = ["KeyW", "KeyA", "KeyS", "KeyD"].some((key) => this.keys.has(key));
    const active = viewMode === "level" && !this.isNoclipEnabled() && (speed > 0.08 || held);
    this.audio.setLoop("Footsteps1_Walk1", active, {
      volume: Math.max(0.18, THREE.MathUtils.clamp(speed / Math.max(this.config.camera.walkSpeed, 0.001), 0, 1) * 0.44),
      fadeSeconds: 0.12,
      playbackRate: THREE.MathUtils.clamp(0.82 + speed / Math.max(this.config.camera.runSpeed, 0.001) * 0.35, 0.82, 1.18),
    });
  }

  #updatePrefabLoops(displayedLevelId, lightFactor) {
    this.prefabInstances.forEach((runtime, key) => {
      const [levelId, prefabName] = key.split(":");
      const prefab = this.config.levelEnvironments?.[levelId]?.prefabs?.find((entry) => entry.name === prefabName);
      const light = prefab?.light;
      if (runtime.light && (light?.fluorescentStartup || light?.faultyStarterLoop)) {
        const soundKey = light.faultyStarterLoop
          ? "LampConstantBuzzBroken1"
          : prefabName.length % 2 === 0 ? "LampConstantBuzz1" : "LampConstantBuzz2";
        this.audio.setAttachedLoop(`lamp:${key}`, runtime.root, soundKey,
          levelId === displayedLevelId && light.enabled !== false && lightFactor > 0.02, {
            levelId,
            volume: (light.faultyStarterLoop ? 0.13 : 0.1) * lightFactor,
            refDistance: light.faultyStarterLoop ? 0.15 : 0.45,
            maxDistance: light.faultyStarterLoop ? 0.7 : 3.2,
            fadeSeconds: 0.45,
          });
      }
      const post = runtime.controlPost;
      if (post?.enabled && post.buzzSoundKey) {
        this.audio.setAttachedLoop(`controlPost:${key}:buzz`, runtime.root, post.buzzSoundKey,
          levelId === displayedLevelId, {
            levelId,
            volume: post.buzzVolume ?? undefined,
            refDistance: post.refDistance ?? 0.45,
            maxDistance: post.maxDistance ?? 2,
            fadeSeconds: post.fadeSeconds ?? 0.35,
          });
      }
      const prefabLoop = prefab?.audio;
      if (prefabLoop?.loopSoundKey) {
        this.audio.setAttachedLoop(`prefab:${key}:loop`, runtime.root, prefabLoop.loopSoundKey,
          levelId === displayedLevelId, {
            levelId,
            volume: prefabLoop.volume,
            refDistance: prefabLoop.refDistance,
            maxDistance: prefabLoop.maxDistance,
            fadeSeconds: prefabLoop.fadeSeconds,
          });
      }
    });
  }

  #updateCore(levelId, dt) {
    const snapshot = this.getSnapshot();
    const elapsed = this.getTerminalElapsed();
    const destroyed = snapshot.failureType === "coreDestroyed" && elapsed >= 0;
    const completed = snapshot.mode === "complete" && elapsed >= 0;
    const tempPitch = THREE.MathUtils.clamp((snapshot.plasmaTemp - 55) / 120, 0, 1);
    const stressPitch = THREE.MathUtils.clamp((snapshot.coreStress ?? 0) / 100, 0, 1);
    const stallDrop = THREE.MathUtils.clamp((snapshot.coreStall ?? 0) / 90, 0, 1);
    const age = Math.max(0, elapsed);
    const destroyedFade = destroyed ? Math.max(0, 1 - age / 5.5) : 1;
    const completeFade = completed ? Math.max(0, 1 - age / 2.4) : 1;
    const volume = (0.3 + tempPitch * 0.17) * (1 - stallDrop * 0.72) * destroyedFade * completeFade;
    const wobble = destroyed ? Math.sin(this.getTime() * 5.7) * 0.08 * destroyedFade : 0;
    const targetPitch = Math.max(0.35, 0.88 + tempPitch * 0.18 + stressPitch * 0.08 - stallDrop * 0.42 + wobble);
    this.reactorPitch = THREE.MathUtils.damp(this.reactorPitch, targetPitch, destroyed ? 4.5 : 2.2, dt);
    const audible = snapshot.mode === "running" || destroyed || completed;
    this.audio.setAttachedLoop("core:FusionCore_Working1", this.getPanel(), "FusionCore_Working1", audible && volume > 0.01, {
      levelId,
      volume,
      refDistance: 1.2,
      maxDistance: 20,
      fadeSeconds: destroyed ? 0.35 : 1.1,
      playbackRate: this.reactorPitch,
    });
  }
}
