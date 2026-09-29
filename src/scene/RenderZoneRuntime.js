import * as THREE from "three";

const ZONE_PREFIX = "LZONE_";
const NON_RENDER_PREFIXES = ["TRGVOL_", "SNDVOL_", "SOCKET_", "PF_", "RB_"];
const COLLIDER_PREFIX = /^(?:UBX|UCX|USP|UCP)_/i;

export class RenderZoneRuntime {
  constructor({ lightingZones, warn = console.warn, now = () => performance.now() } = {}) {
    this.lightingZones = lightingZones;
    this.warn = warn;
    this.now = now;
    this.levels = new Map();
    this.warmupLeaseCount = 0;
  }

  registerLevel(levelId, root, sourceConfig = {}) {
    this.disposeLevel(levelId);
    const config = normalizeConfig(sourceConfig);
    if (!config.enabled || !root) return null;

    root.updateWorldMatrix(true, true);
    const zones = collectZones(levelId, root, config.volumeAliases);
    if (!zones.length) {
      this.warn(`[RenderZones] No ${ZONE_PREFIX} volumes found for ${levelId}`);
      return null;
    }

    const knownZoneIds = new Set(zones.map((zone) => zone.id));
    validateGraph(levelId, config.visibility, knownZoneIds, this.warn);
    const entries = collectRenderEntries(root, zones, config);
    const state = {
      levelId,
      root,
      config,
      zones,
      zoneById: groupZonesById(zones),
      entries,
      visibleZoneIds: new Set(),
      activeZoneId: null,
      zoneMissingSinceMs: null,
      managedCount: entries.filter((entry) => entry.zoneIds.length > 0).length,
      sharedCount: entries.filter((entry) => entry.zoneIds.length === 0).length,
    };
    this.levels.set(levelId, state);
    return state;
  }

  disposeLevel(levelId) {
    const state = this.levels.get(levelId);
    state?.entries.forEach((entry) => {
      entry.object.visible = entry.originalVisible;
    });
    this.levels.delete(levelId);
  }

  update(cameraPosition) {
    if (this.warmupLeaseCount > 0) return;
    const activeZone = this.lightingZones?.getActiveZone?.() ?? null;
    const nowMs = this.now();
    this.levels.forEach((state) => {
      if (state.root.visible === false) return;
      const activeZoneId = activeZone?.levelId === state.levelId ? activeZone.id : null;
      if (!activeZoneId || !state.zoneById.has(activeZoneId)) {
        if (state.activeZoneId) {
          state.zoneMissingSinceMs ??= nowMs;
          if (nowMs - state.zoneMissingSinceMs <= state.config.zoneExitGraceMs) return;
        }
        this.#showAll(state);
        return;
      }
      state.zoneMissingSinceMs = null;
      this.#applyVisibility(state, activeZoneId, cameraPosition);
    });
  }

  getDebugState() {
    return Object.fromEntries([...this.levels.entries()].map(([levelId, state]) => [levelId, {
      active: state.activeZoneId,
      visible: [...state.visibleZoneIds],
      managedMeshes: state.managedCount,
      alwaysVisibleMeshes: state.sharedCount,
      hiddenMeshes: state.entries.filter((entry) => entry.object.visible === false).length,
      warmupOverride: this.warmupLeaseCount > 0,
    }]));
  }

  beginWarmup() {
    this.warmupLeaseCount += 1;
    this.levels.forEach((state) => {
      state.entries.forEach((entry) => {
        entry.object.visible = entry.originalVisible;
      });
    });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.warmupLeaseCount = Math.max(0, this.warmupLeaseCount - 1);
      if (this.warmupLeaseCount > 0) return;
      this.levels.forEach((state) => this.#restoreCurrentVisibility(state));
    };
  }

  #showAll(state) {
    state.activeZoneId = null;
    state.zoneMissingSinceMs = null;
    state.visibleZoneIds.clear();
    state.entries.forEach((entry) => {
      entry.object.visible = entry.originalVisible;
    });
  }

  #restoreCurrentVisibility(state) {
    if (!state.activeZoneId) {
      this.#showAll(state);
      return;
    }
    state.entries.forEach((entry) => {
      entry.object.visible = entry.originalVisible && (
        entry.zoneIds.length === 0 || entry.zoneIds.some((zoneId) => state.visibleZoneIds.has(zoneId))
      );
    });
  }

  #applyVisibility(state, activeZoneId, cameraPosition) {
    const rule = state.config.visibility[activeZoneId];
    if (!rule) {
      this.#showAll(state);
      return;
    }

    const nextVisible = new Set([activeZoneId, ...rule.always]);
    rule.nearby.forEach((zoneId) => {
      const zone = state.zoneById.get(zoneId);
      if (!zone) return;
      const wasVisible = state.visibleZoneIds.has(zoneId);
      const threshold = wasVisible ? state.config.releaseDistance : state.config.preloadDistance;
      if (distanceToZone(zone, cameraPosition) <= threshold) nextVisible.add(zoneId);
    });

    if (setsEqual(nextVisible, state.visibleZoneIds) && state.activeZoneId === activeZoneId) return;
    state.activeZoneId = activeZoneId;
    state.visibleZoneIds = nextVisible;
    state.entries.forEach((entry) => {
      entry.object.visible = entry.originalVisible && (
        entry.zoneIds.length === 0 || entry.zoneIds.some((zoneId) => nextVisible.has(zoneId))
      );
    });
  }
}

