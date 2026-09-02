export class AssetCache {
  constructor({ load, instantiate, now = nowMilliseconds }) {
    if (typeof load !== "function" || typeof instantiate !== "function") {
      throw new TypeError("AssetCache requires load and instantiate functions");
    }
    this.loadAsset = load;
    this.instantiateAsset = instantiate;
    this.now = now;
    this.entries = new Map();
  }

  async instantiate(key, context = {}) {
    let entry = this.entries.get(key);
    const cacheHit = Boolean(entry);
    if (!entry) {
      entry = { promise: null };
      entry.promise = Promise.resolve().then(async () => {
        const phases = {};
        const loadStarted = this.now();
        const source = await this.loadAsset(key, (timing = {}) => Object.assign(phases, timing));
        return {
          source,
          phases,
          sourceLoadMs: this.now() - loadStarted,
        };
      });
      this.entries.set(key, entry);
      entry.promise.catch(() => {
        if (this.entries.get(key) === entry) this.entries.delete(key);
      });
    }

    const loaded = await entry.promise;
    const instantiateStarted = this.now();
    const instance = await this.instantiateAsset(loaded.source, key, context);
    context.onTiming?.({
      key,
      cacheHit,
      sourceLoadMs: cacheHit ? 0 : loaded.sourceLoadMs,
      fetchMs: cacheHit ? 0 : loaded.phases.fetchMs ?? 0,
      parseMs: cacheHit ? 0 : loaded.phases.parseMs ?? 0,
      bytes: cacheHit ? 0 : loaded.phases.bytes ?? 0,
      cloneMs: this.now() - instantiateStarted,
      kind: context.kind ?? "asset",
      name: context.name ?? key,
    });
    return instance;
  }

  has(key) {
    return this.entries.has(key);
  }

  get size() {
    return this.entries.size;
  }

  keys() {
    return this.entries.keys();
  }

  clear() {
    this.entries.clear();
  }
}

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}
