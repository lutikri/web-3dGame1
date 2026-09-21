import {
  createServiceTerminalCanvasRenderer,
  uvToTerminalPixels,
} from "./ServiceTerminalCanvasRenderer.js?v=shared-screen-focus";

export function createServiceTerminalRuntime(
  parts,
  config = {},
  instanceName = "service terminal",
  { createRenderer = createServiceTerminalCanvasRenderer } = {},
) {
  const screenName = config.screenMeshName ?? "SM_Terminal_Screen";
  const screen = parts.get(screenName);
  if (!screen?.isMesh) {
    throw new Error(`[ServiceTerminal] Missing screen mesh "${screenName}" in prefab "${instanceName}"`);
  }
  const viewSocketName = config.viewSocketName ?? "SOCKET_TerminalView";
  const viewSocket = parts.get(viewSocketName);
  if (!viewSocket) {
    throw new Error(`[ServiceTerminal] Missing view socket "${viewSocketName}" in prefab "${instanceName}"`);
  }
  const glassName = config.glassMeshName ?? "SM_Terminal_ScreenGlass";
  const glass = parts.get(glassName);
  if (glass?.isMesh) {
    glass.renderOrder = Number(config.glassRenderOrder ?? 0);
  }
  const renderer = createRenderer({ config, prefabName: instanceName });
  const material = screen.material;
  material.map = renderer.texture;
  material.emissiveMap = renderer.texture;
  material.userData.runtimeTextureOwned = true;
  material.color?.set(0xffffff);
  material.emissive?.set(config.emissiveColor ?? 0xffffff);
  material.emissiveIntensity = Number(config.emissiveIntensity ?? 0.08);
  material.roughness = Number(config.roughness ?? 0.42);
  material.metalness = 0;
  material.toneMapped = true;
  material.needsUpdate = true;
  screen.castShadow = false;
  screen.receiveShadow = false;
  return {
    screen,
    screenName,
    viewSocket,
    viewSocketName,
    focusFovDegrees: Number(config.focusFovDegrees ?? 52),
    enterDurationSeconds: Number(config.enterDurationSeconds ?? 0.42),
    exitDurationSeconds: Number(config.exitDurationSeconds ?? 0.32),
    glass,
    glassName,
    renderer,
    setLanguage: renderer.setLanguage,
    dispose: renderer.dispose,
  };
}

export function registerServiceTerminalInteraction(levelId, prefabConfig, runtime, interactive = []) {
  if (prefabConfig?.behavior !== "serviceTerminal") return false;
  const target = runtime?.serviceTerminal?.screen;
  if (!target) return false;
  const config = prefabConfig.serviceTerminal ?? {};
  target.userData.kind = "serviceTerminal";
  target.userData.levelId = levelId;
  target.userData.levelPrefabKey = `${levelId}:${prefabConfig.name}`;
  target.userData.maxInteractionDistance = config.maxDistance ?? 2.1;
  target.userData.controlLabel = config.controlLabel ?? "SERVICE TERMINAL";
  target.userData.serviceTerminalRuntime = runtime.serviceTerminal;
  if (!interactive.includes(target)) interactive.push(target);
  return true;
}

export function getServiceTerminalHit(runtime, raycaster, camera, pointer, preferredUv = null) {
  const screen = runtime?.screen;
  if (!screen || !raycaster || !camera || !pointer) return null;
  if (preferredUv) {
    return {
      hit: null,
      pixel: uvToTerminalPixels(preferredUv, runtime.renderer.canvas.width, runtime.renderer.canvas.height),
    };
  }
  screen.updateWorldMatrix(true, false);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(screen, false)[0];
  if (!hit?.uv) return null;
  return { hit, pixel: uvToTerminalPixels(hit.uv, runtime.renderer.canvas.width, runtime.renderer.canvas.height) };
}

export function applyServiceTerminalHover(runtime, hit) {
  return runtime?.renderer?.updateHover(hit?.pixel?.x ?? -1, hit?.pixel?.y ?? -1) ?? null;
}
