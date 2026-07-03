import { getGraphicsQualityProfile } from "../config/GraphicsQualityProfiles.js";

const STORAGE_KEY = "operatorGame.preflight.v1";
const SETTINGS_KEY = "operatorGame.settings.v1";
const QUALITY_PREVIEWS = {
  low: "assets/img-performance/set-min.jpg",
  medium: "assets/img-performance/set-med.jpg",
  high: "assets/img-performance/set-max.jpg",
};

const COPY = {
  en: {
    checking: "CHECKING GRAPHICS PERFORMANCE",
    gpu: "BROWSER GPU",
    integrated: "DO YOU HAVE AMD / NVIDIA GRAPHICS?",
    guide: "HOW TO SWITCH GPU",
    continue: "THIS IS FINE",
    confirmed: "ALL GOOD",
    testing: "TESTING PERFORMANCE",
    testComplete: "PERFORMANCE TEST COMPLETE",
    result: "GRAPHICS CALIBRATION COMPLETE",
    recommended: "RECOMMENDED",
    measured: "Measured at the current window size",
    choose: "Choose a graphics profile",
    low: ["LOW", "FASTEST"],
    medium: ["MEDIUM", "BALANCED"],
    high: ["HIGH", "FULL EFFECTS"],
    apply: "APPLY",
    brightnessTitle: "DISPLAY BRIGHTNESS",
    brightnessHint: "Move the slider until the left bar merges with the black frame. The second bar should be barely visible.",
    brightnessControl: "GAME BRIGHTNESS",
    brightnessApply: "CONTINUE",
    setupComplete: "SETUP COMPLETE",
    setupAgain: "Run it again later: P → Settings → Setup Wizard.",
    okay: "OK",
  },
  ru: {
    checking: "ПРОВЕРКА ГРАФИЧЕСКОЙ ПРОИЗВОДИТЕЛЬНОСТИ",
    gpu: "ВИДЕОКАРТА БРАУЗЕРА",
    integrated: "У ВАС ЕСТЬ AMD / NVIDIA?",
    guide: "КАК ПЕРЕКЛЮЧИТЬ ВИДЕОКАРТУ",
    continue: "И ТАК СОЙДЁТ",
    confirmed: "ВСЁ ВЕРНО",
    testing: "ТЕСТИРУЕТСЯ ПРОИЗВОДИТЕЛЬНОСТЬ",
    testComplete: "ТЕСТ ПРОИЗВОДИТЕЛЬНОСТИ ЗАВЕРШЁН",
    result: "КАЛИБРОВКА ГРАФИКИ ЗАВЕРШЕНА",
    recommended: "РЕКОМЕНДУЕТСЯ",
    measured: "Измерено при текущем размере окна",
    choose: "Выберите профиль графики",
    low: ["LOW", "МАКСИМУМ FPS"],
    medium: ["MEDIUM", "БАЛАНС"],
    high: ["HIGH", "ВСЕ ЭФФЕКТЫ"],
    apply: "ПРИМЕНИТЬ",
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
  let benchmarkComplete = false;

  async function prepare() {
    if (saved?.profile) {
      document.documentElement.lang = saved.language;
      return {
        firstRun: false,
        language: saved.language,
        profile: saved.profile,
        displayGamma: saved.displayGamma ?? 0.93,
      };
    }

    overlay = createOverlay();
    document.body.append(overlay);
    preloadFirstRunAssets();
    language = await chooseLanguage();
    document.documentElement.lang = language;
    gpuInfo = probeGraphics();
    showGpuCheck();
    return { firstRun: true, language, profile: "low", displayGamma: 0.93 };
  }

  async function chooseProfile(benchmark) {
    markGpuBenchmarkComplete();
    await gpuContinuePromise;
    const mediumFps = getStableFps(findResult(benchmark, "PROFILE MEDIUM"), 30);
    const highFps = getStableFps(findResult(benchmark, "PROFILE HIGH"), 20);
    const recommendation = highFps >= 45 ? "high" : mediumFps >= 38 ? "medium" : "low";
    selectedProfile = recommendation;
    return new Promise((resolve) => showProfileChoice({ benchmark, recommendation, resolve }));
  }

  function complete(profile, displayGamma = 0.93, { removeOverlay = true } = {}) {
    const quality = getGraphicsQualityProfile(profile);
    selectedProfile = profile;
    saved = { language, profile, displayGamma, gpu: gpuInfo?.renderer ?? "Unknown", measuredAt: Date.now() };
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
          <button type="button" data-setup-ok>${copy.okay}</button>`;
        panel.querySelector("[data-setup-ok]").addEventListener("click", () => resolve(gamma), { once: true });
      }, { once: true });
    });
  }

  function remove() {
    overlay?.remove();
    overlay = null;
  }

  function createOverlay() {
    const element = document.createElement("div");
    element.className = "preflight-overlay";
    element.innerHTML = `<section class="preflight-panel" aria-live="polite"></section>`;
    return element;
  }

  function chooseLanguage() {
    const panel = getPanel();
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
    const integrated = /intel|uhd|iris|radeon graphics|vega/i.test(gpuInfo.renderer);
    const gpuName = getShortGpuName(gpuInfo.renderer);
    getPanel().innerHTML = `
      <h1>${copy.gpu}</h1>
      <strong class="preflight-gpu">${escapeHtml(gpuName)}</strong>
      ${integrated ? `<p class="preflight-warning">${copy.integrated}</p>` : ""}
      <div class="preflight-test-status" data-test-status>
        <span class="preflight-spinner"></span>
        <strong>${copy.testing}</strong>
      </div>
      <div class="preflight-language-actions">
        ${integrated ? `<button type="button" data-gpu-guide>${copy.guide}</button>` : ""}
        <button type="button" data-gpu-continue disabled>${integrated ? copy.continue : copy.confirmed}</button>
      </div>`;
    getPanel().querySelector("[data-gpu-guide]")?.addEventListener("click", showGpuGuide);
    gpuContinuePromise = new Promise((resolve) => {
      resolveGpuContinue = resolve;
    });
    getPanel().querySelector("[data-gpu-continue]").addEventListener("click", () => resolveGpuContinue?.(), { once: true });
  }

  function markGpuBenchmarkComplete() {
    const copy = COPY[language];
    benchmarkComplete = true;
    const status = getPanel().querySelector("[data-test-status]");
    if (status) status.innerHTML = `<strong>${copy.testComplete}</strong>`;
    overlay.querySelectorAll("[data-gpu-continue], [data-guide-continue]").forEach((button) => {
      button.disabled = false;
    });
  }

  function showGpuGuide() {
    const copy = COPY[language];
    const mainPanel = getPanel();
    mainPanel.hidden = true;
    overlay.querySelector(".preflight-guide-screen")?.remove();
    const guide = document.createElement("section");
    guide.className = "preflight-panel preflight-guide-screen";
    guide.innerHTML = `
      <div class="preflight-kicker">${copy.guide}</div>
      <h1>WINDOWS GPU SETUP</h1>
      <div class="preflight-os-tabs">
        ${["11", "10", "7", "xp"].map((version) => `<button type="button" data-windows="${version}">WINDOWS ${version.toUpperCase()}</button>`).join("")}
      </div>
      <div class="preflight-os-guide" data-os-guide></div>
      <div class="preflight-language-actions">
        <button type="button" data-guide-continue ${benchmarkComplete ? "" : "disabled"}>${copy.continue}</button>
      </div>`;
    overlay.append(guide);

    const showWindowsGuide = (version) => {
      guide.querySelector("[data-os-guide]").innerHTML = getWindowsGuide(version, language);
      guide.querySelectorAll("[data-windows]").forEach((button) => {
        button.classList.toggle("is-selected", button.dataset.windows === version);
      });
    };
    guide.querySelectorAll("[data-windows]").forEach((button) => {
      button.addEventListener("click", () => showWindowsGuide(button.dataset.windows));
    });
    guide.querySelector("[data-guide-continue]").addEventListener(
      "click",
      () => {
        guide.remove();
        mainPanel.hidden = false;
        resolveGpuContinue?.();
      },
      { once: true },
    );
    showWindowsGuide("11");
  }

  function showProfileChoice({ benchmark, recommendation, resolve }) {
    const copy = COPY[language];
    const lowResult = findResult(benchmark, "PROFILE LOW");
    const mediumResult = findResult(benchmark, "PROFILE MEDIUM");
    const highResult = findResult(benchmark, "PROFILE HIGH");
    const estimates = {
      low: estimateFps(lowResult, 30),
      medium: estimateFps(mediumResult, 25),
      high: estimateFps(highResult, 15),
    };
    const panel = getPanel();
    panel.innerHTML = `
      <div class="preflight-kicker">${copy.result}</div>
      <h1>${copy.choose}</h1>
      <p>${copy.measured}: ${window.innerWidth}×${window.innerHeight}</p>
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

  return { prepare, chooseProfile, calibrateBrightness, complete, finish, remove };
}

function qualityCard(profile, recommendation, fps, copy) {
  const [title, description] = copy[profile];
  const preview = QUALITY_PREVIEWS[profile];
  return `<button type="button" class="preflight-quality-card ${profile === recommendation ? "is-selected" : ""}" data-profile="${profile}" data-preview="${preview}">
    <span class="preflight-quality-preview is-${profile}" style="background-image:url('${preview}')"></span>
    <strong>${title}${profile === recommendation ? ` · ${copy.recommended}` : ""}</strong>
    <span>${description}</span>
    <em>${fps} FPS</em>
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

function estimateFps(result, fallback) {
  const average = Number(result?.avgFps) || fallback;
  const stable = getStableFps(result, fallback);
  if (average >= 120 && stable >= 75) return "120+";
  if (stable >= 60) return "60+";
  const conservative = Math.max(5, Math.min(120, stable * 0.9));
  return `~${Math.max(5, Math.round(conservative / 5) * 5)}`;
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
    "assets/Panel1.glb",
    "assets/Interior1_Panel1.glb",
    "assets/Interior1_Collision.glb",
    "assets/runtime-textures/T_Panel1_BaseColor_Critical_Preview_1024_ETC1S.ktx2",
    "assets/runtime-textures/T_Panel1_Normal_Critical_Preview_1024_ETC1S.ktx2",
    "assets/runtime-textures/T_Panel1_OcclusionRoughnessMetallic_Critical_Preview_1024_ETC1S.ktx2",
    ...Object.values(QUALITY_PREVIEWS),
  ];
  criticalAssets.forEach((url) => {
    fetch(url, { cache: "force-cache", priority: "low" }).catch(() => {});
  });
}
