import * as THREE from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

export function createTextureStreaming({ renderer, transcoderPath, onProgress, onWarning } = {}) {
  const ktx2Loader = new KTX2Loader().setTranscoderPath(transcoderPath).detectSupport(renderer);
  const imageTextureLoader = new THREE.TextureLoader();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  async function loadKtx2Texture(path, options = {}) {
    try {
      const texture = await ktx2Loader.loadAsync(path);
      applyTextureDefaults(texture, options);
      onProgress?.();
      return texture;
    } catch (error) {
      onWarning?.(error);
      throw error;
    }
  }

  async function loadImageTexture(path, options = {}) {
    const texture = await imageTextureLoader.loadAsync(path);
    applyTextureDefaults(texture, options);
    return texture;
  }

  function applyTextureDefaults(texture, options = {}) {
    texture.flipY = false;
    texture.colorSpace = options.colorSpace ?? THREE.NoColorSpace;
    texture.anisotropy = maxAnisotropy;
  }

  async function loadRuntimeTexture(path, options = {}) {
    return path.toLowerCase().endsWith(".ktx2") ? loadKtx2Texture(path, options) : loadImageTexture(path, options);
  }

  async function loadTextureMaps(paths) {
    if (!paths) return null;

    const textureJobs = {
      map: paths.baseColor ? loadRuntimeTexture(paths.baseColor, { colorSpace: THREE.SRGBColorSpace }) : null,
      normalMap: paths.normal ? loadRuntimeTexture(paths.normal) : null,
      ormMap: paths.orm ? loadRuntimeTexture(paths.orm) : null,
      emissiveMap: paths.emissive ? loadRuntimeTexture(paths.emissive, { colorSpace: THREE.SRGBColorSpace }) : null,
    };

    const entries = await Promise.all(
      Object.entries(textureJobs).map(async ([name, texturePromise]) => [
        name,
        texturePromise ? await texturePromise : null,
      ]),
    );
    return Object.fromEntries(entries);
  }

  function disposeTextureMaps(textureMaps) {
    if (!textureMaps) return;
    Object.values(textureMaps).forEach((texture) => texture?.dispose?.());
  }

  return {
    loadTextureMaps,
    disposeTextureMaps,
  };
}

export function getInitialTexturePaths(paths) {
  if (!paths) return null;
  return paths.preview ?? paths.initial ?? paths;
}

export function getDeferredTexturePaths(paths) {
  if (!paths?.full) return null;
  return paths.full;
}
