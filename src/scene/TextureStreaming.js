import * as THREE from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";

export function createTextureStreaming({ renderer, transcoderPath, onProgress, onWarning } = {}) {
  const ktx2Loader = new KTX2Loader().setTranscoderPath(transcoderPath).detectSupport(renderer);
  const imageTextureLoader = new THREE.TextureLoader();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  async function loadKtx2Texture(path, options = {}) {
    const startedAt = nowMilliseconds();
    options.onTextureStart?.(path);
    try {
      const texture = await ktx2Loader.loadAsync(path);
      applyTextureDefaults(texture, options);
      onProgress?.();
      options.onTextureComplete?.(path);
      options.onTextureTiming?.({ path, kind: "ktx2", totalMs: nowMilliseconds() - startedAt });
      return texture;
    } catch (error) {
      onWarning?.(error);
      options.onTextureComplete?.(path);
      options.onTextureError?.(path, error);
      options.onTextureTiming?.({ path, kind: "ktx2", totalMs: nowMilliseconds() - startedAt, failed: true });
      throw error;
    }
  }

  async function loadImageTexture(path, options = {}) {
    const startedAt = nowMilliseconds();
    options.onTextureStart?.(path);
    try {
      const texture = await imageTextureLoader.loadAsync(path);
      applyTextureDefaults(texture, options);
      options.onTextureComplete?.(path);
      options.onTextureTiming?.({ path, kind: "image", totalMs: nowMilliseconds() - startedAt });
      return texture;
    } catch (error) {
      options.onTextureComplete?.(path);
      options.onTextureError?.(path, error);
      options.onTextureTiming?.({ path, kind: "image", totalMs: nowMilliseconds() - startedAt, failed: true });
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
    const batchStarted = nowMilliseconds();
    const textureTimings = [];
    const timedOptions = {
      ...options,
      onTextureTiming: (timing) => {
        textureTimings.push(timing);
        options.onTextureTiming?.(timing);
      },
    };

    const textureJobs = {
      map: paths.baseColor ? loadRuntimeTexture(paths.baseColor, { ...timedOptions, colorSpace: THREE.SRGBColorSpace }) : null,
      normalMap: paths.normal ? loadRuntimeTexture(paths.normal, timedOptions) : null,
      ormMap: paths.orm ? loadRuntimeTexture(paths.orm, timedOptions) : null,
      roughnessMap: paths.roughness ? loadRuntimeTexture(paths.roughness, timedOptions) : null,
      emissiveMap: paths.emissive
        ? loadRuntimeTexture(paths.emissive, { ...timedOptions, colorSpace: THREE.SRGBColorSpace })
        : null,
      maskMap: paths.mask ? loadRuntimeTexture(paths.mask, timedOptions) : null,
    };

    try {
      const entries = await Promise.all(
        Object.entries(textureJobs).map(async ([name, texturePromise]) => [
          name,
          texturePromise ? await texturePromise : null,
        ]),
      );
      return Object.fromEntries(entries);
    } finally {
      options.onBatchTiming?.({
        wallMs: nowMilliseconds() - batchStarted,
        textureCount: textureTimings.length,
        failedCount: textureTimings.filter((entry) => entry.failed).length,
        sumTextureMs: textureTimings.reduce((sum, entry) => sum + entry.totalMs, 0),
        slowestTextureMs: Math.max(0, ...textureTimings.map((entry) => entry.totalMs)),
      });
    }
  }

  function disposeTextureMaps(textureMaps) {
    if (!textureMaps) return;
    Object.values(textureMaps).forEach((texture) => texture?.dispose?.());
  }

  return {
    loadRuntimeTexture,
    loadTextureMaps,
    disposeTextureMaps,
  };
}

function nowMilliseconds() {
  return globalThis.performance?.now?.() ?? Date.now();
}

export function getInitialTexturePaths(paths) {
  if (!paths) return null;
  return paths.preview ?? paths.initial ?? paths;
}

export function getDeferredTexturePaths(paths) {
  if (!paths?.full) return null;
  return paths.full;
}
