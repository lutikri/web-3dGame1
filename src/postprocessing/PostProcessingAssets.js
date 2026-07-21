import * as THREE from "three";
import { LUT3dlLoader } from "three/addons/loaders/LUT3dlLoader.js";
import { LUTCubeLoader } from "three/addons/loaders/LUTCubeLoader.js";

export class PostProcessingAssets {
  #lutAssetPath = null;
  #lutPromise = null;
  #lensDirtAssetKey = null;
  #lensDirtPromise = null;

  lutTexture = null;
  lensDirtTexture = null;

  hasLut(assetPath) {
    return Boolean(this.lutTexture && this.#lutAssetPath === assetPath);
  }

  get lutAssetPath() {
    return this.#lutAssetPath;
  }

  get lensDirtAssetPath() {
    return this.#lensDirtAssetKey;
  }

  loadLut(config) {
    if (this.lutTexture && this.#lutAssetPath === config.assetPath) return Promise.resolve(this.lutTexture);
    if (this.#lutPromise && this.#lutAssetPath === config.assetPath) return this.#lutPromise;
    const loader = config.format === "3dl" ? new LUT3dlLoader() : new LUTCubeLoader();
    this.#lutAssetPath = config.assetPath;
    this.#lutPromise = new Promise((resolve, reject) => {
      loader.load(config.assetPath, (result) => {
        this.lutTexture = result.texture3D;
        resolve(this.lutTexture);
      }, undefined, reject);
    }).finally(() => { this.#lutPromise = null; });
    return this.#lutPromise;
  }

  loadLensDirt(config) {
    const maxSize = Math.max(256, Number(config.maxTextureSize ?? 1024));
    const assetKey = `${config.assetPath}:${maxSize}`;
    if (this.lensDirtTexture && this.#lensDirtAssetKey === assetKey) return Promise.resolve(this.lensDirtTexture);
    if (this.#lensDirtPromise && this.#lensDirtAssetKey === assetKey) return this.#lensDirtPromise;
    this.#lensDirtAssetKey = assetKey;
    this.#lensDirtPromise = new Promise((resolve, reject) => {
      new THREE.ImageLoader().load(config.assetPath, (image) => {
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        this.lensDirtTexture?.dispose?.();
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.NoColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
        this.lensDirtTexture = texture;
        resolve(texture);
      }, undefined, reject);
    }).finally(() => { this.#lensDirtPromise = null; });
    return this.#lensDirtPromise;
  }

  dispose() {
    this.lutTexture?.dispose?.();
    this.lensDirtTexture?.dispose?.();
    this.lutTexture = null;
    this.lensDirtTexture = null;
    this.#lutAssetPath = null;
    this.#lensDirtAssetKey = null;
  }
}
