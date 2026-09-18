import { getGraphicsQualityProfile } from "../../config/GraphicsQualityProfiles.js?v=bundled-ui-fonts";

const RANGE_CONTROLS = [
  { key: "fov", input: "#settingFov", value: "#settingFovValue", format: String },
  { key: "uiScale", input: "#settingUiScale", value: "#settingUiScaleValue", format: (value) => `${value}%` },
  { key: "sensitivity", input: "#settingSensitivity", value: "#settingSensitivityValue", format: (value) => `${value}%` },
  { key: "gamma", input: "#settingGamma", value: "#settingGammaValue", format: (value) => `${Math.round(value / 0.93 * 100)}%` },
  { key: "masterVolume", input: "#settingMasterVolume", value: "#settingMasterVolumeValue", format: (value) => `${value}%` },
];

export function createSettingsPanel({ settings, gameApi, save, root = document, body = document.body }) {
  const panel = root.querySelector("#settingsPanel");
  const ranges = RANGE_CONTROLS.map((control) => ({
    ...control, input: root.querySelector(control.input), value: root.querySelector(control.value),
  }));
  const tabs = [...(panel?.querySelectorAll("[data-settings-tab]") ?? [])];
  const pages = [...(panel?.querySelectorAll("[data-settings-page]") ?? [])];
  const choices = [...(panel?.querySelectorAll("[data-setting-key]") ?? [])];
  let activeTab = "graphics";
  let wired = false;

  function initialize() {
    const boot = globalThis.window?.operatorGameBootOptions ?? {};
    settings.qualityProfile ??= boot.qualityProfile ?? "high";
    settings.gamma ??= boot.displayGamma ?? 0.93;
    settings.antiAliasing ??= defaultAntiAliasing(settings.qualityProfile);
  }

  function wire() {
    if (wired) return;
    wired = true;
    ranges.forEach(({ key, input }) => input?.addEventListener("input", () => {
      settings[key] = Number(input.value);
      apply();
      save(settings);
    }));
    tabs.forEach((tab) => tab.addEventListener("click", () => selectTab(tab.dataset.settingsTab)));
    choices.forEach((group) => group.addEventListener("click", (event) => {
      const button = event.target.closest?.("[data-setting-value]");
      if (!button || !group.contains(button)) return;
      const key = group.dataset.settingKey;
      const value = key === "renderScale" ? Number(button.dataset.settingValue) : button.dataset.settingValue;
      if (settings[key] === value) return;
      settings[key] = value;
      if (key === "qualityProfile") {
        const profile = getGraphicsQualityProfile(value);
        settings.shadowQuality = profile.shadowQuality;
        settings.gtaoQuality = profile.gtaoQuality;
        settings.antiAliasing = defaultAntiAliasing(value);
        gameApi.applyQualityProfile?.(value);
      }
      apply();
      save(settings);
    }));
  }

  function selectTab(name) {
    activeTab = pages.some((page) => page.dataset.settingsPage === name) ? name : "graphics";
    tabs.forEach((tab) => {
      const selected = tab.dataset.settingsTab === activeTab;
      tab.classList.toggle("is-active", selected);
      tab.setAttribute("aria-current", selected ? "page" : "false");
    });
    pages.forEach((page) => { page.hidden = page.dataset.settingsPage !== activeTab; });
    const title = tabs.find((tab) => tab.dataset.settingsTab === activeTab)?.textContent?.trim() ?? activeTab.toUpperCase();
    const breadcrumb = panel?.querySelector("[data-settings-breadcrumb]");
    if (breadcrumb) breadcrumb.textContent = `SYSTEM SETTINGS / ${title}`;
  }

  function updateMetrics() {
    const metrics = gameApi.getGraphicsMetrics?.() ?? {};
    const fps = root.querySelector("#settingFpsValue");
    const resolution = root.querySelector("#settingRenderResValue");
    if (fps) fps.textContent = metrics.fps > 0 ? String(Math.round(metrics.fps)) : "N/A";
    if (resolution) resolution.textContent = metrics.width && metrics.height
      ? `${metrics.width} × ${metrics.height}` : "—";
  }

  function apply() {
    initialize();
    ranges.forEach(({ key, input, value, format }) => {
      if (input && String(input.value) !== String(settings[key])) input.value = String(settings[key]);
      if (input) {
        const span = Number(input.max) - Number(input.min);
        const fill = span > 0 ? (Number(settings[key]) - Number(input.min)) / span * 100 : 0;
        input.style.setProperty("--settings-fill", `${Math.max(0, Math.min(100, fill))}%`);
      }
      if (value) value.textContent = format(settings[key]);
    });
    choices.forEach((group) => group.querySelectorAll("[data-setting-value]").forEach((button) => {
      const selected = String(settings[group.dataset.settingKey]) === button.dataset.settingValue;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }));
    const scaleMirror = root.querySelector("#settingUiScaleMirror");
    if (scaleMirror) scaleMirror.textContent = `${settings.uiScale}%`;
    body.style.setProperty("--ui-scale", String(settings.uiScale / 100));
    gameApi.setBaseFov?.(settings.fov);
    gameApi.setMouseSensitivity?.(settings.sensitivity / 100);
    gameApi.setRenderScale?.(settings.renderScale);
    gameApi.setDisplayGamma?.(settings.gamma);
    gameApi.setAntiAliasingMode?.(settings.antiAliasing);
    gameApi.setMasterVolume?.(settings.masterVolume);
    gameApi.setShadowQuality?.(settings.shadowQuality);
    gameApi.setGtaoQuality?.(settings.gtaoQuality);
    gameApi.setSsgiQuality?.(settings.ssgiQuality);
    gameApi.setSsrQuality?.(settings.ssrQuality);
    gameApi.setScreenSpaceShadowQuality?.(settings.screenSpaceShadowQuality);
    updateMetrics();
  }

  function show() {
    selectTab(activeTab);
    updateMetrics();
  }

  return { wire, apply, show };
}

export function defaultAntiAliasing(profile) {
  if (profile === "ultra") return "msaa8";
  if (profile === "high") return "smaa";
  return "fxaa";
}

export function qualityLabel(value) {
  return String(value).toUpperCase();
}
