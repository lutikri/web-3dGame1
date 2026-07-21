import * as THREE from "three";

export class LevelStaticPhysicsRuntime {
  constructor(options) { Object.assign(this, options); }

  appendPanel(levelId) {
    const panelModel = this.getPanelModel();
    if (!panelModel || !this.levelCollisionModels.has(levelId)) return 0;
    const panelConfig = this.config.levelEnvironments?.[levelId]?.prefabs?.find((prefab) => prefab.behavior === "operatorPanel");
    if (!panelConfig) return 0;
    panelModel.position.copy(panelConfig.position);
    panelModel.rotation.copy(panelConfig.rotation);
    panelModel.scale.copy(panelConfig.scale);
    panelModel.updateMatrixWorld(true);
    const collisionRoot = new THREE.Group();
    this.panelCollisionMeshes.forEach((source) => {
      const mesh = new THREE.Mesh(source.geometry);
      source.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
      collisionRoot.add(mesh);
    });
    this.getPhysicsSystem()?.appendStaticScene(levelId, collisionRoot);
    this.applyOperatorPanelLevel(levelId);
    return collisionRoot.children.length;
  }

  appendPrefabs(levelId) {
    if (!this.levelCollisionModels.has(levelId)) return 0;
    const collisionRoot = new THREE.Group();
    let count = 0;
    this.levelPrefabInstances.forEach((runtime, key) => {
      if (!key.startsWith(`${levelId}:`) || runtime.collisionDisabled || runtime.physicsDoorKey) return;
      runtime.root.updateWorldMatrix(true, true);
      runtime.collisionMeshes.forEach((source) => {
        if (runtime.dynamicColliderMeshes?.has(source) && !runtime.staticWhileLockedColliderMeshes?.has(source)) return;
        if (!source.geometry) return;
        const mesh = new THREE.Mesh(source.geometry);
        source.updateWorldMatrix(true, false);
        source.matrixWorld.decompose(mesh.position, mesh.quaternion, mesh.scale);
        collisionRoot.add(mesh);
        count += 1;
      });
    });
    if (count > 0) this.getPhysicsSystem()?.appendStaticScene(levelId, collisionRoot);
    return count;
  }

  rebuild(levelId) {
    const collisionModel = this.levelCollisionModels.get(levelId);
    if (!collisionModel) return false;
    this.getPhysicsSystem()?.addStaticScene(levelId, collisionModel);
    this.appendPanel(levelId);
    this.appendPrefabs(levelId);
    return true;
  }
}
