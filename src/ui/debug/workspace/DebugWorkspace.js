import { createLevelOverrideSnapshot } from "../../../levels/LevelConfigSerialization.js?v=locomotion-weight-pass";

const PREFAB_GROUP_ORDER = ["elevator", "operatorPanel", "fluorescentLamp", "radio", "serviceDoor", "bulkheadDoor"];
const PREFAB_TYPE_ALIASES = { DoorBulk1: "bulkheadDoor" };

export function compareDebugPrefabs(a, b) {
  const aType = PREFAB_TYPE_ALIASES[a.prefabType] ?? a.prefabType;
  const bType = PREFAB_TYPE_ALIASES[b.prefabType] ?? b.prefabType;
  const ai = PREFAB_GROUP_ORDER.indexOf(aType);
  const bi = PREFAB_GROUP_ORDER.indexOf(bType);
  return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi)
    || a.name.localeCompare(b.name, undefined, { numeric: true });
}
const SHADOW_MAP_SIZES = [128, 256, 512, 1024, 2048, 4096];
const ICONS = {
  global: "◎",
  postfx: "▣",
  audio: "♪",
  game: "⚙",
  level: "▤",
  world: "◌",
  spawn: "⌖",
  light: "✦",
  prefab: "◇",
  radio: "◉",
  section: "▾",
};

const POST_FX_SECTIONS = [
  ["enabled", "Master"],
  ["gtao", "GTAO"],
  ["ssgi", "SSGI"],
  ["ssr", "SSR"],
  ["screenSpaceShadows", "Screen-space shadows"],
  ["bloom", "Bloom"],
  ["antiAliasing", "Anti-aliasing"],
  ["lensEffects", "Lens effects"],
  ["lut", "LUT"],
  ["colorAdjustments", "Color adjustments"],
  ["sharpen", "Sharpen"],
  ["lensDistortion", "Lens distortion"],
  ["chromaticAberration", "Chromatic aberration"],
];

const POST_FX_ENUMS = {
  method: ["off", "fxaa", "smaa"],
  msaaSamples: [0, 2, 4, 8],
  defaultQuality: ["off", "min", "med", "max"],
  format: ["cube", "3dl"],
  inputColorSpace: ["display-srgb", "linear"],
};

const AUDIO_MIX_ORDER = ["master", "ambience", "machinery", "interaction", "player", "narration", "ui"];

