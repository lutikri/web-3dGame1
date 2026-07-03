const STORAGE_KEY = "operatorGame.preflight.v1";
const SETTINGS_KEY = "operatorGame.settings.v1";

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
    guideText:
      "Windows: Settings → System → Display → Graphics → add Chrome/Edge → Options → High performance. Restart the browser and run detection again.",
    close: "BACK",
    restart: "RESTART BROWSER",
    closeManually: "Close and restart the browser manually.",
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
    guideText:
      "Windows: Параметры → Система → Дисплей → Графика → добавьте Chrome/Edge → Параметры → Высокая производительность. Перезапустите браузер и повторите проверку.",
    close: "НАЗАД",
    restart: "ПЕРЕЗАПУСТИТЬ БРАУЗЕР",
    closeManually: "Закройте и перезапустите браузер вручную.",
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
      return { firstRun: false, language: saved.language, profile: saved.profile };
    }

    overlay = createOverlay();
    document.body.append(overlay);
    preloadFirstRunAssets();
    language = await chooseLanguage();
    document.documentElement.lang = language;
    gpuInfo = probeGraphics();
    showGpuCheck();
    return { firstRun: true, language, profile: "low" };
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

  function complete(profile) {
    selectedProfile = profile;
    saved = { language, profile, gpu: gpuInfo?.renderer ?? "Unknown", measuredAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    saveAppQualitySettings(profile);
    window.operatorGameBootOptions.qualityProfile = profile;
    window.operatorGameBootOptions.deferFullTextures = false;
    window.operatorGameBootOptions.disableFullTextures = profile === "low";
    remove();
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
      <p class="preflight-close-note" data-close-note></p>
      <div class="preflight-language-actions">
        <button type="button" data-restart-browser>${copy.restart}</button>
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
    guide.querySelector("[data-restart-browser]").addEventListener("click", () => {
      window.close();
      guide.querySelector("[data-close-note]").textContent = copy.closeManually;
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
        ${["low", "medium", "high"].map((profile) => qualityCard(profile, recommendation, estimates[profile], copy, benchmark)).join("")}
      </div>
      <button class="preflight-apply" type="button" data-apply-profile>${copy.apply} ${recommendation.toUpperCase()}</button>`;

    panel.querySelectorAll("[data-profile]").forEach((button) => {
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

  return { prepare, chooseProfile, complete, remove };
}

function qualityCard(profile, recommendation, fps, copy, benchmark) {
  const [title, description] = copy[profile];
  const preview = benchmark?.previews?.[`PROFILE ${profile.toUpperCase()}`];
  const previewStyle = preview ? ` style="background-image:url('${preview}')"` : "";
  return `<button type="button" class="preflight-quality-card ${profile === recommendation ? "is-selected" : ""}" data-profile="${profile}">
    <span class="preflight-quality-preview is-${profile}"${previewStyle}></span>
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
  const shadows = profile === "high" ? "min" : "off";
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      ...settings,
      shadowQuality: shadows,
      gtaoQuality: "off",
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
  ];
  criticalAssets.forEach((url) => {
    fetch(url, { cache: "force-cache", priority: "low" }).catch(() => {});
  });
}
