import * as THREE from "three";

export class AudioRuntime {
  constructor({ sounds, groups = {}, masterVolume = 1 }) {
    this.sounds = sounds;
    this.groups = groups;
    this.masterVolume = masterVolume;
    this.context = null;
    this.masterGain = null;
    this.bufferPromises = new Map();
    this.loops = new Map();
    this.attachedLoops = new Map();
    this.attachedOneShots = new Map();
    this.ambienceVolumes = new Map();
    this.lastGroupChoice = new Map();
    this.unlocked = false;
    this.activeLevelId = null;
    this.tmpPoint = new THREE.Vector3();
    this.nextOneShotId = 1;
  }

  unlock() {
    const context = this.getContext();
    if (!context) return;
    this.unlocked = true;
    context.resume?.();
    this.loops.forEach((state) => this.ensureLoopPlaying(state));
    this.attachedLoops.forEach((state) => this.ensureLoopPlaying(state));
    this.ambienceVolumes.forEach((state) => this.ensureLoopPlaying(state));
  }

  setActiveLevel(levelId) {
    this.activeLevelId = levelId;
  }

  registerAmbienceVolume(levelId, object) {
    const parsed = this.parseMarkerName("SNDVOL_", object.name);
    if (!parsed) return false;
    const soundKey = this.resolveSoundKey(parsed.payload);
    if (!soundKey) {
      console.warn(`[AudioRuntime] Unknown ambience sound marker "${object.name}"`);
      return false;
    }

    object.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(object);
    const config = this.sounds[soundKey] ?? {};
    this.ambienceVolumes.set(`${levelId}:${object.uuid}`, this.createLoopState({
      id: `${levelId}:${object.uuid}`,
      levelId,
      soundKey,
      box,
      objectName: object.name,
      targetVolume: 0,
      currentVolume: 0,
      baseVolume: config.volume ?? 1,
      fadeSeconds: 2.5,
      fadeDistance: config.fadeDistance ?? 2,
    }));
    return true;
  }

  disposeLevel(levelId) {
    [...this.ambienceVolumes.entries()].forEach(([key, state]) => {
      if (state.levelId !== levelId) return;
      this.stopLoopState(state);
      this.ambienceVolumes.delete(key);
    });
    [...this.attachedLoops.entries()].forEach(([key, state]) => {
      if (state.levelId !== levelId) return;
      this.stopLoopState(state);
      this.attachedLoops.delete(key);
    });
    [...this.attachedOneShots.entries()].forEach(([key, state]) => {
      if (state.levelId !== levelId) return;
      this.stopOneShotState(state);
      this.attachedOneShots.delete(key);
    });
  }

  play(soundKey, options = {}) {
    const config = this.sounds[soundKey];
    if (!config) {
      console.warn(`[AudioRuntime] Unknown sound "${soundKey}"`);
      return null;
    }
    const context = this.getContext();
    if (!context) return null;
    this.loadBuffer(soundKey)
      .then((buffer) => {
        if (!buffer) return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.loop = Boolean(options.loop ?? config.loop);
        source.playbackRate.value = options.playbackRate ?? 1;
        gain.gain.value = THREE.MathUtils.clamp((options.volume ?? config.volume ?? 1) * this.masterVolume, 0, 1);
        source.connect(gain).connect(this.masterGain);
        source.start();
      })
      .catch((error) => console.warn(`[AudioRuntime] Failed to play "${soundKey}"`, error));
    return true;
  }

  playAttached(object, soundKey, listenerPosition, options = {}) {
    if (!object) return this.play(soundKey, options);
    const config = this.sounds[soundKey];
    if (!config) return null;
    const context = this.getContext();
    if (!context) return null;
    const id = options.id ?? `oneshot:${this.nextOneShotId++}:${soundKey}`;
    const state = {
      id,
      object,
      soundKey,
      levelId: options.levelId ?? object.userData?.levelId ?? null,
      source: null,
      gain: null,
      ended: false,
      baseVolume: options.volume ?? config.volume ?? 1,
      refDistance: options.refDistance ?? config.refDistance ?? 0.75,
      maxDistance: options.maxDistance ?? config.maxDistance ?? 5,
      fadeSeconds: options.fadeSeconds ?? 0.08,
      currentVolume: 0,
      targetVolume: 0,
    };
    object.updateWorldMatrix(true, false);
    const worldPosition = object.getWorldPosition(this.tmpPoint);
    const distance = listenerPosition ? worldPosition.distanceTo(listenerPosition) : 0;
    const distanceFactor = 1 - THREE.MathUtils.smoothstep(distance, state.refDistance, state.maxDistance);
    state.currentVolume = state.baseVolume * distanceFactor;
    state.targetVolume = state.currentVolume;
    this.attachedOneShots.set(id, state);
    this.loadBuffer(soundKey)
      .then((buffer) => {
        if (!buffer || state.ended) return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.playbackRate.value = options.playbackRate ?? 1;
        gain.gain.value = THREE.MathUtils.clamp(state.currentVolume * this.masterVolume, 0, 1);
        source.connect(gain).connect(this.masterGain);
        source.onended = () => {
          state.ended = true;
          if (state.source === source) state.source = null;
          if (state.gain === gain) state.gain = null;
          this.attachedOneShots.delete(id);
        };
        state.source = source;
        state.gain = gain;
        source.start();
      })
      .catch((error) => {
        this.attachedOneShots.delete(id);
        console.warn(`[AudioRuntime] Failed to play attached "${soundKey}"`, error);
      });
    return state;
  }

