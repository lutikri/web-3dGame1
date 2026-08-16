import * as THREE from "three";

const TAU = Math.PI * 2;

export function createPlasmaViewRuntime(root, parts, config = {}, prefabName = "PlasmaView") {
  const core = parts.get(config.meshName ?? "Torus.003") ?? findFirstMesh(root);
  if (!core) {
    console.warn(`[PlasmaView] Missing plasma mesh in prefab "${prefabName}"`);
    return null;
  }

  const sharedUniforms = createSharedUniforms();
  const coreMaterial = createPlasmaMaterial(sharedUniforms, 0);
  const haloMaterial = createPlasmaMaterial(sharedUniforms, 1);
  core.material = coreMaterial;
  core.name = config.runtimeCoreName ?? "SM_PlasmaView1_Core";
  core.castShadow = false;
  core.receiveShadow = false;
  core.frustumCulled = false;
  core.renderOrder = config.coreRenderOrder ?? 20;

  const halo = new THREE.Mesh(core.geometry, haloMaterial);
  halo.name = "FX_PlasmaView_Halo";
  halo.position.copy(core.position);
  halo.quaternion.copy(core.quaternion);
  halo.scale.copy(core.scale).multiplyScalar(config.haloScale ?? 1.075);
  halo.castShadow = false;
  halo.receiveShadow = false;
  halo.frustumCulled = false;
  halo.renderOrder = config.haloRenderOrder ?? 19;
  core.parent.add(halo);

  const light = new THREE.PointLight(
    config.lightColor ?? 0x6da8ff,
    0,
    config.lightDistance ?? 6,
    config.lightDecay ?? 2,
  );
  light.name = `${prefabName}_PlasmaLight`;
  light.castShadow = false;
  light.position.fromArray(config.lightLocalOffset ?? [2.665, 0.147, 4.985]);
  root.add(light);

  const runtime = {
    root,
    core,
    halo,
    light,
    materials: [coreMaterial, haloMaterial],
    uniforms: sharedUniforms,
    elapsed: 0,
    pulse: 0,
    lastPulseCount: 0,
    activity: 0,
    temperature: 0,
    overheat: 0,
    instability: 0,
    uniformity: 0,
    surge: 0,
    stall: 0,
    brightness: 0,
    config,
    dispose() {
      halo.parent?.remove(halo);
      light.parent?.remove(light);
    },
  };
  applyPlasmaViewConfig(runtime, config);
  return runtime;
}

export function applyPlasmaViewConfig(runtime, config = {}) {
  if (!runtime) return false;
  runtime.config = config;
  const uniforms = runtime.uniforms;
  uniforms.uFlowSpeed.value = config.flowSpeed ?? 38;
  uniforms.uBaseFlowRatio.value = config.baseFlowRatio ?? 0.055;
  uniforms.uBaseStrength.value = config.baseStrength ?? 0.8;
  uniforms.uCoreGain.value = config.coreGain ?? 1.15;
  uniforms.uHaloGain.value = config.haloGain ?? 0.14;
  uniforms.uCoreOpacity.value = config.coreOpacity ?? 0.52;
  uniforms.uHaloOpacity.value = config.haloOpacity ?? 0.12;
  uniforms.uHazeStrength.value = config.hazeStrength ?? 0.16;
  uniforms.uFilamentStrength.value = config.filamentStrength ?? 1.8;
  uniforms.uFilamentDensity.value = config.filamentDensity ?? 14;
  uniforms.uFilamentSharpness.value = config.filamentSharpness ?? 0.76;
  uniforms.uFilamentSegmentation.value = config.filamentSegmentation ?? 0.78;
  uniforms.uHotspotStrength.value = config.hotspotStrength ?? 2.4;
  uniforms.uHotspotThreshold.value = config.hotspotThreshold ?? 0.72;
  uniforms.uColorVariation.value = config.colorVariation ?? 0.72;
  uniforms.uBaseColor.value.set(config.baseColor ?? 0x6f1f91);
  uniforms.uStableColor.value.set(config.stableColor ?? 0x3978d8);
  uniforms.uFilamentColor.value.set(config.filamentColor ?? 0xff45c8);
  uniforms.uHotspotColor.value.set(config.hotspotColor ?? 0xffe6ff);
  uniforms.uDangerColor.value.set(config.dangerColor ?? 0xff4a20);
  uniforms.uImpurityColor.value.set(config.impurityColor ?? 0x38d69b);
  uniforms.uDisplacementScale.value = config.displacementScale ?? 0.095;
  runtime.halo.scale.copy(runtime.core.scale).multiplyScalar(config.haloScale ?? 1.055);
  runtime.light.color.set(config.lightColor ?? 0x8f49c7);
  runtime.light.distance = config.lightDistance ?? 6;
  runtime.light.decay = config.lightDecay ?? 2;
  runtime.light.position.fromArray(config.lightLocalOffset ?? [2.665, 0.147, 4.985]);
  return true;
}

