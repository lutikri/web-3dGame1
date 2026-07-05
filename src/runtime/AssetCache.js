export class AssetCache {
  constructor({ load, instantiate }) {
    if (typeof load !== "function" || typeof instantiate !== "function") {
      throw new TypeError("AssetCache requires load and instantiate functions");
    }
    this.loadAsset = load;
    this.instantiateAsset = instantiate;
    this.entries = new Map();
  }

  async instantiate(key) {
    let promise = this.entries.get(key);
    if (!promise) {
      promise = Promise.resolve().then(() => this.loadAsset(key));
      this.entries.set(key, promise);
      promise.catch(() => {
        if (this.entries.get(key) === promise) this.entries.delete(key);
      });
    }
    return this.instantiateAsset(await promise, key);
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
