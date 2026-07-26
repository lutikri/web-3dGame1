import * as THREE from "three";

export function createRuntimeDebugSnapshot(source) {
  const state = source();
  const {
    config, renderer, camera, materials, materialTextureRuntime, levelEnvironmentModels,
    levelAssetCache, levelPrefabInstances, physicsSystem, pointLightsByKey, postProcessingRuntime,
    realismPostProcessingRuntime, postProcessingAssets, runtimeTextureLoading, roomLightingState,
  } = state;
  return {
    freezeNeedles: state.freezeNeedles,
    inputLocked: state.inputLocked,
    zoomActive: state.zoomActive,
    noclipEnabled: state.noclipEnabled,
    noclipSpeed: fixed(state.noclipSpeed),
    roomLightsEnabled: roomLightingState.enabled,
    roomLightFactor: fixed(roomLightingState.currentFactor),
    roomLightSwitchTimer: fixed(roomLightingState.switchTimer),
    roomLightSwitchMode: roomLightingState.switchMode,
    roomLightStarterFaultTimer: fixed(roomLightingState.starterFaultTimer),
    roomLightBootTimer: fixed(roomLightingState.bootTimer),
    operatorViewMode: state.operatorViewMode,
    movementSpeed: fixed(state.movementVelocity.length()),
    leanAmount: fixed(state.leanAmount),
    indicatorTestActive: state.indicatorTestTimer > 0,
    diagnostics: state.diagnostics,
    fuelBlend: state.fuelBlend,
    shiftProfile: state.activeShiftProfile,
    resultsVisible: state.resultsVisible,
    resultsTimer: fixed(state.resultsTimer),
    activeLevelId: state.activeLevelId,
    activeLevelMode: state.activeLevelMode,
    recorder: state.recorder,
    levelSession: state.levelSession,
    cameraFov: fixed(camera.fov),
    modelLoaded: Boolean(state.panelModel),
    panelTransform: state.panelModel ? state.getObjectTransform(state.panelModel.name) : null,
    panelTextureTier: materials.panel.userData.textureTier ?? (materialTextureRuntime.panelMaps ? "loaded" : "placeholder"),
    interiorLoaded: Boolean(state.loadedRuntimeLevelId && levelEnvironmentModels.has(state.loadedRuntimeLevelId)),
    interiorTransform: state.loadedRuntimeLevelId
      ? state.getObjectTransform(`${state.loadedRuntimeLevelId}_Environment`) : null,
    loadedRuntimeLevelId: state.loadedRuntimeLevelId,
    cachedLevelAssets: [...levelAssetCache.keys()],
    photometricPointLights: state.photometricPointLights,
    interiorFans: state.interiorFans.map((fan) => fan.name),
    doors: buildDoorSnapshot(levelPrefabInstances, physicsSystem),
    customInteriorMaterials: state.customInteriorMaterials,
    lightFixtures: Object.fromEntries(
      Object.entries(config.lighting.fixtures ?? {}).map(([name, fixture]) => [name, {
        lightNames: fixture.lightNames ?? [],
        materialKeys: fixture.materialKeys ?? [],
      }]),
    ),
    screen: state.screen,
    game: state.game,
    postProcessing: buildPostProcessingSnapshot(state),
    shadows: {
      enabled: renderer.shadowMap.enabled,
      quality: state.shadowQuality,
      mapSize: state.getShadowPreset(state.shadowQuality).mapSize ?? 0,
      lights: [...pointLightsByKey.values()].filter((light) => light.castShadow).length,
    },
    textureLoading: { ...runtimeTextureLoading },
    lampCount: state.lamps.length,
    needleCount: state.needles.length,
    interactive: state.interactive.map((object) => ({
      name: object.name,
      kind: object.userData.kind,
      label: object.userData.controlLabel ?? "",
    })),
    controls: Object.fromEntries(
      state.controlKnobs.map((knob) => [knob.name, Math.round(knob.userData.controlPercent ?? 0)]),
    ),
    buttons: Object.fromEntries(
      [...state.controlButtons, ...state.roomLightButtons].map((button) => [button.name, {
        pressed: Boolean(button.userData.pressed),
        progress: fixed(button.userData.pressProgress ?? 0),
      }]),
    ),
    lampMaterials: state.lamps.map((lamp) => lampMaterialName(lamp.material, materials)),
    needleAngles: state.needles.map((needle) =>
      Number(THREE.MathUtils.radToDeg(needle.userData.needleAngle ?? 0).toFixed(1))),
  };
}