function normalizeConfig(source = {}) {
  const preloadDistance = finiteNonNegative(source.preloadDistance, 10);
  return {
    enabled: source.enabled === true,
    zoneExitGraceMs: finiteNonNegative(source.zoneExitGraceMs, 750),
    preloadDistance,
    releaseDistance: Math.max(preloadDistance, finiteNonNegative(source.releaseDistance, 14)),
    sharedZoneCount: Math.max(2, Math.round(finitePositive(source.sharedZoneCount, 3))),
    volumeAliases: Object.fromEntries(Object.entries(source.volumeAliases ?? {}).map(([volumeId, zoneId]) => [
      String(volumeId).trim(),
      String(zoneId).trim(),
    ]).filter(([volumeId, zoneId]) => volumeId && zoneId)),
    visibility: Object.fromEntries(Object.entries(source.visibility ?? {}).map(([zoneId, rule]) => [zoneId, {
      always: normalizeIds(rule?.always),
      nearby: normalizeIds(rule?.nearby),
    }])),
  };
}

function collectZones(levelId, root, volumeAliases = {}) {
  const zones = [];
  root.traverse((object) => {
    if (!String(object.name).startsWith(ZONE_PREFIX)) return;
    const box = new THREE.Box3().setFromObject(object);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const physicalId = object.name.slice(ZONE_PREFIX.length);
    zones.push({
      id: volumeAliases[physicalId] ?? physicalId,
      physicalId,
      levelId,
      box,
      volume: size.x * size.y * size.z,
    });
  });
  return zones;
}

function collectRenderEntries(root, zones, config) {
  const entries = [];
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  root.traverse((object) => {
    if (!object.isMesh || object.visible === false || isExcludedObject(object, root)) return;
    box.setFromObject(object);
    if (box.isEmpty()) return;
    const intersecting = zones.filter((zone) => zone.box.intersectsBox(box));
    const isShared = intersecting.length >= config.sharedZoneCount;
    let zoneIds = [];
    if (!isShared) {
      box.getCenter(center);
      const containing = intersecting
        .filter((zone) => zone.box.containsPoint(center))
        .sort((left, right) => left.volume - right.volume);
      zoneIds = [...new Set(containing.length ? [containing[0].id] : intersecting.map((zone) => zone.id))];
    }
    entries.push({ object, originalVisible: object.visible, zoneIds });
  });
  return entries;
}

function groupZonesById(zones) {
  const grouped = new Map();
  zones.forEach((zone) => {
    const group = grouped.get(zone.id) ?? { id: zone.id, volumes: [] };
    group.volumes.push(zone);
    grouped.set(zone.id, group);
  });
  return grouped;
}

function distanceToZone(zone, position) {
  return Math.min(...zone.volumes.map((volume) => volume.box.distanceToPoint(position)));
}

function isExcludedObject(object, root) {
  if (COLLIDER_PREFIX.test(object.name)) return true;
  let current = object;
  while (current && current !== root) {
    const name = String(current.name ?? "");
    if (NON_RENDER_PREFIXES.some((prefix) => name.startsWith(prefix))) return true;
    if (current.userData?.tg_kind === "level_rigid_body" || current.userData?.prefabCollider) return true;
    current = current.parent;
  }
  return false;
}

function validateGraph(levelId, visibility, knownZoneIds, warn) {
  Object.entries(visibility).forEach(([from, rule]) => {
    if (!knownZoneIds.has(from)) warn(`[RenderZones] Unknown source zone "${from}" in ${levelId}`);
    [...rule.always, ...rule.nearby].forEach((to) => {
      if (!knownZoneIds.has(to)) warn(`[RenderZones] Unknown target zone "${to}" from "${from}" in ${levelId}`);
    });
  });
}

function normalizeIds(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value).trim()).filter(Boolean))];
}

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function finiteNonNegative(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function setsEqual(left, right) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
