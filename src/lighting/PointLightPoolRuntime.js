import * as THREE from "three";

export function createPointLightPoolRuntime({
  scene,
  camera,
  photometricLights,
  lightingZones,
  maxLights = 6,
  maxFixtureLights = 3,
  fixtureRadius = 10,
  simpleRadius = 20,
  selectionHysteresis = 2,
  transitionSeconds = 0.5,
} = {}) {
  const entries = [];
  const slots = Array.from({ length: Math.max(0, Math.floor(maxLights)) }, (_, index) => {
    const light = new THREE.PointLight(0xffffff, 0, 0, 2);
    light.name = `PooledPointLight_${String(index + 1).padStart(2, "0")}`;
    light.visible = true;
    light.castShadow = false;
    light.userData.pointLightPoolSlot = index;
    scene?.add(light);
    return { light, entry: null };
  });
  const cameraPosition = new THREE.Vector3();
  const lightPosition = new THREE.Vector3();
  const lightQuaternion = new THREE.Quaternion();
  let previousTiers = new Map();

  function register(runtime, lightConfig, photometricEntry = null) {
    const source = runtime?.light;
    if (!source?.isPointLight) return null;
    source.userData.pooledEmitter = true;
    source.visible = false;
    const entry = {
      runtime,
      levelId: runtime.root?.userData.levelId ?? null,
      source,
      lightConfig,
      photometricEntry,
      slot: null,
      tier: "off",
      blend: 0,
      fixtureBlend: 0,
    };
    entries.push(entry);
    photometricLights?.setPooledAssignment?.(photometricEntry, null, 0);
    return entry;
  }

  function unregister(entry) {
    if (!entry) return;
    releaseSlot(entry);
    photometricLights?.setPooledAssignment?.(entry.photometricEntry, null, 0);
    const index = entries.indexOf(entry);
    if (index >= 0) entries.splice(index, 1);
    previousTiers.delete(entry);
  }

  function update(dt = 0) {
    camera?.updateMatrixWorld?.(true);
    camera?.getWorldPosition?.(cameraPosition);
    lightingZones?.update?.(cameraPosition);
    const candidates = entries.flatMap((entry) => {
      entry.source.visible = false;
      if (!(entry.source.intensity > 0) || !isHierarchyVisible(entry.source.parent)) return [];
      entry.source.updateMatrixWorld?.(true);
      entry.source.getWorldPosition(lightPosition);
      const zone = lightingZones?.classifyEmitter?.(
        entry.levelId,
        lightPosition,
        Boolean(entry.photometricEntry),
      ) ?? null;
      return [{
        entry,
        distanceSq: camera ? lightPosition.distanceToSquared(cameraPosition) : 0,
        hasFixture: Boolean(entry.photometricEntry),
        zoneTier: zone?.tier ?? null,
        priority: zone?.priority ?? 2,
        zoneId: zone?.zoneId ?? null,
      }];
    });
    const selection = selectPointLightPoolEntries(candidates, {
      maxLights: slots.length,
      maxFixtureLights,
      fixtureRadius,
      simpleRadius,
      hysteresis: selectionHysteresis,
      previousTiers,
    });
    previousTiers = new Map(selection.map(({ entry, tier }) => [entry, tier]));
    const selected = new Map(selection.map((item) => [item.entry, item]));
    const candidateByEntry = new Map(candidates.map((candidate) => [candidate.entry, candidate]));

    entries.forEach((entry) => {
      const selectionEntry = selected.get(entry);
      const tier = selectionEntry?.tier ?? "off";
      entry.zoneId = selectionEntry?.zoneId ?? candidateByEntry.get(entry)?.zoneId ?? null;
      if (tier === "off") {
        entry.blend = 0;
        entry.fixtureBlend = 0;
        releaseSlot(entry);
        photometricLights?.setPooledAssignment?.(entry.photometricEntry, null, 0);
        entry.tier = tier;
        return;
      }
      if (!entry.slot) entry.slot = claimSlot(entry);
      entry.blend = advancePoolBlend(entry.blend, true, dt, transitionSeconds);
      entry.fixtureBlend = advancePoolBlend(
        entry.fixtureBlend,
        tier === "fixture",
        dt,
        transitionSeconds,
      );
      entry.tier = tier;
      syncSlot(entry);
      photometricLights?.setPooledAssignment?.(
        entry.photometricEntry,
        entry.slot?.light ?? null,
        entry.fixtureBlend,
      );
    });
  }

  function claimSlot(entry) {
    const slot = slots.find((candidate) => !candidate.entry);
    if (!slot) return null;
    slot.entry = entry;
    return slot;
  }

  function releaseSlot(entry) {
    if (!entry.slot) return;
    entry.slot.light.intensity = 0;
    entry.slot.entry = null;
    entry.slot = null;
  }

  function syncSlot(entry) {
    const target = entry.slot?.light;
    if (!target) return;
    entry.source.updateMatrixWorld?.(true);
    entry.source.getWorldPosition(target.position);
    entry.source.getWorldQuaternion(lightQuaternion);
    target.quaternion.copy(lightQuaternion);
    target.color.copy(entry.source.color);
    target.distance = entry.source.distance;
    target.decay = entry.source.decay;
    target.intensity = entry.source.intensity * entry.blend;
    target.visible = true;
    target.updateMatrixWorld?.(true);
  }

  function prepare() {
    update(transitionSeconds);
  }

  function getDebugState() {
    return {
      slots: slots.length,
      fixtureSlots: Math.min(maxFixtureLights, slots.length),
      fixtureRadius,
      simpleRadius,
      registered: entries.length,
      active: entries.filter((entry) => entry.slot).length,
      entries: entries.map((entry) => ({
        light: entry.source.name,
        tier: entry.tier,
        slot: entry.slot?.light.userData.pointLightPoolSlot ?? -1,
        intensity: Number((entry.slot?.light.intensity ?? 0).toFixed(3)),
        blend: Number(entry.blend.toFixed(3)),
        fixtureBlend: Number(entry.fixtureBlend.toFixed(3)),
        zoneId: entry.zoneId ?? null,
      })),
    };
  }

  return { getDebugState, prepare, register, unregister, update };
}

