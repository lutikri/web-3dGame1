import * as THREE from "three";

export class AudioRuntime {
  constructor({
    sounds,
    groups = {},
    mix = {},
    masterVolume = 1,
    suspended = false,
    blockedScopes = [],
    now = () => globalThis.performance?.now?.() ?? Date.now(),
    recentSeconds = 8,
  }) {
    this.sounds = sounds;
    this.groups = groups;
    this.mix = {
      master: masterVolume,
      ambience: 1,
      interaction: 1,
      machinery: 1,
      narration: 1,
      player: 1,
      ui: 1,
      ...mix,
    };
    this.masterVolume = this.mix.master;
    this.suspended = Boolean(suspended);
    this.context = null;
    this.masterGain = null;
    this.bufferPromises = new Map();
    this.loops = new Map();
    this.oneShots = new Map();
    this.attachedLoops = new Map();
    this.attachedOneShots = new Map();
    this.ambienceVolumes = new Map();
    this.lastGroupChoice = new Map();
    this.unlocked = false;
    this.blockedScopes = new Set(blockedScopes);
    this.activeLevelId = null;
    this.tmpPoint = new THREE.Vector3();
    this.nextOneShotId = 1;
    this.now = now;
    this.recentSeconds = recentSeconds;
    this.playbackHistory = [];
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
      debugType: "ambience",
      box,
      objectName: object.name,
      targetVolume: 0,
      currentVolume: 0,
      authoredVolume: null,
      baseVolume: this.resolveConfiguredVolume(soundKey),
      fadeSeconds: 2.5,
      fadeDistance: config.fadeDistance ?? 2,
    }));
    return true;
  }

  disposeLevel(levelId) {
    [...this.oneShots.entries()].forEach(([key, state]) => {
      if (state.levelId !== levelId) return;
      this.stopOneShotState(state);
      this.oneShots.delete(key);
    });
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

  stopAttachedOneShots(predicate = () => true) {
    let stopped = 0;
    [...this.attachedOneShots.entries()].forEach(([key, state]) => {
      if (!predicate(state)) return;
      this.stopOneShotState(state);
      this.attachedOneShots.delete(key);
      stopped += 1;
    });
    return stopped;
  }

  play(soundKey, options = {}) {
    if (this.isScopeBlocked(options.scope)) return null;
    const config = this.sounds[soundKey];
    if (!config) {
      console.warn(`[AudioRuntime] Unknown sound "${soundKey}"`);
      return null;
    }
    const context = this.getContext();
    if (!context) return null;
    const id = options.id ?? `oneshot:${this.nextOneShotId++}:${soundKey}`;
    const state = {
      id,
      soundKey,
      scope: options.scope ?? null,
      levelId: options.levelId ?? null,
      source: null,
      gain: null,
      ended: false,
      authoredVolume: options.volume ?? null,
      baseVolume: this.resolveConfiguredVolume(soundKey, options.volume),
    };
    this.oneShots.set(id, state);
    this.loadBuffer(soundKey)
      .then((buffer) => {
        if (!buffer || state.ended) return;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.loop = Boolean(options.loop ?? config.loop);
        source.playbackRate.value = options.playbackRate ?? 1;
        gain.gain.value = THREE.MathUtils.clamp(state.baseVolume * this.getSoundMixVolume(soundKey), 0, 1);
        source.connect(gain).connect(this.masterGain);
        source.onended = () => {
          state.ended = true;
          if (state.source === source) state.source = null;
          if (state.gain === gain) state.gain = null;
          this.oneShots.delete(id);
        };
        state.source = source;
        state.gain = gain;
        source.start();
        this.recordPlayback(soundKey, "one-shot");
      })
      .catch((error) => {
        this.oneShots.delete(id);
        console.warn(`[AudioRuntime] Failed to play "${soundKey}"`, error);
      });
    return true;
  }

  playAttached(object, soundKey, listenerPosition, options = {}) {
    if (this.isScopeBlocked(options.scope)) return null;
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
      scope: options.scope ?? null,
      levelId: options.levelId ?? object.userData?.levelId ?? null,
      source: null,
      gain: null,
      ended: false,
      authoredVolume: options.volume ?? null,
      baseVolume: this.resolveConfiguredVolume(soundKey, options.volume),
      refDistance: options.refDistance ?? config.refDistance ?? 0.75,
      maxDistance: options.maxDistance ?? config.maxDistance ?? 5,
      fadeSeconds: options.fadeSeconds ?? 0.08,
      currentVolume: 0,
      targetVolume: 0,
      distanceFactor: 1,
    };
    object.updateWorldMatrix(true, false);
    const worldPosition = object.getWorldPosition(this.tmpPoint);
    const distance = listenerPosition ? worldPosition.distanceTo(listenerPosition) : 0;
    const distanceFactor = 1 - THREE.MathUtils.smoothstep(distance, state.refDistance, state.maxDistance);
    state.distanceFactor = distanceFactor;
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
        gain.gain.value = THREE.MathUtils.clamp(state.currentVolume * this.getSoundMixVolume(soundKey), 0, 1);
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
        this.recordPlayback(soundKey, "attached-one-shot");
      })
      .catch((error) => {
        this.attachedOneShots.delete(id);
        console.warn(`[AudioRuntime] Failed to play attached "${soundKey}"`, error);
      });
    return state;
  }

  playRandom(groupKey, options = {}) {
    if (this.isScopeBlocked(options.scope)) return null;
    const soundKey = this.pickRandomSound(groupKey);
    return soundKey ? this.play(soundKey, options) : null;
  }

  playRandomAttached(object, groupKey, listenerPosition, options = {}) {
    if (this.isScopeBlocked(options.scope)) return null;
    const soundKey = this.pickRandomSound(groupKey);
    return soundKey ? this.playAttached(object, soundKey, listenerPosition, options) : null;
  }

  pickRandomSound(groupKey) {
    const choices = this.groups[groupKey] ?? [];
    if (!choices.length) return null;
    const last = this.lastGroupChoice.get(groupKey);
    const pool = choices.length > 1 ? choices.filter((key) => key !== last) : choices;
    const soundKey = pool[Math.floor(Math.random() * pool.length)];
    this.lastGroupChoice.set(groupKey, soundKey);
    return soundKey;
  }

  setLoop(soundKey, active, options = {}) {
    const config = this.sounds[soundKey];
    if (!config) return null;
    let state = this.loops.get(soundKey);
    if (!state) {
      state = this.createLoopState({
        id: soundKey,
        soundKey,
        debugType: "loop",
        currentVolume: 0,
        targetVolume: 0,
        authoredVolume: options.volume ?? null,
        baseVolume: this.resolveConfiguredVolume(soundKey, options.volume),
        fadeSeconds: config.fadeSeconds ?? options.fadeSeconds ?? 0.4,
      });
      this.loops.set(soundKey, state);
    }
    state.active = Boolean(active);
    state.authoredVolume = options.volume ?? null;
    state.baseVolume = this.resolveConfiguredVolume(soundKey, options.volume);
    state.targetVolume = active ? state.baseVolume : 0;
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
        debugType: "attached-loop",
        levelId: options.levelId ?? object.userData?.levelId ?? null,
        currentVolume: 0,
        targetVolume: 0,
        authoredVolume: options.volume ?? null,
        baseVolume: this.resolveConfiguredVolume(soundKey, options.volume),
        fadeSeconds: options.fadeSeconds ?? config.fadeSeconds ?? 0.35,
        refDistance: options.refDistance ?? config.refDistance ?? 0.7,
        maxDistance: options.maxDistance ?? config.maxDistance ?? 4,
      });
      this.attachedLoops.set(id, state);
    }
    state.object = object;
    state.levelId = options.levelId ?? object.userData?.levelId ?? state.levelId;
    state.authoredVolume = options.volume ?? null;
    state.baseVolume = this.resolveConfiguredVolume(soundKey, options.volume);
    state.fadeSeconds = options.fadeSeconds ?? state.fadeSeconds;
    state.refDistance = options.refDistance ?? state.refDistance;
    state.maxDistance = options.maxDistance ?? state.maxDistance;
    state.active = Boolean(active);
    state.targetPlaybackRate = options.playbackRate ?? state.targetPlaybackRate ?? 1;
    if (state.active) this.ensureLoopPlaying(state);
    return state;
  }

  update(dt, listenerPosition, levelId = this.activeLevelId) {
    this.prunePlaybackHistory();
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
      state.distanceFactor = fade;
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
      state.distanceFactor = fade;
      target = state.baseVolume * fade;
    }
    state.targetVolume = target;
    const damping = state.fadeSeconds <= 0 ? 1000 : 1 / Math.max(state.fadeSeconds, 0.001);
    state.currentVolume = THREE.MathUtils.damp(state.currentVolume ?? 0, state.targetVolume ?? 0, damping, dt);
    if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp(state.currentVolume * this.getSoundMixVolume(state.soundKey), 0, 1);
  }

  fadeLoopState(state, dt) {
    const damping = state.fadeSeconds <= 0 ? 1000 : 1 / Math.max(state.fadeSeconds, 0.001);
    state.currentVolume = THREE.MathUtils.damp(state.currentVolume ?? 0, state.targetVolume ?? 0, damping, dt);
    if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp(state.currentVolume * this.getSoundMixVolume(state.soundKey), 0, 1);
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
        gain.gain.value = THREE.MathUtils.clamp((state.currentVolume ?? 0) * this.getSoundMixVolume(state.soundKey), 0, 1);
        source.connect(gain).connect(this.masterGain);
        source.onended = () => {
          if (state.source === source) state.source = null;
          if (state.gain === gain) state.gain = null;
        };
        state.source = source;
        state.gain = gain;
        source.start();
        this.recordPlayback(state.soundKey, state.debugType ?? "loop");
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
    this.masterGain.gain.value = this.suspended ? 0 : this.masterVolume;
    this.masterGain.connect(this.context.destination);
    return this.context;
  }

  setMasterVolume(value) {
    this.masterVolume = THREE.MathUtils.clamp(Number(value) || 0, 0, 2);
    this.mix.master = this.masterVolume;
    if (this.masterGain) this.masterGain.gain.value = this.suspended ? 0 : this.masterVolume;
  }

  setSuspended(value) {
    this.suspended = Boolean(value);
    if (this.masterGain) this.masterGain.gain.value = this.suspended ? 0 : this.masterVolume;
  }

  setScopeBlocked(scope, blocked) {
    if (!scope) return false;
    if (blocked) {
      this.blockedScopes.add(scope);
      [...this.oneShots.entries()].forEach(([key, state]) => {
        if (state.scope !== scope) return;
        this.stopOneShotState(state);
        this.oneShots.delete(key);
      });
      this.stopAttachedOneShots((state) => state.scope === scope);
    } else {
      this.blockedScopes.delete(scope);
    }
    return this.blockedScopes.has(scope);
  }

  isScopeBlocked(scope) {
    return Boolean(scope && this.blockedScopes.has(scope));
  }

  setMixVolume(group, value) {
    if (!group || group === "master") {
      this.setMasterVolume(value);
      return;
    }
    this.mix[group] = THREE.MathUtils.clamp(Number(value) || 0, 0, 2);
    this.refreshMix();
  }

  refreshMix() {
    this.setMasterVolume(this.mix.master ?? this.masterVolume ?? 1);
    this.loops.forEach((state) => {
      if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp((state.currentVolume ?? 0) * this.getSoundMixVolume(state.soundKey), 0, 1);
    });
    this.oneShots.forEach((state) => {
      if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp((state.baseVolume ?? 0) * this.getSoundMixVolume(state.soundKey), 0, 1);
    });
    this.attachedLoops.forEach((state) => {
      if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp((state.currentVolume ?? 0) * this.getSoundMixVolume(state.soundKey), 0, 1);
    });
    this.attachedOneShots.forEach((state) => {
      if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp((state.currentVolume ?? 0) * this.getSoundMixVolume(state.soundKey), 0, 1);
    });
    this.ambienceVolumes.forEach((state) => {
      if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp((state.currentVolume ?? 0) * this.getSoundMixVolume(state.soundKey), 0, 1);
    });
  }

  getDebugState(levelId = this.activeLevelId) {
    const soundKeys = new Set();
    const collectLoop = (state) => {
      if (!state?.soundKey) return;
      if (state.levelId && levelId && state.levelId !== levelId) return;
      soundKeys.add(state.soundKey);
    };
    this.loops.forEach(collectLoop);
    this.oneShots.forEach(collectLoop);
    this.attachedLoops.forEach(collectLoop);
    this.attachedOneShots.forEach(collectLoop);
    this.ambienceVolumes.forEach(collectLoop);
    const recentSounds = this.getRecentSounds(levelId);
    recentSounds.forEach((entry) => soundKeys.add(entry.soundKey));
    return {
      activeLevelId: levelId,
      unlocked: this.unlocked,
      blockedScopes: [...this.blockedScopes].sort(),
      soundKeys: [...soundKeys].sort(),
      recentSounds,
      loops: this.loops.size,
      attachedLoops: this.attachedLoops.size,
      ambienceVolumes: this.ambienceVolumes.size,
      oneShots: this.oneShots.size + this.attachedOneShots.size,
    };
  }

  refreshSoundConfig(soundKey = null) {
    const matches = (state) => !soundKey || state.soundKey === soundKey;
    const refreshBase = (state) => {
      if (!matches(state)) return;
      state.baseVolume = this.resolveConfiguredVolume(state.soundKey, state.authoredVolume);
    };
    this.oneShots.forEach((state) => {
      refreshBase(state);
      if (state.gain) state.gain.gain.value = THREE.MathUtils.clamp(state.baseVolume * this.getSoundMixVolume(state.soundKey), 0, 1);
    });
    this.loops.forEach((state) => {
      refreshBase(state);
      if (state.active && matches(state)) state.targetVolume = state.baseVolume;
    });
    this.attachedLoops.forEach(refreshBase);
    this.attachedOneShots.forEach((state) => {
      refreshBase(state);
      if (!matches(state)) return;
      state.currentVolume = state.baseVolume * (state.distanceFactor ?? 1);
      state.targetVolume = state.currentVolume;
    });
    this.ambienceVolumes.forEach(refreshBase);
    this.refreshMix();
  }

  resolveConfiguredVolume(soundKey, authoredVolume = null) {
    const config = this.sounds[soundKey] ?? {};
    const configuredValue = Number(config.volume ?? 1);
    const configured = Number.isFinite(configuredValue) ? configuredValue : 1;
    if (authoredVolume == null) return configured;
    const defaultValue = Number(config.__defaultVolume ?? configured);
    const defaultVolume = Number.isFinite(defaultValue) ? Math.max(0.0001, defaultValue) : 1;
    const authoredValue = Number(authoredVolume);
    return (Number.isFinite(authoredValue) ? authoredValue : defaultVolume) * configured / defaultVolume;
  }

  preview(soundKey) {
    return this.play(soundKey, { loop: false });
  }

  recordPlayback(soundKey, type) {
    this.playbackHistory.push({ soundKey, type, playedAt: this.now() });
    this.prunePlaybackHistory();
  }

  prunePlaybackHistory() {
    const cutoff = this.now() - this.recentSeconds * 1000;
    this.playbackHistory = this.playbackHistory.filter((entry) => entry.playedAt >= cutoff);
  }

  getRecentSounds(levelId = this.activeLevelId) {
    this.prunePlaybackHistory();
    const now = this.now();
    const entries = new Map();
    this.playbackHistory.forEach((event) => {
      const entry = entries.get(event.soundKey) ?? {
        soundKey: event.soundKey,
        category: this.getSoundCategory(event.soundKey),
        activeVoices: 0,
        recentPlays: 0,
        lastPlayedAt: event.playedAt,
        types: new Set(),
      };
      entry.recentPlays += 1;
      entry.lastPlayedAt = Math.max(entry.lastPlayedAt, event.playedAt);
      entry.types.add(event.type);
      entries.set(event.soundKey, entry);
    });
    const collectActive = (state, type) => {
      if (!state?.soundKey || !state.source) return;
      if (state.levelId && levelId && state.levelId !== levelId) return;
      const entry = entries.get(state.soundKey) ?? {
        soundKey: state.soundKey,
        category: this.getSoundCategory(state.soundKey),
        activeVoices: 0,
        recentPlays: 0,
        lastPlayedAt: now,
        types: new Set(),
      };
      entry.activeVoices += 1;
      entry.types.add(type);
      entries.set(state.soundKey, entry);
    };
    this.oneShots.forEach((state) => collectActive(state, "one-shot"));
    this.loops.forEach((state) => collectActive(state, "loop"));
    this.attachedOneShots.forEach((state) => collectActive(state, "attached-one-shot"));
    this.attachedLoops.forEach((state) => collectActive(state, "attached-loop"));
    this.ambienceVolumes.forEach((state) => collectActive(state, "ambience"));
    return [...entries.values()]
      .map((entry) => ({
        ...entry,
        types: [...entry.types].sort(),
        ageSeconds: Math.max(0, (now - entry.lastPlayedAt) / 1000),
      }))
      .sort((a, b) => b.activeVoices - a.activeVoices || b.lastPlayedAt - a.lastPlayedAt || a.soundKey.localeCompare(b.soundKey));
  }

  getSoundMixVolume(soundKey) {
    const category = this.getSoundCategory(soundKey);
    return this.mix[category] ?? 1;
  }

  getSoundCategory(soundKey) {
    const config = this.sounds[soundKey] ?? {};
    if (config.mixGroup) return config.mixGroup;
    const match = String(config.path ?? "").match(/assets\/sounds\/([^/]+)\//);
    return match?.[1] ?? "machinery";
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
