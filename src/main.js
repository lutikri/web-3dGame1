import { createPreflight } from "./app/Preflight.js";
import { getGraphicsQualityProfile } from "./config/GraphicsQualityProfiles.js";

const preflight = createPreflight();
const bootChoice = await preflight.prepare();
const bootQuality = getGraphicsQualityProfile(bootChoice.profile ?? "low");

window.operatorGameBootOptions = {
  qualityProfile: bootChoice.profile ?? "low",
  deferFullTextures: bootChoice.firstRun,
  disableFullTextures: !bootQuality.fullTextures && !bootChoice.firstRun,
};

await import("./OperatorGame.js");

if (bootChoice.firstRun) {
  await waitForPreviewScene(window.operatorGameDebug);
  let benchmark = { results: [] };
  try {
    benchmark = await window.operatorGameDebug.runPerformanceBenchmark({
      quick: true,
      skipTextureWait: true,
      showReport: false,
      warmupSeconds: 0.15,
      sampleSeconds: 0.65,
    });
  } catch (error) {
    console.warn("[Preflight] Performance calibration failed; using conservative defaults", error);
  }
  const profile = await preflight.chooseProfile(benchmark);
  window.operatorGameDebug.applyQualityProfile(profile);
  preflight.complete(profile);
} else {
  preflight.remove();
}

const { createAppShell } = await import("./app/AppShell.js");
window.operatorGameApp = createAppShell({
  gameApi: window.operatorGameDebug,
});

async function waitForPreviewScene(gameApi, timeoutMs = 15000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const state = gameApi.getState?.();
    if (state?.modelLoaded && state?.interiorLoaded) return;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
}
