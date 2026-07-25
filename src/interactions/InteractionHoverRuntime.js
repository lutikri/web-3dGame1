import * as THREE from "three";

const TOOLTIP_KINDS = new Set([
  "controlKnob",
  "controlButton",
  "roomLightButton",
  "bulkheadHandle",
  "doorLatchHandle",
]);

export function createInteractionHoverRuntime({
  raycaster,
  pointer,
  camera,
  interactive,
  controlTooltip,
  config,
  getInteractionLevelId,
  getActiveLevelId,
  isObjectVisible,
  getTooltipText,
  setHoveredDoor,
  getOcclusionRoots = () => [],
  body = document.body,
}) {
  const worldPosition = new THREE.Vector3();
  let hoveredInteractive = null;
  let hoveredKnob = null;
  let hoveredTooltipTarget = null;
  let forcedTarget = null;
  let lastHoverSignal = "";

  function update() {
    if (forcedTarget) {
      applyTarget(forcedTarget, null, true);
      return forcedTarget;
    }
    raycaster.setFromCamera(pointer, camera);
    const interactionLevelId = getInteractionLevelId();
    const roots = getOcclusionRoots().filter(Boolean);
    const candidates = roots.length > 0
      ? raycaster.intersectObjects(roots, true)
      : raycaster.intersectObjects(interactive, true);
    const hit = resolveVisibleInteractionHit(candidates, {
      interactionLevelId,
      interactionConfig: config.interaction,
      isObjectVisible,
      isInteractiveRoot: (root) => interactive.includes(root),
      occlusionTolerance: config.interaction?.occlusionTolerance ?? 0.03,
    });
    applyTarget(hit?.root ?? null, hit?.candidate ?? null);
    return hoveredInteractive;
  }

  function isViewObstructed(maxDistance) {
    const roots = getOcclusionRoots().filter(Boolean);
    if (roots.length === 0) return false;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    raycaster.set(camera.position, direction);
    return raycaster.intersectObjects(roots, true).some((candidate) => {
      if (candidate.distance > maxDistance) return false;
      return isInteractionOccluder(candidate.object, isObjectVisible);
    });
  }

  function limitViewOffset(origin, offset, clearance = 0) {
    const distance = offset.length();
    const roots = getOcclusionRoots().filter(Boolean);
    if (distance <= 0.0001 || roots.length === 0) return offset;
    raycaster.set(origin, offset.clone().normalize());
    const hit = raycaster.intersectObjects(roots, true).find(
      (candidate) => isInteractionOccluder(candidate.object, isObjectVisible),
    );
    if (!hit || hit.distance >= distance + clearance) return offset;
    return offset.clone().multiplyScalar(getSafeViewOffsetScale(distance, hit.distance, clearance));
  }

  function applyTarget(target, hit = null, forceTooltip = false) {
    hoveredInteractive = target;
    body.classList.toggle("interactive-hover", Boolean(target));
    body.classList.toggle("brief-interactive-hover", target?.userData.kind === "briefSheet");
    body.classList.toggle("hold-interactive-hover", Number(target?.userData.holdInteractionSeconds) > 0);
    if (target && hit) {
      target.userData.lastHitDistance = hit.distance;
      target.userData.lastHitPoint = hit.point.clone();
    }
    setHoveredKnob(target?.userData.kind === "controlKnob" ? target : null);
    setHoveredDoor(target?.userData.kind === "hingedDoor" ? target : null);
    setHoveredTooltipTarget(forceTooltip ? target : getTooltipTarget(target));
    dispatchHoverSignal(target);
  }

  function setHoveredKnob(knob) {
    if (hoveredKnob === knob) return;
    hoveredKnob = knob;
    refreshTooltip();
  }

  function setHoveredTooltipTarget(target) {
    if (hoveredTooltipTarget === target) return;
    hoveredTooltipTarget = target;
    refreshTooltip();
  }

  function setForcedTarget(target) {
    forcedTarget = target ?? null;
    if (forcedTarget) applyTarget(forcedTarget, null, true);
    else clear();
    return Boolean(forcedTarget);
  }

  function clear() {
    forcedTarget = null;
    hoveredInteractive = null;
    setHoveredKnob(null);
    setHoveredTooltipTarget(null);
    setHoveredDoor(null);
    body.classList.remove("interactive-hover");
    body.classList.remove("brief-interactive-hover");
    body.classList.remove("hold-interactive-hover");
    dispatchHoverSignal(null);
  }

  function refreshTooltip() {
    if (!hoveredTooltipTarget) {
      controlTooltip.hidden = true;
      return;
    }
    hoveredTooltipTarget.updateWorldMatrix(true, false);
    hoveredTooltipTarget.getWorldPosition(worldPosition);
    worldPosition.y += config.controls.labelYOffset;
    const screenPosition = worldPosition.project(camera);
    if (screenPosition.z < -1 || screenPosition.z > 1) {
      controlTooltip.hidden = true;
      return;
    }
    controlTooltip.hidden = false;
    controlTooltip.textContent = getTooltipText(hoveredTooltipTarget);
    controlTooltip.style.left = `${(screenPosition.x * 0.5 + 0.5) * window.innerWidth}px`;
    controlTooltip.style.top = `${(-screenPosition.y * 0.5 + 0.5) * window.innerHeight}px`;
  }

  function dispatchHoverSignal(target) {
    const levelId = getActiveLevelId();
    const kind = target?.userData.kind ?? "none";
    const name = target?.name ?? "";
    const levelPrefabKey = target?.userData.levelPrefabKey ?? "";
    const prefabName = levelPrefabKey.split(":").slice(1).join(":");
    const signal = `${levelId}:${kind}:${name}:${prefabName}`;
    if (signal === lastHoverSignal) return;
    lastHoverSignal = signal;
    window.dispatchEvent(new CustomEvent("operatorgame:hover-target", {
      detail: { levelId, kind, name, prefabName, controlLabel: target?.userData.controlLabel ?? "" },
    }));
  }

  return {
    update,
    clear,
    refreshTooltip,
    setHoveredKnob,
    setHoveredTooltipTarget,
    setForcedTarget,
    getHoveredInteractive: () => hoveredInteractive,
    getHoveredKnob: () => hoveredKnob,
    getTooltipTarget: () => hoveredTooltipTarget,
    isViewObstructed,
    limitViewOffset,
  };
}