function buildDoorSnapshot(instances, physics) {
  return Object.fromEntries([...instances.entries()]
    .filter(([, runtime]) => runtime.door)
    .map(([key, runtime]) => [key, {
      currentDegrees: fixed(physics?.getDoorDegrees(runtime.physicsDoorKey) ?? runtime.door.degrees),
      commandedOpen: runtime.door.commandedOpen,
      initialDegrees: runtime.door.interaction.initialDegrees,
      openDegrees: runtime.door.interaction.openDegrees,
      limits: [runtime.door.interaction.minDegrees, runtime.door.interaction.maxDegrees],
      physicsDoorKey: runtime.physicsDoorKey ?? null,
    }]));
}

function buildPostProcessingSnapshot({
  postProcessingRuntime: post, realismPostProcessingRuntime: realism, postProcessingAssets: assets,
  gtaoQuality, ssgiQuality, ssrQuality, screenSpaceShadowQuality,
}) {
  const lens = post.lensEffectsPass;
  return {
    composer: Boolean(post.composer),
    gtao: Boolean(post.gtaoPass),
    gtaoQuality,
    gtaoBlendIntensity: post.gtaoPass?.blendIntensity ?? 0,
    realismComposer: Boolean(realism.composer),
    ssgi: Boolean(realism.ssgiEffect),
    ssgiQuality,
    ssr: Boolean(realism.ssgiEffect || realism.ssrEffect),
    ssrQuality,
    screenSpaceShadows: Boolean(realism.screenSpaceShadowEffect),
    screenSpaceShadowImplementation: "hbao",
    screenSpaceShadowQuality,
    bloom: Boolean(realism.composer ? realism.bloomEffect : post.bloomPass),
    bloomStrength: realism.composer ? realism.bloomEffect?.intensity ?? 0 : post.bloomPass?.strength ?? 0,
    antiAliasingMethod: post.fxaaPass ? "fxaa" : post.smaaPass ? "smaa" : "off",
    msaaSamples: post.composer?.renderTarget1?.samples ?? 0,
    lensEffects: Boolean(lens),
    anamorphicGlare: Boolean(lens?.uniforms.glareEnabled.value),
    anamorphicGlareStrength: lens?.uniforms.glareStrength.value ?? 0,
    flareGhosts: Boolean(lens?.uniforms.ghostsEnabled.value),
    flareGhostStrength: lens?.uniforms.ghostStrength.value ?? 0,
    lensDirt: Boolean(lens?.uniforms.dirtEnabled.value),
    lensDirtStrength: lens?.uniforms.dirtStrength.value ?? 0,
    lensDirtTextureLoaded: Boolean(assets.lensDirtTexture),
    lensDirtAssetPath: assets.lensDirtAssetPath,
    lensEffectsUseBloomTexture: Boolean(lens?.uniforms.hasBloomTexture.value),
    realismBloom: Boolean(realism.bloomEffect),
    realismBloomStrength: realism.bloomEffect?.intensity ?? 0,
    lut: Boolean(post.lutPass),
    lutAssetPath: assets.lutAssetPath,
    lutIntensity: post.lutPass?.intensity ?? 0,
    colorAdjustments: Boolean(post.colorAdjustmentPass),
    sharpen: Boolean(post.sharpenPass),
    sharpenAmount: post.sharpenPass?.uniforms.amount.value ?? 0,
    lensDistortion: Boolean(post.lensDistortionPass),
    barrelAmount: post.lensDistortionPass?.uniforms.barrelAmount.value ?? 0,
    fisheyeAmount: post.lensDistortionPass?.uniforms.fisheyeAmount.value ?? 0,
    chromaticAberration: Boolean(post.chromaticAberrationPass),
    chromaticAberrationAmount: post.chromaticAberrationPass?.uniforms.amount.value ?? 0,
    realismChromaticAberration: Boolean(realism.chromaticAberrationEffect),
  };
}

function lampMaterialName(material, materials) {
  if (material === materials.lampOff) return "off";
  if (material === materials.lampRed) return "red";
  if (material === materials.lampGreen) return "green";
  return "amber";
}

function fixed(value) {
  return Number(Number(value ?? 0).toFixed(2));
}
