import test from "node:test";
import assert from "node:assert/strict";

import {
  acknowledgeDevelopmentNotice,
  clearProgressStorage,
  clearPersistentRigidBodyStorage,
  createEmptyProgress,
  loadPersistentRigidBodyStates,
  loadProgress,
  loadSettings,
  requestReturnToMenuAfterPreflight,
  saveProgress,
  savePersistentRigidBodyStates,
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

test("app persistence allows display gamma up to 150 percent", () => {
  const storage = createStorage({
    "operatorGame.settings.v1": JSON.stringify({ gamma: 2 }),
  });
  assert.equal(loadSettings(storage).gamma, 1.395);
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

test("persistent rigid body transforms are global complex state and cleared with progress", () => {
  const storage = createStorage();
  savePersistentRigidBodyStates({
    Lamp01: {
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      linearVelocity: { x: 0.1, y: 0, z: 0 },
      angularVelocity: { x: 0, y: 0.2, z: 0 },
      sleeping: true,
    },
  }, storage);
  savePersistentRigidBodyStates({
    Pipe01: {
      position: { x: 5, y: 6, z: 7 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
    },
  }, storage);
  assert.deepEqual(Object.keys(loadPersistentRigidBodyStates(storage)), ["Lamp01", "Pipe01"]);

  clearProgressStorage(storage, {});
  assert.deepEqual(loadPersistentRigidBodyStates(storage), {});
  clearPersistentRigidBodyStorage(storage);
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
