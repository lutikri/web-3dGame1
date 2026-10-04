import { getGraphicsQualityProfile } from "../config/GraphicsQualityProfiles.js?v=compact-loading-game";
import { GAME_VERSION_LABEL } from "../config/GameVersion.js?v=compact-loading-game";
import { SOUND_REGISTRY } from "../audio/SoundRegistry.js?v=compact-loading-game";
import {
  createUiAudioInteractionRuntime,
  resolveUiAudioControl,
} from "./UiAudioInteractionRuntime.js?v=compact-loading-game";
import {
  classifyGraphicsAdapter,
  isHighEndGraphicsAdapter,
} from "../config/GraphicsHardwareTiers.js?v=compact-loading-game";

export { classifyGraphicsAdapter } from "../config/GraphicsHardwareTiers.js?v=compact-loading-game";

const STORAGE_KEY = "operatorGame.preflight.v1";
const SETTINGS_KEY = "operatorGame.settings.v1";
const QUALITY_PROFILE_REVISION = 2;
export const FIRST_RUN_DISPLAY_GAMMA = 1.255;
const PREFLIGHT_DESIGN_WIDTH = 1920;
const PREFLIGHT_DESIGN_HEIGHT = 1080;
const PREFLIGHT_BACKGROUND = "assets/ui/boot-backgrounds/site-12-01.webp";
const FIRST_BOOT_SLIDES = [
  "assets/ui/first-boot/Slide1.jpg",
  "assets/ui/first-boot/Slide2.jpg",
  "assets/ui/first-boot/Slide3.jpg",
];
const FIRST_BOOT_SLIDE_MS = 9000;
const FIRST_BOOT_TOTAL_MS = FIRST_BOOT_SLIDES.length * FIRST_BOOT_SLIDE_MS;

const COPY = {
  en: {
    performance: "PERFORMANCE",
    browserGpu: "BROWSER GPU",
    graphicsProfile: "GRAPHICS PROFILE",
    unknownGpu: "UNKNOWN / NOT REPORTED",
    gpuHelpLabel: "About browser GPU detection",
    gpuHelp: "Your browser may be using integrated graphics instead of your dedicated GPU. If performance is lower than expected, check Windows Graphics settings for your browser. The recommended profile is based on the adapter currently reported by the browser.",
    recommended: "RECOMMENDED",
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    continue: "CONTINUE",
  },
  ru: {
    performance: "ПРОИЗВОДИТЕЛЬНОСТЬ",
    browserGpu: "GPU БРАУЗЕРА",
    graphicsProfile: "ГРАФИЧЕСКИЙ ПРОФИЛЬ",
    unknownGpu: "НЕИЗВЕСТНО / НЕ СООБЩЕНО",
    gpuHelpLabel: "О распознавании GPU браузером",
    gpuHelp: "Браузер может использовать встроенную графику вместо дискретной видеокарты. Если производительность ниже ожидаемой, проверьте параметры графики Windows для вашего браузера. Рекомендуемый профиль основан на адаптере, о котором сейчас сообщает браузер.",
    recommended: "РЕКОМЕНДУЕТСЯ",
    low: "LOW",
    medium: "MEDIUM",
    high: "HIGH",
    continue: "ПРОДОЛЖИТЬ",
  },
};

