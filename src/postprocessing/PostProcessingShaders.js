import * as THREE from "three";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";

export const chromaticAberrationShader = {
  uniforms: {
    tDiffuse: { value: null },
    amount: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float amount;
    varying vec2 vUv;

    void main() {
      vec2 offset = (vUv - 0.5) * amount;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export const colorAdjustmentShader = {
  uniforms: {
    tDiffuse: { value: null },
    brightness: { value: 0 },
    contrast: { value: 1 },
    saturation: { value: 1 },
    gamma: { value: 1 },
    temperature: { value: 0 },
    tint: { value: 0 },
    emergency: { value: 0 },
    emergencyTint: { value: new THREE.Color("#ff4a2c") },
    emergencyTintStrength: { value: 0 },
    vignetteStrength: { value: 0 },
    vignetteRadius: { value: 0.78 },
    vignetteSoftness: { value: 0.38 },
    grainAmount: { value: 0 },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float brightness;
    uniform float contrast;
    uniform float saturation;
    uniform float gamma;
    uniform float temperature;
    uniform float tint;
    uniform float emergency;
    uniform vec3 emergencyTint;
    uniform float emergencyTintStrength;
    uniform float vignetteStrength;
    uniform float vignetteRadius;
    uniform float vignetteSoftness;
    uniform float grainAmount;
    uniform float time;
    varying vec2 vUv;

    float hash(vec2 p) {
      p += time;
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = source.rgb;

      color = (color - 0.5) * contrast + 0.5;
      color += brightness;

      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color = mix(vec3(luma), color, saturation);

      color.r += temperature * 0.1;
      color.b -= temperature * 0.1;
      color.g += tint * 0.1;
      color = mix(color, emergencyTint, emergency * emergencyTintStrength);
      color = pow(max(color, vec3(0.0)), vec3(1.0 / max(gamma, 0.001)));

      float distanceFromCenter = distance(vUv, vec2(0.5));
      float vignette = smoothstep(vignetteRadius, vignetteRadius - max(vignetteSoftness, 0.001), distanceFromCenter);
      color *= mix(1.0 - vignetteStrength, 1.0, vignette);

      float grain = (hash(gl_FragCoord.xy) - 0.5) * grainAmount;
      color += grain;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), source.a);
    }
  `,
};

export const sharpenShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    amount: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float amount;
    varying vec2 vUv;

    void main() {
      vec2 texel = 1.0 / resolution;
      vec3 center = texture2D(tDiffuse, vUv).rgb;
      vec3 blur = vec3(0.0);
      blur += texture2D(tDiffuse, vUv + texel * vec2(-1.0, 0.0)).rgb;
      blur += texture2D(tDiffuse, vUv + texel * vec2(1.0, 0.0)).rgb;
      blur += texture2D(tDiffuse, vUv + texel * vec2(0.0, -1.0)).rgb;
      blur += texture2D(tDiffuse, vUv + texel * vec2(0.0, 1.0)).rgb;
      blur *= 0.25;
      vec3 color = center + (center - blur) * amount;
      gl_FragColor = vec4(clamp(color, 0.0, 1.0), texture2D(tDiffuse, vUv).a);
    }
  `,
};

export const lensDistortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    barrelAmount: { value: 0 },
    fisheyeAmount: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float barrelAmount;
    uniform float fisheyeAmount;
    varying vec2 vUv;

    void main() {
      vec2 centered = vUv * 2.0 - 1.0;
      float radius2 = dot(centered, centered);
      float radius = sqrt(radius2);
      float normalizedRadius = min(radius / 1.41421356, 1.0);

      float tangentRadius = tan(normalizedRadius * 1.15) / tan(1.15);
      float equidistantRadius = atan(normalizedRadius * 2.2) / atan(2.2);
      float projectedRadius = fisheyeAmount >= 0.0 ? tangentRadius : equidistantRadius;
      float fisheyeRadius = mix(normalizedRadius, projectedRadius, clamp(abs(fisheyeAmount), 0.0, 1.0));
      float fisheyeScale = radius > 0.00001 ? fisheyeRadius / max(normalizedRadius, 0.00001) : 1.0;
      float barrelScale = 1.0 + barrelAmount * radius2;
      vec2 uv = clamp(centered * fisheyeScale * barrelScale * 0.5 + 0.5, vec2(0.0), vec2(1.0));

      gl_FragColor = texture2D(tDiffuse, uv);
    }
  `,
};

export const lensEffectsShader = {
  uniforms: {
    tDiffuse: { value: null },
    bloomTexture: { value: null },
    lensDirtTexture: { value: null },
    hasBloomTexture: { value: 0 },
    hasLensDirtTexture: { value: 0 },
    glareEnabled: { value: 0 },
    glareStrength: { value: 0 },
    glareThreshold: { value: 0.72 },
    glareLength: { value: 0.1 },
    glareTint: { value: new THREE.Color("#d8e8ff") },
    ghostsEnabled: { value: 0 },
    ghostStrength: { value: 0 },
    ghostThreshold: { value: 0.82 },
    ghostSpacing: { value: 0.72 },
    ghostTint: { value: new THREE.Color("#b7d8ff") },
    ghostChromaticAberration: { value: 0.006 },
    haloStrength: { value: 0.12 },
    haloRadius: { value: 0.42 },
    dirtEnabled: { value: 0 },
    dirtStrength: { value: 0 },
    dirtSpread: { value: 0 },
    dirtTint: { value: new THREE.Color("#ffffff") },
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D bloomTexture;
    uniform sampler2D lensDirtTexture;
    uniform float hasBloomTexture;
    uniform float hasLensDirtTexture;
    uniform float glareEnabled;
    uniform float glareStrength;
    uniform float glareThreshold;
    uniform float glareLength;
    uniform vec3 glareTint;
    uniform float ghostsEnabled;
    uniform float ghostStrength;
    uniform float ghostThreshold;
    uniform float ghostSpacing;
    uniform vec3 ghostTint;
    uniform float ghostChromaticAberration;
    uniform float haloStrength;
    uniform float haloRadius;
    uniform float dirtEnabled;
    uniform float dirtStrength;
    uniform float dirtSpread;
    uniform vec3 dirtTint;
    varying vec2 vUv;

    float luminance(vec3 color) {
      return dot(color, vec3(0.2126, 0.7152, 0.0722));
    }

    vec3 highlights(vec3 color, float threshold) {
      float contribution = smoothstep(threshold, min(1.0, threshold + 0.18), luminance(color));
      return color * contribution;
    }

    vec3 sampleBloom(vec2 uv) {
      return texture2D(bloomTexture, clamp(uv, 0.0, 1.0)).rgb * hasBloomTexture;
    }

    vec3 sampleBloomChromatic(vec2 uv, vec2 direction) {
      vec2 offset = direction * ghostChromaticAberration;
      return vec3(
        sampleBloom(uv + offset).r,
        sampleBloom(uv).g,
        sampleBloom(uv - offset).b
      );
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 glare = vec3(0.0);

      if (glareEnabled > 0.5) {
        for (int i = 1; i <= 6; i++) {
          float stepAmount = float(i) / 6.0;
          float weight = (1.0 - stepAmount) * 0.24 + 0.04;
          vec2 offset = vec2(glareLength * stepAmount, 0.0);
          glare += highlights(sampleBloom(vUv + offset), glareThreshold) * weight;
          glare += highlights(sampleBloom(vUv - offset), glareThreshold) * weight;
        }
      }

      glare *= glareTint * glareStrength * glareEnabled;

      vec3 ghosts = vec3(0.0);
      if (ghostsEnabled > 0.5) {
        vec2 uv = vec2(1.0) - vUv;
        vec2 ghostVector = (vec2(0.5) - uv) * ghostSpacing;
        for (int i = 1; i <= 4; i++) {
          float index = float(i);
          vec2 ghostUv = fract(uv + ghostVector * index);
          float edgeWeight = 1.0 - smoothstep(0.0, 0.72, distance(ghostUv, vec2(0.5)));
          vec2 direction = normalize(ghostUv - 0.5 + vec2(0.0001));
          ghosts += highlights(sampleBloomChromatic(ghostUv, direction), ghostThreshold) * edgeWeight;
        }

        vec2 haloDirection = normalize(ghostVector + vec2(0.0001));
        vec2 haloUv = fract(uv + haloDirection * haloRadius);
        float haloWeight = 1.0 - smoothstep(0.0, 0.72, distance(haloUv, vec2(0.5)));
        ghosts += highlights(sampleBloomChromatic(haloUv, haloDirection), ghostThreshold) * haloWeight * haloStrength;
      }
      ghosts *= ghostTint * ghostStrength * ghostsEnabled;

      vec3 dirt = vec3(0.0);
      if (dirtEnabled > 0.5 && hasLensDirtTexture > 0.5) {
        vec3 dirtMask = texture2D(lensDirtTexture, vUv).rgb;
        vec2 spread = vec2(dirtSpread);
        vec3 bloomIllumination = sampleBloom(vUv) * 0.28;
        bloomIllumination += sampleBloom(vUv + vec2(spread.x, 0.0)) * 0.09;
        bloomIllumination += sampleBloom(vUv - vec2(spread.x, 0.0)) * 0.09;
        bloomIllumination += sampleBloom(vUv + vec2(0.0, spread.y)) * 0.09;
        bloomIllumination += sampleBloom(vUv - vec2(0.0, spread.y)) * 0.09;
        bloomIllumination += sampleBloom(vUv + spread) * 0.09;
        bloomIllumination += sampleBloom(vUv - spread) * 0.09;
        bloomIllumination += sampleBloom(vUv + vec2(spread.x, -spread.y)) * 0.09;
        bloomIllumination += sampleBloom(vUv + vec2(-spread.x, spread.y)) * 0.09;
        dirt = bloomIllumination * dirtMask * dirtTint * dirtStrength;
      }

      gl_FragColor = vec4(clamp(source.rgb + glare + ghosts + dirt, 0.0, 1.0), source.a);
    }
  `,
};

export const compatibleFxaaShader = {
  ...FXAAShader,
  name: "CompatibleFXAAShader",
  fragmentShader: FXAAShader.fragmentShader.replaceAll("-100.0", "-16.0"),
};

