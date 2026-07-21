import { Octree } from "three/addons/math/Octree.js";
import { Fog } from "three";

export function createLevelEnvironmentActivation({
  config,
  scene,
  resolveEnvironmentId,
  getRequestedLevelId,
  getViewMode,
  environmentModels,
  collisionModels,
  prefabInstances,
  controlledLights,
  panelCollisionMeshes,
  getPanelRuntime,
  audio,
  physics,
  getDebugHub,
  getPanelConfig,
  setCollisionState,
  syncPlayerCapsule,
  resolvePlayerCollisions,
}) {
  function activate() {
    const requestedLevelId = getRequestedLevelId();
    const displayedLevelId = resolveEnvironmentId(requestedLevelId);
    const collisionVisible = Boolean(config.player?.collision?.show);
    applyWorldConfig(requestedLevelId);

    environmentModels.forEach((model, key) => {
      model.visible = key.split(":")[0] === displayedLevelId;
    });
    collisionModels.forEach((model, levelId) => {
      model.visible = levelId === displayedLevelId && collisionVisible;
    });
    prefabInstances.forEach((runtime, key) => {
      const visible = key.split(":")[0] === displayedLevelId && collisionVisible;
      runtime.collisionMeshes.forEach((mesh) => { mesh.visible = visible; });
    });
    controlledLights.forEach((light) => {
      light.visible = (light.userData.levelId ?? "default") === displayedLevelId;
    });
    getPanelRuntime().applyLevel(displayedLevelId, getViewMode());
    audio.setActiveLevel(displayedLevelId);
    getDebugHub()?.setActiveLevel?.(displayedLevelId);
    physics?.setActiveScene(displayedLevelId);

    const activeCollision = displayedLevelId && collisionModels.get(displayedLevelId);
    if (!activeCollision) return displayedLevelId;
    activeCollision.updateMatrixWorld(true);
    const octree = new Octree();
    octree.fromGraphNode(activeCollision);
    if (getPanelConfig(displayedLevelId)) {
      panelCollisionMeshes.forEach((mesh) => {
        mesh.visible = collisionVisible;
        octree.fromGraphNode(mesh);
      });
    }
    prefabInstances.forEach((runtime, key) => {
      if (!key.startsWith(`${displayedLevelId}:`) || runtime.collisionDisabled || runtime.physicsDoorKey) return;
      runtime.collisionMeshes.forEach((mesh) => {
        if (runtime.dynamicColliderMeshes?.has(mesh) && !runtime.staticWhileLockedColliderMeshes?.has(mesh)) return;
        octree.fromGraphNode(mesh);
      });
    });
    setCollisionState(octree, true);
    syncPlayerCapsule();
    resolvePlayerCollisions();
    return displayedLevelId;
  }

  function applyWorldConfig(levelId) {
    const worldConfig = config.levelEnvironments?.[levelId]?.world;
    if (!worldConfig) throw new Error(`[LevelRuntime] Missing world config for "${levelId}"`);
    scene.background.set(worldConfig.backgroundColor);
    if (!scene.fog) scene.fog = new Fog(worldConfig.fogColor, worldConfig.fogNear, worldConfig.fogFar);
    scene.fog.color.set(worldConfig.fogColor);
    scene.fog.near = worldConfig.fogNear;
    scene.fog.far = Math.max(scene.fog.near + 0.01, worldConfig.fogFar);
  }

  return { activate, applyWorldConfig };
}
