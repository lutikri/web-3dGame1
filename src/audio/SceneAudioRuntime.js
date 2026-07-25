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
    coreAudio,
    playSound,
  }) {
    Object.assign(this, {
      config, audio, camera, getPanel, keys, prefabInstances, getViewMode, getActiveLevelId,
      resolveEnvironmentId, hasPanel, getMovementVelocity, isNoclipEnabled, getLightFactor,
      getSnapshot, coreAudio, playSound,
    });
    this.previousLightFactor = 1;
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
    this.coreAudio.update(dt, {
      levelId: displayedLevelId,
      active: viewMode === "level" && this.hasPanel(displayedLevelId),
      snapshot: this.getSnapshot(),
    });
  };

  #updatePanel(levelId, viewMode) {
    // CoreAudioRuntime owns the reactor panel bed and its alarm layers.
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

}
