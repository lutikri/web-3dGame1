import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

export function createPhotometricPointLightRuntime({
  camera,
  emptyTexture,
  maxLights = 8,
} = {}) {
  const textureLoader = new THREE.TextureLoader();
  const rgbeLoader = new RGBELoader();
  const entries = [];
  const texturePromises = new Map();
  const materialUniforms = new WeakMap();
  const patchedMaterials = new Set();
  const compiledMaterials = new Set();
  const matrixScratch = new THREE.Matrix4();
  let debugMode = false;

  function patchMaterial(material) {
    if (!material) return;
    if (Array.isArray(material)) {
      material.forEach(patchMaterial);
      return;
    }
    if (patchedMaterials.has(material)) {
      if (!materialUniforms.has(material)) materialUniforms.set(material, createUniforms());
      return;
    }

    const previousOnBeforeCompile = material.onBeforeCompile;
    const previousCustomProgramCacheKey = material.customProgramCacheKey;
    materialUniforms.set(material, createUniforms());
    patchedMaterials.add(material);
    material.onBeforeCompile = (shader) => {
      previousOnBeforeCompile?.(shader);
      Object.assign(shader.uniforms, materialUniforms.get(material));
      shader.fragmentShader = injectShader(shader.fragmentShader);
      compiledMaterials.add(material);
    };
    material.customProgramCacheKey = () => {
      const previousKey = previousCustomProgramCacheKey?.call(material) ?? material.name ?? "";
      return `${previousKey}:photometric-point-light-v3`;
    };
    material.needsUpdate = true;
  }

  function resetClonedMaterial(material) {
    if (!material) return;
    if (Array.isArray(material)) {
      material.forEach(resetClonedMaterial);
      return;
    }
    if (!patchedMaterials.has(material)) return;
    patchedMaterials.delete(material);
    compiledMaterials.delete(material);
    materialUniforms.delete(material);
    material.onBeforeCompile = THREE.Material.prototype.onBeforeCompile;
    material.customProgramCacheKey = THREE.Material.prototype.customProgramCacheKey;
  }

  function register(runtime, lightConfig) {
    const profileConfig = lightConfig?.photometricProfile;
    if (!runtime?.light || profileConfig?.enabled !== true || !profileConfig.path) return null;
    const entry = {
      light: runtime.light,
      root: runtime.root,
      path: profileConfig.path,
      strength: THREE.MathUtils.clamp(Number(profileConfig.strength ?? 1), 0, 2),
      flipY: Boolean(profileConfig.flipY),
      texture: null,
    };
    entries.push(entry);
    loadTexture(profileConfig.path)
      .then((texture) => {
        entry.texture = texture;
        updateUniforms();
      })
      .catch((error) => {
        console.warn(`[PhotometricPointLightRuntime] Failed to load profile "${profileConfig.path}"`, error);
      });
    return entry;
  }

  function unregister(entry) {
    if (!entry) return;
    const index = entries.indexOf(entry);
    if (index >= 0) entries.splice(index, 1);
    updateUniforms();
  }

  async function loadTexture(path) {
    if (!texturePromises.has(path)) {
      texturePromises.set(path, loadTextureUncached(path));
    }
    return texturePromises.get(path);
  }

  async function loadTextureUncached(path) {
    const lowerPath = path.toLowerCase();
    const texture = lowerPath.endsWith(".hdr") || lowerPath.endsWith(".rgbe")
      ? await rgbeLoader.loadAsync(path)
      : await textureLoader.loadAsync(path);
    texture.name = path.split("/").pop() ?? "PhotometricPointLightProfile";
    texture.colorSpace = THREE.NoColorSpace;
    texture.mapping = THREE.UVMapping;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.flipY = false;
    texture.needsUpdate = true;
    return texture;
  }

  function updateUniforms() {
    const activeEntries = entries
      .filter((entry) => entry.light?.visible && entry.light.intensity > 0 && entry.texture)
      .slice(0, maxLights);
    const profileTexture = activeEntries[0]?.texture ?? emptyTexture;
    camera?.updateMatrixWorld();
    if (camera?.matrixWorld && camera?.matrixWorldInverse) {
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    }

    patchedMaterials.forEach((material) => {
      const uniforms = materialUniforms.get(material);
      if (!uniforms) return;
      uniforms.photometricPointLightProfile.value = profileTexture;
      uniforms.photometricPointLightCount.value = activeEntries.length;
      uniforms.photometricPointLightDebugMode.value = debugMode ? 1 : 0;
      activeEntries.forEach((entry, index) => {
        uniforms.photometricPointLightViewPosition.value[index]
          .setFromMatrixPosition(entry.light.matrixWorld)
          .applyMatrix4(camera.matrixWorldInverse);
        entry.root.updateMatrixWorld(true);
        matrixScratch.copy(entry.root.matrixWorld).invert();
        uniforms.photometricPointLightWorldToLocal.value[index].copy(matrixScratch);
        uniforms.photometricPointLightStrength.value[index] = entry.strength;
        uniforms.photometricPointLightFlipY.value[index] = entry.flipY ? 1 : 0;
      });
    });
  }

  function setDebugMode(enabled) {
    debugMode = Boolean(enabled);
    patchedMaterials.forEach((material) => {
      material.needsUpdate = true;
    });
    updateUniforms();
    return debugMode;
  }

  function getDebugState() {
    return {
      registered: entries.length,
      active: entries.filter((entry) => entry.light?.visible && entry.light.intensity > 0).length,
      loadedProfiles: new Set(entries.filter((entry) => entry.texture).map((entry) => entry.path)).size,
      maxLights,
      patchedMaterials: patchedMaterials.size,
      compiledMaterials: compiledMaterials.size,
      debugMode,
      entries: entries.map((entry) => ({
        light: entry.light?.name ?? "",
        root: entry.root?.name ?? "",
        path: entry.path,
        loaded: Boolean(entry.texture),
        visible: Boolean(entry.light?.visible),
        intensity: Number((entry.light?.intensity ?? 0).toFixed(3)),
        strength: entry.strength,
        flipY: entry.flipY,
      })),
    };
  }

  function createUniforms() {
    return {
      photometricPointLightProfile: { value: emptyTexture },
      photometricPointLightCount: { value: 0 },
      photometricPointLightViewPosition: {
        value: Array.from({ length: maxLights }, () => new THREE.Vector3()),
      },
      photometricPointLightWorldToLocal: {
        value: Array.from({ length: maxLights }, () => new THREE.Matrix4()),
      },
      photometricPointLightStrength: { value: Array.from({ length: maxLights }, () => 1) },
      photometricPointLightFlipY: { value: Array.from({ length: maxLights }, () => 0) },
      photometricPointLightDebugMode: { value: 0 },
    };
  }

  function injectShader(fragmentShader) {
    if (fragmentShader.includes("photometricPointLightProfile")) return fragmentShader;
    const pars = `
#if NUM_POINT_LIGHTS > 0
#define MAX_PHOTOMETRIC_POINT_LIGHTS ${maxLights}
uniform sampler2D photometricPointLightProfile;
uniform int photometricPointLightCount;
uniform vec3 photometricPointLightViewPosition[ MAX_PHOTOMETRIC_POINT_LIGHTS ];
uniform mat4 photometricPointLightWorldToLocal[ MAX_PHOTOMETRIC_POINT_LIGHTS ];
uniform float photometricPointLightStrength[ MAX_PHOTOMETRIC_POINT_LIGHTS ];
uniform float photometricPointLightFlipY[ MAX_PHOTOMETRIC_POINT_LIGHTS ];
uniform float photometricPointLightDebugMode;

vec3 samplePhotometricPointLightProfile( const in vec3 pointLightViewPosition, const in vec3 geometryPosition ) {
  vec3 factor = vec3( 1.0 );
  mat3 viewToWorld = transposeMat3( mat3( viewMatrix ) );
  vec3 fragmentWorldPosition = cameraPosition + viewToWorld * geometryPosition;
  vec3 lightWorldPosition = cameraPosition + viewToWorld * pointLightViewPosition;
  vec3 worldDirection = normalize( fragmentWorldPosition - lightWorldPosition );
  float nearestDistanceSq = 0.25;
  float selectedStrength = 1.0;
  float selectedFlipY = 0.0;
  vec3 selectedLocalDirection = vec3( 0.0, -1.0, 0.0 );
  bool selectedLight = false;

  for ( int j = 0; j < MAX_PHOTOMETRIC_POINT_LIGHTS; j ++ ) {
    if ( j >= photometricPointLightCount ) break;
    vec3 lightDelta = pointLightViewPosition - photometricPointLightViewPosition[ j ];
    float distanceSq = dot( lightDelta, lightDelta );
    if ( distanceSq < nearestDistanceSq ) {
      nearestDistanceSq = distanceSq;
      selectedStrength = photometricPointLightStrength[ j ];
      selectedFlipY = photometricPointLightFlipY[ j ];
      selectedLocalDirection = normalize( ( photometricPointLightWorldToLocal[ j ] * vec4( worldDirection, 0.0 ) ).xyz );
      selectedLight = true;
    }
  }

  if ( selectedLight ) {
    vec2 profileUv = equirectUv( selectedLocalDirection );
    profileUv.y = mix( profileUv.y, 1.0 - profileUv.y, selectedFlipY );
    float profileValue = max( luminance( texture2D( photometricPointLightProfile, profileUv ).rgb ), 0.0 );
    if ( photometricPointLightDebugMode > 0.5 ) {
      float debugValue = clamp( profileValue, 0.0, 1.0 );
      factor = mix( vec3( 0.0, 0.08, 2.0 ), vec3( 2.0, 0.08, 0.0 ), debugValue );
    } else {
      factor = vec3( mix( 1.0, profileValue, selectedStrength ) );
    }
  }

  return factor;
}
#endif
`;
    return fragmentShader
      .replace("#include <lights_pars_begin>", `#include <lights_pars_begin>\n${pars}`)
      .replace(
        "#include <lights_fragment_begin>",
        THREE.ShaderChunk.lights_fragment_begin.replace(
          "getPointLightInfo( pointLight, geometryPosition, directLight );",
          `getPointLightInfo( pointLight, geometryPosition, directLight );
    directLight.color *= samplePhotometricPointLightProfile( pointLight.position, geometryPosition );`,
        ),
      );
  }

  return {
    getDebugState,
    patchMaterial,
    register,
    resetClonedMaterial,
    setDebugMode,
    unregister,
    updateUniforms,
  };
}
