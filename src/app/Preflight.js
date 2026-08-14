import { getGraphicsQualityProfile } from "../config/GraphicsQualityProfiles.js?v=soma-body-weight";
import { SOUND_REGISTRY } from "../audio/SoundRegistry.js?v=soma-body-weight";
import {
  createUiAudioInteractionRuntime,
  resolveUiAudioControl,
} from "./UiAudioInteractionRuntime.js?v=soma-body-weight";
import {
  classifyGraphicsAdapter,
  isHighEndGraphicsAdapter,
} from "../config/GraphicsHardwareTiers.js?v=soma-body-weight";

export { classifyGraphicsAdapter } from "../config/GraphicsHardwareTiers.js?v=soma-body-weight";

const STORAGE_KEY = "operatorGame.preflight.v1";
const SETTINGS_KEY = "operatorGame.settings.v1";
const QUALITY_PROFILE_REVISION = 2;
const QUALITY_PREVIEWS = {
  low: "assets/ui/performance/set-min.jpg",
  medium: "assets/ui/performance/set-med.jpg",
  high: "assets/ui/performance/set-max.jpg",
};

const PREFLIGHT_DESIGN_WIDTH = 1920;
const PREFLIGHT_DESIGN_HEIGHT = 1080;

const COPY = {
  en: {
    gpu: "GRAPHICS ADAPTER",
    integrated: "The browser is using integrated or power-saving graphics. If this computer also has NVIDIA or AMD graphics, switch the browser to the high-performance adapter.",
    software: "Hardware acceleration is unavailable. The browser is rendering through software, so LOW is the safe starting profile.",
    unknown: "The browser did not disclose the adapter model. MEDIUM will be used as the balanced starting profile, but every profile remains available.",
    guide: "I HAVE NVIDIA / AMD",
    continue: "USE CURRENT ADAPTER",
    confirmed: "ADAPTER CONFIRMED",
    hardwareReady: "HARDWARE ACCELERATION CHECK COMPLETE",
    result: "GRAPHICS CALIBRATION COMPLETE",
    recommended: "RECOMMENDED",
    measured: "Recommendation based on the adapter currently used by the browser",
    choose: "Choose a graphics profile",
    low: ["LOW", "FASTEST"],
    medium: ["MEDIUM", "BALANCED"],
    high: ["HIGH", "FULL EFFECTS"],
    apply: "APPLY",
    applying: "INITIALIZING SELECTED GRAPHICS PROFILE",
    loadingRuntime: "LOADING RUNTIME",
    brightnessTitle: "DISPLAY BRIGHTNESS",
    brightnessHint: "Move the slider until the left bar merges with the black frame. The second bar should be barely visible.",
    brightnessControl: "GAME BRIGHTNESS",
    brightnessApply: "CONTINUE",
    setupComplete: "SETUP COMPLETE",
    setupAgain: "Run it again later: P → Settings → Setup Wizard.",
    okay: "OK",
  },
  ru: {
    gpu: "ГРАФИЧЕСКИЙ АДАПТЕР",
    integrated: "Браузер использует встроенную или энергосберегающую графику. Если в компьютере также есть NVIDIA или AMD, переключите браузер на производительный адаптер.",
    software: "Аппаратное ускорение недоступно. Браузер рисует сцену программно, поэтому безопасный стартовый профиль — LOW.",
    unknown: "Браузер не сообщил модель адаптера. Стартовым сбалансированным профилем будет MEDIUM, но выбрать можно любой профиль.",
    guide: "У МЕНЯ ЕСТЬ NVIDIA / AMD",
    continue: "ИСПОЛЬЗОВАТЬ ТЕКУЩИЙ",
    confirmed: "АДАПТЕР ВЕРНЫЙ",
    hardwareReady: "ПРОВЕРКА АППАРАТНОГО УСКОРЕНИЯ ЗАВЕРШЕНА",
    result: "КАЛИБРОВКА ГРАФИКИ ЗАВЕРШЕНА",
    recommended: "РЕКОМЕНДУЕТСЯ",
    measured: "Рекомендация основана на адаптере, который сейчас использует браузер",
    choose: "Выберите профиль графики",
    low: ["LOW", "МАКСИМУМ FPS"],
    medium: ["MEDIUM", "БАЛАНС"],
    high: ["HIGH", "ВСЕ ЭФФЕКТЫ"],
    apply: "ПРИМЕНИТЬ",
    applying: "ИНИЦИАЛИЗАЦИЯ ВЫБРАННОГО ПРОФИЛЯ ГРАФИКИ",
    loadingRuntime: "ЗАГРУЗКА СИСТЕМ",
    brightnessTitle: "ЯРКОСТЬ ЭКРАНА",
    brightnessHint: "Двигайте ползунок, пока левая полоса не сольётся с чёрной рамкой шкалы. Вторая полоса должна быть едва заметна.",
    brightnessControl: "ЯРКОСТЬ ИГРЫ",
    brightnessApply: "ПРОДОЛЖИТЬ",
    setupComplete: "НАСТРОЙКА ЗАВЕРШЕНА",
    setupAgain: "Настроить заново: P → Настройки → Мастер настройки.",
    okay: "OK",
  },
};

