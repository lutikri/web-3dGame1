import * as THREE from "three";
import { applyAxisRotation } from "./TransformUtils.js?v=prefab-marker-reset";

export class InteriorObjectRegistry {
  constructor(options) {
    Object.assign(this, options);
  }

  registerEnvironmentObject = (object, environmentConfig = null, levelId = null) => {
    if (object.userData.hitProxyFor) return;
    if (levelId) object.userData.levelId = levelId;
    if (String(object.name).startsWith("SNDVOL_")) {
      this.audio.registerAmbienceVolume(levelId ?? "default", object);
      object.visible = false;
      return;
    }

    const fanConfigs = environmentConfig?.behaviors?.fans ?? this.config.interior.fans ?? {};
    const fanConfig = Object.entries(fanConfigs).find(
      ([name]) => normalizeObjectName(name) === normalizeObjectName(object.name),
    )?.[1];
    if (fanConfig?.enabled) {
      object.userData.initialRotation = object.rotation.clone();
      object.userData.fanAxis = fanConfig.axis ?? "z";
      object.userData.fanSpeed = THREE.MathUtils.degToRad(fanConfig.speedDegreesPerSecond ?? 360);
      object.userData.fanAngle = 0;
      this.collections.interiorFans.push(object);
    }

    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    ensureSecondUvSet(object);
    object.material = this.getInteriorMaterial(object);
    if (object.name === this.config.interior.bulkheadExit?.meshName) this.registerBulkheadHandle(object);

    const levelBindings = (environmentConfig?.session?.bindings ?? []).filter(
      (binding) => binding.source === object.name,
    );
    const button = this.config.interior.lightToggleButton;
    if (button && (levelBindings.length > 0 || interiorMaterialMatches(object, button))) {
      this.#registerRoomLightButton(object, button, levelBindings);
    }
  };

  registerPanelObject = (object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    ensureSecondUvSet(object);
    object.material = this.materials.panel;

    if (object.name.includes("_Arrow_") || object.name.includes("_Arrrow_")) {
      object.castShadow = this.config.shadows.castNeedleShadows;
      object.userData.initialRotation = object.rotation.clone();
      object.userData.needleAngle = THREE.MathUtils.degToRad(this.config.needleAnimation.inactiveDegrees);
      object.userData.needleSpeed = this.#getRandomNeedleSpeed();
      object.userData.needleSpeedTimer = 0;
      object.userData.needleJitterOffset = 0;
      object.userData.needleJitterTarget = 0;
      object.userData.needleJitterTimer = Math.random() * this.config.needleAnimation.jitterRetargetInterval;
      object.userData.needleNoiseSeed = Math.random() * 100;
      object.userData.gaugeKey = getGaugeKey(object.name);
      this.collections.needles.push(object);
      if (object.userData.gaugeKey) this.collections.gaugeNeedles.set(object.userData.gaugeKey, object);
    }
    if (object.name.startsWith("LightCase1_Light_")) {
      object.material = this.materials.lampOff;
      object.userData.initialScale = object.scale.clone();
      this.collections.lamps.push(object);
    }
    if (this.config.controls.knobs[object.name]) this.#registerControlKnob(object, this.config.controls.knobs[object.name]);
    if (this.config.controls.buttons[object.name]) this.#registerControlButton(object, this.config.controls.buttons[object.name]);
    if (object.name === "DisplaySmall1_ScreenMesh") this.statusScreen.attachToMesh(object);
  };

  updateFans = (dt) => {
    this.collections.interiorFans.forEach((fan) => {
      fan.userData.fanAngle = (fan.userData.fanAngle + fan.userData.fanSpeed * dt) % (Math.PI * 2);
      fan.rotation.copy(fan.userData.initialRotation);
      applyAxisRotation(fan, fan.userData.fanAxis, fan.userData.fanAngle);
    });
  };

  getInteriorMaterial(object) {
    const key = this.getInteriorCustomMaterialKey(object);
    return key ? this.materials.interiorCustom[key] ?? this.materials.interior : this.materials.interior;
  }

  getInteriorCustomMaterialKey = (object) => (
    Object.entries(this.config.interior.specialMaterials ?? {})
      .find(([, config]) => interiorMaterialMatches(object, config))?.[0] ?? null
  );

