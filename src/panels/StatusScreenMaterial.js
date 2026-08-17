import * as THREE from "three";

export const DEFAULT_STATUS_SCREEN_EFFECTS = Object.freeze({
  brightness: 1.4,
  scanlineStrength: 0.04,
  scanlineDensity: 1,
  edgeDarkening: 0.1,
  cornerDarkening: 0.24,
  centerBoost: 0.18,
  flickerStrength: 0.012,
  jitterStrength: 0.12,
  jitterEventStrength: 0.4,
  persistenceStrength: 0.14,
  persistenceDecay: 0.26,
});

const CONFIG_RANGES = {
  brightness: [0, 4],
  scanlineStrength: [0, 0.25],
  scanlineDensity: [0.25, 3],
  edgeDarkening: [0, 0.5],
  cornerDarkening: [0, 1],
  centerBoost: [0, 1],
  flickerStrength: [0, 0.1],
  jitterStrength: [0, 2],
  jitterEventStrength: [0, 3],
  persistenceStrength: [0, 1],
  persistenceDecay: [0.01, 2],
};

const UNIFORM_BY_CONFIG_KEY = {
  brightness: "uBrightness",
  scanlineStrength: "uScanlineStrength",
  scanlineDensity: "uScanlineDensity",
  edgeDarkening: "uEdgeDarkening",
  cornerDarkening: "uCornerDarkening",
  centerBoost: "uCenterBoost",
  flickerStrength: "uFlickerStrength",
  jitterStrength: "uJitterStrength",
  jitterEventStrength: "uJitterEventStrength",
  persistenceStrength: "uPersistenceStrength",
  persistenceDecay: "uPersistenceDecay",
};

export function normalizeStatusScreenEffects(config = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_STATUS_SCREEN_EFFECTS).map(([key, fallback]) => {
    const [min, max] = CONFIG_RANGES[key];
    const value = Number(config[key]);
    return [key, THREE.MathUtils.clamp(Number.isFinite(value) ? value : fallback, min, max)];
  }));
}

export function getStatusScreenPersistenceWeight(age, strength, decay) {
  const safeAge = Math.max(0, Number(age) || 0);
  const safeStrength = THREE.MathUtils.clamp(Number(strength) || 0, 0, 1);
  const safeDecay = Math.max(0.01, Number(decay) || DEFAULT_STATUS_SCREEN_EFFECTS.persistenceDecay);
  return Math.exp(-safeAge / safeDecay) * safeStrength;
}

export function createStatusScreenMaterial({ currentTexture, previousTexture, width, height, config } = {}) {
  const effects = normalizeStatusScreenEffects(config);
  const material = new THREE.ShaderMaterial({
    name: "StatusScreenCRTMaterial",
    uniforms: {
      uCurrentMap: { value: currentTexture },
      uPreviousMap: { value: previousTexture },
      uResolution: { value: new THREE.Vector2(width, height) },
      uTime: { value: 0 },
      uPersistenceAge: { value: 1000 },
      uPowerFactor: { value: 1 },
      ...createEffectUniforms(effects),
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uCurrentMap;
      uniform sampler2D uPreviousMap;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uPersistenceAge;
      uniform float uPowerFactor;
      uniform float uBrightness;
      uniform float uScanlineStrength;
      uniform float uScanlineDensity;
      uniform float uEdgeDarkening;
      uniform float uCornerDarkening;
      uniform float uCenterBoost;
      uniform float uFlickerStrength;
      uniform float uJitterStrength;
      uniform float uJitterEventStrength;
      uniform float uPersistenceStrength;
      uniform float uPersistenceDecay;
      varying vec2 vUv;

      void main() {
        vec2 texel = 1.0 / uResolution;
        float slowDrift = sin(uTime * 2.7) * 0.55 + sin(uTime * 7.1 + 1.4) * 0.2;
        float eventPulse = pow(max(0.0, sin(uTime * 0.77 + 2.1)), 24.0);
        float lineCenter = fract(uTime * 0.071 + 0.31);
        float lineBand = exp(-pow((vUv.y - lineCenter) * 90.0, 2.0));
        float jitterPixels = slowDrift * uJitterStrength
          + eventPulse * uJitterEventStrength * (0.35 + lineBand * 0.65);
        vec2 uv = clamp(vUv + vec2(jitterPixels * texel.x, 0.0), texel, 1.0 - texel);

        vec3 center = texture2D(uCurrentMap, uv).rgb;
        vec3 color = center;

        vec3 previous = texture2D(uPreviousMap, uv).rgb;
        float persistence = exp(-uPersistenceAge / max(0.01, uPersistenceDecay)) * uPersistenceStrength;
        color += max(previous - center, vec3(0.0)) * persistence;

        float scanPhase = uv.y * uResolution.y * 3.14159265 * uScanlineDensity;
        float scanline = 0.5 + 0.5 * sin(scanPhase);
        color *= 1.0 - scanline * uScanlineStrength;

        vec2 centered = (uv - 0.5) * vec2(1.0, 0.82);
        float radiusSq = dot(centered, centered);
        float edge = clamp(radiusSq * 2.3, 0.0, 1.0);
        float centerLight = exp(-radiusSq * 4.5);
        vec2 cornerDelta = uv - vec2(0.92, 0.08);
        float corner = exp(-dot(cornerDelta, cornerDelta) * 6.0);
        float tubeBrightness = (1.0 - edge * uEdgeDarkening)
          * (1.0 - corner * uCornerDarkening)
          * (1.0 + centerLight * uCenterBoost);

        float flickerWave = sin(uTime * 37.0) * 0.45
          + sin(uTime * 6.1 + 1.7) * 0.35
          + sin(uTime * 91.0 + 0.4) * 0.2;
        float flicker = 1.0 + flickerWave * uFlickerStrength;
        color *= tubeBrightness * flicker * uBrightness * uPowerFactor;

        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    toneMapped: false,
  });
  material.userData.statusScreenEffects = effects;
  return material;
}

export function applyStatusScreenMaterialConfig(material, config) {
  const effects = normalizeStatusScreenEffects(config);
  Object.entries(UNIFORM_BY_CONFIG_KEY).forEach(([key, uniformName]) => {
    if (material?.uniforms?.[uniformName]) material.uniforms[uniformName].value = effects[key];
  });
  if (material) material.userData.statusScreenEffects = effects;
  return effects;
}

function createEffectUniforms(effects) {
  return Object.fromEntries(Object.entries(UNIFORM_BY_CONFIG_KEY).map(([key, uniformName]) => [
    uniformName,
    { value: effects[key] },
  ]));
}