export function createPreflight() {
  let saved = loadSaved();
  let language = saved?.language ?? "en";
  let overlay = null;
  let gpuInfo = null;
  let selectedProfile = saved?.profile ?? "low";
  let gpuContinuePromise = null;
  let resolveGpuContinue = null;
  let resizeHandler = null;
  let uiAudio = null;

  async function prepare() {
    if (saved?.profile) {
      if ((saved.qualityProfileRevision ?? 0) < QUALITY_PROFILE_REVISION) {
        saveAppQualitySettings(saved.profile);
        saved.qualityProfileRevision = QUALITY_PROFILE_REVISION;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
      }
      document.documentElement.lang = saved.language;
      return {
        firstRun: false,
        language: saved.language,
        profile: saved.profile,
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
    preloadFirstRunAssets();
    language = await chooseLanguage();
    document.documentElement.lang = language;
    gpuInfo = probeGraphics();
    showGpuCheck();
    return { firstRun: true, language, profile: "low", displayGamma: 0.93 };
  }

  async function chooseProfile() {
    await gpuContinuePromise;
    const recommendation = recommendGraphicsProfile({ gpuInfo });
    selectedProfile = recommendation;
    return new Promise((resolve) => showProfileChoice({ benchmark: null, recommendation, resolve }));
  }

  function complete(profile, displayGamma = 0.93, { removeOverlay = true } = {}) {
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
    saveAppQualitySettings(profile);
    window.operatorGameBootOptions.qualityProfile = profile;
    window.operatorGameBootOptions.deferFullTextures = false;
    window.operatorGameBootOptions.disableFullTextures = !quality.fullTextures;
    if (removeOverlay) remove();
  }

  async function finish() {
    if (!overlay) return;
    overlay.classList.add("is-finishing");
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    remove();
  }

  function calibrateBrightness(onChange, initialGamma = 0.93) {
    const copy = COPY[language];
    const panel = getPanel();
    setStep("display");
    panel.innerHTML = `
      <div class="preflight-kicker">DISPLAY CALIBRATION</div>
      <h1>${copy.brightnessTitle}</h1>
      <p>${copy.brightnessHint}</p>
      <div class="preflight-black-frame">
        <div class="preflight-black-levels">
          ${[0, 4, 8, 12, 20, 32].map((level) => `<span data-black-level="${level}"></span>`).join("")}
        </div>
      </div>
      <label class="preflight-gamma-control">
        <span>${copy.brightnessControl}</span>
        <input type="range" min="0.75" max="1.25" step="0.01" value="${initialGamma}" data-gamma />
        <strong data-gamma-value>100%</strong>
      </label>
      <button type="button" data-gamma-apply>${copy.brightnessApply}</button>`;

    const input = panel.querySelector("[data-gamma]");
    const update = () => {
      const gamma = Number(input.value);
      panel.querySelector("[data-gamma-value]").textContent = `${Math.round((gamma / 0.93) * 100)}%`;
      panel.querySelectorAll("[data-black-level]").forEach((bar) => {
        const source = Number(bar.dataset.blackLevel) / 255;
        const corrected = Math.round(Math.pow(source, 1 / gamma) * 255);
        bar.style.backgroundColor = `rgb(${corrected}, ${corrected}, ${corrected})`;
      });
      onChange?.(gamma);
    };
    input.addEventListener("input", update);
    update();
    return new Promise((resolve) => {
      panel.querySelector("[data-gamma-apply]").addEventListener("click", () => {
        const gamma = Number(input.value);
        panel.innerHTML = `
          <div class="preflight-kicker">OPERATOR CONSOLE</div>
          <h1>${copy.setupComplete}</h1>
          <p>${copy.setupAgain}</p>
          <button type="button" data-setup-ok data-ui-sound="setupComplete">${copy.okay}</button>`;
        panel.querySelector("[data-setup-ok]").addEventListener("click", () => resolve(gamma), { once: true });
      }, { once: true });
    });
  }

  function remove() {
    if (resizeHandler) window.removeEventListener("resize", resizeHandler);
    resizeHandler = null;
    uiAudio?.dispose();
    uiAudio = null;
    overlay?.remove();
    overlay = null;
  }

  function showBooting() {
    const copy = COPY[language];
    const panel = getPanel();
    panel.innerHTML = `
      <div class="preflight-kicker">RENDERER / ${selectedProfile.toUpperCase()}</div>
      <h1>${copy.applying}</h1>
      <div class="preflight-test-status">
        <span class="preflight-spinner"></span>
        <strong>${copy.loadingRuntime}</strong>
      </div>`;
  }

  function createOverlay() {
    const element = document.createElement("div");
    element.className = "preflight-overlay";
    element.innerHTML = `
      <section class="preflight-terminal">
        <header class="preflight-header">
          <span>TERRAGEN SYSTEMS / SYSTEM PREFLIGHT</span>
          <span>SITE-12 / TERM 04</span>
        </header>
        <div class="preflight-body">
          <aside class="preflight-index" aria-label="Setup progress">
            <div class="preflight-index-heading"><span>PREFLIGHT</span><span>01</span></div>
            <ol>
              <li data-preflight-step="language"><b>01</b><span>LANGUAGE</span></li>
              <li data-preflight-step="graphics"><b>02</b><span>GRAPHICS</span></li>
              <li data-preflight-step="profile"><b>03</b><span>QUALITY PROFILE</span></li>
              <li data-preflight-step="display"><b>04</b><span>DISPLAY</span></li>
            </ol>
            <p>FIRST-RUN TERMINAL CALIBRATION</p>
          </aside>
          <main class="preflight-panel" aria-live="polite"></main>
        </div>
        <footer class="preflight-footer">
          <span>OPERATOR CONSOLE / INITIAL SETUP</span>
          <span data-preflight-stage>SETUP 01 / 04</span>
        </footer>
      </section>`;
    return element;
  }

  function setStep(step) {
    const steps = ["language", "graphics", "profile", "display"];
    const activeIndex = Math.max(0, steps.indexOf(step));
    overlay?.querySelectorAll("[data-preflight-step]").forEach((node, index) => {
      node.classList.toggle("is-active", index === activeIndex);
      node.classList.toggle("is-complete", index < activeIndex);
    });
    const stage = overlay?.querySelector("[data-preflight-stage]");
    if (stage) stage.textContent = `SETUP ${String(activeIndex + 1).padStart(2, "0")} / 04`;
  }

  function chooseLanguage() {
    const panel = getPanel();
    setStep("language");
    panel.innerHTML = `
      <h1>CHOOSE LANGUAGE / ВЫБЕРИТЕ ЯЗЫК</h1>
      <div class="preflight-language-actions">
        <button type="button" data-language="en">ENGLISH</button>
        <button type="button" data-language="ru">РУССКИЙ</button>
      </div>`;
    return new Promise((resolve) => {
      panel.querySelectorAll("[data-language]").forEach((button) => {
        button.addEventListener("click", () => resolve(button.dataset.language), { once: true });
      });
    });
  }

  function showGpuCheck() {
    const copy = COPY[language];
    const adapterClass = classifyGraphicsAdapter(gpuInfo.renderer);
    const integrated = adapterClass === "integrated";
    const adapterNotice = adapterClass === "software" ? copy.software : adapterClass === "unknown" ? copy.unknown : integrated ? copy.integrated : "";
    const gpuName = getShortGpuName(gpuInfo.renderer);
    setStep("graphics");
    if (!gpuContinuePromise) {
      gpuContinuePromise = new Promise((resolve) => {
        resolveGpuContinue = resolve;
      });
    }
    getPanel().innerHTML = `
      <div class="preflight-kicker">HARDWARE / WEBGL ${gpuInfo.webgl2 ? "2" : "1"}</div>
      <h1>${copy.gpu}</h1>
      <strong class="preflight-gpu">${escapeHtml(gpuName)}</strong>
      ${adapterNotice ? `<p class="preflight-warning is-${adapterClass}">${adapterNotice}</p>` : ""}
      <div class="preflight-test-status" data-test-status>
        <strong>${copy.hardwareReady}</strong>
      </div>
      <div class="preflight-language-actions">
        ${integrated ? `<button type="button" data-gpu-guide>${copy.guide}</button>` : ""}
        <button type="button" data-gpu-continue>${adapterClass === "software" || integrated ? copy.continue : copy.confirmed}</button>
      </div>`;
    getPanel().querySelector("[data-gpu-guide]")?.addEventListener("click", showGpuGuide);
    getPanel().querySelector("[data-gpu-continue]").addEventListener("click", () => resolveGpuContinue?.(), { once: true });
  }

  function showGpuGuide() {
    const copy = COPY[language];
    const panel = getPanel();
    panel.innerHTML = `
      <div class="preflight-kicker">${copy.guide}</div>
      <h1>WINDOWS GPU SETUP</h1>
      <div class="preflight-os-tabs">
        ${["11", "10", "7", "xp"].map((version) => `<button type="button" data-windows="${version}">WINDOWS ${version.toUpperCase()}</button>`).join("")}
      </div>
      <div class="preflight-os-guide" data-os-guide></div>
      <div class="preflight-language-actions">
        <button type="button" data-guide-back>${copy.continue}</button>
      </div>`;

    const showWindowsGuide = (version) => {
      panel.querySelector("[data-os-guide]").innerHTML = getWindowsGuide(version, language);
      panel.querySelectorAll("[data-windows]").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.windows === version);
      });
    };
    panel.querySelectorAll("[data-windows]").forEach((button) => {
      button.addEventListener("click", () => showWindowsGuide(button.dataset.windows));
    });
    panel.querySelector("[data-guide-back]").addEventListener("click", showGpuCheck, { once: true });
    showWindowsGuide("11");
  }

  function showProfileChoice({ benchmark, recommendation, resolve }) {
    const copy = COPY[language];
    const lowResult = findResult(benchmark, "PROFILE LOW");
    const mediumResult = findResult(benchmark, "PROFILE MEDIUM");
    const highResult = findResult(benchmark, "PROFILE HIGH");
    const estimates = {
      low: estimateFps(lowResult),
      medium: estimateFps(mediumResult),
      high: estimateFps(highResult),
    };
    const panel = getPanel();
    setStep("profile");
    panel.innerHTML = `
      <div class="preflight-kicker">${copy.result}</div>
      <h1>${copy.choose}</h1>
      <p>${copy.measured}.</p>
      <div class="preflight-quality-grid">
        ${["low", "medium", "high"].map((profile) => qualityCard(profile, recommendation, estimates[profile], copy)).join("")}
      </div>
      <img class="preflight-quality-zoom" alt="" aria-hidden="true" />
      <button class="preflight-apply" type="button" data-apply-profile>${copy.apply} ${recommendation.toUpperCase()}</button>`;

    const zoomPreview = panel.querySelector(".preflight-quality-zoom");
    let previewArmed = false;
    window.setTimeout(() => {
      previewArmed = true;
    }, 320);
    panel.querySelectorAll("[data-profile]").forEach((button) => {
      const previewTarget = button.querySelector(".preflight-quality-preview");
      const showPreview = () => {
        if (!previewArmed) return;
        zoomPreview.src = button.dataset.preview;
        zoomPreview.classList.add("is-visible");
      };
      const hidePreview = () => zoomPreview.classList.remove("is-visible");
      previewTarget.addEventListener("mouseenter", () => showPreview());
      previewTarget.addEventListener("mousemove", () => showPreview());
      previewTarget.addEventListener("mouseleave", hidePreview);
      button.addEventListener("click", () => {
        selectedProfile = button.dataset.profile;
        panel.querySelectorAll("[data-profile]").forEach((card) => card.classList.toggle("is-selected", card === button));
        panel.querySelector("[data-apply-profile]").textContent = `${copy.apply} ${selectedProfile.toUpperCase()}`;
      });
    });
    panel.querySelector("[data-apply-profile]").addEventListener("click", () => resolve(selectedProfile), { once: true });
  }

  function getPanel() {
    return overlay.querySelector(".preflight-panel");
  }

  return { prepare, chooseProfile, showBooting, calibrateBrightness, complete, finish, remove };
}

