const SETTINGS_STORAGE_KEY = "operatorGame.settings.v1";
const PROGRESS_STORAGE_KEY = "operatorGame.progress.v1";
const PREFLIGHT_STORAGE_KEY = "operatorGame.preflight.v1";
const PREFLIGHT_RETURN_TO_MENU_KEY = "operatorGame.preflight.returnToMenu";

const DEFAULT_SETTINGS = Object.freeze({
  fov: 72,
  uiScale: 100,
  shadowQuality: "min",
  gtaoQuality: "off",
  ssgiQuality: "off",
  ssrQuality: "off",
  screenSpaceShadowQuality: "off",
  sensitivity: 100,
});

export function createEmptyProgress() {
  return { finishedLevels: {}, completedLevels: {} };
}

export function loadProgress(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY) ?? "{}");
    return {
      finishedLevels: isRecord(parsed.finishedLevels) ? parsed.finishedLevels : {},
      completedLevels: isRecord(parsed.completedLevels) ? parsed.completedLevels : {},
    };
  } catch {
    return createEmptyProgress();
  }
}

export function saveProgress(progress, storage = localStorage) {
  storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
}

export function clearProgressStorage(storage = localStorage, session = sessionStorage) {
  storage.removeItem(PROGRESS_STORAGE_KEY);
  Object.keys(session)
    .filter((key) => key.startsWith("operatorGame.levelSession."))
    .forEach((key) => session.removeItem(key));
}

export function loadSettings(storage = localStorage) {
  try {
    return normalizeSettings(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? "{}"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings, storage = localStorage) {
  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalizeSettings(settings)));
}

export function clearPreflightStorage(storage = localStorage) {
  storage.removeItem(PREFLIGHT_STORAGE_KEY);
}

export function requestReturnToMenuAfterPreflight(storage = sessionStorage) {
  storage.setItem(PREFLIGHT_RETURN_TO_MENU_KEY, "1");
}

export function normalizeSettings(source = {}) {
  return {
    fov: clampNumber(source.fov, 55, 95, DEFAULT_SETTINGS.fov),
    uiScale: clampNumber(source.uiScale, 80, 130, DEFAULT_SETTINGS.uiScale),
    shadowQuality: normalizeQuality(source.shadowQuality, ["off", "min", "med", "max"], "min"),
    gtaoQuality: normalizeQuality(source.gtaoQuality, ["off", "min", "med", "max"], "off"),
    ssgiQuality: normalizeQuality(source.ssgiQuality, ["off", "min", "med", "max"], "off"),
    ssrQuality: normalizeQuality(source.ssrQuality, ["off", "min", "med", "max"], "off"),
    screenSpaceShadowQuality: normalizeQuality(
      source.screenSpaceShadowQuality,
      ["off", "min", "med", "max"],
      "off",
    ),
    sensitivity: clampNumber(source.sensitivity, 40, 180, DEFAULT_SETTINGS.sensitivity),
  };
}

function normalizeQuality(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
