export class RandomSpeechRuntime {
  constructor({
    getActiveLevelId,
    getLevelConfig,
    getShiftElapsed,
    getCoreSnapshot,
    getLanguage = () => document.documentElement.lang,
    isPlaybackAllowed = () => true,
    isNarrationActive = () => false,
    playNarration = async () => false,
    random = Math.random,
  } = {}) {
    this.getActiveLevelId = getActiveLevelId;
    this.getLevelConfig = getLevelConfig;
    this.getShiftElapsed = getShiftElapsed;
    this.getCoreSnapshot = getCoreSnapshot;
    this.getLanguage = getLanguage;
    this.isPlaybackAllowed = isPlaybackAllowed;
    this.isNarrationActive = isNarrationActive;
    this.playNarration = playNarration;
    this.random = random;
    this.reset();
  }

  update(dt) {
    const levelId = this.getActiveLevelId?.();
    if (levelId !== this.levelId) this.reset(levelId);
    const config = this.getLevelConfig?.(levelId)?.narration?.randomSpeech;
    if (!config?.enabled || !this.isPlaybackAllowed(levelId) || this.pending || this.isNarrationActive()) return;

    this.checkElapsed += Math.max(0, Number(dt) || 0);
    const interval = Math.max(0.25, Number(config.checkIntervalSeconds) || 8);
    if (this.checkElapsed < interval) return;
    this.checkElapsed %= interval;

    const elapsed = Math.max(0, Number(this.getShiftElapsed?.()) || 0);
    if (elapsed < this.nextEligibleAt || this.random() > clampChance(config.chance, 0.3)) return;

    const candidates = (config.lines ?? []).filter((line) => this.canPlay(line, { levelId, elapsed }));
    const selected = chooseWeighted(candidates, this.random);
    if (!selected) return;
    const line = resolveLocalizedLine(selected, this.getLanguage?.());
    if (!line?.soundKey) return;

    this.pending = true;
    void Promise.resolve(this.playNarration(selected.id, line, levelId))
      .then((played) => {
        if (!played) return;
        this.played.add(selected.id);
        this.lastPlayedAt.set(selected.id, elapsed);
        this.recent.push(selected.id);
        const recentCount = Math.max(0, Math.floor(Number(config.recentHistorySize) || 2));
        while (this.recent.length > recentCount) this.recent.shift();
        const [minCooldown, maxCooldown] = normalizeRange(config.cooldownRangeSeconds, 55, 95);
        this.nextEligibleAt = elapsed + minCooldown + (maxCooldown - minCooldown) * this.random();
      })
      .finally(() => { this.pending = false; });
  }

  canPlay(line, { levelId, elapsed }) {
    if (!line?.id || !matchesShift(line.shift, levelId)) return false;
    if (Number.isFinite(line.minTime) && elapsed < line.minTime) return false;
    if (Number.isFinite(line.maxTime) && elapsed > line.maxTime) return false;
    if (line.once && this.played.has(line.id)) return false;
    if (this.recent.includes(line.id)) return false;
    const lastPlayedAt = this.lastPlayedAt.get(line.id);
    if (Number.isFinite(lastPlayedAt) && elapsed - lastPlayedAt < Math.max(0, Number(line.cooldown) || 0)) return false;
    return matchesReactor(line.reactor, this.getCoreSnapshot?.());
  }

  reset(levelId = null) {
    this.levelId = levelId;
    this.checkElapsed = 0;
    this.nextEligibleAt = 0;
    this.pending = false;
    this.played = new Set();
    this.recent = [];
    this.lastPlayedAt = new Map();
  }
}

function resolveLocalizedLine(line, language) {
  const locale = String(language ?? "").toLowerCase().startsWith("ru") ? "ru" : "en";
  return line?.[locale] ?? null;
}

function matchesShift(shift, levelId) {
  if (!shift) return true;
  return (Array.isArray(shift) ? shift : [shift]).includes(levelId);
}

function matchesReactor(condition, snapshot = {}) {
  if (!condition) return true;
  const modes = condition.modes ?? (condition.mode ? [condition.mode] : null);
  if (modes && !modes.includes(snapshot?.mode)) return false;
  return matchesRange(snapshot?.coreStress, condition.minCoreStress, condition.maxCoreStress)
    && matchesRange(snapshot?.plasmaTemp, condition.minTemperature, condition.maxTemperature)
    && matchesRange(snapshot?.powerOutput, condition.minPower, condition.maxPower);
}

function matchesRange(value, min, max) {
  if (Number.isFinite(min) && (!Number.isFinite(value) || value < min)) return false;
  if (Number.isFinite(max) && (!Number.isFinite(value) || value > max)) return false;
  return true;
}

function chooseWeighted(candidates, random) {
  const totalWeight = candidates.reduce((total, line) => total + Math.max(0, Number(line.weight) || 0), 0);
  if (!(totalWeight > 0)) return null;
  let threshold = random() * totalWeight;
  for (const line of candidates) {
    threshold -= Math.max(0, Number(line.weight) || 0);
    if (threshold <= 0) return line;
  }
  return candidates.at(-1) ?? null;
}

function normalizeRange(value, fallbackMin, fallbackMax) {
  const [first = fallbackMin, second = fallbackMax] = Array.isArray(value) ? value : [];
  return [Math.max(0, Math.min(first, second)), Math.max(0, Math.max(first, second))];
}

function clampChance(value, fallback) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : fallback));
}