export function updatePlasmaViewRuntime(runtime, snapshot, dt) {
  if (!runtime || !snapshot) return null;
  const safeDt = THREE.MathUtils.clamp(Number(dt) || 0, 0, 0.1);
  runtime.elapsed += safeDt;

  const phaseTemp = Array.isArray(snapshot.phase?.temp) ? snapshot.phase.temp : [75, 145];
  const tempMin = Number(phaseTemp[0]) || 75;
  const tempMax = Math.max(tempMin + 1, Number(phaseTemp[1]) || 145);
  const running = snapshot.mode === "running" ? 1 : 0;
  const shutdown = THREE.MathUtils.clamp(Number(snapshot.shutdownLevel) || 0, 0, 1);
  const burnRate = THREE.MathUtils.clamp(Number(snapshot.burnRate) || 0, 0, 1.2);
  const output = THREE.MathUtils.clamp((Number(snapshot.powerOutput) || 0) / 1200, 0, 1.2);
  const containment = THREE.MathUtils.clamp((Number(snapshot.containment) || 0) / 100, 0, 1);
  const efficiency = THREE.MathUtils.clamp((Number(snapshot.reactionEfficiency) || 0) / 100, 0, 1);
  const surge = THREE.MathUtils.clamp((Number(snapshot.outputSurge) || 0) / 100, 0, 1);
  const stall = THREE.MathUtils.clamp((Number(snapshot.coreStall) || 0) / 100, 0, 1);
  const fuelImpurity = THREE.MathUtils.clamp(Number(snapshot.fuelBlend?.efficiencyPenalty) || 0, 0, 0.85);
  const temperature = smoothstep(45, tempMax, Number(snapshot.plasmaTemp) || 0);
  const cold = 1 - smoothstep(55, tempMin, Number(snapshot.plasmaTemp) || 0);
  const overheat = smoothstep(tempMax, 180, Number(snapshot.plasmaTemp) || 0);
  const fieldInstability = 1 - smoothstep(0.35, 0.78, containment);
  const targetActivity = running * (1 - shutdown) * THREE.MathUtils.clamp(
    burnRate * (0.34 + Math.sqrt(output) * 0.66),
    0,
    1.15,
  );
  const targetInstability = THREE.MathUtils.clamp(Math.max(
    fieldInstability,
    surge * 0.9,
    stall * 0.72,
    cold * 0.48,
  ) + fuelImpurity * 0.22, 0, 1);
  const targetBrightness = targetActivity * (0.32 + Math.sqrt(output) * 1.15);

  const pulseCount = Math.max(0, Number(snapshot.ignitionPulseCount) || 0);
  if (pulseCount > runtime.lastPulseCount) runtime.pulse = 1;
  runtime.lastPulseCount = pulseCount;
  runtime.pulse = damp(runtime.pulse, 0, 5.8, safeDt);
  runtime.activity = damp(runtime.activity, targetActivity, running ? 3.2 : 1.6, safeDt);
  runtime.temperature = damp(runtime.temperature, temperature, 2.1, safeDt);
  runtime.overheat = damp(runtime.overheat, overheat, 2.5, safeDt);
  runtime.instability = damp(runtime.instability, targetInstability, 3.4, safeDt);
  runtime.uniformity = damp(runtime.uniformity, efficiency, 1.8, safeDt);
  runtime.surge = damp(runtime.surge, surge, 5.5, safeDt);
  runtime.stall = damp(runtime.stall, stall, 2.8, safeDt);
  runtime.brightness = damp(runtime.brightness, targetBrightness, running ? 3 : 1.4, safeDt);

  const uniforms = runtime.uniforms;
  uniforms.uTime.value = runtime.elapsed;
  uniforms.uActivity.value = runtime.activity;
  uniforms.uTemperature.value = runtime.temperature;
  uniforms.uOverheat.value = runtime.overheat;
  uniforms.uInstability.value = runtime.instability;
  uniforms.uUniformity.value = runtime.uniformity;
  uniforms.uSurge.value = runtime.surge;
  uniforms.uStall.value = runtime.stall;
  uniforms.uPulse.value = runtime.pulse;
  uniforms.uImpurity.value = fuelImpurity;
  uniforms.uBrightness.value = runtime.brightness;

  runtime.core.visible = runtime.activity > 0.002 || runtime.pulse > 0.01;
  runtime.halo.visible = runtime.core.visible;
  const lightFactor = THREE.MathUtils.clamp(runtime.brightness * 0.78 + runtime.pulse * 0.55, 0, 1.4);
  runtime.light.intensity = (runtime.config.lightIntensity ?? 5.5) * lightFactor;
  runtime.light.color.copy(getPlasmaLightColor(
    runtime.temperature,
    runtime.overheat,
    runtime.config.lightColor,
  ));
  return runtime;
}

