import * as THREE from "three";

export function createInteriorMaterialFactory({
  panelConfig,
  specialMaterials,
  getPanelTextureMaps,
  setupMaskOverlay,
  updateMaskOverlay,
  patchMaterial,
}) {
  const applyTextureRepeat = (textureMaps, repeatConfig) => {
    const repeat = Array.isArray(repeatConfig) || typeof repeatConfig === "object"
      ? {
          x: Number(repeatConfig.x ?? repeatConfig[0] ?? 1),
          y: Number(repeatConfig.y ?? repeatConfig[1] ?? repeatConfig.x ?? repeatConfig[0] ?? 1),
        }
      : { x: Number(repeatConfig ?? 1), y: Number(repeatConfig ?? 1) };
    [
      textureMaps.map,
      textureMaps.normalMap,
      textureMaps.ormMap,
      textureMaps.roughnessMap,
      textureMaps.emissiveMap,
    ].forEach((texture) => {
      if (!texture) return;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat.x, repeat.y);
      texture.needsUpdate = true;
    });
  };

  const applyMaskTextureSettings = (texture) => {
    if (!texture) return;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);
    texture.needsUpdate = true;
  };

  const applyPanelTextureMaps = (material, textureMaps) => {
    if (!material || !textureMaps) return;
    material.color.set("#ffffff");
    material.map = textureMaps.map;
    material.normalMap = textureMaps.normalMap;
    material.aoMap = textureMaps.ormMap;
    material.roughnessMap = textureMaps.ormMap;
    material.metalnessMap = textureMaps.ormMap;
    patchMaterial(material);
    material.needsUpdate = true;
  };

  const createPanelMaterial = (name, overrides = {}) => {
    const material = new THREE.MeshStandardMaterial({
      name,
      color: panelConfig.placeholderColor ?? "#365247",
      roughness: 1,
      metalness: 1,
      aoMapIntensity: 1,
      ...overrides,
    });
    const textureMaps = getPanelTextureMaps();
    if (textureMaps) applyPanelTextureMaps(material, textureMaps);
    return material;
  };

  const createCustomMaterial = (key, config) => {
    const materialParameters = {
      name: config.name ?? `${key}_PBR_Emissive`,
      normalScale: new THREE.Vector2(config.normalScale ?? 1, config.normalScale ?? 1),
      color: config.color ?? "#ffffff",
      roughness: config.roughness ?? 1,
      metalness: config.metalness ?? 1,
      aoMapIntensity: config.aoMapIntensity ?? 1,
      emissive: config.emissive ?? "#fff2b0",
      emissiveIntensity: config.emissiveIntensity ?? 1.35,
      transparent: Boolean(config.transparent),
      alphaTest: config.alphaTest ?? 0,
      opacity: config.opacity ?? 1,
      depthTest: config.depthTest ?? true,
      depthWrite: config.depthWrite ?? true,
      side: config.side ?? THREE.FrontSide,
    };
    const material = config.maskAsAlphaMap
      ? new ContrastAlphaMapMaterial({ ...materialParameters, alphaMapContrast: config.alphaMapContrast ?? 1 })
      : new THREE.MeshStandardMaterial(materialParameters);
    material.userData.baseEmissiveIntensity = material.emissiveIntensity;
    material.userData.roomLightControlled = Boolean(config.roomLightControlled);
    if (config.maskOverlay) setupMaskOverlay(material, config);
    return material;
  };

  const createCustomMaterials = () => Object.fromEntries(
    Object.entries(specialMaterials ?? {}).map(([key, config]) => [key, createCustomMaterial(key, config)]),
  );

  const applyCustomTextureMaps = (material, textureMaps, config = {}) => {
    if (!material || !textureMaps) return;
    material.map = textureMaps.map ?? null;
    material.normalMap = textureMaps.normalMap ?? null;
    material.aoMap = textureMaps.ormMap ?? null;
    material.roughnessMap = textureMaps.roughnessMap ?? textureMaps.ormMap ?? null;
    material.metalnessMap = textureMaps.ormMap ?? null;
    material.emissiveMap = textureMaps.emissiveMap ?? null;
    material.userData.maskMap = textureMaps.maskMap ?? null;
    material.alphaMap = config.maskAsAlphaMap ? textureMaps.maskMap ?? null : null;
    material.transparent = Boolean(config.transparent);
    material.opacity = config.opacity ?? 1;
    material.depthTest = config.depthTest ?? true;
    material.depthWrite = config.depthWrite ?? true;
    material.side = config.side ?? THREE.FrontSide;
    applyTextureRepeat(textureMaps, config.textureRepeat);
    applyMaskTextureSettings(textureMaps.maskMap);
    updateMaskOverlay(material, config);
    patchMaterial(material);
    material.needsUpdate = true;
  };

  return { createPanelMaterial, applyPanelTextureMaps, createCustomMaterials, applyCustomTextureMaps };
}

class ContrastAlphaMapMaterial extends THREE.MeshStandardMaterial {
  constructor(parameters = {}) {
    const { alphaMapContrast = 1, ...materialParameters } = parameters;
    super(materialParameters);
    this._alphaMapContrastUniform = { value: clampAlphaMapContrast(alphaMapContrast) };
    this.#installAlphaMapContrastShader();
  }

  get alphaMapContrast() {
    return this._alphaMapContrastUniform.value;
  }

  set alphaMapContrast(value) {
    this._alphaMapContrastUniform.value = clampAlphaMapContrast(value);
  }

  copy(source) {
    super.copy(source);
    this.alphaMapContrast = source.alphaMapContrast ?? 1;
    return this;
  }

  #installAlphaMapContrastShader() {
    this.onBeforeCompile = (shader) => {
      shader.uniforms.alphaMapContrast = this._alphaMapContrastUniform;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <alphamap_pars_fragment>",
          `#include <alphamap_pars_fragment>
uniform float alphaMapContrast;`,
        )
        .replace(
          "#include <alphamap_fragment>",
          `#ifdef USE_ALPHAMAP
  float contrastedAlphaMap = texture2D(alphaMap, vAlphaMapUv).g;
  contrastedAlphaMap = clamp((contrastedAlphaMap - 0.5) * alphaMapContrast + 0.5, 0.0, 1.0);
  diffuseColor.a *= contrastedAlphaMap;
#endif`,
        );
    };
    this.customProgramCacheKey = () => "contrast-alpha-map-v1";
  }
}

function clampAlphaMapContrast(value) {
  return THREE.MathUtils.clamp(Number(value ?? 1), 0, 4);
}
