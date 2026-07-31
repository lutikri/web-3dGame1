import { createPreflight } from "./app/Preflight.js?v=passive-flashlight-prefab";
import { applyLocalization } from "./app/Localization.js?v=passive-flashlight-prefab";
import { getGraphicsQualityProfile } from "./config/GraphicsQualityProfiles.js?v=passive-flashlight-prefab";

const APP_BUILD_REVISION = "passive-flashlight-prefab";
const preflight = createPreflight();
const runtimeSmokeMode = new URLSearchParams(window.location.search).has("runtimeSmoke");
const returnToMenuAfterPreflight = sessionStorage.getItem("operatorGame.preflight.returnToMenu") === "1";
sessionStorage.removeItem("operatorGame.preflight.returnToMenu");
const bootChoice = runtimeSmokeMode
  ? { language: "en", profile: "low", displayGamma: 0.93, firstRun: false }
  : await preflight.prepare();
applyLocalization(bootChoice.language);
const selectedFirstRunProfile = bootChoice.firstRun ? await preflight.chooseProfile() : null;
const bootProfile = selectedFirstRunProfile ?? bootChoice.profile ?? "low";
const bootQuality = getGraphicsQualityProfile(bootProfile);

window.operatorGameBootOptions = {
  qualityProfile: bootProfile,
  displayGamma: bootChoice.displayGamma ?? 0.93,
  deferFullTextures: bootChoice.firstRun,
  disableFullTextures: !bootQuality.fullTextures && !bootChoice.firstRun,
  returnToMenuAfterPreflight,
};

if (bootChoice.firstRun) preflight.showBooting();
await import(`./OperatorGame.js?v=passive-flashlight-prefab`);

let finishPreflightAfterShell = false;
if (bootChoice.firstRun) {
  const displayGamma = await preflight.calibrateBrightness(
    (gamma) => window.operatorGameDebug.setDisplayGamma(gamma),
    bootChoice.displayGamma,
  );
  preflight.complete(bootProfile, displayGamma, { removeOverlay: false });
  finishPreflightAfterShell = true;
} else {
  preflight.remove();
}

const { createAppShell } = await import(`./app/AppShell.js?v=passive-flashlight-prefab`);
window.operatorGameApp = createAppShell({
  gameApi: window.operatorGameDebug,
});
if (finishPreflightAfterShell) {
  await window.operatorGameApp.initialRouteReady;
  await preflight.finish();
}

if (runtimeSmokeMode) {
  const { runLevelRuntimeSmoke } = await import(
    `./runtime/RuntimeSmoke.js?v=passive-flashlight-prefab`
  );
  await window.operatorGameApp.initialRouteReady;
  try {
    window.operatorGameRuntimeSmokeResult = await runLevelRuntimeSmoke(window.operatorGameDebug);
    console.log("[RuntimeSmoke] PASS", window.operatorGameRuntimeSmokeResult);
  } catch (error) {
    window.operatorGameRuntimeSmokeResult = { ok: false, error: error.message };
    console.error("[RuntimeSmoke] FAIL", error);
  }
}
