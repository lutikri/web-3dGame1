import * as THREE from "three";

const ZONE_PREFIX = "LZONE_";

export class LightingZoneRuntime {
  constructor({ adjacencyMargin = 0.35, exitPadding = 0.6 } = {}) {
    this.adjacencyMargin = Math.max(0, Number(adjacencyMargin) || 0);
    this.exitPadding = Math.max(0, Number(exitPadding) || 0);
    this.levels = new Map();
    this.activeZone = null;
  }

  registerLevel(levelId, root) {
    this.disposeLevel(levelId);
    root?.updateWorldMatrix?.(true, true);
    const zones = [];
    root?.traverse?.((object) => {
      if (!String(object.name).startsWith(ZONE_PREFIX)) return;
      const box = new THREE.Box3().setFromObject(object);
      if (box.isEmpty()) return;
      object.visible = false;
      const size = box.getSize(new THREE.Vector3());
      zones.push({
        id: object.name.slice(ZONE_PREFIX.length),
        name: object.name,
        levelId,
        root,
        object,
        box,
        volume: size.x * size.y * size.z,
        adjacent: new Set(),
      });
    });
    connectAdjacentZones(zones, this.adjacencyMargin);
    this.levels.set(levelId, zones);
    return zones;
  }

  disposeLevel(levelId) {
    const zones = this.levels.get(levelId) ?? [];
    if (zones.includes(this.activeZone)) this.activeZone = null;
    this.levels.delete(levelId);
  }

  update(position) {
    const visibleZones = [...this.levels.values()].flat().filter((zone) => zone.root.visible !== false);
    const containing = visibleZones
      .filter((zone) => zone.box.containsPoint(position))
      .sort((left, right) => left.volume - right.volume);
    if (containing.length) this.activeZone = containing[0];
    else if (!this.#retainsActiveZone(position)) this.activeZone = null;
    return this.activeZone;
  }

  classifyEmitter(levelId, position, hasFixture = false) {
    const zones = this.levels.get(levelId) ?? [];
    if (!zones.length || !this.activeZone || this.activeZone.levelId !== levelId) return null;
    const emitterZone = zones
      .filter((zone) => zone.box.containsPoint(position))
      .sort((left, right) => left.volume - right.volume)[0] ?? null;
    if (!emitterZone) return { zoneId: null, tier: "off", priority: 3 };
    if (emitterZone === this.activeZone) {
      return { zoneId: emitterZone.id, tier: hasFixture ? "fixture" : "simple", priority: 0 };
    }
    if (this.activeZone.adjacent.has(emitterZone)) {
      return { zoneId: emitterZone.id, tier: "simple", priority: 1 };
    }
    return { zoneId: emitterZone.id, tier: "off", priority: 2 };
  }

  getDebugState() {
    return {
      active: this.activeZone?.id ?? null,
      levels: Object.fromEntries([...this.levels.entries()].map(([levelId, zones]) => [
        levelId,
        zones.map((zone) => ({
          id: zone.id,
          active: zone === this.activeZone,
          adjacent: [...zone.adjacent].map((entry) => entry.id),
        })),
      ])),
    };
  }

  #retainsActiveZone(position) {
    if (!this.activeZone || this.activeZone.root.visible === false) return false;
    const expanded = this.activeZone.box.clone().expandByScalar(this.exitPadding);
    return expanded.containsPoint(position);
  }
}

export function connectAdjacentZones(zones, margin = 0.35) {
  zones.forEach((zone) => zone.adjacent.clear());
  for (let leftIndex = 0; leftIndex < zones.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < zones.length; rightIndex += 1) {
      const left = zones[leftIndex];
      const right = zones[rightIndex];
      if (boxGap(left.box, right.box) > margin) continue;
      left.adjacent.add(right);
      right.adjacent.add(left);
    }
  }
  return zones;
}

export function boxGap(left, right) {
  const dx = Math.max(0, left.min.x - right.max.x, right.min.x - left.max.x);
  const dy = Math.max(0, left.min.y - right.max.y, right.min.y - left.max.y);
  const dz = Math.max(0, left.min.z - right.max.z, right.min.z - left.max.z);
  return Math.hypot(dx, dy, dz);
}
