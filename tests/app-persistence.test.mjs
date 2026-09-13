import test from "node:test";
import assert from "node:assert/strict";

import {
  acknowledgeDevelopmentNotice,
  clearProgressStorage,
  createEmptyProgress,
  loadProgress,
  loadSettings,
  requestReturnToMenuAfterPreflight,
  saveProgress,
  shouldShowDevelopmentNotice,
} from "../src/app/AppPersistence.js";

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    get values() {
      return values;
    },
  };
}

test("app persistence normalizes invalid settings", () => {
  const storage = createStorage({
    "operatorGame.settings.v1": JSON.stringify({ fov: 500, uiScale: "bad", shadowQuality: "ultra" }),
  });
  assert.deepEqual(loadSettings(storage), {
    fov: 95,
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
});

test("app progress persistence round-trips and clears level sessions", () => {
  const storage = createStorage();
  const progress = createEmptyProgress();
  progress.completedLevels["intro-shift"] = true;
  saveProgress(progress, storage);
  assert.deepEqual(loadProgress(storage), progress);

  const session = { "operatorGame.levelSession.intro-shift": "state", unrelated: "keep" };
  Object.defineProperty(session, "removeItem", { enumerable: false, value: (key) => delete session[key] });
  clearProgressStorage(storage, session);
  assert.equal(storage.values.has("operatorGame.progress.v1"), false);
  assert.equal(session["operatorGame.levelSession.intro-shift"], undefined);
  assert.equal(session.unrelated, "keep");
});

test("preflight rerun intent is owned by app persistence", () => {
  const storage = createStorage();
  requestReturnToMenuAfterPreflight(storage);
  assert.equal(storage.getItem("operatorGame.preflight.returnToMenu"), "1");
});

test("development notice is shown once before first preflight only", () => {
  const storage = createStorage();
  assert.equal(shouldShowDevelopmentNotice(storage), true);
  acknowledgeDevelopmentNotice(storage);
  assert.equal(shouldShowDevelopmentNotice(storage), false);
  assert.equal(shouldShowDevelopmentNotice(createStorage({ "operatorGame.preflight.v1": "{}" })), false);
});
