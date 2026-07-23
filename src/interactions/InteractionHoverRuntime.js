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
    const hit = raycaster.intersectObjects(interactive, true).find((candidate) => {
      if (candidate.object.userData.prefabCollider || !isObjectVisible(candidate.object)) return false;
      const root = findInteractiveRoot(candidate.object);
      if (root?.userData.levelId && root.userData.levelId !== interactionLevelId) return false;
      const maxDistance = getInteractionMaxDistance(root, config.interaction);
      return !Number.isFinite(maxDistance) || candidate.distance <= maxDistance;
    });
    applyTarget(hit ? findInteractiveRoot(hit.object) : null, hit);
    return hoveredInteractive;
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
    const signal = `${levelId}:${kind}:${name}`;
    if (signal === lastHoverSignal) return;
    lastHoverSignal = signal;
    window.dispatchEvent(new CustomEvent("operatorgame:hover-target", {
      detail: { levelId, kind, name, controlLabel: target?.userData.controlLabel ?? "" },
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
  };
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
