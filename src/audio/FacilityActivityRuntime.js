import * as THREE from "three";

export class FacilityActivityRuntime {
  constructor({
    getActiveLevelId,
    getLevelConfig,
    getEnvironmentRoot = () => null,
    getShiftElapsed = () => 0,
    getCoreSnapshot = () => null,
    isPlaybackAllowed = () => true,
    isBlocked = () => false,
    playSound = () => null,
    stopActivity = () => {},
    random = Math.random,
  } = {}) {
    Object.assign(this, {
      getActiveLevelId, getLevelConfig, getEnvironmentRoot, getShiftElapsed, getCoreSnapshot,
      isPlaybackAllowed, isBlocked, playSound, stopActivity, random,
    });
    this.reset();
  }

  update(dt) {
    const levelId = this.getActiveLevelId?.();
    if (levelId !== this.levelId) this.activate(levelId);
    const config = this.getLevelConfig?.(levelId)?.facilityActivity;
    if (!config?.enabled || !this.isPlaybackAllowed(levelId)) return;

    if (this.isBlocked()) return;
    this.elapsed += Math.max(0, Number(dt) || 0);
    this.flushDueSteps(levelId, config);
    if (this.activeEvent && this.pendingSteps.length === 0 && this.elapsed >= this.activeEvent.endsAt) {
      this.activeEvent = null;
    }
    if (this.activeEvent || this.elapsed < this.nextEventAt || this.elapsed < this.nextProbeAt) return;

    this.nextProbeAt = this.elapsed + randomRange(config.checkIntervalRangeSeconds, 8, 15, this.random);
    if (this.random() > clamp(config.chance, 0.32)) return;
    const event = this.pickEvent(config, levelId);
    if (event) this.startEvent(event, config, levelId);
  }

  activate(levelId) {
    this.reset();
    this.levelId = levelId;
    const config = this.getLevelConfig?.(levelId)?.facilityActivity;
    this.emitters = createEmitters(config?.emitters, this.getEnvironmentRoot?.(levelId));
    this.nextProbeAt = randomRange(config?.checkIntervalRangeSeconds, 8, 15, this.random);
  }

  reset() {
    if (this.levelId) this.stopActivity(this.levelId);
    this.emitters?.forEach((emitter) => emitter.removeFromParent());
    this.levelId = null;
    this.elapsed = 0;
    this.nextProbeAt = 0;
    this.nextEventAt = 0;
    this.activityId = 0;
    this.activeEvent = null;
    this.pendingSteps = [];
    this.playedSoundIds = new Set();
    this.lastSoundAt = new Map();
    this.recentSoundIds = [];
    this.emitters = new Map();
  }

  pickEvent(config, levelId) {
    const candidates = (config.events ?? []).filter((event) => this.canPlayEvent(event, config, levelId));
    if (!candidates.length) return null;
    const uncanny = candidates.filter((event) => eventCategory(event, config) === "uncanny");
    const ordinary = candidates.filter((event) => eventCategory(event, config) !== "uncanny");
    const pool = uncanny.length && this.random() < clamp(config.uncannyChance, 0.04)
      ? uncanny
      : ordinary.length ? ordinary : uncanny;
    return chooseWeighted(pool, this.random);
  }

  canPlayEvent(event, config, levelId) {
    if (!matchesShift(event.shift, levelId) || !matchesReactor(event.reactor, this.getCoreSnapshot?.())) return false;
    const elapsed = Number(this.getShiftElapsed?.()) || 0;
    if (Number.isFinite(event.minTime) && elapsed < event.minTime) return false;
    if (Number.isFinite(event.maxTime) && elapsed > event.maxTime) return false;
    const sounds = new Map((config.sounds ?? []).map((sound) => [sound.id, sound]));
    return (event.steps ?? []).every((step) => this.canPlaySound(sounds.get(step.soundId), levelId));
  }

  canPlaySound(sound, levelId) {
    if (!sound?.id || !sound.file) return false;
    if (!matchesShift(sound.shift, levelId)) return false;
    if (!matchesReactor(sound.reactor, this.getCoreSnapshot?.())) return false;
    if ((sound.once || sound.allowRepeat === false) && this.playedSoundIds.has(sound.id)) return false;
    if (this.recentSoundIds.includes(sound.id)) return false;
    const lastPlayedAt = this.lastSoundAt.get(sound.id);
    return !Number.isFinite(lastPlayedAt) || this.elapsed - lastPlayedAt >= Math.max(0, Number(sound.minCooldown) || 0);
  }