export function createPreflight({ screenTransition } = {}) {
  let saved = loadSaved();
  let language = saved?.language ?? "en";
  let overlay = null;
  let gpuInfo = null;
  let selectedProfile = saved?.profile ?? "low";
  let resizeHandler = null;
  let uiAudio = null;

  async function prepare() {
    if (saved?.profile) {
      if ((saved.qualityProfileRevision ?? 0) < QUALITY_PROFILE_REVISION) {
        saveAppQualitySettings(saved.profile, saved.displayGamma);
        saved.qualityProfileRevision = QUALITY_PROFILE_REVISION;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      }
      document.documentElement.lang = saved.language;
      return {
        firstRun: false,
        language: saved.language,
        profile: readAppQualityProfile() ?? saved.profile,
        displayGamma: saved.displayGamma ?? 0.93,
      };
    }

    overlay = createOverlay();
    uiAudio = createPreflightUiAudio({ root: overlay });
    document.body.append(overlay);
    resizeHandler = () => updatePreflightScale(overlay, window.innerWidth, window.innerHeight);
    resizeHandler();
    window.addEventListener("resize", resizeHandler);
    document.documentElement.classList.remove("preflight-boot");
    preloadFirstBootAssets();
    language = await chooseLanguage();
    document.documentElement.lang = language;
    return { firstRun: true, language, profile: "low", displayGamma: FIRST_RUN_DISPLAY_GAMMA };
  }

  function chooseProfile() {
    gpuInfo = probeGraphics();
    const recommendation = recommendGraphicsProfile({ gpuInfo });
    selectedProfile = recommendation;
    return new Promise((resolve) => showPerformance({ recommendation, resolve }));
  }

  function complete(profile, displayGamma = FIRST_RUN_DISPLAY_GAMMA, { removeOverlay = true } = {}) {
    const quality = getGraphicsQualityProfile(profile);
    selectedProfile = profile;
    saved = {
      language,
      profile,
      displayGamma,
      gpu: gpuInfo?.renderer ?? "Unknown",
      measuredAt: Date.now(),
      qualityProfileRevision: QUALITY_PROFILE_REVISION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    saveAppQualitySettings(profile, displayGamma);
    if (window.operatorGameBootOptions) {
      window.operatorGameBootOptions.qualityProfile = profile;
      window.operatorGameBootOptions.deferFullTextures = false;
      window.operatorGameBootOptions.disableFullTextures = !quality.fullTextures;
    }
    if (removeOverlay) remove();
  }

  async function finish() {
    if (!overlay) return;
    overlay.classList.add("is-finishing");
    if (screenTransition) {
      await screenTransition.cover({ tone: "white", durationMs: 760, holdMs: 180 });
      remove();
      await screenTransition.reveal({ durationMs: 900 });
      return;
    }
    await wait(260);
    remove();
  }

  function remove() {
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
    uiAudio?.dispose();
    uiAudio = null;
    overlay?.remove();
    overlay = null;
  }

  function startFirstBootSlides() {
    if (!overlay) return { ready: Promise.resolve(), finish: async () => {} };
    let startedAt = null;
    let timer = null;
    let runtimeReady = false;
    let completing = false;
    let resolveCompletion;
    const completion = new Promise((resolve) => { resolveCompletion = resolve; });
    overlay.classList.add("is-first-boot");

    const render = () => {
      if (startedAt === null) return;
      const state = getFirstBootSlideState(performance.now() - startedAt);
      overlay.querySelectorAll("[data-first-boot-slide]").forEach((image, index) => {
        image.classList.toggle("is-active", index === state.slideIndex);
      });
      const percent = overlay.querySelector("[data-first-boot-percent]");
      const status = overlay.querySelector("[data-first-boot-status]");
      const count = overlay.querySelector("[data-first-boot-count]");
      const fill = overlay.querySelector("[data-first-boot-fill]");
      if (percent) percent.textContent = `${String(state.progress).padStart(2, "0")}%`;
      if (status) status.textContent = runtimeReady
        ? language === "ru" ? "СИСТЕМА ГОТОВА · ПРОСМОТР НЕОБЯЗАТЕЛЕН" : "SYSTEM READY · ORIENTATION OPTIONAL"
        : state.status;
      if (count) count.textContent = `${language === "ru" ? "СЛАЙД" : "SLIDE"} ${String(state.slideIndex + 1).padStart(2, "0")} / 03`;
      if (fill) fill.style.width = `${state.progress}%`;
    };

    const completePresentation = async () => {
      if (completing) return completion;
      completing = true;
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      overlay?.querySelector("[data-first-boot-continue]")?.setAttribute("aria-disabled", "true");
      await wait(120);
      await screenTransition?.cover({ tone: "white", durationMs: 950, holdMs: 400 });
      remove();
      await screenTransition?.reveal({ durationMs: 1100 });
      resolveCompletion();
      return completion;
    };

    const ready = (async () => {
      await screenTransition?.cover({ tone: "white", durationMs: 900, holdMs: 400 });
      if (!overlay) return;
      overlay.innerHTML = `
        <section class="first-boot-slides" aria-live="polite">
          <div class="first-boot-images" aria-hidden="true">
            ${FIRST_BOOT_SLIDES.map((path, index) => `<img src="${path}" alt="" data-first-boot-slide="${index}" />`).join("")}
          </div>
          <footer class="first-boot-loading">
            <div class="first-boot-loading-copy">
              <div class="first-boot-loading-info"><strong>INITIALIZATION</strong><span data-first-boot-status>PREPARING RENDERER...</span><span data-first-boot-count>SLIDE 01 / 03</span></div>
              <button type="button" class="first-boot-continue" data-first-boot-continue data-ui-sound="none" aria-hidden="true" disabled>${language === "ru" ? "ПРОДОЛЖИТЬ" : "CONTINUE"}</button>
              <div class="first-boot-loading-percent"><strong data-first-boot-percent>00%</strong></div>
            </div>
            <div class="first-boot-loading-track"><i data-first-boot-fill></i></div>
          </footer>
        </section>`;
      await waitForFirstBootImages(overlay);
      overlay.querySelector("[data-first-boot-slide='0']")?.classList.add("is-active");
      await screenTransition?.reveal({ durationMs: 1100 });
      startedAt = performance.now();
      render();
      timer = window.setInterval(render, 80);
      overlay.querySelector("[data-first-boot-continue]")?.addEventListener("click", completePresentation, { once: true });
      await uiAudio?.playCorporateIntro?.();
    })();

    return {
      ready,
      async finish() {
        await ready;
        if (startedAt === null) return;
        runtimeReady = true;
        const continueButton = overlay?.querySelector("[data-first-boot-continue]");
        if (continueButton) {
          continueButton.classList.add("is-ready");
          continueButton.setAttribute("aria-hidden", "false");
          continueButton.disabled = false;
        }
        render();
        return completion;
      },
    };
  }

  function createOverlay() {
    const element = document.createElement("div");
    element.className = "preflight-overlay";
    element.innerHTML = `
      <div class="preflight-backdrop" aria-hidden="true">
        <img src="${PREFLIGHT_BACKGROUND}" alt="" />
        <span class="preflight-corner preflight-corner-tl"></span>
        <span class="preflight-corner preflight-corner-tr"></span>
        <span class="preflight-corner preflight-corner-bl"></span>
        <span class="preflight-corner preflight-corner-br"></span>
        <span class="preflight-ambient preflight-ambient-version">${GAME_VERSION_LABEL}</span>
        <span class="preflight-ambient preflight-ambient-brand">BASELOAD (C)<br />AN ARTEM LUT GAME</span>
        <span class="preflight-ambient preflight-ambient-system">A TERRAGEN SYSTEM<br />OPERATING SYSTEM<br />1970–2037</span>
      </div>
      <section class="preflight-terminal" aria-label="System preflight">
        <header class="preflight-header">
          <span>TERRAGEN SYSTEMS</span>
          <span>SITE-12</span>
        </header>
        <main class="preflight-panel" aria-live="polite"></main>
      </section>`;
    return element;
  }

  function chooseLanguage() {
    const panel = getPanel();
    renderLanguage(panel);
    return new Promise((resolve) => {
      panel.querySelectorAll("[data-language]").forEach((button) => {
        button.addEventListener("click", () => {
          language = button.dataset.language;
          document.documentElement.lang = language;
          resolve(language);
        }, { once: true });
      });
    });
  }

  function renderLanguage(panel) {
    panel.innerHTML = `
      <div class="preflight-step-content preflight-language-step">
        <h1>CHOOSE LANGUAGE<small>ВЫБЕРИТЕ ЯЗЫК</small></h1>
        <div class="preflight-language-actions">
          <button type="button" data-language="en">ENGLISH</button>
          <button type="button" data-language="ru">РУССКИЙ</button>
        </div>
      </div>
      ${progressMarkup(0)}`;
  }

  function showPerformance({ recommendation, resolve }) {
    const copy = COPY[language];
    const panel = getPanel();
    const gpuName = getBrowserGpuLabel(gpuInfo?.renderer, copy.unknownGpu);
    panel.innerHTML = `
      <div class="preflight-step-content preflight-performance-step">
        <h1>${copy.performance}</h1>
        <div class="preflight-gpu-block">
          <div class="preflight-gpu-label">${copy.browserGpu}</div>
          <div class="preflight-gpu-value">
            <strong class="preflight-gpu">${escapeHtml(gpuName)}</strong>
            <span class="preflight-gpu-help">
              <button type="button" aria-label="${copy.gpuHelpLabel}" aria-describedby="preflightGpuHelp">?</button>
            </span>
            <span class="preflight-gpu-tooltip" id="preflightGpuHelp" role="tooltip">${copy.gpuHelp}</span>
          </div>
        </div>
        <div class="preflight-profile-block">
          <div class="preflight-profile-label">${copy.graphicsProfile}</div>
          <div class="preflight-quality-grid">
            ${["low", "medium", "high"].map((profile) => qualityCard(profile, recommendation, copy)).join("")}
          </div>
        </div>
        <button class="preflight-apply" type="button" data-apply-profile>${copy.continue}</button>
      </div>
      ${progressMarkup(1)}`;

    panel.querySelectorAll("[data-profile]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedProfile = button.dataset.profile;
        panel.querySelectorAll("[data-profile]").forEach((card) => {
          const selected = card === button;
          card.classList.toggle("is-selected", selected);
          card.setAttribute("aria-pressed", String(selected));
        });
      });
    });
    panel.querySelector("[data-apply-profile]").addEventListener("click", () => resolve(selectedProfile), { once: true });
  }

  function getPanel() {
    return overlay.querySelector(".preflight-panel");
  }

  return { prepare, chooseProfile, complete, finish, startFirstBootSlides, remove };
}

