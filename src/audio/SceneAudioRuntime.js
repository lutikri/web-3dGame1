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
    announcements,
    playSound,
    presentationBlocked = false,
  }) {
    Object.assign(this, {
      config, audio, camera, getPanel, keys, prefabInstances, getViewMode, getActiveLevelId,
      resolveEnvironmentId, hasPanel, getMovementVelocity, isNoclipEnabled, getLightFactor,
      getSnapshot, coreAudio, playSound,
      announcements,
    });
    this.presentationBlocked = Boolean(presentationBlocked);
    this.previousLightFactor = 1;
  }

  setPresentationBlocked = (blocked) => {
    this.presentationBlocked = Boolean(blocked);
    // A lighting transition completed behind the curtain is presentation state,
    // not an audible in-world lamp event when the scene is revealed.
    this.previousLightFactor = this.getLightFactor();
  };

  update = (dt) => {
    const viewMode = this.getViewMode();
    const sceneActive = viewMode === "level" && !this.presentationBlocked;
    const displayedLevelId = viewMode === "menu"
      ? "intro-shift"
      : this.resolveEnvironmentId(this.getActiveLevelId());
    this.audio.update(dt, this.camera.position, this.presentationBlocked ? null : displayedLevelId);
    const lightFactor = this.getLightFactor();
    if (sceneActive && this.previousLightFactor < 0.18 && lightFactor > 0.42) {
      this.playSound(this.getPanel(), "LampTurnOn1", { maxDistance: 12 });
    }
    this.previousLightFactor = lightFactor;
    this.#updatePanel(displayedLevelId, sceneActive);
    this.#updateFootsteps(sceneActive);
    this.#updatePrefabLoops(displayedLevelId, lightFactor, this.presentationBlocked);
    const snapshot = this.getSnapshot();
    this.coreAudio.update(dt, {
      levelId: displayedLevelId,
      active: sceneActive && this.hasPanel(displayedLevelId),
      snapshot,
    });
    this.announcements.update(dt, {
      levelId: displayedLevelId,
      active: sceneActive && this.hasPanel(displayedLevelId),
      snapshot,
    });
  };

  #updatePanel(levelId, sceneActive) {
    this.audio.setAttachedLoop("panel:core", this.getPanel(), "Core1_Panel1_Loop",
      sceneActive && this.hasPanel(levelId), {
        levelId, volume: 0.18, refDistance: 0.8, maxDistance: 4.5, fadeSeconds: 0.8,
      });
  }

  #updateFootsteps(sceneActive) {
    const velocity = this.getMovementVelocity();
    const speed = Math.hypot(velocity.x, velocity.z);
    const held = ["KeyW", "KeyA", "KeyS", "KeyD"].some((key) => this.keys.has(key));
    const active = sceneActive && !this.isNoclipEnabled() && (speed > 0.08 || held);
    this.audio.setLoop("Footsteps1_Walk1", active, {
      volume: Math.max(0.18, THREE.MathUtils.clamp(speed / Math.max(this.config.camera.walkSpeed, 0.001), 0, 1) * 0.44),
      fadeSeconds: 0.12,
      playbackRate: THREE.MathUtils.clamp(0.82 + speed / Math.max(this.config.camera.runSpeed, 0.001) * 0.35, 0.82, 1.18),
    });
  }

  #updatePrefabLoops(displayedLevelId, lightFactor, presentationBlocked) {
    this.prefabInstances.forEach((runtime, key) => {
      const [levelId, prefabName] = key.split(":");
      const prefab = this.config.levelEnvironments?.[levelId]?.prefabs?.find((entry) => entry.name === prefabName);
      const light = prefab?.light;
      if (runtime.light && (light?.fluorescentStartup || light?.faultyStarterLoop)) {
        const soundKey = light.faultyStarterLoop
          ? "LampConstantBuzzBroken1"
          : prefabName.length % 2 === 0 ? "LampConstantBuzz1" : "LampConstantBuzz2";
        this.audio.setAttachedLoop(`lamp:${key}`, runtime.root, soundKey,
          !presentationBlocked && levelId === displayedLevelId && light.enabled !== false && lightFactor > 0.02, {
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
          !presentationBlocked && levelId === displayedLevelId, {
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
          !presentationBlocked && levelId === displayedLevelId, {
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
