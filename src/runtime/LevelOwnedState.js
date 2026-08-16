export class LevelOwnedState {
  constructor({
    scene,
    environmentModels,
    collisionModels,
    prefabInstances,
    interactive,
    roomLightButtons,
    interiorFans,
    physics,
    playerPosition,
    photometricLights,
    pointLightPool,
    lightingZones,
    lighting,
    audio,
    stopEditing,
    clearNarration,
    clearLoadedLevel,
    resetCollision,
  }) {
    Object.assign(this, {
      scene, environmentModels, collisionModels, prefabInstances,
      interactive, roomLightButtons, interiorFans, physics, playerPosition,
      photometricLights, pointLightPool, lightingZones, lighting, audio, stopEditing, clearNarration,
      clearLoadedLevel, resetCollision,
    });
  }

  disposeLevel(levelId) {
    this.stopEditing();
    this.clearNarration();
    this.physics?.resetWorld(this.playerPosition);
    for (const key of [levelId, `${levelId}:prefabs`]) {
      const model = this.environmentModels.get(key);
      if (model) this.scene.remove(model);
      this.environmentModels.delete(key);
    }
    const collision = this.collisionModels.get(levelId);
    if (collision) this.scene.remove(collision);
    this.collisionModels.delete(levelId);

    for (const [key, runtime] of [...this.prefabInstances.entries()]) {
      if (!key.startsWith(`${levelId}:`)) continue;
      this.pointLightPool?.unregister(runtime.pointLightPoolEntry);
      this.photometricLights.unregister(runtime.photometricPointLight);
      (runtime.materialClones ?? runtime.emissiveMaterials ?? []).forEach((material) => material.dispose());
      runtime.briefSheet?.dispose?.();
      runtime.plasmaView?.dispose?.();
      runtime.light?.shadow?.dispose?.();
      this.prefabInstances.delete(key);
    }
    removeLevelEntries(this.interactive, levelId);
    removeLevelEntries(this.roomLightButtons, levelId);
    removeLevelEntries(this.interiorFans, levelId);
    this.lighting.disposeLevel(levelId);
    this.lightingZones?.disposeLevel(levelId);
    this.audio.disposeLevel(levelId);
    this.clearLoadedLevel(levelId);
    this.resetCollision();
    console.log(`[LevelRuntime] Unloaded: ${levelId}`);
  }
}

export function removeLevelEntries(collection, levelId) {
  for (let index = collection.length - 1; index >= 0; index -= 1) {
    if (collection[index]?.userData.levelId === levelId) collection.splice(index, 1);
  }
}
