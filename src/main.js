import { createPreflight } from "./app/Preflight.js?v=development-notice-v1";
import { applyLocalization } from "./app/Localization.js?v=development-notice-v1";
import { getGraphicsQualityProfile } from "./config/GraphicsQualityProfiles.js?v=development-notice-v1";
import { showDevelopmentNotice } from "./app/DevelopmentNotice.js?v=development-notice-v1";
import { acknowledgeDevelopmentNotice, shouldShowDevelopmentNotice } from "./app/AppPersistence.js?v=development-notice-v1";

const APP_BUILD_REVISION = "development-notice-v1";
const runtimeSmokeMode = new URLSearchParams(window.location.search).has("runtimeSmoke");
if (!runtimeSmokeMode && shouldShowDevelopmentNotice()) {
  await showDevelopmentNotice();
  acknowledgeDevelopmentNotice();
}
const preflight = createPreflight();
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
await import(`./OperatorGame.js?v=development-notice-v1`);

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

const { createAppShell } = await import(`./app/AppShell.js?v=development-notice-v1`);
window.operatorGameApp = createAppShell({
  gameApi: window.operatorGameDebug,
});
if (finishPreflightAfterShell) {
  await window.operatorGameApp.initialRouteReady;
  await preflight.finish();
}

if (runtimeSmokeMode) {
  const { runLevelRuntimeSmoke } = await import(
    `./runtime/RuntimeSmoke.js?v=development-notice-v1`
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
