const CONTROL_DEFINITIONS = [
  { key: "fov", input: "#settingFov", value: "#settingFovValue", event: "input", format: String },
  { key: "uiScale", input: "#settingUiScale", value: "#settingUiScaleValue", event: "input", format: (value) => `${value}%` },
  { key: "shadowQuality", input: "#settingShadowQuality", value: "#settingShadowQualityValue", event: "change", format: qualityLabel },
  { key: "gtaoQuality", input: "#settingGtaoQuality", value: "#settingGtaoQualityValue", event: "change", format: qualityLabel },
  { key: "ssgiQuality", input: "#settingSsgiQuality", value: "#settingSsgiQualityValue", event: "change", format: qualityLabel },
  { key: "ssrQuality", input: "#settingSsrQuality", value: "#settingSsrQualityValue", event: "change", format: qualityLabel },
  { key: "screenSpaceShadowQuality", input: "#settingScreenSpaceShadowQuality", value: "#settingScreenSpaceShadowQualityValue", event: "change", format: qualityLabel },
  { key: "sensitivity", input: "#settingSensitivity", value: "#settingSensitivityValue", event: "input", format: (value) => `${value}%` },
];

const NUMERIC_KEYS = new Set(["fov", "uiScale", "sensitivity"]);

export function createSettingsPanel({ settings, gameApi, save, root = document, body = document.body }) {
  const controls = CONTROL_DEFINITIONS.map((definition) => ({
    ...definition,
    inputElement: root.querySelector(definition.input),
    valueElement: root.querySelector(definition.value),
  }));
  let wired = false;

  function wire() {
    if (wired) return;
    wired = true;
    controls.forEach((control) => {
      if (!control.inputElement) return;
      control.inputElement.addEventListener(control.event, () => {
        settings[control.key] = NUMERIC_KEYS.has(control.key)
          ? Number(control.inputElement.value)
          : control.inputElement.value;
        apply();
        save(settings);
      });
    });
  }

  function apply() {
    controls.forEach((control) => {
      const value = settings[control.key];
      if (control.valueElement) control.valueElement.textContent = control.format(value);
      if (control.inputElement && String(control.inputElement.value) !== String(value)) {
        control.inputElement.value = String(value);
      }
    });
    body.style.setProperty("--ui-scale", String(settings.uiScale / 100));
    gameApi.setBaseFov?.(settings.fov);
    gameApi.setShadowQuality?.(settings.shadowQuality);
    gameApi.setGtaoQuality?.(settings.gtaoQuality);
    gameApi.setSsgiQuality?.(settings.ssgiQuality);
    gameApi.setSsrQuality?.(settings.ssrQuality);
    gameApi.setScreenSpaceShadowQuality?.(settings.screenSpaceShadowQuality);
    gameApi.setMouseSensitivity?.(settings.sensitivity / 100);
  }

  return { wire, apply };
}

export function qualityLabel(value) {
  return ["off", "min", "med", "max"].includes(value) ? value.toUpperCase() : String(value).toUpperCase();
}