export function getSafeViewOffsetScale(offsetDistance, hitDistance, clearance = 0) {
  if (offsetDistance <= 0.0001 || !Number.isFinite(hitDistance)) return 1;
  return THREE.MathUtils.clamp((hitDistance - clearance) / offsetDistance, 0, 1);
}

export function resolveVisibleInteractionHit(candidates, {
  interactionLevelId,
  interactionConfig = {},
  isObjectVisible,
  isInteractiveRoot = () => true,
  occlusionTolerance = 0.03,
}) {
  let interactionHit = null;
  for (const candidate of candidates) {
    const object = candidate.object;
    if (!isInteractionOccluder(object, isObjectVisible)) continue;
    const root = findInteractiveRoot(object);
    if (!root || !isInteractiveRoot(root)) continue;
    if (root.userData.levelId && root.userData.levelId !== interactionLevelId) continue;
    const maxDistance = getInteractionMaxDistance(root, interactionConfig);
    if (!Number.isFinite(maxDistance) || candidate.distance <= maxDistance) {
      interactionHit = { candidate, root };
      break;
    }
  }
  if (!interactionHit) return null;
  const blocker = candidates.find((candidate) => {
    if (!isInteractionOccluder(candidate.object, isObjectVisible)) return false;
    const root = findInteractiveRoot(candidate.object);
    if (root && isInteractiveRoot(root)) return false;
    return candidate.distance + occlusionTolerance < interactionHit.candidate.distance;
  });
  return blocker ? null : interactionHit;
}

function isInteractionOccluder(object, isObjectVisible) {
  return Boolean(object?.isMesh && !object.userData.prefabCollider && isObjectVisible(object));
}

export function getInteractionMaxDistance(object, interactionConfig = {}) {
  if (!object) return Infinity;
  if (Number.isFinite(object.userData.maxInteractionDistance)) return object.userData.maxInteractionDistance;
  if (["controlKnob", "controlButton", "roomLightButton"].includes(object.userData.kind)) {
    return interactionConfig.panelMaxDistance ?? 1.45;
  }
  return interactionConfig.maxDistance ?? 1.85;
}

export function findInteractiveRoot(object) {
  let current = object;
  while (current) {
    if (current.userData.hitProxyFor && current.parent?.userData.kind) return current.parent;
    if (current.userData.kind) return current;
    current = current.parent;
  }
  return null;
}

export function getTooltipTarget(object) {
  return object && TOOLTIP_KINDS.has(object.userData.kind) ? object : null;
}

export function createInteractionTooltipPolicy({ translateControlLabel, translate, prefabInstances, config, getActiveLevelId, getLevelEnvironmentId, getRoomLightsEnabled }) {
  function getRoomLightState(button) {
    const binding = (button?.userData.levelBindings ?? []).find((item) => item.action === "togglePrefabLight" && item.target);
    if (!binding) return getRoomLightsEnabled();
    const environmentId = getLevelEnvironmentId(getActiveLevelId());
    const prefab = config.levelEnvironments?.[environmentId]?.prefabs?.find((item) => item.name === binding.target);
    return prefab?.light?.enabled !== false;
  }
  function getText(target) {
    const label = translateControlLabel(target.userData.controlLabel);
    if (target.userData.kind === "controlKnob") return `${label} ${Math.round(target.userData.controlPercent)}%`;
    if (target.userData.kind === "roomLightButton") return `${label} ${getRoomLightState(target) ? translate("controls.on") : translate("controls.off")}`;
    if (target.userData.kind === "doorLatchHandle") {
      const runtime = prefabInstances.get(target.userData.levelPrefabKey);
      if (runtime?.door?.interaction?.latchAction === "toggleDoor") return label;
      return `${label} ${runtime?.door?.latched ? translate("controls.on") : translate("controls.off")}`;
    }
    return label;
  }
  return { getText, getRoomLightState };
}

export function isObjectHierarchyVisible(object, scene) {
  let current = object;
  while (current) {
    if (current.visible === false) return false;
    if (current === scene) return true;
    current = current.parent;
  }
  return false;
}
