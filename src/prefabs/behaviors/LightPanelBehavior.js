import * as THREE from "three";

// Blender global X -> glTF X; Blender global Z -> glTF Y. Compose in the
// parent frame: the exported switches already have a rotated local frame.
function rotatePart(part, axis, degrees) {
  const direction = new THREE.Vector3();
  direction[axis] = 1;
  part.mesh.quaternion.copy(part.baseQuaternion).premultiply(
    new THREE.Quaternion().setFromAxisAngle(direction, THREE.MathUtils.degToRad(degrees)),
  ).normalize();
}

function getCircuitTargets(circuit) {
  return [circuit.targets, circuit.extraTargets].filter(Boolean).join(",")
    .split(",").map((name) => name.trim()).filter(Boolean);
}

export function applyLightPanelStartupPower(prefabs) {
  const lamps = new Map(prefabs.filter((prefab) => prefab.light).map((prefab) => [prefab.name, prefab]));
  prefabs.forEach((prefab) => {
    const panel = prefab.behavior === "lightPanel" ? prefab.lightPanel : null;
    if (!panel) return;
    Object.values(panel.circuits).forEach((circuit) => {
      if (panel.masterEnabled && circuit.enabled && !panel.startsTripped) return;
      getCircuitTargets(circuit).forEach((name) => {
        const lamp = lamps.get(name);
        if (lamp) lamp.light.enabled = false;
      });
    });
  });
  return prefabs;
}

export function createLightPanelRuntime(parts, config, prefabName) {
  const requirePart = (name) => {
    const mesh = parts.get(name);
    if (!mesh?.isMesh) throw new Error(`[LightPanel] Missing mesh "${name}" in "${prefabName}"`);
    return { mesh, baseQuaternion: mesh.quaternion.clone() };
  };
  const runtime = {
    config,
    door: { ...requirePart(config.doorMeshName), progress: config.startsOpen ? 1 : 0, open: Boolean(config.startsOpen) },
    startsOpen: Boolean(config.startsOpen),
    startsTripped: Boolean(config.startsTripped),
    elapsed: 0,
    master: { ...requirePart(config.masterMeshName), progress: config.masterEnabled ? 1 : 0 },
    circuits: new Map(Object.entries(config.circuits).map(([name, circuit]) => [name, {
      ...requirePart(circuit.meshName),
      indicator: requirePart(circuit.indicatorName).mesh,
      progress: circuit.enabled ? 0 : 1,
      tripped: Boolean(config.startsTripped),
    }])),
    powerDirty: true,
    resetFaults: false,
  };
  updateLightPanelRuntime(runtime, 0);
  return runtime;
}

export function applyLightPanelConfig(runtime, config) {
  if (!runtime) return false;
  runtime.config = config;
  if (runtime.startsTripped !== Boolean(config.startsTripped)) {
    runtime.startsTripped = Boolean(config.startsTripped);
    runtime.circuits.forEach((part) => { part.tripped = runtime.startsTripped; });
  }
  if (runtime.startsOpen !== Boolean(config.startsOpen)) {
    runtime.startsOpen = Boolean(config.startsOpen);
    runtime.door.open = runtime.startsOpen;
    runtime.door.progress = runtime.startsOpen ? 1 : 0;
  }
  runtime.powerDirty = true;
  for (const part of [runtime.door, runtime.master, ...runtime.circuits.values()]) {
    part.mesh.userData.maxInteractionDistance = config.maxDistance;
  }
  updateLightPanelRuntime(runtime, 0);
  return true;
}

export function registerLightPanelInteraction(levelId, prefabConfig, runtime, interactive) {
  const panel = runtime?.lightPanel;
  if (!panel) return false;
  const register = (part, action, label, circuitName) => {
    Object.assign(part.mesh.userData, {
      kind: "lightPanelControl", levelId,
      levelPrefabKey: `${levelId}:${prefabConfig.name}`,
      lightPanelAction: action, lightPanelCircuit: circuitName,
      controlLabel: label, maxInteractionDistance: panel.config.maxDistance,
    });
    if (!interactive.includes(part.mesh)) interactive.push(part.mesh);
  };
  register(panel.door, "door", "LIGHT PANEL DOOR");
  register(panel.master, "master", "LIGHTING MAIN ISOLATOR");
  panel.circuits.forEach((part, name) => register(part, "circuit", panel.config.circuits[name].label, name));
  return true;
}

