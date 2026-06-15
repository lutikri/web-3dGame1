import * as THREE from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

export function createTextureStreaming({ renderer, transcoderPath, onProgress, onWarning } = {}) {
  const ktx2Loader = new KTX2Loader().setTranscoderPath(transcoderPath).detectSupport(renderer);
  const imageTextureLoader = new THREE.TextureLoader();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  async function loadKtx2Texture(path, options = {}) {
    options.onTextureStart?.(path);
    try {
      const texture = await ktx2Loader.loadAsync(path);
      applyTextureDefaults(texture, options);
      onProgress?.();
      options.onTextureComplete?.(path);
      return texture;
    } catch (error) {
      onWarning?.(error);
      options.onTextureComplete?.(path);
      options.onTextureError?.(path, error);
      throw error;
    }
  }

  async function loadImageTexture(path, options = {}) {
    options.onTextureStart?.(path);
    try {
      const texture = await imageTextureLoader.loadAsync(path);
      applyTextureDefaults(texture, options);
      options.onTextureComplete?.(path);
      return texture;
    } catch (error) {
      options.onTextureComplete?.(path);
      options.onTextureError?.(path, error);
      throw error;
    }
  }

  function applyTextureDefaults(texture, options = {}) {
    texture.flipY = false;
    texture.colorSpace = options.colorSpace ?? THREE.NoColorSpace;
    texture.anisotropy = maxAnisotropy;
  }

  async function loadRuntimeTexture(path, options = {}) {
    return path.toLowerCase().endsWith(".ktx2") ? loadKtx2Texture(path, options) : loadImageTexture(path, options);
  }

  async function loadTextureMaps(paths, options = {}) {
    if (!paths) return null;

    const textureJobs = {
      map: paths.baseColor ? loadRuntimeTexture(paths.baseColor, { ...options, colorSpace: THREE.SRGBColorSpace }) : null,
      normalMap: paths.normal ? loadRuntimeTexture(paths.normal, options) : null,
      ormMap: paths.orm ? loadRuntimeTexture(paths.orm, options) : null,
      emissiveMap: paths.emissive
        ? loadRuntimeTexture(paths.emissive, { ...options, colorSpace: THREE.SRGBColorSpace })
        : null,
      maskMap: paths.mask ? loadRuntimeTexture(paths.mask, options) : null,
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
