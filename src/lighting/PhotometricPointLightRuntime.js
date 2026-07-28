import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";

export function createPhotometricPointLightRuntime({
  camera,
  emptyTexture,
  maxLights = 4,
  maxProfiles = 4,
  selectionRadius = 15,
  selectionHysteresis = 2,
  transitionSeconds = 0.6,
} = {}) {
  if (!emptyTexture) {
    emptyTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    emptyTexture.needsUpdate = true;
  }
  const textureLoader = new THREE.TextureLoader();
  const rgbeLoader = new RGBELoader();
  const entries = [];
  const texturePromises = new Map();
  const materialUniforms = new WeakMap();
  const patchedMaterials = new Set();
  const compiledMaterials = new Set();
  const matrixScratch = new THREE.Matrix4();
  const cameraPositionScratch = new THREE.Vector3();
  const lightPositionScratch = new THREE.Vector3();
  let selectedEntries = [];
  let activeEntries = [];
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
      return `${previousKey}:photometric-point-light-v5:${maxLights}:${maxProfiles}`;
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
      sourceLight: runtime.light,
      root: runtime.light.parent ?? runtime.root,
      path: profileConfig.path,
      strength: THREE.MathUtils.clamp(Number(profileConfig.strength ?? 1), 0, 2),
      flipY: Boolean(profileConfig.flipY),
      texture: null,
      blend: 0,
      pooled: false,
      pooledLight: null,
      pooledBlend: 0,
    };
    entries.push(entry);
    entry.ready = loadTexture(profileConfig.path)
      .then((texture) => {
        entry.texture = texture;
        updateUniforms();
      })
      .catch((error) => {
        console.warn(`[PhotometricPointLightRuntime] Failed to load profile "${profileConfig.path}"`, error);
      });
    return entry;
  }

  async function prepare() {
    await Promise.allSettled(entries.map((entry) => entry.ready).filter(Boolean));
    updateUniforms();
  }

  function unregister(entry) {
    if (!entry) return;
    const index = entries.indexOf(entry);
    if (index >= 0) entries.splice(index, 1);
    updateUniforms();
  }

  function setPooledAssignment(entry, light, blend = 0) {
    if (!entry) return;
    entry.pooled = true;
    entry.pooledLight = light ?? null;
    entry.pooledBlend = THREE.MathUtils.clamp(Number(blend) || 0, 0, 1);
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

  function updateUniforms(dt = 0) {
    camera?.updateMatrixWorld();
    camera?.getWorldPosition?.(cameraPositionScratch);
    const legacyEntries = entries.filter((entry) => !entry.pooled);
    const candidates = legacyEntries
      .filter((entry) => entry.light?.visible && entry.light.intensity > 0 && entry.texture)
      .map((entry) => {
        entry.root?.updateMatrixWorld?.(true);
        entry.light.updateMatrixWorld?.(true);
        entry.light.getWorldPosition(lightPositionScratch);
        return {
          entry,
          distanceSq: camera ? lightPositionScratch.distanceToSquared(cameraPositionScratch) : 0,
        };
      });
    selectedEntries = selectPhotometricLightEntries(candidates, {
      maxLights,
      radius: selectionRadius,
      hysteresis: selectionHysteresis,
      selectedEntries,
    });
    const selectedSet = new Set(selectedEntries);
    legacyEntries.forEach((entry) => {
      entry.blend = advancePhotometricBlend(
        entry.blend,
        selectedSet.has(entry),
        dt,
        transitionSeconds,
      );
    });
    activeEntries = [
      ...entries.filter((entry) => (
        entry.pooled && entry.pooledLight?.visible && entry.pooledLight.intensity > 0
        && entry.texture && entry.pooledBlend > 0
      )),
      ...selectedEntries,
    ].slice(0, maxLights);
    const { profiles, profileIndices } = assignPhotometricProfileSlots(activeEntries, maxProfiles);
    if (camera?.matrixWorld && camera?.matrixWorldInverse) {
      camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    }

    patchedMaterials.forEach((material) => {
      const uniforms = materialUniforms.get(material);
      if (!uniforms) return;
      for (let index = 0; index < maxProfiles; index += 1) {
        uniforms[`photometricPointLightProfile${index}`].value = profiles[index]?.texture ?? emptyTexture;
      }
      uniforms.photometricPointLightCount.value = activeEntries.length;
      uniforms.photometricPointLightDebugMode.value = debugMode ? 1 : 0;
      activeEntries.forEach((entry, index) => {
        const activeLight = entry.pooled ? entry.pooledLight : entry.light;
        uniforms.photometricPointLightViewPosition.value[index]
          .setFromMatrixPosition(activeLight.matrixWorld)
          .applyMatrix4(camera.matrixWorldInverse);
        entry.root.updateMatrixWorld(true);
        matrixScratch.copy(entry.root.matrixWorld).invert();
        uniforms.photometricPointLightWorldToLocal.value[index].copy(matrixScratch);
        const blend = entry.pooled ? entry.pooledBlend : entry.blend;
        uniforms.photometricPointLightStrength.value[index] = entry.strength * blend;
        uniforms.photometricPointLightFlipY.value[index] = entry.flipY ? 1 : 0;
        uniforms.photometricPointLightProfileIndex.value[index] = profileIndices[index];
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
      active: entries.filter((entry) => {
        const light = entry.pooled ? entry.pooledLight : entry.light;
        return light?.visible && light.intensity > 0;
      }).length,
      loadedProfiles: new Set(entries.filter((entry) => entry.texture).map((entry) => entry.path)).size,
      maxLights,
      maxProfiles,
      selectionRadius,
      selectionHysteresis,
      transitionSeconds,
      selected: activeEntries.length,
      patchedMaterials: patchedMaterials.size,
      compiledMaterials: compiledMaterials.size,
      debugMode,
      entries: entries.map((entry) => ({
        light: (entry.pooled ? entry.pooledLight : entry.light)?.name ?? entry.sourceLight?.name ?? "",
        root: entry.root?.name ?? "",
        path: entry.path,
        loaded: Boolean(entry.texture),
        visible: Boolean((entry.pooled ? entry.pooledLight : entry.light)?.visible),
        intensity: Number(((entry.pooled ? entry.pooledLight : entry.light)?.intensity ?? 0).toFixed(3)),
        strength: entry.strength,
        flipY: entry.flipY,
        selected: entry.pooled ? Boolean(entry.pooledLight) : selectedEntries.includes(entry),
        blend: Number((entry.pooled ? entry.pooledBlend : entry.blend).toFixed(3)),
      })),
    };
  }

  function createUniforms() {
    const uniforms = {
      photometricPointLightCount: { value: 0 },
      photometricPointLightViewPosition: {
        value: Array.from({ length: maxLights }, () => new THREE.Vector3()),
      },
      photometricPointLightWorldToLocal: {
        value: Array.from({ length: maxLights }, () => new THREE.Matrix4()),
      },
      photometricPointLightStrength: { value: Array.from({ length: maxLights }, () => 1) },
      photometricPointLightFlipY: { value: Array.from({ length: maxLights }, () => 0) },
      photometricPointLightProfileIndex: { value: Array.from({ length: maxLights }, () => -1) },
      photometricPointLightDebugMode: { value: 0 },
    };
    for (let index = 0; index < maxProfiles; index += 1) {
      uniforms[`photometricPointLightProfile${index}`] = { value: emptyTexture };
    }
    return uniforms;
  }

  function injectShader(fragmentShader) {
    if (fragmentShader.includes("photometricPointLightProfileIndex")) return fragmentShader;
    const profileUniforms = Array.from(
      { length: maxProfiles },
      (_, index) => `uniform sampler2D photometricPointLightProfile${index};`,
    ).join("\n");
    const profileSamples = Array.from(
      { length: maxProfiles },
      (_, index) => `${index === 0 ? "if" : "else if"} ( profileIndex == ${index} ) profileValue = max( luminance( texture2D( photometricPointLightProfile${index}, uv ).rgb ), 0.0 );`,
    ).join("\n  ");
    const pars = `
#if NUM_POINT_LIGHTS > 0
#define MAX_PHOTOMETRIC_POINT_LIGHTS ${maxLights}
${profileUniforms}
uniform int photometricPointLightCount;
uniform vec3 photometricPointLightViewPosition[ MAX_PHOTOMETRIC_POINT_LIGHTS ];
uniform mat4 photometricPointLightWorldToLocal[ MAX_PHOTOMETRIC_POINT_LIGHTS ];
uniform float photometricPointLightStrength[ MAX_PHOTOMETRIC_POINT_LIGHTS ];
uniform float photometricPointLightFlipY[ MAX_PHOTOMETRIC_POINT_LIGHTS ];
uniform int photometricPointLightProfileIndex[ MAX_PHOTOMETRIC_POINT_LIGHTS ];
uniform float photometricPointLightDebugMode;

float samplePhotometricProfile( const in int profileIndex, const in vec2 uv ) {
  float profileValue = 1.0;
  ${profileSamples}
  return profileValue;
}

vec3 samplePhotometricPointLightProfile( const in vec3 pointLightViewPosition, const in vec3 geometryPosition ) {
  vec3 factor = vec3( 1.0 );
  mat3 viewToWorld = transposeMat3( mat3( viewMatrix ) );
  vec3 fragmentWorldPosition = cameraPosition + viewToWorld * geometryPosition;
  vec3 lightWorldPosition = cameraPosition + viewToWorld * pointLightViewPosition;
  vec3 worldDirection = normalize( fragmentWorldPosition - lightWorldPosition );
  float nearestDistanceSq = 0.25;
  float selectedStrength = 1.0;
  float selectedFlipY = 0.0;
  int selectedProfileIndex = -1;
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
      selectedProfileIndex = photometricPointLightProfileIndex[ j ];
      selectedLocalDirection = normalize( ( photometricPointLightWorldToLocal[ j ] * vec4( worldDirection, 0.0 ) ).xyz );
      selectedLight = true;
    }
  }

  if ( selectedLight ) {
    vec2 profileUv = equirectUv( selectedLocalDirection );
    profileUv.y = mix( profileUv.y, 1.0 - profileUv.y, selectedFlipY );
    float profileValue = samplePhotometricProfile( selectedProfileIndex, profileUv );
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
    prepare,
    register,
    resetClonedMaterial,
    setPooledAssignment,
    setDebugMode,
    unregister,
    updateUniforms,
  };
}

export function assignPhotometricProfileSlots(entries, maxProfiles = 4) {
  const profiles = [];
  const profileIndices = entries.map((entry) => {
    let index = profiles.findIndex((profile) => profile.path === entry.path);
    if (index < 0 && profiles.length < maxProfiles) {
      index = profiles.length;
      profiles.push({ path: entry.path, texture: entry.texture });
    }
    return index;
  });
  return { profiles, profileIndices };
}

export function selectPhotometricLightEntries(candidates, {
  maxLights = 4,
  radius = 15,
  hysteresis = 2,
  selectedEntries = [],
} = {}) {
  const selectedSet = new Set(selectedEntries);
  const enterRadius = Math.max(0, Number(radius) || 0);
  const retentionDistance = Math.max(0, Number(hysteresis) || 0);
  const exitRadiusSq = (enterRadius + retentionDistance) ** 2;
  const enterRadiusSq = enterRadius ** 2;

  return candidates
    .filter(({ entry, distanceSq }) => (
      Number.isFinite(distanceSq)
      && distanceSq <= (selectedSet.has(entry) ? exitRadiusSq : enterRadiusSq)
    ))
    .sort((left, right) => {
      const leftScore = Math.sqrt(left.distanceSq) - (selectedSet.has(left.entry) ? retentionDistance : 0);
      const rightScore = Math.sqrt(right.distanceSq) - (selectedSet.has(right.entry) ? retentionDistance : 0);
      return leftScore - rightScore;
    })
    .slice(0, Math.max(0, Math.floor(maxLights)))
    .map(({ entry }) => entry);
}

export function advancePhotometricBlend(current, selected, dt, transitionSeconds = 0.6) {
  const value = THREE.MathUtils.clamp(Number(current) || 0, 0, 1);
  const duration = Math.max(0, Number(transitionSeconds) || 0);
  if (duration === 0) return selected ? 1 : 0;
  const step = Math.max(0, Number(dt) || 0) / duration;
  return THREE.MathUtils.clamp(value + (selected ? step : -step), 0, 1);
}