function progressMarkup(activeIndex) {
  return `
    <footer class="preflight-progress" aria-label="Preflight progress">
      <strong class="${activeIndex === 0 ? "is-active" : ""}"><b>01</b>LANGUAGE</strong>
      <strong class="${activeIndex === 1 ? "is-active" : ""}"><b>02</b>PERFORMANCE</strong>
    </footer>`;
}

function qualityCard(profile, recommendation, copy) {
  const title = copy[profile];
  const selected = profile === recommendation;
  return `<div class="preflight-quality-option">
    <button type="button" class="preflight-quality-card ${selected ? "is-selected" : ""}" data-profile="${profile}" aria-pressed="${selected}">${title}</button>
    ${selected ? `<em>${copy.recommended}</em>` : ""}
  </div>`;
}

export function getFirstBootSlideState(elapsedMs) {
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const slideIndex = Math.floor(elapsed / FIRST_BOOT_SLIDE_MS) % FIRST_BOOT_SLIDES.length;
  const statuses = ["LOADING ASSETS...", "COMPILING MAP...", "COMPILING SHADERS..."];
  return {
    slideIndex,
    status: statuses[slideIndex],
    progress: Math.min(100, Math.floor((elapsed / FIRST_BOOT_TOTAL_MS) * 100)),
  };
}