  startEvent(event, config, levelId) {
    const sounds = new Map((config.sounds ?? []).map((sound) => [sound.id, sound]));
    const id = ++this.activityId;
    let at = this.elapsed;
    let endsAt = at;
    const steps = (event.steps ?? []).map((step, index) => {
      if (index > 0) at += randomRange(step.delayRangeSeconds ?? step.delaySeconds, 0, 0, this.random);
      const sound = sounds.get(step.soundId);
      const pitch = 1 + randomSigned(sound.pitchVariation, this.random);
      endsAt = Math.max(endsAt, at + (sound.duration ?? 0) / Math.max(0.01, pitch));
      return { at, sound, pitch, stepIndex: index, activityId: id };
    });
    if (!steps.length) return false;
    const firstSound = steps[0].sound;
    this.activeEvent = { id: event.id, endsAt };
    this.pendingSteps.push(...steps);
    this.nextEventAt = endsAt + randomRange(
      [firstSound.minCooldown, firstSound.maxCooldown], 25, 80, this.random,
    );
    this.flushDueSteps(levelId, config);
    return true;
  }

  flushDueSteps(levelId, config) {
    const due = this.pendingSteps.filter((step) => step.at <= this.elapsed);
    this.pendingSteps = this.pendingSteps.filter((step) => step.at > this.elapsed);
    due.forEach((step) => this.playStep(step, levelId, config));
  }

  playStep({ sound, pitch, stepIndex, activityId }, levelId, config) {
    const emitter = this.pickEmitter(sound);
    if (!emitter) return;
    const volume = Math.max(0, Number(sound.volume) || 0) * (0.9 + this.random() * 0.2);
    const played = this.playSound(emitter, sound.file, {
      id: `facility:${levelId}:${activityId}:${stepIndex}:${sound.id}`,
      levelId,
      volume,
      refDistance: sound.refDistance,
      maxDistance: sound.maxDistance,
      playbackRate: pitch,
    });
    if (!played) return;
    this.playedSoundIds.add(sound.id);
    this.lastSoundAt.set(sound.id, this.elapsed);
    this.recentSoundIds.push(sound.id);
    const historySize = Math.max(0, Math.floor(Number(config.recentHistorySize) || 3));
    while (this.recentSoundIds.length > historySize) this.recentSoundIds.shift();
  }

  pickEmitter(sound) {
    const candidates = (sound.emitterIds ?? []).map((id) => this.emitters.get(id)).filter(Boolean);
    return candidates.length ? candidates[Math.floor(this.random() * candidates.length)] : null;
  }
}

function createEmitters(definitions = {}, parent = null) {
  return new Map(Object.entries(definitions).map(([id, definition]) => {
    const emitter = new THREE.Object3D();
    emitter.name = `FacilityActivity_${id}`;
    emitter.position.set(definition?.position?.x ?? 0, definition?.position?.y ?? 0, definition?.position?.z ?? 0);
    parent?.add(emitter);
    return [id, emitter];
  }));
}

function eventCategory(event, config) {
  if (event.category) return event.category;
  const sound = (config.sounds ?? []).find(({ id }) => id === event.steps?.[0]?.soundId);
  return sound?.category ?? "machinery";
}

function matchesShift(shift, levelId) {
  if (!shift) return true;
  return (Array.isArray(shift) ? shift : [shift]).includes(levelId);
}

function matchesReactor(condition, snapshot = {}) {
  if (!condition) return true;
  const modes = condition.modes ?? (condition.mode ? [condition.mode] : null);
  if (modes && !modes.includes(snapshot?.mode)) return false;
  return matchesRange(snapshot?.powerOutput, condition.minPower, condition.maxPower)
    && matchesRange(snapshot?.coreStress, condition.minCoreStress, condition.maxCoreStress);
}

function matchesRange(value, min, max) {
  if (Number.isFinite(min) && (!Number.isFinite(value) || value < min)) return false;
  if (Number.isFinite(max) && (!Number.isFinite(value) || value > max)) return false;
  return true;
}

function chooseWeighted(items, random) {
  const total = items.reduce((sum, item) => sum + Math.max(0, Number(item.weight) || 0), 0);
  if (!(total > 0)) return null;
  let threshold = random() * total;
  for (const item of items) {
    threshold -= Math.max(0, Number(item.weight) || 0);
    if (threshold <= 0) return item;
  }
  return items.at(-1) ?? null;
}

function randomRange(value, fallbackMin, fallbackMax, random) {
  const [first = fallbackMin, second = fallbackMax] = Array.isArray(value) ? value : [value, value];
  const min = Math.max(0, Math.min(Number(first) || fallbackMin, Number(second) || fallbackMax));
  const max = Math.max(min, Math.max(Number(first) || fallbackMax, Number(second) || fallbackMax));
  return min + (max - min) * random();
}

function randomSigned(amount, random) {
  return (random() * 2 - 1) * Math.max(0, Number(amount) || 0);
}

function clamp(value, fallback) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : fallback));
}
