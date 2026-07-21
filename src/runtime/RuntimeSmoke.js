export async function runLevelRuntimeSmoke(gameApi) {
  const steps = [];
  await runStep("intro-shift", () =>
    gameApi.startLevel({ levelId: "intro-shift", mode: "tutorial" }),
  );
  await runStep("exploring-around", () =>
    gameApi.startLevel({ levelId: "exploring-around", mode: "tutorial" }),
    [
      "exploring-around:fluorescentLamp_PowerHall1",
      "exploring-around:fluorescentLamp_PowerHall2",
      "exploring-around:redBulkLamp_Exit1",
    ],
  );
  await runStep("menu-preview", () => gameApi.resetForMenu());
  return { ok: true, steps };

  async function runStep(name, action, expectedPrefabs = []) {
    const completed = await action();
    if (completed === false) throw new Error(`[RuntimeSmoke] ${name} was superseded`);
    const state = gameApi.inspectRuntime();
    const expectedEnvironment = name === "menu-preview" ? "intro-shift" : name;
    assertEqual(state.loadedRuntimeLevelId, expectedEnvironment, `${name}: loaded runtime`);
    assertOwnedKeys(state.environmentRoots, expectedEnvironment, `${name}: environment roots`);
    assertOwnedKeys(state.collisionLevels, expectedEnvironment, `${name}: collision levels`);
    assertOwnedKeys(state.prefabInstances, expectedEnvironment, `${name}: prefab instances`);
    expectedPrefabs.forEach((key) => {
      if (!state.prefabInstances.includes(key)) {
        throw new Error(`[RuntimeSmoke] ${name}: missing prefab marker instance "${key}"`);
      }
    });
    assertEqual(state.physics?.activeSceneKey, expectedEnvironment, `${name}: physics scene`);
    if (name === "menu-preview") {
      assertEqual(state.levelSession, null, `${name}: level session reset`);
    } else {
      assertEqual(state.levelSession?.levelId, name, `${name}: level session`);
    }
    steps.push({
      name,
      loadedRuntimeLevelId: state.loadedRuntimeLevelId,
      environmentRoots: state.environmentRoots,
      collisionLevels: state.collisionLevels,
      prefabCount: state.prefabInstances.length,
      physics: state.physics,
    });
  }
}

function assertOwnedKeys(keys, expectedLevelId, label) {
  if (!keys?.length || keys.some((key) => String(key).split(":")[0] !== expectedLevelId)) {
    throw new Error(`[RuntimeSmoke] ${label} contains foreign or missing entries: ${JSON.stringify(keys)}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`[RuntimeSmoke] ${label}: expected ${expected}, received ${actual}`);
  }
}
