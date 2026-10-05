import { AUDIO_CATEGORY_SETTINGS } from "../audio/AudioCategorySettings.js?v=compact-loading-game";

const SETTINGS_STORAGE_KEY = "operatorGame.settings.v1";
const PROGRESS_STORAGE_KEY = "operatorGame.progress.v1";
const PREFLIGHT_STORAGE_KEY = "operatorGame.preflight.v1";
const PREFLIGHT_RETURN_TO_MENU_KEY = "operatorGame.preflight.returnToMenu";
const DEVELOPMENT_NOTICE_STORAGE_KEY = "operatorGame.developmentNotice.v1";
const RIGID_BODIES_STORAGE_KEY = "operatorGame.rigidBodies.v2";
const LEGACY_LEVEL_RIGID_BODIES_STORAGE_KEY = "operatorGame.levelRigidBodies.v1";

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
  ...Object.fromEntries(AUDIO_CATEGORY_SETTINGS.map(({ key }) => [key, 100])),
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
  clearPersistentRigidBodyStorage(storage);
  Object.keys(session)
    .filter((key) => key.startsWith("operatorGame.levelSession."))
    .forEach((key) => session.removeItem(key));
}

// Persistent props are world state, not shift-local save state. A stable authored
// rigid ID therefore represents the same physical object wherever the complex
// is presented by a shift.
export function loadPersistentRigidBodyStates(storage = getLocalStorage()) {
  try {
    const serialized = storage.getItem(RIGID_BODIES_STORAGE_KEY);
    if (serialized == null) return migrateLegacyRigidBodyStates(storage);
    const current = JSON.parse(serialized);
    if (isRecord(current)) return normalizeRigidBodyStates(current);
    return migrateLegacyRigidBodyStates(storage);
  } catch {
    return migrateLegacyRigidBodyStates(storage);
  }
}

export function savePersistentRigidBodyStates(states, storage = getLocalStorage()) {
  const allStates = loadPersistentRigidBodyStates(storage);
  const normalizedStates = normalizeRigidBodyStates(states);
  if (Object.keys(normalizedStates).length) {
    Object.assign(allStates, normalizedStates);
  }
  storage.setItem(RIGID_BODIES_STORAGE_KEY, JSON.stringify(allStates));
  return true;
}

export function clearPersistentRigidBodyStorage(storage = getLocalStorage()) {
  storage.removeItem(RIGID_BODIES_STORAGE_KEY);
  storage.removeItem(LEGACY_LEVEL_RIGID_BODIES_STORAGE_KEY);
}

export function clearPersistentRigidBodyStates(ids, storage = getLocalStorage()) {
  const allStates = loadPersistentRigidBodyStates(storage);
  const normalizedIds = [...new Set((ids ?? []).map((id) => String(id ?? "").trim()).filter(Boolean))];
  const changed = normalizedIds.some((id) => id in allStates);
  normalizedIds.forEach((id) => delete allStates[id]);
  storage.setItem(RIGID_BODIES_STORAGE_KEY, JSON.stringify(allStates));
  return changed;
}

function migrateLegacyRigidBodyStates(storage) {
  try {
    const legacy = JSON.parse(storage.getItem(LEGACY_LEVEL_RIGID_BODIES_STORAGE_KEY) ?? "{}");
    if (!isRecord(legacy)) return {};
    // The old data was level-scoped. Preserve it as a best-effort migration;
    // if a prop appeared in several shifts, the most recently stored entry wins.
    return Object.values(legacy).reduce((states, levelStates) => ({
      ...states,
      ...normalizeRigidBodyStates(levelStates),
    }), {});
  } catch {
    return {};
  }
}

// Compatibility aliases for older callers. New runtime code must use the
// persistent/world-state names above.
export const loadLevelRigidBodyStates = loadPersistentRigidBodyStates;
export function saveLevelRigidBodyStates(_levelId, states, storage = getLocalStorage()) {
  return savePersistentRigidBodyStates(states, storage);
}
export const clearLevelRigidBodyStorage = clearPersistentRigidBodyStorage;
export function clearLevelRigidBodyStates(_levelId, storage = getLocalStorage()) {
  return clearPersistentRigidBodyStorage(storage);
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
    gamma: source.gamma == null ? null : clampNumber(source.gamma, 0.75, 1.395, 0.93),
    antiAliasing: normalizeQuality(source.antiAliasing, ["fxaa", "smaa", "msaa4", "msaa8"], null),
    masterVolume: clampNumber(source.masterVolume, 0, 100, DEFAULT_SETTINGS.masterVolume),
    ...Object.fromEntries(AUDIO_CATEGORY_SETTINGS.map(({ key }) => [
      key, clampNumber(source[key] ?? DEFAULT_SETTINGS[key], 0, 100, DEFAULT_SETTINGS[key]),
    ])),
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
