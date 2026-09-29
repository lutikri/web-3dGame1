import * as THREE from "three";

const DISTANCE_UNIFORMS_ANCHOR = "uniform float distanceFallOff;";
const VIEW_POSITION_ANCHOR = "vec3 viewPos = getViewPosition(vUv, depth);";
const AO_RESULT_ANCHOR = "ao = pow(ao, scale);";

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