  playRandom(groupKey, options = {}) {
    const choices = this.groups[groupKey] ?? [];
    if (!choices.length) return null;
    const last = this.lastGroupChoice.get(groupKey);
    const pool = choices.length > 1 ? choices.filter((key) => key !== last) : choices;
    const soundKey = pool[Math.floor(Math.random() * pool.length)];
    this.lastGroupChoice.set(groupKey, soundKey);
    return this.play(soundKey, options);
  }

  setLoop(soundKey, active, options = {}) {
    const config = this.sounds[soundKey];
    if (!config) return null;
    let state = this.loops.get(soundKey);
    if (!state) {
      state = this.createLoopState({
        id: soundKey,
        soundKey,
        currentVolume: 0,
        targetVolume: 0,
        baseVolume: config.volume ?? 1,
        fadeSeconds: config.fadeSeconds ?? options.fadeSeconds ?? 0.4,
      });
      this.loops.set(soundKey, state);
    }
    state.active = Boolean(active);
    state.targetVolume = active ? (options.volume ?? state.baseVolume) : 0;
    state.fadeSeconds = options.fadeSeconds ?? config.fadeSeconds ?? state.fadeSeconds;
    state.targetPlaybackRate = options.playbackRate ?? state.targetPlaybackRate ?? 1;
    if (active) this.ensureLoopPlaying(state);
    return state;
  }

  setAttachedLoop(id, object, soundKey, active, options = {}) {
    const config = this.sounds[soundKey];
    if (!config || !object) return null;
    let state = this.attachedLoops.get(id);
    if (!state || state.soundKey !== soundKey) {
      if (state) this.stopLoopState(state);
      state = this.createLoopState({
        id,
        object,
        soundKey,
        levelId: options.levelId ?? object.userData?.levelId ?? null,
        currentVolume: 0,
        targetVolume: 0,
        baseVolume: options.volume ?? config.volume ?? 1,
        fadeSeconds: options.fadeSeconds ?? config.fadeSeconds ?? 0.35,
        refDistance: options.refDistance ?? config.refDistance ?? 0.7,
        maxDistance: options.maxDistance ?? config.maxDistance ?? 4,
      });
      this.attachedLoops.set(id, state);
    }
    state.object = object;
    state.levelId = options.levelId ?? object.userData?.levelId ?? state.levelId;
    state.baseVolume = options.volume ?? state.baseVolume;
    state.fadeSeconds = options.fadeSeconds ?? state.fadeSeconds;
    state.refDistance = options.refDistance ?? state.refDistance;
    state.maxDistance = options.maxDistance ?? state.maxDistance;
    state.active = Boolean(active);
    state.targetPlaybackRate = options.playbackRate ?? state.targetPlaybackRate ?? 1;
    if (state.active) this.ensureLoopPlaying(state);
    return state;
  }

  update(dt, listenerPosition, levelId = this.activeLevelId) {
    this.updateAmbienceVolumes(dt, listenerPosition, levelId);
    this.loops.forEach((state) => this.fadeLoopState(state, dt));
    this.attachedLoops.forEach((state) => this.updateAttachedLoop(state, dt, listenerPosition, levelId));
    this.attachedOneShots.forEach((state, key) => {
      if (state.ended) {
        this.attachedOneShots.delete(key);
        return;
      }
      this.updateAttachedOneShot(state, dt, listenerPosition, levelId);
    });
  }

  updateAmbienceVolumes(dt, listenerPosition, levelId) {
    this.ambienceVolumes.forEach((state) => {
      const active = state.levelId === levelId;
      let target = 0;
      if (active) {
        state.box.clampPoint(listenerPosition, this.tmpPoint);
        const distance = this.tmpPoint.distanceTo(listenerPosition);
        target = state.baseVolume * (1 - THREE.MathUtils.smoothstep(distance, 0, state.fadeDistance));
      }
      state.active = target > 0.001;
      state.targetVolume = target;
      if (state.active) this.ensureLoopPlaying(state);
      this.fadeLoopState(state, dt);
    });
  }

  updateAttachedLoop(state, dt, listenerPosition, levelId) {
    const active = state.active && (!state.levelId || state.levelId === levelId);
    let target = 0;
    if (active) {
      state.object.updateWorldMatrix(true, false);
      const worldPosition = state.object.getWorldPosition(this.tmpPoint);
      const distance = worldPosition.distanceTo(listenerPosition);
      const fade = 1 - THREE.MathUtils.smoothstep(distance, state.refDistance, state.maxDistance);
      target = state.baseVolume * fade;
    }
    state.targetVolume = target;
    if (target > 0.001) this.ensureLoopPlaying(state);
    this.fadeLoopState(state, dt);
  }

