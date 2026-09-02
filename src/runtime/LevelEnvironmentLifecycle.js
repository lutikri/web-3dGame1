import { LevelRuntime } from "./LevelRuntime.js?v=pause-full-texture-upgrades";

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
      console.info(formatLevelLoadTiming(
        levelId,
        nowMilliseconds() - loadStarted,
        buildMs,
        physicsMs,
        runtime.loadTimings,
      ));
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

function formatLevelLoadTiming(levelId, totalMs, buildMs, physicsMs, timings = {}) {
  const mb = (timings.assetBytes ?? 0) / (1024 * 1024);
  return `[LevelLoadTiming] ${levelId}: total=${totalMs.toFixed(1)}ms build=${buildMs.toFixed(1)}ms`
    + ` glbFetchSum=${(timings.glbFetchMs ?? 0).toFixed(1)}ms`
    + ` glbParseDracoSum=${(timings.glbParseDracoMs ?? 0).toFixed(1)}ms`
    + ` clone=${(timings.assetCloneMs ?? 0).toFixed(1)}ms`
    + ` environmentSetup=${(timings.environmentSetupMs ?? 0).toFixed(1)}ms`
    + ` collisionSetup=${(timings.collisionSetupMs ?? 0).toFixed(1)}ms`
    + ` prefabCreate=${(timings.prefabCreateMs ?? 0).toFixed(1)}ms`
    + ` prefabReady=${(timings.prefabReadyMs ?? 0).toFixed(1)}ms`
    + ` prefabSetup=${(timings.prefabSetupMs ?? 0).toFixed(1)}ms`
    + ` physics=${physicsMs.toFixed(1)}ms`
    + ` assets=${timings.assetRequests ?? 0}`
    + ` hits=${timings.assetCacheHits ?? 0}`
    + ` misses=${timings.assetCacheMisses ?? 0}`
    + ` fetched=${mb.toFixed(2)}MB`
    + ` slowestAsset=${JSON.stringify(timings.slowestAssetName ?? "")}`
    + ` slowestAssetTime=${(timings.slowestAssetMs ?? 0).toFixed(1)}ms`;
}

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}