async function waitForFirstBootImages(root) {
  const pending = [...root.querySelectorAll("[data-first-boot-slide]")].map(async (image) => {
    try {
      await image.decode?.();
    } catch {
      // Optional orientation art must not block boot if an image fails to decode.
    }
  });
  await Promise.race([Promise.all(pending), wait(4000)]);
}

function probeGraphics() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { powerPreference: "high-performance" }) ?? canvas.getContext("webgl");
  const extension = gl?.getExtension("WEBGL_debug_renderer_info");
  return {
    renderer: extension
      ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
      : gl?.getParameter(gl.RENDERER) ?? "",
    webgl2: typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext,
  };
}

export function getBrowserGpuLabel(renderer, fallback = "UNKNOWN / NOT REPORTED") {
  const text = String(renderer ?? "").trim();
  if (!text || /unavailable|unknown|masked|webgl renderer/i.test(text)) return fallback;
  const intel = text.match(/Intel(?:\(R\))?\s+(?:HD|UHD|Iris)[^,(]*/i);
  if (intel) return intel[0].replace(/\s+/g, " ").trim();
  const nvidia = text.match(/NVIDIA\s+GeForce\s+[^,(]*/i);
  if (nvidia) return nvidia[0].trim();
  const amd = text.match(/(?:AMD\s+)?Radeon\s+[^,(]*/i);
  if (amd) return amd[0].trim();
  return text.replace(/^ANGLE\s*\(/i, "").split(",")[0].trim() || fallback;
}

function findResult(benchmark, name) {
  return benchmark?.results?.find((result) => result.preset === name);
}

function getStableFps(result, fallback) {
  if (!result) return fallback;
  const average = Number(result.avgFps) || fallback;
  const p95Fps = result.p95FrameMs > 0 ? 1000 / result.p95FrameMs : average;
  return Math.min(average, p95Fps);
}

export function recommendGraphicsProfile({ benchmark, gpuInfo } = {}) {
  const adapterClass = classifyGraphicsAdapter(gpuInfo?.renderer);
  if (adapterClass === "software" || gpuInfo?.webgl2 === false) return "low";
  const mediumResult = findResult(benchmark, "PROFILE MEDIUM");
  const highResult = findResult(benchmark, "PROFILE HIGH");
  if (highResult && getStableFps(highResult, 0) >= 45) return "high";
  if (mediumResult && getStableFps(mediumResult, 0) >= 36) return "medium";
  if (mediumResult || highResult) return "low";
  return isHighEndGraphicsAdapter(gpuInfo?.renderer) ? "high" : "medium";
}

export function getPreflightScale(viewportWidth, viewportHeight) {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const height = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  return Math.min(width / PREFLIGHT_DESIGN_WIDTH, height / PREFLIGHT_DESIGN_HEIGHT);
}

export function createPreflightUiAudio({ root, AudioClass = globalThis.Audio } = {}) {
  if (!root || !AudioClass) return { dispose() {} };
  const clickAudio = new AudioClass(SOUND_REGISTRY.Menu_Click1.path);
  const hoverAudio = new AudioClass(SOUND_REGISTRY.Menu_Hover1.path);
  const setupCompleteAudio = new AudioClass(SOUND_REGISTRY.Menu_SetupComlete1.path);
  const corporateIntroAudio = new AudioClass(SOUND_REGISTRY.TCorporateIntro1.path);
  clickAudio.volume = SOUND_REGISTRY.Menu_Click1.volume;
  hoverAudio.volume = SOUND_REGISTRY.Menu_Hover1.volume;
  setupCompleteAudio.volume = SOUND_REGISTRY.Menu_SetupComlete1.volume;
  corporateIntroAudio.volume = SOUND_REGISTRY.TCorporateIntro1.volume;
  corporateIntroAudio.preload = "auto";
  let unlocked = false;
  const play = (audio) => {
    audio.currentTime = 0;
    return audio.play()?.catch?.(() => {});
  };
  const interaction = createUiAudioInteractionRuntime({
    root,
    isAudioUnlocked: () => unlocked,
    playClick: () => play(clickAudio),
    playHover: () => play(hoverAudio),
  });
  const handleClick = (event) => {
    unlocked = true;
    const control = resolveUiAudioControl(root, event?.target);
    if (control?.dataset?.uiSound === "setupComplete") {
      play(setupCompleteAudio);
      return;
    }
    interaction.handleClick(event);
  };
  const handleMouseMove = (event) => interaction.handlePointerMove(event);
  root.addEventListener("click", handleClick, true);
  root.addEventListener("mousemove", handleMouseMove);
  return {
    playCorporateIntro() {
      return play(corporateIntroAudio);
    },
    dispose() {
      root.removeEventListener("click", handleClick, true);
      root.removeEventListener("mousemove", handleMouseMove);
      clickAudio.pause?.();
      hoverAudio.pause?.();
      setupCompleteAudio.pause?.();
      corporateIntroAudio.pause?.();
    },
  };
}

function updatePreflightScale(overlay, viewportWidth, viewportHeight) {
  overlay?.style.setProperty("--preflight-scale", String(getPreflightScale(viewportWidth, viewportHeight)));
}

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

function readAppQualityProfile() {
  try {
    const profile = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}").qualityProfile;
    return ["low", "medium", "high", "ultra"].includes(profile) ? profile : null;
  } catch {
    return null;
  }
}

function saveAppQualitySettings(profile, gamma = null) {
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
  } catch {
    settings = {};
  }
  const quality = getGraphicsQualityProfile(profile);
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...settings,
      qualityProfile: profile,
      ...(gamma == null ? {} : { gamma }),
      shadowQuality: quality.shadowQuality,
      gtaoQuality: quality.gtaoQuality,
      ssgiQuality: "off",
      ssrQuality: "off",
      screenSpaceShadowQuality: "off",
    }),
  );
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

function preloadFirstBootAssets() {
  FIRST_BOOT_SLIDES.forEach((url) => {
    fetch(url, { cache: "force-cache", priority: "low" }).catch(() => {});
  });
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
