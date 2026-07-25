import { LevelRuntime } from "./LevelRuntime.js?v=exploring-exit-objective";

export class LevelEnvironmentLifecycle {
  constructor({
    environments,
    lighting,
    sceneBuilder,
    disposeOwned,
    rebuildStaticPhysics,
    rebuildDebugPanels,
    updateActiveEnvironment,
  }) {
    Object.assign(this, {
      environments,
      lighting,
      sceneBuilder,
      disposeOwned,
      rebuildStaticPhysics,
      rebuildDebugPanels,
      updateActiveEnvironment,
    });
  }

  async load(levelId) {
    const loadStarted = nowMilliseconds();
    const environment = this.environments?.[levelId];
    if (!environment) throw new Error(`[LevelRuntime] Unknown environment: ${levelId}`);
    const runtime = new LevelRuntime(levelId);
    runtime.defer(() => this.disposeOwned(levelId));
    this.lighting.createLevel(levelId, environment.lighting);
    try {
      const prefabCountBeforeBuild = environment.prefabs?.length ?? 0;
      const buildStarted = nowMilliseconds();
      await this.sceneBuilder.build(runtime, levelId, environment);
      const buildMs = nowMilliseconds() - buildStarted;
      const physicsStarted = nowMilliseconds();
      this.rebuildStaticPhysics(levelId);
      const physicsMs = nowMilliseconds() - physicsStarted;
      if ((environment.prefabs?.length ?? 0) !== prefabCountBeforeBuild) this.rebuildDebugPanels();
      this.updateActiveEnvironment();
      console.log(`[LevelRuntime] Loaded only: ${levelId}`);
      console.info(`[LevelLoadTiming] ${levelId}: total=${(nowMilliseconds() - loadStarted).toFixed(1)}ms build=${buildMs.toFixed(1)}ms physics=${physicsMs.toFixed(1)}ms`);
      return runtime.activate();
    } catch (error) {
      try {
        await runtime.dispose();
      } catch (cleanupError) {
        console.error(`[LevelRuntime] Cleanup failed after loading "${levelId}"`, cleanupError);
      }
      throw error;
    }
  }

  dispose(runtime) {
    return runtime.dispose();
  }
}

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}