export function createDebugWorkspace({
  levelEnvironmentConfigs = {},
  materialConfigs = {},
  gameConfig = {},
  postProcessingConfig = {},
  getPostProcessingQualities,
  setPostProcessingQuality,
  soundRegistry = {},
  soundMix = {},
  getAudioDebugState,
  getSceneSoundKeys,
  applyLevelPrefab,
  applyLevelWorld,
  applyLevelAmbient,
  applyPlayerCollisionSettings,
  applyPostProcessing,
  rebuildPostProcessing,
  applyAudioMix,
  applyMaterialConfig,
  togglePositionGizmo,
}) {
  const root = document.createElement("section");
  root.className = "debug-workspace";
  root.hidden = true;
  root.innerHTML = `
    <div class="debug-workspace__bar">
      <div>
        <div class="debug-workspace__eyebrow">DEBUG EDITOR</div>
        <div class="debug-workspace__title">Scene Workspace</div>
      </div>
      <div class="debug-workspace__status" data-role="status">ready</div>
    </div>
    <div class="debug-workspace__body">
      <aside class="debug-workspace__outliner">
        <input class="debug-workspace__search" data-role="search" placeholder="filter outliner" />
        <div class="debug-workspace__tree" data-role="tree"></div>
      </aside>
      <main class="debug-workspace__properties" data-role="properties"></main>
    </div>
  `;
  document.body.append(root);

  const tree = root.querySelector('[data-role="tree"]');
  const properties = root.querySelector('[data-role="properties"]');
  const status = root.querySelector('[data-role="status"]');
  const search = root.querySelector('[data-role="search"]');
  let visible = false;
  let activeLevelId = null;
  let selectedId = "global:postfx";
  let filter = "";
  const lastSelectedByLevel = new Map();
  const openSections = new Map();

  search.addEventListener("input", () => {
    filter = search.value.trim().toLowerCase();
    renderOutliner();
  });

  function setStatus(text, state = "") {
    status.textContent = text;
    status.dataset.state = state;
  }

  function setVisible(nextVisible) {
    visible = Boolean(nextVisible);
    root.hidden = !visible;
    return visible;
  }

  function setActiveLevel(levelId) {
    if (activeLevelId && selectedId) lastSelectedByLevel.set(activeLevelId, selectedId);
    activeLevelId = levelId;
    selectedId = lastSelectedByLevel.get(levelId) ?? getDefaultSelection(levelId);
    render();
  }

  function getDefaultSelection(levelId) {
    const env = getActiveEnvironment(levelId);
    const firstPrefab = env?.prefabs?.[0];
    return firstPrefab ? `prefab:${levelId}:${firstPrefab.name}` : "global:postfx";
  }

  function getActiveEnvironment(levelId = activeLevelId) {
    return levelId ? levelEnvironmentConfigs[levelId] : null;
  }

  function select(id) {
    selectedId = id;
    if (activeLevelId) lastSelectedByLevel.set(activeLevelId, id);
    render();
  }

  function render() {
    renderOutliner();
    renderProperties();
  }

  function renderOutliner() {
    const env = getActiveEnvironment();
    const nodes = [];
    nodes.push(sectionNode("Global", [
      itemNode("global:postfx", "GlobalPostProcess", "post fx", "postfx"),
      itemNode("global:player", "Player Settings", "game", "game"),
      itemNode("global:audio", "Audio Mix", "audio", "audio"),
    ], "global"));
    if (env) {
      nodes.push(sectionNode(activeLevelId, [
        itemNode(`level:${activeLevelId}:world`, "World / Fog", "level", "world"),
        itemNode(`level:${activeLevelId}:spawn`, "Player Spawn", "spawn", "spawn"),
        itemNode(`level:${activeLevelId}:ambient`, "Ambient", "light", "light"),
        sectionNode("Point Lights", Object.keys(env.lighting?.pointLights ?? {}).map((key) =>
          itemNode(`level-light:${activeLevelId}:${key}`, key, "light", "light"),
        ), "light"),
        sectionNode("Prefabs", buildPrefabNodes(activeLevelId, env.prefabs ?? []), "prefab"),
      ], "level"));
    }
    tree.replaceChildren(...nodes.filter(Boolean));
  }

  function buildPrefabNodes(levelId, prefabs) {
    const byName = new Map(prefabs.map((prefab) => [prefab.name, prefab]));
    const childrenByParent = new Map();
    const roots = [];
    prefabs.forEach((prefab) => {
      const [parentName, childName] = prefab.name.split("__");
      if (childName && byName.has(parentName)) {
        if (!childrenByParent.has(parentName)) childrenByParent.set(parentName, []);
        childrenByParent.get(parentName).push(prefab);
      } else {
        roots.push(prefab);
      }
    });
    return roots
      .sort(compareDebugPrefabs)
      .map((prefab) => {
        const children = (childrenByParent.get(prefab.name) ?? []).sort(compareDebugPrefabs).map((child) =>
          itemNode(`prefab:${levelId}:${child.name}`, getPrefabDisplayName(child), getPrefabTypeLabel(child), getPrefabIcon(child)),
        );
        return children.length
          ? sectionNode(getPrefabDisplayName(prefab), [
              itemNode(`prefab:${levelId}:${prefab.name}`, "<root>", getPrefabTypeLabel(prefab), getPrefabIcon(prefab)),
              ...children,
            ], getPrefabIcon(prefab))
          : itemNode(`prefab:${levelId}:${prefab.name}`, getPrefabDisplayName(prefab), getPrefabTypeLabel(prefab), getPrefabIcon(prefab));
      });
  }

  function sectionNode(label, children = [], icon = "section") {
    const visibleChildren = children.filter(Boolean).filter((node) => !filter || node.textContent.toLowerCase().includes(filter));
    if (filter && !label.toLowerCase().includes(filter) && !visibleChildren.length) return null;
    const sectionId = `section:${label}`;
    const details = document.createElement("details");
    details.className = "debug-tree-section";
    details.open = filter ? true : openSections.get(sectionId) ?? true;
    details.addEventListener("toggle", () => {
      if (!filter) openSections.set(sectionId, details.open);
    });
    const summary = document.createElement("summary");
    summary.innerHTML = `<span class="debug-tree-icon">${escapeHtml(ICONS[icon] ?? ICONS.section)}</span><span>${escapeHtml(label)}</span>`;
    details.append(summary, ...visibleChildren);
    return details;
  }

  function itemNode(id, label, meta = "", icon = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "debug-tree-item";
    button.dataset.selected = String(id === selectedId);
    button.dataset.id = id;
    button.innerHTML = `<span class="debug-tree-icon">${escapeHtml(ICONS[icon] ?? ICONS.prefab)}</span><span>${escapeHtml(label)}</span>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}`;
    button.addEventListener("click", () => select(id));
    return button;
  }

  function renderProperties() {
    const [kind, levelId, key] = selectedId.split(":");
    if (kind === "prefab") return renderPrefabProperties(levelId, key);
    if (kind === "level-light") return renderLevelPointLightProperties(levelId, key);
    if (selectedId === "global:postfx") return renderPostFxProperties();
    if (selectedId === "global:player") return renderPlayerProperties();
    if (selectedId === "global:audio") return renderAudioProperties();
    if (kind === "level") return renderLevelProperties(levelId, key);
    renderPlaceholder("Nothing selected", "Pick an item from the outliner.");
  }

  function renderPrefabProperties(levelId, prefabName) {
    const env = levelEnvironmentConfigs[levelId];
    const prefab = env?.prefabs?.find((entry) => entry.name === prefabName);
    if (!prefab) return renderPlaceholder("Missing prefab", prefabName);
    const parentName = prefab.name.includes("__") ? prefab.name.split("__")[0] : "";
    const title = getPrefabDisplayName(prefab);
    const body = [
      header(title, [
        ["Type", prefab.prefabType ?? prefab.behavior ?? "prefab"],
        parentName ? ["Parent", parentName] : null,
        ["Stable name", prefab.name],
      ]),
      section("Transform", [
        vectorRow("Position", prefab.position, -50, 50, 0.001, () => applyLevelPrefab?.(levelId, prefab.name, true)),
        vectorRow("Rotation", prefab.rotation, -Math.PI * 2, Math.PI * 2, 0.001, () => applyLevelPrefab?.(levelId, prefab.name, true), ["_x", "_y", "_z"]),
        vectorRow("Scale", prefab.scale, 0.01, 10, 0.001, () => applyLevelPrefab?.(levelId, prefab.name, true)),
        actionRow([
          button("Edit transform", () => togglePositionGizmo?.({
            id: `prefab:${levelId}:${prefab.name}`,
            type: "prefab",
            levelId,
            key: prefab.name,
            position: prefab.position,
            onChange: () => applyLevelPrefab?.(levelId, prefab.name, true),
          })),
        ]),
      ]),
    ];
    const suspendedLamp = getSuspendedLampDebugProperties(prefab, materialConfigs);
    if (suspendedLamp) {
      const applySuspension = () => applyLevelPrefab?.(levelId, prefab.name);
      body.push(section("Suspended lamp", [
        booleanRow("Movement enabled", suspendedLamp.suspension, "enabled", applySuspension),
        numberRow("Max angle", suspendedLamp.suspension, "maxAngleDegrees", 0, 12, 0.05, applySuspension),
        numberRow("Swing period", suspendedLamp.suspension, "naturalPeriodSeconds", 0.5, 12, 0.05, applySuspension),
        numberRow("Damping", suspendedLamp.suspension, "dampingPerSecond", 0, 4, 0.01, applySuspension),
        numberRow("Airflow strength", suspendedLamp.suspension, "airflowDegrees", 0, 8, 0.05, applySuspension),
        numberRow("Airflow period X", suspendedLamp.suspension, "airflowPeriodXSeconds", 1, 30, 0.1, applySuspension),
        numberRow("Airflow period Z", suspendedLamp.suspension, "airflowPeriodZSeconds", 1, 30, 0.1, applySuspension),
        suspendedLamp.bulbMaterial
          ? numberRow("Bulb emissive", suspendedLamp.bulbMaterial, "emissiveIntensity", 0, 30, 0.05,
            () => applyMaterialConfig?.("lampDome1Bulb"))
          : null,
      ]));
    }
    if (prefab.light) body.push(renderPrefabLightSection(levelId, prefab));
    if (prefab.radio) {
      body.push(section("Radio", [
        numberRow("Voice max distance", prefab.radio, "maxDistance", 0.5, 20, 0.05, () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Voice ref distance", prefab.radio, "refDistance", 0.05, 5, 0.05, () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Lamp blink frequency", prefab.radio, "lampBlinkFrequency", 0, 8, 0.05, () => applyLevelPrefab?.(levelId, prefab.name)),
      ]));
    }
    body.push(section("Actions", [
      actionRow([
        button("Save active level", () => saveActiveLevel(levelId)),
        button("Copy selected override", () => copySelectedPrefab(prefab)),
      ]),
    ]));
    properties.replaceChildren(...body);
  }

  function renderPrefabLightSection(levelId, prefab) {
    const light = prefab.light;
    light.shadowMapSize ??= 512;
    return section("Light", [
      group("Main", [
        booleanRow("Enabled", light, "enabled", () => applyLevelPrefab?.(levelId, prefab.name)),
        colorRow("Color", light, "color", () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Intensity", light, "intensity", 0, 30, 0.01, () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Distance", light, "distance", 0, 60, 0.05, () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Decay", light, "decay", 0, 4, 0.01, () => applyLevelPrefab?.(levelId, prefab.name)),
        light.type === "spot" ? numberRow("Spot angle", light, "angle", 0.05, 1.55, 0.001, () => applyLevelPrefab?.(levelId, prefab.name)) : null,
        light.type === "spot" ? numberRow("Spot penumbra", light, "penumbra", 0, 1, 0.01, () => applyLevelPrefab?.(levelId, prefab.name)) : null,
        light.type === "spot" && light.cookiePath
          ? numberRow("Cookie rotation", light, "cookieRotationDegrees", -180, 180, 1,
            () => applyLevelPrefab?.(levelId, prefab.name))
          : null,
      ]),
      group("Offset", [
        vectorRow("Local offset", light.localOffset, -3, 3, 0.001, () => applyLevelPrefab?.(levelId, prefab.name)),
        actionRow([
          button("Edit light offset", () => togglePositionGizmo?.({
            id: `prefab-light:${levelId}:${prefab.name}`,
            type: "prefabLightOffset",
            levelId,
            key: prefab.name,
            position: light.localOffset,
            onChange: () => applyLevelPrefab?.(levelId, prefab.name),
          })),
        ]),
      ]),
      light.type === "spot" ? group("Spot target", [
        vectorRow("Local target", light.targetLocalOffset, -20, 20, 0.001,
          () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Projection near", light, "shadowNear", 0.005, 1, 0.005,
          () => applyLevelPrefab?.(levelId, prefab.name, true)),
        numberRow("Projection far", light, "shadowFar", 0.5, 60, 0.05,
          () => applyLevelPrefab?.(levelId, prefab.name, true)),
        light.cookiePath ? paragraph(`Cookie: ${light.cookiePath}`) : paragraph("Cookie: none"),
      ]) : null,
      group("Startup / flicker", [
        booleanRow("Starter on power-up", light, "fluorescentStartup", () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Startup delay", light, "startupDelaySeconds", 0, 30, 0.1, () => applyLevelPrefab?.(levelId, prefab.name)),
        booleanRow("Faulty starter loop", light, "faultyStarterLoop", () => applyLevelPrefab?.(levelId, prefab.name)),
        light.flicker ? booleanRow("Random flicker", light.flicker, "enabled", () => applyLevelPrefab?.(levelId, prefab.name)) : null,
        light.flicker ? numberRow("Flicker min interval", light.flicker, "minIntervalSeconds", 0.1, 180, 0.1, () => applyLevelPrefab?.(levelId, prefab.name)) : null,
        light.flicker ? numberRow("Flicker max interval", light.flicker, "maxIntervalSeconds", 0.1, 300, 0.1, () => applyLevelPrefab?.(levelId, prefab.name)) : null,
      ]),
      light.afterglow ? group("Phosphor afterglow", [
        booleanRow("Enabled", light.afterglow, "enabled", () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Duration", light.afterglow, "durationSeconds", 0, 10, 0.05, () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Initial glow", light.afterglow, "initialFactor", 0, 1, 0.01, () => applyLevelPrefab?.(levelId, prefab.name)),
        numberRow("Falloff exponent", light.afterglow, "exponent", 0.1, 6, 0.05, () => applyLevelPrefab?.(levelId, prefab.name)),
      ]) : null,
      group("Shadows", [
        booleanRow("Cast shadows", light, "castShadow", () => applyLevelPrefab?.(levelId, prefab.name, true)),
        selectRow("Shadow map size", light, "shadowMapSize", SHADOW_MAP_SIZES, () => applyLevelPrefab?.(levelId, prefab.name, true)),
        numberRow("Bias", light, "shadowBias", -0.01, 0.01, 0.00001, () => applyLevelPrefab?.(levelId, prefab.name, true)),
        numberRow("Normal bias", light, "shadowNormalBias", 0, 0.2, 0.0005, () => applyLevelPrefab?.(levelId, prefab.name, true)),
        numberRow("Radius", light, "shadowRadius", 0, 10, 0.1, () => applyLevelPrefab?.(levelId, prefab.name, true)),
        light.type !== "spot" ? numberRow("Near", light, "shadowNear", 0.01, 5, 0.01,
          () => applyLevelPrefab?.(levelId, prefab.name, true)) : null,
        light.type !== "spot" ? numberRow("Far", light, "shadowFar", 0.5, 60, 0.05,
          () => applyLevelPrefab?.(levelId, prefab.name, true)) : null,
      ]),
      group("Batch", [
        actionRow([
          button(`Apply light to all ${prefab.prefabType} in level`, () => applyLightToSamePrefabType(levelId, prefab)),
        ]),
      ]),
    ]);
  }

  function renderLevelProperties(levelId, key) {
    const env = levelEnvironmentConfigs[levelId];
    if (!env) return renderPlaceholder("Missing level", levelId);
    if (key === "world") {
      return properties.replaceChildren(
        header("World / Fog", [["Level", levelId]]),
        section("World", [
          colorRow("Background", env.world, "backgroundColor", () => applyLevelWorld?.(levelId)),
          colorRow("Fog color", env.world, "fogColor", () => applyLevelWorld?.(levelId)),
          numberRow("Fog near", env.world, "fogNear", 0, 100, 0.05, () => applyLevelWorld?.(levelId)),
          numberRow("Fog far", env.world, "fogFar", 0.1, 300, 0.1, () => applyLevelWorld?.(levelId)),
        ]),
        section("Actions", [actionRow([button("Save active level", () => saveActiveLevel(levelId))])]),
      );
    }
    if (key === "spawn") {
      return properties.replaceChildren(
        header("Player Spawn", [["Level", levelId]]),
        section("Transform", [
          vectorRow("Position", env.player.spawnPosition, -50, 50, 0.01),
          vectorRow("Rotation degrees", env.player.rotationDegrees, -360, 360, 0.1),
        ]),
      );
    }
    if (key === "ambient") {
      return properties.replaceChildren(
        header("Ambient", [["Level", levelId]]),
        section("Ambient light", [
          colorRow("Sky", env.lighting, "ambientSky", () => applyLevelAmbient?.(levelId)),
          colorRow("Ground", env.lighting, "ambientGround", () => applyLevelAmbient?.(levelId)),
          numberRow("Intensity", env.lighting, "ambientIntensity", 0, 2, 0.005, () => applyLevelAmbient?.(levelId)),
        ]),
      );
    }
    renderPlaceholder("Level", key);
  }

  function renderLevelPointLightProperties(levelId, key) {
    const light = levelEnvironmentConfigs[levelId]?.lighting?.pointLights?.[key];
    if (!light) return renderPlaceholder("Missing point light", key);
    const apply = () => applyLevelAmbient?.(levelId);
    properties.replaceChildren(
      header(key, [["Type", "Point light"], ["Level", levelId]]),
      section("Light", [
        colorRow("Color", light, "color", apply),
        numberRow("Intensity", light, "intensity", 0, 30, 0.01, apply),
        numberRow("Distance", light, "distance", 0, 80, 0.05, apply),
        numberRow("Decay", light, "decay", 0, 4, 0.01, apply),
        vectorRow("Position", light.position, -50, 50, 0.01, apply),
      ]),
    );
  }

  function renderPostFxProperties() {
    const rows = [
      header("GlobalPostProcess", [["Scope", "Global"], ["Save target", "PostProcessingOverrides.js"]]),
      ...POST_FX_SECTIONS.map(([key, title]) => renderPostFxSection(key, title)).filter(Boolean),
      section("Actions", [
        actionRow([
          button("Save Post FX to project", () => savePostProcessingToProject()),
          button("Copy Post FX config", () => copyPostProcessingConfig()),
        ]),
      ]),
    ];
    properties.replaceChildren(...rows);
  }

  function renderPostFxSection(key, title) {
    if (key === "enabled") {
      return section(title, [booleanRow("Enabled", postProcessingConfig, "enabled", applyPostFxChange)]);
    }
    const object = postProcessingConfig[key];
    if (!object || typeof object !== "object") return null;
    const qualityRows = getPostFxQualityRows(key, object);
    return section(title, [...qualityRows, ...autoRows(object, applyPostFxChange)]);
  }

  function renderAudioProperties() {
    soundMix.master ??= 1;
    const audioState = getAudioDebugState?.() ?? {};
    const sceneKeys = new Set(getSceneSoundKeys?.(activeLevelId) ?? audioState.soundKeys ?? []);
    const activeKeys = new Set(audioState.soundKeys ?? []);
    const sceneRegistry = Object.fromEntries(
      Object.entries(soundRegistry).filter(([key]) => sceneKeys.has(key)),
    );
    const soundGroups = groupSoundsByCategory(sceneRegistry);
    properties.replaceChildren(
      header("Audio Mix", [
        ["Scope", "Global"],
        ["Runtime", audioState.unlocked ? "WebAudio active" : "waiting for audio unlock"],
        ["Scene sounds", sceneKeys.size],
        ["Runtime registered", activeKeys.size],
      ]),
      section("Bus volumes", AUDIO_MIX_ORDER.map((key) =>
        numberRow(labelize(key), soundMix, key, 0, 2, 0.01, () => applyAudioMix?.()),
      )),
      sceneKeys.size ? null : section("Scene sounds", [
        paragraph("No scene sounds found for the active level."),
      ]),
      ...AUDIO_MIX_ORDER
        .filter((key) => key !== "master" && soundGroups[key]?.length)
        .map((key) => section(labelize(key), soundGroups[key].map((soundKey) => renderSoundConfig(soundKey)))),
    );
  }

  function renderSoundConfig(soundKey) {
    const config = soundRegistry[soundKey];
    const rows = [
      numberRow("Volume", config, "volume", 0, 2, 0.01, () => applyAudioMix?.()),
      numberRow("Ref distance", config, "refDistance", 0.01, 10, 0.01, () => applyAudioMix?.()),
      numberRow("Max distance", config, "maxDistance", 0.05, 40, 0.05, () => applyAudioMix?.()),
      numberRow("Fade distance", config, "fadeDistance", 0.05, 20, 0.05, () => applyAudioMix?.()),
      numberRow("Fade seconds", config, "fadeSeconds", 0, 10, 0.05, () => applyAudioMix?.()),
    ].filter(Boolean);
    return group(soundKey, rows.length ? rows : [paragraph("No editable mix fields yet.")]);
  }

  function applyPostFxChange() {
    applyPostProcessing?.();
    rebuildPostProcessing?.();
  }

  function getPostFxQualityRows(key, object) {
    const qualityKeyBySection = {
      gtao: "gtao",
      ssgi: "ssgi",
      ssr: "ssr",
      screenSpaceShadows: "screenSpaceShadows",
    };
    const qualityKey = qualityKeyBySection[key];
    if (!qualityKey || !object.presets) return [];
    const qualities = getPostProcessingQualities?.() ?? {};
    const state = { quality: qualities[qualityKey] ?? object.defaultQuality ?? "off" };
    return [
      selectRow("Active quality", state, "quality", Object.keys(object.presets), () => {
        setPostProcessingQuality?.(qualityKey, state.quality);
        renderProperties();
      }),
    ];
  }

  function renderPlayerProperties() {
    const collision = gameConfig.collision ?? {};
    properties.replaceChildren(
      header("Player Settings", [["Scope", "Global"]]),
      section("Controller", [
        numberRow("Body radius", gameConfig, "collisionRadius", 0.1, 0.6, 0.01, applyPlayerCollisionSettings),
        numberRow("Body height", gameConfig, "collisionHeight", 0.6, 2.2, 0.01, applyPlayerCollisionSettings),
        numberRow("Step height", collision, "stepHeight", 0, 0.8, 0.01, applyPlayerCollisionSettings),
        numberRow("Jump speed", collision, "jumpSpeed", 0, 8, 0.1, applyPlayerCollisionSettings),
      ]),
    );
  }

  function applyLightToSamePrefabType(levelId, sourcePrefab) {
    const env = levelEnvironmentConfigs[levelId];
    if (!env || !sourcePrefab.light) return;
    const source = structuredClone(sourcePrefab.light);
    (env.prefabs ?? []).forEach((prefab) => {
      if (prefab.name === sourcePrefab.name || prefab.prefabType !== sourcePrefab.prefabType || !prefab.light) return;
      Object.assign(prefab.light, structuredClone(source));
      applyLevelPrefab?.(levelId, prefab.name, true);
    });
    setStatus(`applied light to ${sourcePrefab.prefabType}`, "ok");
    render();
  }

  async function saveActiveLevel(levelId = activeLevelId) {
    const env = getActiveEnvironment(levelId);
    if (!env?.saveKind) return setStatus("no active level save target", "error");
    setStatus("saving level...", "busy");
    try {
      const result = await fetch("/__save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: env.saveKind, config: createLevelOverrideSnapshot(env) }),
      }).then((response) => response.json().then((body) => ({ response, body })));
      if (!result.response.ok || !result.body.ok) throw new Error(result.body.error ?? "save failed");
      setStatus(`saved ${result.body.filePath ?? env.saveKind}`, "ok");
    } catch (error) {
      console.error("[Debug workspace] Failed to save level", error);
      setStatus("save failed", "error");
    }
  }

  async function copySelectedPrefab(prefab) {
    await navigator.clipboard.writeText(JSON.stringify(prefab, null, 2));
    setStatus("selected prefab copied", "ok");
  }

  function renderPlaceholder(title, text) {
    properties.replaceChildren(header(title), paragraph(text));
  }

  function header(title, rows = []) {
    const element = document.createElement("header");
    element.className = "debug-properties-header";
    element.innerHTML = `<h2>${escapeHtml(title)}</h2>`;
    const meta = rows.filter(Boolean);
    if (meta.length) {
      const dl = document.createElement("dl");
      meta.forEach(([key, value]) => {
        dl.insertAdjacentHTML("beforeend", `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(value))}</dd>`);
      });
      element.append(dl);
    }
    return element;
  }

  function section(title, children = []) {
    const element = document.createElement("section");
    element.className = "debug-property-section";
    element.innerHTML = `<h3>${escapeHtml(title)}</h3>`;
    element.append(...children.flat().filter(Boolean));
    return element;
  }

  function group(title, children = []) {
    const element = document.createElement("div");
    element.className = "debug-property-group";
    element.innerHTML = `<h4>${escapeHtml(title)}</h4>`;
    element.append(...children.flat().filter(Boolean));
    return element;
  }

  function paragraph(text) {
    const p = document.createElement("p");
    p.className = "debug-property-note";
    p.textContent = text;
    return p;
  }

  function autoRows(object, onChange, options = {}) {
    const omit = new Set(options.omit ?? []);
    return Object.entries(object)
      .filter(([key]) => !omit.has(key))
      .map(([key, value]) => {
        const label = labelize(key);
        if (POST_FX_ENUMS[key]) return selectRow(label, object, key, POST_FX_ENUMS[key], onChange);
        if (typeof value === "boolean") return booleanRow(label, object, key, onChange);
        if (typeof value === "number") {
          const [min, max, step] = getAutoNumberRange(key, value);
          return numberRow(label, object, key, min, max, step, onChange);
        }
        if (typeof value === "string") {
          if (normalizeColor(value) === value) return colorRow(label, object, key, onChange);
          return textRow(label, object, key, onChange);
        }
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return group(label, autoRows(value, onChange, options));
        }
        return null;
      });
  }

  function getAutoNumberRange(key, value) {
    if (/threshold|opacity|blend|radius|strength|amount|saturation|contrast|gamma|maxRoughness|scale|intensity/i.test(key)) {
      return [0, Math.max(2, Math.ceil(Math.max(value, 1) * 2)), 0.005];
    }
    if (/temperature|tint|barrel|fisheye|brightness/i.test(key)) return [-1, 1, 0.005];
    if (/sample|spp|steps|iterations|maxTextureSize/i.test(key)) return [0, Math.max(64, value * 4), 1];
    if (/distance|thickness|bias|power|length|spacing|kernel/i.test(key)) return [0, Math.max(10, Math.ceil(Math.max(value, 1) * 4)), 0.01];
    return [0, Math.max(10, Math.ceil(Math.max(value, 1) * 4)), 0.01];
  }

  function groupSoundsByCategory(registry) {
    return Object.keys(registry).sort().reduce((groups, key) => {
      const category = getSoundCategory(registry[key]);
      if (!groups[category]) groups[category] = [];
      groups[category].push(key);
      return groups;
    }, {});
  }

  function getSoundCategory(config) {
    if (config?.mixGroup) return config.mixGroup;
    return String(config?.path ?? "").match(/assets\/sounds\/([^/]+)\//)?.[1] ?? "machinery";
  }

  async function savePostProcessingToProject() {
    setStatus("saving Post FX...", "busy");
    try {
      const result = await fetch("/__save-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "postProcessing", config: postProcessingConfig }),
      }).then((response) => response.json().then((body) => ({ response, body })));
      if (!result.response.ok || !result.body.ok) throw new Error(result.body.error ?? "save failed");
      setStatus(`saved ${result.body.filePath ?? "Post FX"}`, "ok");
    } catch (error) {
      console.error("[Debug workspace] Failed to save Post FX", error);
      setStatus("Post FX save failed", "error");
    }
  }

  async function copyPostProcessingConfig() {
    await navigator.clipboard.writeText(JSON.stringify(postProcessingConfig, null, 2));
    setStatus("Post FX config copied", "ok");
  }

  function vectorRow(label, vector, min, max, step, onChange, keys = ["x", "y", "z"]) {
    return group(label, keys.map((key) => numberRow(key.replace("_", ""), vector, key, min, max, step, onChange)));
  }

  function numberRow(label, object, key, min, max, step, onChange) {
    if (!object || object[key] === undefined) return null;
    const row = baseRow(label);
    const input = document.createElement("input");
    input.type = "number";
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = Number(object[key]).toFixed(step < 0.001 ? 5 : 3).replace(/\.?0+$/, "");
    input.addEventListener("change", () => {
      object[key] = Number(input.value);
      onChange?.();
    });
    row.append(input);
    return row;
  }

  function colorRow(label, object, key, onChange) {
    if (!object || object[key] === undefined) return null;
    const row = baseRow(label);
    const input = document.createElement("input");
    input.type = "color";
    input.value = normalizeColor(object[key]);
    input.addEventListener("input", () => {
      object[key] = input.value;
      onChange?.();
    });
    row.append(input);
    return row;
  }

  function textRow(label, object, key, onChange) {
    if (!object || object[key] === undefined) return null;
    const row = baseRow(label);
    const input = document.createElement("input");
    input.type = "text";
    input.value = object[key] ?? "";
    input.addEventListener("change", () => {
      object[key] = input.value;
      onChange?.();
    });
    row.append(input);
    return row;
  }

  function booleanRow(label, object, key, onChange) {
    if (!object || object[key] === undefined) return null;
    const row = baseRow(label);
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = Boolean(object[key]);
    input.addEventListener("change", () => {
      object[key] = input.checked;
      onChange?.();
    });
    row.append(input);
    return row;
  }

  function selectRow(label, object, key, options, onChange) {
    if (!object || object[key] === undefined) return null;
    const row = baseRow(label);
    const select = document.createElement("select");
    options.forEach((option) => {
      const element = document.createElement("option");
      element.value = option;
      element.textContent = option;
      select.append(element);
    });
    select.value = object[key];
    select.addEventListener("change", () => {
      const numeric = Number(select.value);
      object[key] = Number.isFinite(numeric) && String(numeric) === select.value ? numeric : select.value;
      onChange?.();
    });
    row.append(select);
    return row;
  }

  function actionRow(children = []) {
    const row = document.createElement("div");
    row.className = "debug-action-row";
    row.append(...children.filter(Boolean));
    return row;
  }

  function button(label, onClick) {
    const element = document.createElement("button");
    element.type = "button";
    element.textContent = label;
    element.addEventListener("click", onClick);
    return element;
  }

  function baseRow(label) {
    const row = document.createElement("label");
    row.className = "debug-property-row";
    row.append(Object.assign(document.createElement("span"), { textContent: label }));
    return row;
  }

  function destroy() {
    root.remove();
  }

  render();

  return {
    destroy,
    setVisible,
    isVisible: () => visible,
    setActiveLevel,
    select: (id) => select(id),
    saveProject: () => saveActiveLevel(),
    savePostProcessingToProject,
    copyPostProcessingConfig,
    refresh: render,
  };
}

export function getSuspendedLampDebugProperties(prefab, materialConfigs = {}) {
  if (prefab?.behavior !== "suspendedLamp" || !prefab.suspension) return null;
  return {
    suspension: prefab.suspension,
    bulbMaterial: materialConfigs.lampDome1Bulb ?? null,
  };
}

function getPrefabDisplayName(prefab) {
  return prefab.name.includes("__") ? prefab.name.split("__").slice(1).join("__") : prefab.name;
}

function getPrefabTypeLabel(prefab) {
  if (prefab.light) return "light";
  if (prefab.radio) return "radio";
  return prefab.prefabType ?? prefab.behavior ?? "prefab";
}

function getPrefabIcon(prefab) {
  if (prefab.light) return "light";
  if (prefab.radio) return "radio";
  return "prefab";
}

function labelize(value) {
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeColor(value) {
  if (typeof value !== "string") return "#ffffff";
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  return "#ffffff";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