export function activateLightPanelControl(target, instances, { playSound = () => {}, playSoundGroup = () => {} } = {}) {
  const panel = instances.get(target?.userData.levelPrefabKey)?.lightPanel;
  if (!panel) return false;
  const action = target.userData.lightPanelAction;
  const audio = panel.config.audio ?? {};
  let soundKey;
  if (action === "door") {
    panel.door.open = !panel.door.open;
    soundKey = panel.door.open ? audio.doorOpenSoundKey : audio.doorCloseSoundKey;
  }
  else if (action === "master") {
    panel.config.masterEnabled = !panel.config.masterEnabled;
    soundKey = panel.config.masterEnabled ? audio.masterOnSoundKey : audio.masterOffSoundKey;
    // Cycling the isolator restores every breaker and retries failed starters.
    if (panel.config.masterEnabled) {
      Object.values(panel.config.circuits).forEach((circuit) => { circuit.enabled = true; });
      panel.circuits.forEach((part) => { part.tripped = false; });
      panel.resetFaults = true;
    }
    panel.powerDirty = true;
  } else if (action === "circuit") {
    const circuit = panel.config.circuits[target.userData.lightPanelCircuit];
    if (!circuit) return false;
    circuit.enabled = !circuit.enabled;
    panel.powerDirty = true;
    playSoundGroup(target, "mechanicalButton", { levelId: target.userData.levelId, maxDistance: 3 });
  } else return false;
  if (soundKey) playSound(target, soundKey, { levelId: target.userData.levelId });
  return true;
}

export function syncLightPanelPower(runtime, levelId, { config, setLightEnabled }) {
  if (!runtime || !setLightEnabled) return;
  const panelConfig = runtime.config;
  const prefabs = config.levelEnvironments?.[levelId]?.prefabs ?? [];
  runtime.circuits.forEach((part, name) => {
    const circuit = panelConfig.circuits[name];
    const lamps = getCircuitTargets(circuit).map((target) => prefabs.find((prefab) => prefab.name === target && prefab.light)).filter(Boolean);
    const enabled = Boolean(panelConfig.masterEnabled && circuit.enabled && !part.tripped);
    if (runtime.powerDirty || !enabled) {
      lamps.forEach((lamp) => {
        if (runtime.resetFaults) lamp.light.faultyStarterLoop = false;
        if (runtime.resetFaults && enabled && lamp.light.enabled !== false) setLightEnabled(levelId, lamp.name, false);
        if ((lamp.light.enabled !== false) !== enabled) setLightEnabled(levelId, lamp.name, enabled);
      });
    }
  });
  runtime.powerDirty = false;
  runtime.resetFaults = false;
}

export function isLightPanelPowerAvailable(instances, levelId, prefabName) {
  for (const [key, runtime] of instances) {
    if (!key.startsWith(`${levelId}:`) || !runtime.lightPanel) continue;
    const panel = runtime.lightPanel;
    for (const [name, part] of panel.circuits) {
      const circuit = panel.config.circuits[name];
      if (!getCircuitTargets(circuit).includes(prefabName)) continue;
      if (!panel.config.masterEnabled || !circuit.enabled || part.tripped) return false;
    }
  }
  return true;
}

export function updateLightPanelRuntime(runtime, dt) {
  if (!runtime) return;
  const config = runtime.config;
  runtime.elapsed += Math.max(0, dt);
  const step = (value, target, duration) => THREE.MathUtils.clamp(
    value + Math.sign(target - value) * Math.min(Math.abs(target - value), Math.max(0, dt) / Math.max(0.001, duration)), 0, 1,
  );
  runtime.door.progress = step(runtime.door.progress, runtime.door.open ? 1 : 0, config.doorDurationSeconds);
  rotatePart(runtime.door, config.doorAxis, THREE.MathUtils.lerp(
    config.doorClosedDegrees, config.doorOpenDegrees, THREE.MathUtils.smoothstep(runtime.door.progress, 0, 1),
  ));
  runtime.master.progress = step(runtime.master.progress, config.masterEnabled ? 1 : 0, config.masterDurationSeconds);
  runtime.master.mesh.position[config.masterAxis] = THREE.MathUtils.lerp(
    config.masterOffPosition, config.masterOnPosition, THREE.MathUtils.smoothstep(runtime.master.progress, 0, 1),
  );
  runtime.circuits.forEach((part, name) => {
    const circuit = config.circuits[name];
    part.progress = step(part.progress, circuit.enabled ? 0 : 1, config.switchDurationSeconds);
    rotatePart(part, config.switchAxis, config.switchOffDegrees * THREE.MathUtils.smoothstep(part.progress, 0, 1));
    const materials = Array.isArray(part.indicator.material) ? part.indicator.material : [part.indicator.material];
    materials.forEach((material) => {
      material.emissive.set(part.tripped ? config.faultIndicatorColor : config.indicatorColor);
      const blinking = runtime.elapsed % config.faultBlinkSeconds < config.faultBlinkSeconds * 0.5;
      material.emissiveIntensity = config.masterEnabled && (part.tripped ? blinking : circuit.enabled)
        ? config.indicatorIntensity : 0;
    });
  });
}
