const SETTINGS_STORAGE_KEY = "operatorGame.settings.v1";
const PROGRESS_STORAGE_KEY = "operatorGame.progress.v1";
const PREFLIGHT_STORAGE_KEY = "operatorGame.preflight.v1";
const PREFLIGHT_RETURN_TO_MENU_KEY = "operatorGame.preflight.returnToMenu";
const DEVELOPMENT_NOTICE_STORAGE_KEY = "operatorGame.developmentNotice.v1";
const LEVEL_RIGID_BODIES_STORAGE_KEY = "operatorGame.levelRigidBodies.v1";

const DEFAULT_SETTINGS = Object.freeze({
  fov: 72,
  uiScale: 100,
  shadowQuality: "min",
  gtaoQuality: "off",
  ssgiQuality: "off",
  ssrQuality: "off",
  screenSpaceShadowQuality: "off",
  sensitivity: 100,
  qualityProfile: null,
  renderScale: 100,
  gamma: null,
  antiAliasing: null,
  masterVolume: 100,
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
  clearLevelRigidBodyStorage(storage);
  Object.keys(session)
    .filter((key) => key.startsWith("operatorGame.levelSession."))
    .forEach((key) => session.removeItem(key));
}

export function loadLevelRigidBodyStates(storage = getLocalStorage()) {
  try {
    const parsed = JSON.parse(storage.getItem(LEVEL_RIGID_BODIES_STORAGE_KEY) ?? "{}");
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed)
      .filter(([, states]) => isRecord(states))
      .map(([levelId, states]) => [levelId, normalizeRigidBodyStates(states)]));
  } catch {
    return {};
  }
}

export function saveLevelRigidBodyStates(levelId, states, storage = getLocalStorage()) {
  const normalizedLevelId = String(levelId ?? "").trim();
  if (!normalizedLevelId) return false;
  const allStates = loadLevelRigidBodyStates(storage);
  const normalizedStates = normalizeRigidBodyStates(states);
  if (Object.keys(normalizedStates).length) {
    allStates[normalizedLevelId] = { ...(allStates[normalizedLevelId] ?? {}), ...normalizedStates };
  }
  else delete allStates[normalizedLevelId];
  storage.setItem(LEVEL_RIGID_BODIES_STORAGE_KEY, JSON.stringify(allStates));
  return true;
}

export function clearLevelRigidBodyStorage(storage = getLocalStorage()) {
  storage.removeItem(LEVEL_RIGID_BODIES_STORAGE_KEY);
}

export function clearLevelRigidBodyStates(levelId, storage = getLocalStorage()) {
  const normalizedLevelId = String(levelId ?? "").trim();
  if (!normalizedLevelId) return false;
  const allStates = loadLevelRigidBodyStates(storage);
  if (!(normalizedLevelId in allStates)) return false;
  delete allStates[normalizedLevelId];
  storage.setItem(LEVEL_RIGID_BODIES_STORAGE_KEY, JSON.stringify(allStates));
  return true;
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

export function shouldShowDevelopmentNotice(storage = localStorage) {
  return storage.getItem(PREFLIGHT_STORAGE_KEY) == null
    && storage.getItem(DEVELOPMENT_NOTICE_STORAGE_KEY) !== "1";
}

export function acknowledgeDevelopmentNotice(storage = localStorage) {
  storage.setItem(DEVELOPMENT_NOTICE_STORAGE_KEY, "1");
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
    qualityProfile: normalizeQuality(source.qualityProfile, ["low", "medium", "high", "ultra"], null),
    renderScale: clampNumber(source.renderScale, 50, 150, DEFAULT_SETTINGS.renderScale),
    gamma: source.gamma == null ? null : clampNumber(source.gamma, 0.75, 1.25, 0.93),
    antiAliasing: normalizeQuality(source.antiAliasing, ["fxaa", "smaa", "msaa4", "msaa8"], null),
    masterVolume: clampNumber(source.masterVolume, 0, 100, DEFAULT_SETTINGS.masterVolume),
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

function normalizeRigidBodyStates(source) {
  if (!isRecord(source)) return {};
  return Object.fromEntries(Object.entries(source)
    .map(([id, state]) => [String(id).trim(), normalizeRigidBodyState(state)])
    .filter(([id, state]) => id && state));
}

function normalizeRigidBodyState(source) {
  if (!isRecord(source)) return null;
  const position = normalizeVector3(source.position);
  const rotation = normalizeQuaternion(source.rotation);
  if (!position || !rotation) return null;
  return {
    position,
    rotation,
    linearVelocity: normalizeVector3(source.linearVelocity) ?? { x: 0, y: 0, z: 0 },
    angularVelocity: normalizeVector3(source.angularVelocity) ?? { x: 0, y: 0, z: 0 },
    sleeping: Boolean(source.sleeping),
  };
}

function normalizeVector3(source) {
  if (!isRecord(source)) return null;
  const vector = { x: Number(source.x), y: Number(source.y), z: Number(source.z) };
  return Object.values(vector).every(Number.isFinite) ? vector : null;
}

function normalizeQuaternion(source) {
  if (!isRecord(source)) return null;
  const quaternion = { x: Number(source.x), y: Number(source.y), z: Number(source.z), w: Number(source.w) };
  return Object.values(quaternion).every(Number.isFinite) ? quaternion : null;
}

function getLocalStorage() {
  return globalThis.localStorage ?? EMPTY_STORAGE;
}

const EMPTY_STORAGE = Object.freeze({
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});