  #registerRoomLightButton(object, config, levelBindings) {
    if (object.userData.roomLightButtonRegistered) return;
    this.#setButtonData(object, config, "roomLightButton", -0.012);
    object.userData.roomLightButtonRegistered = true;
    object.userData.levelBindings = levelBindings;
    this.collections.roomLightButtons.push(object);
    this.collections.interactive.push(object);
    const hitRadius = config.hitRadius ?? 0;
    if (hitRadius <= 0) return;
    const proxy = new THREE.Mesh(
      new THREE.SphereGeometry(hitRadius, 16, 8),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    proxy.name = `${object.name}_HitProxy`;
    proxy.visible = false;
    proxy.userData.kind = "roomLightButton";
    proxy.userData.controlLabel = object.userData.controlLabel;
    proxy.userData.hitProxyFor = object.name;
    proxy.userData.levelId = object.userData.levelId;
    proxy.userData.maxInteractionDistance = object.userData.maxInteractionDistance;
    object.add(proxy);
    this.collections.interactive.push(proxy);
  }

  #registerControlKnob(object, config) {
    const percent = THREE.MathUtils.clamp(config.initialPercent ?? 0, 0, 100);
    object.userData.kind = "controlKnob";
    object.userData.controlId = object.name;
    object.userData.controlLabel = config.label;
    object.userData.controlPercent = percent;
    object.userData.initialPercent = percent;
    object.userData.initialRotation = object.rotation.clone();
    object.userData.maxInteractionDistance = this.#interactionDistance(config);
    this.collections.controlKnobs.push(object);
    this.collections.interactive.push(object);
    this.applyControlKnobRotation(object);
  }

  #registerControlButton(object, config) {
    this.#setButtonData(object, config, "controlButton", -0.02);
    object.userData.controlId = object.name;
    object.userData.controlAction = config.action ?? "";
    this.collections.controlButtons.push(object);
    this.collections.interactive.push(object);
  }

  #setButtonData(object, config, kind, defaultDistance) {
    object.userData.kind = kind;
    object.userData.controlLabel = config.label ?? "ROOM LIGHTS";
    object.userData.initialPosition = object.position.clone();
    object.userData.pressAxis = config.pressAxis ?? "y";
    object.userData.pressDistance = config.pressDistance ?? defaultDistance;
    object.userData.pressSpeed = config.pressSpeed ?? 16;
    object.userData.pressed = false;
    object.userData.pressProgress = 0;
    object.userData.maxInteractionDistance = this.#interactionDistance(config);
  }

  #interactionDistance(config) {
    return config.maxInteractionDistance ?? this.config.interaction?.panelMaxDistance ?? 1.45;
  }

  #getRandomNeedleSpeed() {
    const speed = this.config.needleAnimation.speedDegreesPerSecond;
    return THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(speed.min, speed.max));
  }
}

export function getGaugeKey(name) {
  if (name.includes("PlasmaTemp")) return "plasmaTemp";
  if (name.includes("ContainmentStability")) return "containment";
  if (name.includes("PowerOutput")) return "powerOutput";
  if (name.includes("TargetOutput")) return "targetOutput";
  if (name.includes("FuelReserve")) return "fuelReserve";
  if (name.includes("HeatSinkCapacity")) return "heatSinkCapacity";
  if (name.includes("ReactorDamage")) return "coreStress";
  if (name.includes("ReactionEfficiency")) return "reactionEfficiency";
  return null;
}

export function interiorMaterialMatches(object, config) {
  const matchNames = [...(config.meshNames ?? []), config.meshName].filter(Boolean);
  const objectNames = getInteriorObjectMatchNames(object);
  const normalizedObjectNames = objectNames.map(normalizeObjectName);
  const normalizedPrefixes = (config.namePrefixes ?? []).map(normalizeObjectName);
  const materialNames = Array.isArray(object.material)
    ? object.material.map((material) => material?.name).filter(Boolean)
    : [object.material?.name].filter(Boolean);
  const normalizedMaterialNames = materialNames.map(normalizeObjectName);
  const configuredMaterialNames = (config.materialNames ?? []).map(normalizeObjectName);
  return configuredMaterialNames.some((name) => normalizedMaterialNames.includes(name)) ||
    normalizedPrefixes.some((prefix) => normalizedObjectNames.some((name) => name.startsWith(prefix))) ||
    matchNames.some((name) => objectNames.includes(name) || normalizedObjectNames.includes(normalizeObjectName(name)));
}

export function getInteriorObjectMatchNames(object) {
  const names = [];
  let current = object;
  while (current) {
    if (current.name) names.push(current.name);
    current = current.parent;
  }
  if (object.geometry?.name) names.push(object.geometry.name);
  return [...new Set(names)];
}

export function normalizeObjectName(name) {
  return String(name).replace(/[._\-\s]/g, "").toLowerCase();
}

export function isCollisionHelperMesh(name = "") {
  return /(?:^|_)Coll(?:ider)?(?:$|[._])/i.test(name) || /^UBX_/i.test(name);
}

export function ensureSecondUvSet(object) {
  if (!object.geometry?.attributes.uv2 && object.geometry?.attributes.uv) {
    object.geometry.setAttribute("uv2", object.geometry.attributes.uv.clone());
  }
}