  updateAttachedOneShot(state, dt, listenerPosition, levelId) {
    const active = !state.levelId || state.levelId === levelId;
    let target = 0;
    if (active) {
      state.object.updateWorldMatrix(true, false);
      const worldPosition = state.object.getWorldPosition(this.tmpPoint);
      const distance = worldPosition.distanceTo(listenerPosition);
      const fade = 1 - THREE.MathUtils.smoothstep(distance, state.refDistance, state.maxDistance);
      target = state.baseVolume * fade;
    }
    state.targetVolume = target;
    const damping = state.fadeSeconds <= 0 ? 1000 : 1 / Math.max(state.fadeSeconds, 0.001);
    state.currentVolume = THREE.MathUtils.damp(state.currentVolume ?? 0, state.targetVolume ?? 0, damping, dt);
    if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp(state.currentVolume * this.masterVolume, 0, 1);
  }

  fadeLoopState(state, dt) {
    const damping = state.fadeSeconds <= 0 ? 1000 : 1 / Math.max(state.fadeSeconds, 0.001);
    state.currentVolume = THREE.MathUtils.damp(state.currentVolume ?? 0, state.targetVolume ?? 0, damping, dt);
    if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp(state.currentVolume * this.masterVolume, 0, 1);
    if (state.source) {
      const targetRate = THREE.MathUtils.clamp(state.targetPlaybackRate ?? 1, 0.25, 4);
      const smoothing = state.playbackRateSmoothing ?? 0.18;
      state.source.playbackRate.setTargetAtTime(targetRate, this.context.currentTime, smoothing);
    }
    if (state.currentVolume <= 0.001 && (state.targetVolume ?? 0) <= 0.001) this.stopLoopState(state);
  }

  createLoopState(partial) {
    return {
      active: false,
      source: null,
      gain: null,
      startPromise: null,
      targetPlaybackRate: 1,
      playbackRateSmoothing: 0.18,
      ...partial,
    };
  }

  ensureLoopPlaying(state) {
    if (!this.unlocked || state.source || state.startPromise) return;
    const context = this.getContext();
    if (!context) return;
    state.startPromise = this.loadBuffer(state.soundKey)
      .then((buffer) => {
        state.startPromise = null;
        if (!buffer || state.source) return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.loop = true;
        source.playbackRate.value = THREE.MathUtils.clamp(state.targetPlaybackRate ?? 1, 0.25, 4);
        gain.gain.value = THREE.MathUtils.clamp((state.currentVolume ?? 0) * this.masterVolume, 0, 1);
        source.connect(gain).connect(this.masterGain);
        source.onended = () => {
          if (state.source === source) state.source = null;
          if (state.gain === gain) state.gain = null;
        };
        state.source = source;
        state.gain = gain;
        source.start();
      })
      .catch((error) => {
        state.startPromise = null;
        console.warn(`[AudioRuntime] Failed to start loop "${state.soundKey}"`, error);
      });
  }

  stopLoopState(state) {
    if (state.source) {
      try {
        state.source.stop();
      } catch {
        // Source may already be stopped.
      }
    }
    state.source = null;
    state.gain = null;
    state.startPromise = null;
    state.currentVolume = 0;
    state.targetVolume = 0;
  }

  stopOneShotState(state) {
    state.ended = true;
    if (state.source) {
      try {
        state.source.stop();
      } catch {
        // Source may already be stopped.
      }
    }
    state.source = null;
    state.gain = null;
    state.currentVolume = 0;
    state.targetVolume = 0;
  }

  loadBuffer(soundKey) {
    const existing = this.bufferPromises.get(soundKey);
    if (existing) return existing;
    const config = this.sounds[soundKey];
    const context = this.getContext();
    const promise = this.fetchArrayBuffer(this.preferOggPath(config.path))
      .catch(() => this.fetchArrayBuffer(config.path))
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer.slice(0)))
      .catch((error) => {
        this.bufferPromises.delete(soundKey);
        throw error;
      });
    this.bufferPromises.set(soundKey, promise);
    return promise;
  }

  fetchArrayBuffer(path) {
    return fetch(path).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} ${path}`);
      return response.arrayBuffer();
    });
  }

  preferOggPath(path) {
    return String(path).replace(/\.mp3($|\?)/i, ".ogg$1");
  }

  getContext() {
    if (this.context) return this.context;
    const AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    this.context = new AudioContextClass();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.masterVolume;
    this.masterGain.connect(this.context.destination);
    return this.context;
  }

  parseMarkerName(prefix, name) {
    if (!String(name).startsWith(prefix)) return null;
    return { payload: String(name).slice(prefix.length) };
  }

  resolveSoundKey(payload) {
    if (this.sounds[payload]) return payload;
    return Object.keys(this.sounds)
      .filter((key) => payload === key || payload.startsWith(`${key}_`))
      .sort((a, b) => b.length - a.length)[0] ?? null;
  }
}
