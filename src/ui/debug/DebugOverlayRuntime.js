import * as THREE from "three";

export class DebugOverlayRuntime {
  constructor(options) {
    Object.assign(this, options);
  }

  update = () => {
    if (!this.element) return;
    const memory = this.memoryProfiler.getSnapshot();
    const rotation = this.camera.rotation;
    const quality = this.getQuality();
    this.element.textContent = [
      "CAMERA",
      `pos x: ${this.camera.position.x.toFixed(2)}`,
      `pos y: ${this.camera.position.y.toFixed(2)}`,
      `pos z: ${this.camera.position.z.toFixed(2)}`,
      `rot x: ${THREE.MathUtils.radToDeg(rotation.x).toFixed(1)}deg`,
      `rot y: ${THREE.MathUtils.radToDeg(rotation.y).toFixed(1)}deg`,
      `rot z: ${THREE.MathUtils.radToDeg(rotation.z).toFixed(1)}deg`,
      "",
      "LIGHTS: src/OperatorGameConfig.js",
      "CONFIG.lighting.pointLights",
      "",
      `shadows: ${this.renderer.shadowMap.enabled ? quality.shadows : "off"}`,
      `gtao: ${this.postProcessing.gtaoPass ? quality.gtao : "off"}`,
      `ssgi: ${this.realismPostProcessing.ssgiEffect ? quality.ssgi : "off"}`,
      `ssr: ${this.realismPostProcessing.ssgiEffect || this.realismPostProcessing.ssrEffect ? quality.ssr : "off"}`,
      `screen-space AO (HBAO): ${this.realismPostProcessing.screenSpaceShadowEffect ? quality.screenSpaceShadows : "off"}`,
      "",
      "MEMORY",
      `js heap: ${this.formatMemory(memory.heapUsedBytes)} / ${this.formatMemory(memory.heapLimitBytes)}`,
      `system ram hint: ${memory.deviceMemoryGb ? `${memory.deviceMemoryGb} GB` : "n/a"}`,
      `webgl objs: ${memory.textureObjectCount} tex / ${memory.geometryObjectCount} geo`,
      `gpu tex est: ${this.formatMemory(memory.runtimeTextureBytes)}`,
      `largest tex: ${this.formatTexture(memory.largestTexture)}`,
      `largest set: ${memory.largestSet ? `${this.formatMemory(memory.largestSet.bytes)} ${memory.largestSet.label} ${memory.largestSet.tier}` : "n/a"}`,
      "",
      `noclip: ${this.isNoclipEnabled() ? "on" : "off"}`,
      `noclip speed: ${this.getNoclipSpeed().toFixed(2)}`,
      "",
      `hover: ${this.getHoveredObject()?.name ?? "none"}`,
    ].join("\n");
  };
}