function qualityCard(profile, recommendation, fps, copy) {
  const [title, description] = copy[profile];
  const preview = QUALITY_PREVIEWS[profile];
  return `<button type="button" class="preflight-quality-card ${profile === recommendation ? "is-selected" : ""}" data-profile="${profile}" data-preview="${preview}">
    <span class="preflight-quality-preview is-${profile}" style="background-image:url('${preview}')"></span>
    <strong>${title}${profile === recommendation ? ` · ${copy.recommended}` : ""}</strong>
    <span>${description}</span>
    ${fps ? `<em>${fps} FPS</em>` : ""}
  </button>`;
}

function probeGraphics() {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", { powerPreference: "high-performance" }) ?? canvas.getContext("webgl");
  const extension = gl?.getExtension("WEBGL_debug_renderer_info");
  return {
    renderer: extension
      ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL)
      : gl?.getParameter(gl.RENDERER) ?? "GPU information unavailable",
    webgl2: typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext,
  };
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

function estimateFps(result) {
  if (!result) return null;
  const average = Number(result.avgFps) || 0;
  const stable = getStableFps(result, 0);
  if (average >= 120 && stable >= 75) return "120+";
  if (stable >= 60) return "60+";
  const conservative = Math.max(5, Math.min(120, stable * 0.9));
  return `~${Math.max(5, Math.round(conservative / 5) * 5)}`;
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
  clickAudio.volume = SOUND_REGISTRY.Menu_Click1.volume;
  hoverAudio.volume = SOUND_REGISTRY.Menu_Hover1.volume;
  setupCompleteAudio.volume = SOUND_REGISTRY.Menu_SetupComlete1.volume;
  let unlocked = false;
  const play = (audio) => {
    audio.currentTime = 0;
    audio.play()?.catch?.(() => {});
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
    dispose() {
      root.removeEventListener("click", handleClick, true);
      root.removeEventListener("mousemove", handleMouseMove);
      clickAudio.pause?.();
      hoverAudio.pause?.();
    },
  };
}

