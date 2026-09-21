import { createPreflight } from "./app/Preflight.js?v=early-menu-track";
import { applyLocalization } from "./app/Localization.js?v=early-menu-track";
import { getGraphicsQualityProfile } from "./config/GraphicsQualityProfiles.js?v=early-menu-track";
import { showDevelopmentNotice } from "./app/DevelopmentNotice.js?v=early-menu-track";
import { acknowledgeDevelopmentNotice, shouldShowDevelopmentNotice } from "./app/AppPersistence.js?v=early-menu-track";
import { getScreenTransitionRuntime } from "./ui/ScreenTransitionRuntime.js?v=early-menu-track";

const APP_BUILD_REVISION = "early-menu-track";
const runtimeSmokeMode = new URLSearchParams(window.location.search).has("runtimeSmoke");
if (!runtimeSmokeMode && shouldShowDevelopmentNotice()) {
  await showDevelopmentNotice();
  acknowledgeDevelopmentNotice();
}
const screenTransition = getScreenTransitionRuntime();
const preflight = createPreflight({ screenTransition });
const returnToMenuAfterPreflight = sessionStorage.getItem("operatorGame.preflight.returnToMenu") === "1";
sessionStorage.removeItem("operatorGame.preflight.returnToMenu");
const bootChoice = runtimeSmokeMode
  ? { language: "en", profile: "low", displayGamma: 0.93, firstRun: false }
  : await preflight.prepare();
applyLocalization(bootChoice.language);
const selectedFirstRunProfile = bootChoice.firstRun ? await preflight.chooseProfile() : null;
const bootProfile = selectedFirstRunProfile ?? bootChoice.profile ?? "low";
const bootQuality = getGraphicsQualityProfile(bootProfile);
let bootDisplayGamma = bootChoice.displayGamma ?? 0.93;

window.operatorGameBootOptions = {
  qualityProfile: bootProfile,
  displayGamma: bootDisplayGamma,
  firstRun: bootChoice.firstRun,
  repeatBoot: !bootChoice.firstRun && !runtimeSmokeMode,
  deferFullTextures: bootChoice.firstRun,
  disableFullTextures: !bootQuality.fullTextures && !bootChoice.firstRun,
  returnToMenuAfterPreflight,
};

let firstBootSlides = null;
if (bootChoice.firstRun) {
  bootDisplayGamma = await preflight.calibrateBrightness(null, bootDisplayGamma);
  window.operatorGameBootOptions.displayGamma = bootDisplayGamma;
  preflight.complete(bootProfile, bootDisplayGamma, { removeOverlay: false });
  firstBootSlides = preflight.startFirstBootSlides();
  await firstBootSlides.ready;
}
await import(`./OperatorGame.js?v=early-menu-track`);

if (!bootChoice.firstRun) preflight.remove();

const { createAppShell } = await import(`./app/AppShell.js?v=early-menu-track`);
window.operatorGameApp = createAppShell({
  gameApi: window.operatorGameDebug,
});
if (firstBootSlides) {
  await window.operatorGameApp.initialRouteReady;
  await firstBootSlides.finish();
  window.operatorGameDebug.setAudioSuspended?.(false);
} else if (window.operatorGameBootOptions.repeatBoot) {
  await window.operatorGameApp.initialRouteReady;
  await screenTransition.reveal({ durationMs: 720 });
  window.operatorGameDebug.setAudioSuspended?.(false);
}

if (runtimeSmokeMode) {
  const { runLevelRuntimeSmoke } = await import(
    `./runtime/RuntimeSmoke.js?v=early-menu-track`
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
