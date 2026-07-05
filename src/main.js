import { createPreflight } from "./app/Preflight.js";
import { applyLocalization } from "./app/Localization.js";
import { getGraphicsQualityProfile } from "./config/GraphicsQualityProfiles.js";

const preflight = createPreflight();
const runtimeSmokeMode = new URLSearchParams(window.location.search).has("runtimeSmoke");
const returnToMenuAfterPreflight = sessionStorage.getItem("operatorGame.preflight.returnToMenu") === "1";
sessionStorage.removeItem("operatorGame.preflight.returnToMenu");
const bootChoice = runtimeSmokeMode
  ? { language: "en", profile: "low", displayGamma: 0.93, firstRun: false }
  : await preflight.prepare();
applyLocalization(bootChoice.language);
const bootQuality = getGraphicsQualityProfile(bootChoice.profile ?? "low");

window.operatorGameBootOptions = {
  qualityProfile: bootChoice.profile ?? "low",
  displayGamma: bootChoice.displayGamma ?? 0.93,
  deferFullTextures: bootChoice.firstRun,
  disableFullTextures: !bootQuality.fullTextures && !bootChoice.firstRun,
  returnToMenuAfterPreflight,
};

await import("./OperatorGame.js");

let finishPreflightAfterShell = false;
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
  const displayGamma = await preflight.calibrateBrightness(
    (gamma) => window.operatorGameDebug.setDisplayGamma(gamma),
    bootChoice.displayGamma,
  );
  preflight.complete(profile, displayGamma, { removeOverlay: false });
  finishPreflightAfterShell = true;
} else {
  preflight.remove();
}

const { createAppShell } = await import("./app/AppShell.js");
window.operatorGameApp = createAppShell({
  gameApi: window.operatorGameDebug,
});
if (finishPreflightAfterShell) {
  await window.operatorGameApp.initialRouteReady;
  await preflight.finish();
}

if (runtimeSmokeMode) {
  const { runLevelRuntimeSmoke } = await import("./runtime/RuntimeSmoke.js");
  await window.operatorGameApp.initialRouteReady;
  try {
    window.operatorGameRuntimeSmokeResult = await runLevelRuntimeSmoke(window.operatorGameDebug);
    console.log("[RuntimeSmoke] PASS", window.operatorGameRuntimeSmokeResult);
  } catch (error) {
    window.operatorGameRuntimeSmokeResult = { ok: false, error: error.message };
    console.error("[RuntimeSmoke] FAIL", error);
  }
}

async function waitForPreviewScene(gameApi, timeoutMs = 15000) {
  const startedAt = performance.now();
  while (performance.now() - startedAt < timeoutMs) {
    const state = gameApi.getState?.();
    if (state?.modelLoaded && state?.interiorLoaded) return;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
  }
}
