import { LevelRuntime } from "./LevelRuntime.js?v=prototype-flow-1";

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
    const environment = this.environments?.[levelId];
    if (!environment) throw new Error(`[LevelRuntime] Unknown environment: ${levelId}`);
    const runtime = new LevelRuntime(levelId);
    runtime.defer(() => this.disposeOwned(levelId));
    this.lighting.createLevel(levelId, environment.lighting);
    try {
      const prefabCountBeforeBuild = environment.prefabs?.length ?? 0;
      await this.sceneBuilder.build(runtime, levelId, environment);
      this.rebuildStaticPhysics(levelId);
      if ((environment.prefabs?.length ?? 0) !== prefabCountBeforeBuild) this.rebuildDebugPanels();
      this.updateActiveEnvironment();
      console.log(`[LevelRuntime] Loaded only: ${levelId}`);
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