export function selectPointLightPoolEntries(candidates, {
  maxLights = 6,
  maxFixtureLights = 3,
  fixtureRadius = 10,
  simpleRadius = 20,
  hysteresis = 2,
  previousTiers = new Map(),
} = {}) {
  const retention = Math.max(0, Number(hysteresis) || 0);
  const fixtureLimit = Math.max(0, Math.floor(maxFixtureLights));
  const lightLimit = Math.max(0, Math.floor(maxLights));
  const sorted = candidates
    .filter(({ distanceSq }) => Number.isFinite(distanceSq))
    .map((candidate) => ({ ...candidate, distance: Math.sqrt(candidate.distanceSq) }))
    .filter(({ entry, distance, zoneTier }) => (
      zoneTier === "fixture" || zoneTier === "simple" || (
        zoneTier == null
        && distance <= Math.max(0, simpleRadius) + (previousTiers.has(entry) ? retention : 0)
      )
    ))
    .sort((left, right) => {
      const priorityDelta = (left.priority ?? 2) - (right.priority ?? 2);
      if (priorityDelta !== 0) return priorityDelta;
      const leftScore = left.distance - (previousTiers.has(left.entry) ? retention : 0);
      const rightScore = right.distance - (previousTiers.has(right.entry) ? retention : 0);
      return leftScore - rightScore;
    })
    .slice(0, lightLimit);
  const fixtureEntries = new Set(sorted
    .filter(({ entry, distance, hasFixture, zoneTier }) => (
      hasFixture
      && (zoneTier === "fixture" || (
        zoneTier == null
        && distance <= Math.max(0, fixtureRadius)
          + (previousTiers.get(entry) === "fixture" ? retention : 0)
      ))
    ))
    .slice(0, fixtureLimit)
    .map(({ entry }) => entry));
  return sorted.map(({ entry, zoneId }) => {
    const selection = { entry, tier: fixtureEntries.has(entry) ? "fixture" : "simple" };
    if (zoneId != null) selection.zoneId = zoneId;
    return selection;
  });
}

export function advancePoolBlend(current, selected, dt, transitionSeconds = 0.5) {
  const value = THREE.MathUtils.clamp(Number(current) || 0, 0, 1);
  const duration = Math.max(0, Number(transitionSeconds) || 0);
  if (duration === 0) return selected ? 1 : 0;
  const step = Math.max(0, Number(dt) || 0) / duration;
  return THREE.MathUtils.clamp(value + (selected ? step : -step), 0, 1);
}

function isHierarchyVisible(object) {
  for (let current = object; current; current = current.parent) {
    if (current.visible === false) return false;
  }
  return true;
}
