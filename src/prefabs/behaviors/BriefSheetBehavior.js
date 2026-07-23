import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();

export function createBriefSheetRuntime(parts, config = {}, loadTexture = loadBriefTexture) {
  const mesh = parts.get(config.meshName ?? "SM_Brief1");
  if (!mesh?.isMesh) {
    console.warn(`[BriefSheetBehavior] Missing brief mesh "${config.meshName ?? "SM_Brief1"}"`);
    return null;
  }
  const runtime = {
    mesh,
    texture: null,
    texturePromise: null,
    disposed: false,
    dispose() {
      this.disposed = true;
      this.texture?.dispose?.();
      this.texture = null;
    },
  };
  if (!config.texturePath) return runtime;
  runtime.texturePromise = loadTexture(config.texturePath)
    .then((texture) => {
      if (runtime.disposed) {
        texture.dispose?.();
        return null;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.needsUpdate = true;
      mesh.material.map = texture;
      mesh.material.color.set("#ffffff");
      mesh.material.needsUpdate = true;
      runtime.texture = texture;
      return texture;
    })
    .catch((error) => {
      console.warn(`[BriefSheetBehavior] Failed to load "${config.texturePath}"`, error);
      return null;
    });
  return runtime;
}

function loadBriefTexture(path) {
  return textureLoader.loadAsync(path);
}