function updatePreflightScale(overlay, viewportWidth, viewportHeight) {
  overlay?.style.setProperty("--preflight-scale", String(getPreflightScale(viewportWidth, viewportHeight)));
}

function getShortGpuName(renderer) {
  const text = String(renderer);
  const intel = text.match(/Intel(?:\(R\))?\s+(?:HD|UHD|Iris)[^,(]*/i);
  if (intel) return intel[0].replace(/\s+/g, " ").trim();
  const nvidia = text.match(/NVIDIA\s+GeForce\s+[^,(]*/i);
  if (nvidia) return nvidia[0].trim();
  const amd = text.match(/(?:AMD\s+)?Radeon\s+[^,(]*/i);
  if (amd) return amd[0].trim();
  return text.replace(/^ANGLE\s*\(/i, "").split(",")[0].trim();
}

function getWindowsGuide(version, language) {
  const guides = {
    en: {
      11: [
        "Press Win + I → System → Display → Graphics.",
        "Under “Custom settings for applications”, choose “Add desktop app” and click Browse.",
        "Select the EXE file of the browser you are using.",
        "When the browser appears in the list, open Options → High performance → Save.",
        "Fully close every browser window, then start it again.",
      ],
      10: [
        "Press Win + I → System → Display → Graphics settings.",
        "Under “Choose an app to set preference”, select Desktop app → Browse.",
        "Select the EXE file of the browser you are using.",
        "Select the added browser → Options → High performance → Save, then restart it.",
      ],
      7: ["Open NVIDIA Control Panel or AMD Catalyst Control Center.", "Find application graphics settings.", "Assign the browser to the high-performance GPU."],
      xp: ["Politely inform Windows XP that hybrid graphics exist now.", "Install a newer Windows.", "Return when the control room stops using Internet Explorer 6."],
    },
    ru: {
      11: [
        "Нажмите Win + I → Система → Дисплей → Графика.",
        "В разделе пользовательских параметров приложений выберите «Добавить классическое приложение / Add desktop app» и нажмите «Обзор / Browse».",
        "Выберите EXE-файл браузера, которым вы сейчас пользуетесь.",
        "Нажмите на добавленный браузер → Параметры → Высокая производительность → Сохранить.",
        "Полностью закройте все окна браузера и запустите его снова.",
      ],
      10: [
        "Нажмите Win + I → Система → Дисплей → Настройки графики.",
        "В «Выберите приложение для настройки» укажите «Классическое приложение» → Обзор.",
        "Выберите EXE-файл используемого браузера.",
        "Выберите добавленный браузер → Параметры → Высокая производительность → Сохранить и перезапустите браузер.",
      ],
      7: ["Откройте NVIDIA Control Panel или AMD Catalyst Control Center.", "Найдите настройки графики для приложений.", "Назначьте браузеру производительную видеокарту."],
      xp: ["Спокойно объясните Windows XP, что гибридные видеокарты уже существуют.", "Установите Windows поновее.", "Возвращайтесь, когда диспетчерская перестанет запускать Internet Explorer 6."],
    },
  };
  const steps = guides[language]?.[version] ?? guides.en[version];
  return `<ol>${steps.map((step) => `<li>${step}</li>`).join("")}</ol>`;
}

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null;
  }
}

function saveAppQualitySettings(profile) {
  let settings = {};
  try {
    settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
  } catch {
    settings = {};
  }
  const shadows = getGraphicsQualityProfile(profile).shadowQuality;
  const gtao = getGraphicsQualityProfile(profile).gtaoQuality;
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...settings,
      shadowQuality: shadows,
      gtaoQuality: gtao,
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

function preloadFirstRunAssets() {
  const criticalAssets = [
    "assets/mesh/panel/SM_Panel1.glb",
    "assets/mesh/environment/SM_Interior1_1.glb",
    "assets/mesh/prefabs/SM_DoorBulk1.glb",
    "assets/mesh/prefabs/SM_Lamp_BulkRed.glb",
    "assets/runtime-textures/T_Panel1_BaseColor_Critical_Preview_1024_ETC1S.ktx2",
    "assets/runtime-textures/T_Panel1_Normal_Critical_Preview_1024_ETC1S.ktx2",
    "assets/runtime-textures/T_Panel1_OcclusionRoughnessMetallic_Critical_Preview_1024_ETC1S.ktx2",
    ...Object.values(QUALITY_PREVIEWS),
  ];
  criticalAssets.forEach((url) => {
    fetch(url, { cache: "force-cache", priority: "low" }).catch(() => {});
  });
}