function createSharedUniforms() {
  return {
    uTime: { value: 0 },
    uActivity: { value: 0 },
    uTemperature: { value: 0 },
    uOverheat: { value: 0 },
    uInstability: { value: 0 },
    uUniformity: { value: 0 },
    uSurge: { value: 0 },
    uStall: { value: 0 },
    uPulse: { value: 0 },
    uImpurity: { value: 0 },
    uBrightness: { value: 0 },
    uFlowSpeed: { value: 1 },
    uBaseFlowRatio: { value: 0.055 },
    uBaseStrength: { value: 0.8 },
    uCoreGain: { value: 1.15 },
    uHaloGain: { value: 0.14 },
    uCoreOpacity: { value: 0.52 },
    uHaloOpacity: { value: 0.12 },
    uHazeStrength: { value: 0.16 },
    uFilamentStrength: { value: 1.8 },
    uFilamentDensity: { value: 14 },
    uFilamentSharpness: { value: 0.76 },
    uFilamentSegmentation: { value: 0.78 },
    uHotspotStrength: { value: 2.4 },
    uHotspotThreshold: { value: 0.72 },
    uColorVariation: { value: 0.72 },
    uBaseColor: { value: new THREE.Color(0x6f1f91) },
    uStableColor: { value: new THREE.Color(0x3978d8) },
    uFilamentColor: { value: new THREE.Color(0xff45c8) },
    uHotspotColor: { value: new THREE.Color(0xffe6ff) },
    uDangerColor: { value: new THREE.Color(0xff4a20) },
    uImpurityColor: { value: new THREE.Color(0x38d69b) },
    uDisplacementScale: { value: 0.095 },
  };
}

