import * as THREE from "three";

const emptyMaskTexture = createSolidTexture(0, 0, 0, 255);

export function createMaskOverlayRuntime({ specialMaterials, getMaterials }) {
  const setup = (material, config) => {
    const uniforms = createUniforms(config);
    material.userData.maskOverlayUniforms = uniforms;
    material.customProgramCacheKey = () => `${material.name}:mask-overlay`;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <uv_pars_vertex>", `#include <uv_pars_vertex>
varying vec2 interiorMaskUv;`)
        .replace("#include <uv_vertex>", `#include <uv_vertex>
interiorMaskUv = uv;`);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_pars_fragment>",
        `#include <map_pars_fragment>
uniform sampler2D interiorMaskMap;
uniform vec3 interiorMaskColorR;
uniform vec3 interiorMaskColorG;
uniform vec3 interiorMaskColorB;
uniform float interiorMaskOpacityR;
uniform float interiorMaskOpacityG;
uniform float interiorMaskOpacityB;
uniform vec3 interiorMaskThreshold;
uniform vec3 interiorMaskSoftness;
uniform vec3 interiorMaskBlendMode;
uniform float interiorMaskDebugView;
varying vec2 interiorMaskUv;
float getInteriorMaskChannel(float channel, float threshold, float softness) {
  return smoothstep(threshold, threshold + max(softness, 0.001), channel);
}
vec3 getInteriorOverlayBlend(vec3 baseColor, vec3 overlayColor) {
  return mix(2.0 * baseColor * overlayColor, 1.0 - 2.0 * (1.0 - baseColor) * (1.0 - overlayColor), step(0.5, baseColor));
}
vec3 applyInteriorMaskBlend(vec3 baseColor, vec3 overlayColor, float strength, float blendMode) {
  vec3 mixColor = mix(baseColor, overlayColor, strength);
  vec3 multiplyColor = mix(baseColor, baseColor * overlayColor, strength);
  vec3 overlayBlendColor = mix(baseColor, getInteriorOverlayBlend(baseColor, overlayColor), strength);
  vec3 mixOrMultiply = mix(mixColor, multiplyColor, step(0.5, blendMode));
  return mix(mixOrMultiply, overlayBlendColor, step(1.5, blendMode));
}`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
  vec3 interiorMaskSample = texture2D(interiorMaskMap, interiorMaskUv).rgb;
  if (interiorMaskDebugView > 0.5) {
    diffuseColor.rgb = interiorMaskSample;
  } else {
  float interiorMaskR = getInteriorMaskChannel(interiorMaskSample.r, interiorMaskThreshold.r, interiorMaskSoftness.r);
  float interiorMaskG = getInteriorMaskChannel(interiorMaskSample.g, interiorMaskThreshold.g, interiorMaskSoftness.g);
  float interiorMaskB = getInteriorMaskChannel(interiorMaskSample.b, interiorMaskThreshold.b, interiorMaskSoftness.b);
  diffuseColor.rgb = applyInteriorMaskBlend(diffuseColor.rgb, interiorMaskColorR, clamp(interiorMaskR * interiorMaskOpacityR, 0.0, 1.0), interiorMaskBlendMode.r);
  diffuseColor.rgb = applyInteriorMaskBlend(diffuseColor.rgb, interiorMaskColorG, clamp(interiorMaskG * interiorMaskOpacityG, 0.0, 1.0), interiorMaskBlendMode.g);
  diffuseColor.rgb = applyInteriorMaskBlend(diffuseColor.rgb, interiorMaskColorB, clamp(interiorMaskB * interiorMaskOpacityB, 0.0, 1.0), interiorMaskBlendMode.b);
  }`,
      );
    };
  };

  const update = (material, config = {}) => {
    const uniforms = material.userData.maskOverlayUniforms;
    if (!uniforms) return;
    const overlay = config.maskOverlay ?? {};
    uniforms.interiorMaskMap.value = material.userData.maskMap ?? emptyMaskTexture;
    uniforms.interiorMaskColorR.value.set(overlay.red?.color ?? "#ffffff");
    uniforms.interiorMaskColorG.value.set(overlay.green?.color ?? "#ffffff");
    uniforms.interiorMaskColorB.value.set(overlay.blue?.color ?? "#ffffff");
    uniforms.interiorMaskOpacityR.value = channelStrength(overlay.red);
    uniforms.interiorMaskOpacityG.value = channelStrength(overlay.green);
    uniforms.interiorMaskOpacityB.value = channelStrength(overlay.blue);
    uniforms.interiorMaskThreshold.value.copy(channelVector(overlay, "threshold", 0.45));
    uniforms.interiorMaskSoftness.value.copy(channelVector(overlay, "softness", 0.08));
    uniforms.interiorMaskBlendMode.value.copy(blendModeVector(overlay));
    uniforms.interiorMaskDebugView.value = overlay.debugView ? 1 : 0;
    material.needsUpdate = true;
  };

  const setDebug = (materialKey, enabled) => {
    const config = specialMaterials?.[materialKey];
    const material = getMaterials()?.[materialKey];
    if (!config?.maskOverlay || !material) return false;
    config.maskOverlay.debugView = Boolean(enabled);
    update(material, config);
    return config.maskOverlay.debugView;
  };

  return { setup, update, setDebug };
}

function createUniforms(config) {
  const overlay = config.maskOverlay ?? {};
  return {
    interiorMaskMap: { value: emptyMaskTexture },
    interiorMaskColorR: { value: new THREE.Color(overlay.red?.color ?? "#ffffff") },
    interiorMaskColorG: { value: new THREE.Color(overlay.green?.color ?? "#ffffff") },
    interiorMaskColorB: { value: new THREE.Color(overlay.blue?.color ?? "#ffffff") },
    interiorMaskOpacityR: { value: channelStrength(overlay.red) },
    interiorMaskOpacityG: { value: channelStrength(overlay.green) },
    interiorMaskOpacityB: { value: channelStrength(overlay.blue) },
    interiorMaskThreshold: { value: channelVector(overlay, "threshold", 0.45) },
    interiorMaskSoftness: { value: channelVector(overlay, "softness", 0.08) },
    interiorMaskBlendMode: { value: blendModeVector(overlay) },
    interiorMaskDebugView: { value: overlay.debugView ? 1 : 0 },
  };
}

function channelStrength(channel = {}) {
  return Number(channel.opacity ?? 0) * Number(channel.intensity ?? 1);
}

function channelVector(overlay, property, fallback) {
  return new THREE.Vector3(
    Number(overlay.red?.[property] ?? fallback),
    Number(overlay.green?.[property] ?? fallback),
    Number(overlay.blue?.[property] ?? fallback),
  );
}

function blendModeVector(overlay) {
  return new THREE.Vector3(blendMode(overlay.red?.blend), blendMode(overlay.green?.blend), blendMode(overlay.blue?.blend));
}

function blendMode(mode = "mix") {
  if (mode === "multiply") return 1;
  if (mode === "overlay") return 2;
  return 0;
}

function createSolidTexture(r, g, b, a = 255) {
  const texture = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}
