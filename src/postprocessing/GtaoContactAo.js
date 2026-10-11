import * as THREE from "three";

const DISTANCE_UNIFORMS_ANCHOR = "uniform float distanceFallOff;";
const VIEW_POSITION_ANCHOR = "vec3 viewPos = getViewPosition(vUv, depth);";
const AO_RESULT_ANCHOR = "ao = pow(ao, scale);";
const GTAO_EXCLUSION_STENCIL_REF = 1;
const GTAO_DEFAULT_OUTPUT = 0;

export function configureGtaoContactAo(pass, preset = {}) {
  const material = pass?.gtaoMaterial;
  if (!material?.fragmentShader || !material.uniforms) return false;
  if (!material.userData.contactAoDistancePatched) {
    material.fragmentShader = injectDistanceFade(material.fragmentShader);
    material.uniforms.contactAoFadeStart = { value: 8 };
    material.uniforms.contactAoFadeEnd = { value: 12 };
    material.userData.contactAoDistancePatched = true;
    material.needsUpdate = true;
  }
  applyGtaoContactDistance(pass, preset);
  return true;
}

export function applyGtaoContactDistance(pass, preset = {}) {
  const uniforms = pass?.gtaoMaterial?.uniforms;
  if (!uniforms?.contactAoFadeStart || !uniforms?.contactAoFadeEnd) return false;
  const start = Math.max(0, Number(preset.distanceFadeStart ?? 8));
  const end = Math.max(start + 0.01, Number(preset.distanceFadeEnd ?? 12));
  uniforms.contactAoFadeStart.value = start;
  uniforms.contactAoFadeEnd.value = end;
  return true;
}

export function bindGtaoToComposerDepth(pass) {
  if (!pass?.setGBuffer || !pass?.render || pass.userData?.composerDepthBound) return false;
  pass.userData ??= {};
  const render = pass.render.bind(pass);
  pass.render = (renderer, writeBuffer, readBuffer, ...args) => {
    const depthTexture = readBuffer?.depthTexture;
    if (depthTexture && pass.depthTexture !== depthTexture) pass.setGBuffer(depthTexture, undefined);
    return render(renderer, writeBuffer, readBuffer, ...args);
  };
  pass.userData.composerDepthBound = true;
  return true;
}

export function configureGtaoExclusionMask(pass) {
  if (!pass?.render || !pass?.renderPass || !pass?.camera || !pass?.gtaoMaterial ||
    !pass?.pdMaterial || !pass?.blendMaterial) return false;
  pass.userData ??= {};
  configureBlendStencil(pass.blendMaterial);
  if (pass.userData.exclusionMaskConfigured) return true;

  const render = pass.render.bind(pass);
  pass.render = (renderer, writeBuffer, readBuffer, ...args) => {
    if (pass.output !== GTAO_DEFAULT_OUTPUT) {
      pass.needsSwap = true;
      return render(renderer, writeBuffer, readBuffer, ...args);
    }
    const depthTexture = readBuffer?.depthTexture;
    if (depthTexture && pass.depthTexture !== depthTexture) pass.setGBuffer?.(depthTexture, undefined);
    pass.needsSwap = false;
    return renderGtaoInPlace(pass, renderer, readBuffer);
  };
  pass.userData.exclusionMaskConfigured = true;
  return true;
}

export function createComposerTarget(width, height, { samples = 0 } = {}) {
  const depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedInt248Type);
  depthTexture.format = THREE.DepthStencilFormat;
  const target = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    stencilBuffer: true,
    depthTexture,
  });
  target.samples = Math.max(0, Number(samples) || 0);
  return target;
}

function configureBlendStencil(material) {
  material.stencilWrite = true;
  material.stencilWriteMask = 0;
  material.stencilFunc = THREE.NotEqualStencilFunc;
  material.stencilRef = GTAO_EXCLUSION_STENCIL_REF;
  material.stencilFuncMask = 0xff;
  material.stencilFail = THREE.KeepStencilOp;
  material.stencilZFail = THREE.KeepStencilOp;
  material.stencilZPass = THREE.KeepStencilOp;
}

function renderGtaoInPlace(pass, renderer, readBuffer) {
  if (pass._renderGBuffer) {
    pass.overrideVisibility();
    pass.renderOverride(renderer, pass.normalMaterial, pass.normalRenderTarget, 0x7777ff, 1);
    pass.restoreVisibility();
  }

  const camera = pass.camera;
  pass.gtaoMaterial.uniforms.cameraNear.value = camera.near;
  pass.gtaoMaterial.uniforms.cameraFar.value = camera.far;
  pass.gtaoMaterial.uniforms.cameraProjectionMatrix.value.copy(camera.projectionMatrix);
  pass.gtaoMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
  pass.gtaoMaterial.uniforms.cameraWorldMatrix.value.copy(camera.matrixWorld);
  pass.renderPass(renderer, pass.gtaoMaterial, pass.gtaoRenderTarget, 0xffffff, 1);

  pass.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(camera.projectionMatrixInverse);
  pass.renderPass(renderer, pass.pdMaterial, pass.pdRenderTarget, 0xffffff, 1);

  pass.blendMaterial.uniforms.intensity.value = pass.blendIntensity;
  pass.blendMaterial.uniforms.tDiffuse.value = pass.pdRenderTarget.texture;
  pass.renderPass(renderer, pass.blendMaterial, readBuffer);
}

function injectDistanceFade(source) {
  if (![DISTANCE_UNIFORMS_ANCHOR, VIEW_POSITION_ANCHOR, AO_RESULT_ANCHOR]
    .every((anchor) => source.includes(anchor))) {
    throw new Error("[GTAO] Installed Three.js shader no longer matches contact-AO patch anchors");
  }
  return source
    .replace(DISTANCE_UNIFORMS_ANCHOR, `${DISTANCE_UNIFORMS_ANCHOR}
\t\tuniform float contactAoFadeStart;
\t\tuniform float contactAoFadeEnd;`)
    .replace(VIEW_POSITION_ANCHOR, `${VIEW_POSITION_ANCHOR}
\t\t\tfloat contactAoDistance = length(viewPos);
\t\t\tif (contactAoDistance >= contactAoFadeEnd) {
\t\t\t\tgl_FragColor = vec4(1.0);
\t\t\t\treturn;
\t\t\t}`)
    .replace(AO_RESULT_ANCHOR, `${AO_RESULT_ANCHOR}
\t\t\tao = mix(ao, 1.0, smoothstep(contactAoFadeStart, contactAoFadeEnd, contactAoDistance));`);
}