function createPlasmaMaterial(sharedUniforms, layer) {
  return new THREE.ShaderMaterial({
    name: layer === 0 ? "M_PlasmaView_Core" : "M_PlasmaView_Halo",
    uniforms: {
      ...sharedUniforms,
      uLayer: { value: layer },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform float uActivity;
      uniform float uInstability;
      uniform float uSurge;
      uniform float uLayer;
      uniform float uFlowSpeed;
      uniform float uBaseFlowRatio;
      uniform float uBaseStrength;
      uniform float uDisplacementScale;
      varying vec2 vPlasmaUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      void main() {
        vPlasmaUv = uv;
        float majorWave = sin(uv.x * ${TAU.toFixed(8)} * 3.0 + uTime * 3.8 * uFlowSpeed);
        float fineWave = sin(uv.x * ${TAU.toFixed(8)} * 11.0 - uTime * 8.6 * uFlowSpeed + uv.y * 5.0);
        float stabilityResponse = 0.08 + uInstability * 0.92;
        float displacement = (majorWave * 0.72 + fineWave * 0.28) * uDisplacementScale
          * stabilityResponse * uActivity * (1.0 + uSurge * 0.8);
        vec3 transformed = position + normal * displacement;
        vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uTime;
      uniform float uActivity;
      uniform float uTemperature;
      uniform float uOverheat;
      uniform float uInstability;
      uniform float uUniformity;
      uniform float uSurge;
      uniform float uStall;
      uniform float uPulse;
      uniform float uImpurity;
      uniform float uBrightness;
      uniform float uLayer;
      uniform float uFlowSpeed;
      uniform float uBaseFlowRatio;
      uniform float uBaseStrength;
      uniform float uCoreGain;
      uniform float uHaloGain;
      uniform float uCoreOpacity;
      uniform float uHaloOpacity;
      uniform float uHazeStrength;
      uniform float uFilamentStrength;
      uniform float uFilamentDensity;
      uniform float uFilamentSharpness;
      uniform float uFilamentSegmentation;
      uniform float uHotspotStrength;
      uniform float uHotspotThreshold;
      uniform float uColorVariation;
      uniform vec3 uBaseColor;
      uniform vec3 uStableColor;
      uniform vec3 uFilamentColor;
      uniform vec3 uHotspotColor;
      uniform vec3 uDangerColor;
      uniform vec3 uImpurityColor;
      varying vec2 vPlasmaUv;
      varying vec3 vWorldNormal;
      varying vec3 vWorldPosition;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise21(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.52;
        for (int i = 0; i < 5; i++) {
          value += noise21(p) * amplitude;
          p = p * 2.03 + vec2(17.1, 9.2);
          amplitude *= 0.49;
        }
        return value;
      }

      void main() {
        float speed = (0.3 + uActivity * 1.08 + uSurge * 1.75) * uFlowSpeed;
        float baseSpeed = speed * uBaseFlowRatio;
        vec2 baseDomain = vec2(vPlasmaUv.x * 16.0 - uTime * baseSpeed, vPlasmaUv.y * 5.0);
        vec2 fastDomain = vec2(vPlasmaUv.x * 16.0 - uTime * speed, vPlasmaUv.y * 5.0);
        float baseWarp = fbm(baseDomain * 0.56 + vec2(uTime * 0.13, -uTime * 0.08));
        float flow = fbm(baseDomain + vec2(baseWarp * 2.8, baseWarp * 1.3));
        float softBands = 0.5 + 0.5 * sin(vPlasmaUv.x * ${TAU.toFixed(8)} * 7.0
          - uTime * baseSpeed * 2.2 + baseWarp * 7.0);
        float baseBody = smoothstep(0.28, 0.8, flow * 0.68 + softBands * 0.32);
        float warp = fbm(fastDomain * 0.56 + vec2(uTime * 1.7, -uTime * 1.1));
        float fine = fbm(fastDomain * 2.15 - vec2(uTime * speed * 0.7, 0.0));
        float disorder = clamp(uInstability * 0.8 + uStall * 0.75 + (1.0 - uUniformity) * 0.28, 0.0, 1.0);
        float breakupNoise = mix(0.42, baseBody * 0.72 + fine * 0.28, disorder);
        float continuity = smoothstep(0.18 + uStall * 0.48, 0.56, uActivity + breakupNoise * (1.0 - uStall * 0.55));
        float lineA = 0.5 + 0.5 * sin(vPlasmaUv.x * ${TAU.toFixed(8)} * uFilamentDensity
          + vPlasmaUv.y * 9.0 + warp * 5.2 - uTime * speed * 2.4);
        float lineB = 0.5 + 0.5 * sin(vPlasmaUv.x * ${TAU.toFixed(8)} * (uFilamentDensity * 0.57)
          - vPlasmaUv.y * 15.0 - fine * 4.0 - uTime * speed * 1.45);
        float filamentSeed = max(lineA * (0.62 + fine * 0.38), lineB * (0.55 + flow * 0.45));
        float filamentEnd = min(0.995, uFilamentSharpness + 0.13);
        float filaments = smoothstep(uFilamentSharpness, filamentEnd, filamentSeed)
          * (0.52 + disorder * 0.48);
        float segmentField = fbm(vec2(vPlasmaUv.x * 5.0 - uTime * speed * 0.34,
          vPlasmaUv.y * 22.0 + warp * 2.4));
        float segmentMask = smoothstep(0.38, 0.7, segmentField);
        filaments *= mix(1.0, segmentMask, uFilamentSegmentation);
        float hotspotCarrier = 0.5 + 0.5 * sin(vPlasmaUv.x * ${TAU.toFixed(8)} * 2.0
          + vPlasmaUv.y * 19.0 - uTime * speed * 0.82 + warp * 3.0);
        float hotspotSeed = hotspotCarrier * 0.64 + fine * 0.36 + uSurge * 0.1 + uOverheat * 0.06;
        float hotspots = filaments * smoothstep(uHotspotThreshold,
          min(0.995, uHotspotThreshold + 0.12), hotspotSeed) * (0.45 + disorder * 0.55);

        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 2.1);
        float colorField = fbm(baseDomain * 0.34 + vec2(baseWarp * 1.7, -uTime * baseSpeed * 0.12));
        float colorDetail = fbm(fastDomain * 0.47 + vec2(8.3, 19.7));
        float stablePatch = smoothstep(0.42, 0.8, colorField)
          * uUniformity * (1.0 - disorder * 0.7) * uColorVariation;
        float filamentPatch = clamp(filaments * (0.38 + colorDetail * 0.62)
          * uColorVariation, 0.0, 1.0);
        float dangerPatch = clamp((smoothstep(0.64, 0.9, 1.0 - colorField) * disorder * 0.42
          + hotspots * (uOverheat * 0.7 + uSurge * 0.52)) * uColorVariation, 0.0, 1.0);
        float impurityPatch = smoothstep(0.7, 0.94, colorDetail) * uImpurity
          * (0.18 + disorder * 0.82) * uColorVariation;
        vec3 plasmaColor = mix(uBaseColor, uStableColor, stablePatch);
        plasmaColor = mix(plasmaColor, uFilamentColor, filamentPatch);
        plasmaColor = mix(plasmaColor, uHotspotColor,
          clamp(hotspots * uHotspotStrength, 0.0, 1.0));
        plasmaColor = mix(plasmaColor, uDangerColor, dangerPatch);
        plasmaColor = mix(plasmaColor, uImpurityColor, impurityPatch);

        float activity = clamp(uActivity + uPulse * 0.85, 0.0, 1.35);
        float haze = baseBody * uHazeStrength;
        float localEnergy = 0.08 + baseBody * uBaseStrength * 0.55 + haze * 0.35
          + filaments * uFilamentStrength * 1.35
          + hotspots * uHotspotStrength * 3.2 + uPulse * (0.2 + hotspots * 1.4);
        float layerMask = uLayer < 0.5
          ? (baseBody * uBaseStrength * 0.34 + haze * 0.35
            + filaments * 0.92 + hotspots * 1.25 + fresnel * 0.08)
          : (fresnel * 0.38 + baseBody * uBaseStrength * 0.12
            + haze * 0.26 + filaments * 0.26 + hotspots * 0.18);
        float opacity = uLayer < 0.5 ? uCoreOpacity : uHaloOpacity;
        float alpha = continuity * activity * layerMask * opacity;
        if (alpha < 0.006) discard;
        float layerEnergy = uLayer < 0.5 ? uCoreGain : uHaloGain;
        float heatBoost = 0.75 + uOverheat * 0.22 + uSurge * 0.12;
        vec3 color = plasmaColor * localEnergy * layerEnergy
          * (0.18 + uBrightness * 0.46 + uPulse * 0.32) * heatBoost;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, opacity));
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: layer === 0 ? THREE.NormalBlending : THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: true,
  });
}

function getPlasmaLightColor(temperature, overheat, configuredColor = 0x8f49c7) {
  const color = new THREE.Color(configuredColor).lerp(new THREE.Color(0x7f67d9), temperature * 0.35);
  return color.lerp(new THREE.Color(0xff6a24), overheat * 0.32);
}

function findFirstMesh(root) {
  let found = null;
  root.traverse((object) => {
    if (!found && object.isMesh) found = object;
  });
  return found;
}

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function smoothstep(minimum, maximum, value) {
  return THREE.MathUtils.smoothstep(value, minimum, maximum);
}
