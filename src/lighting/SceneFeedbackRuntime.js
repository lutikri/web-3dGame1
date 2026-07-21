import * as THREE from "three";

export class SceneFeedbackRuntime {
  constructor({
    config, camera, controlledLights, postProcessing, realism, diagnostics, roomLighting,
    getSnapshot, getTime, getZoomActive, getStartupAmount, getIgnitionPulseAmount,
    getEmergencyAmount, getTerminalLightFactor, getFixtureFactor,
    flickerWave, getRoomMaterials = () => [], applyColorAdjustments, applyLensDistortion,
    createStartupPattern = () => [], getStartupPatternFactor = () => 1, updateFixtureFlicker = () => {},
  }) {
    Object.assign(this, {
      config, camera, controlledLights, postProcessing, realism, diagnostics, roomLighting,
      getSnapshot, getTime, getZoomActive, getStartupAmount, getIgnitionPulseAmount,
      getEmergencyAmount, getTerminalLightFactor, getFixtureFactor,
      flickerWave, getRoomMaterials, applyColorAdjustments, applyLensDistortion,
      createStartupPattern, getStartupPatternFactor, updateFixtureFlicker,
    });
    this.appliedCameraRoll = 0;
    this.startupTimer = 0;
    this.indicatorTimer = 0;
    this.ignitionPulseTimer = 0;
    this.startupPattern = [];
  }

  update = (dt) => {
    this.startupTimer = Math.max(0, this.startupTimer - dt);
    this.ignitionPulseTimer = Math.max(0, this.ignitionPulseTimer - dt);
    this.updateIndicatorTest(dt);
    this.updateFixtureFlicker(dt);
    this.roomLighting.update(dt);
    this.updateLighting();
    this.updateCamera();
  };

  triggerStartup = () => {
    this.startupTimer = this.config.feedback.startup.duration;
    this.startupPattern = this.createStartupPattern();
  };
  triggerIgnitionPulse = () => { this.ignitionPulseTimer = this.config.feedback.ignitionPulse.duration; };
  updateIndicatorTest = (dt) => {
    if (!this.diagnostics.isSelfTestActive()) {
      this.indicatorTimer = 0;
      return;
    }
    this.indicatorTimer = Math.min(this.indicatorTimer + dt, this.config.feedback.indicatorTest.duration);
  };
  getStartupLightFactor = () => {
    if (this.startupTimer <= 0) return 1;
    const startup = this.config.feedback.startup;
    return this.getStartupPatternFactor(this.startupPattern, startup.duration - this.startupTimer);
  };
  setStartupTimer = (value) => { this.startupTimer = Math.max(0, Number(value) || 0); };
  setIndicatorTimer = (value) => { this.indicatorTimer = Math.max(0, Number(value) || 0); };
  getStartupTimer = () => this.startupTimer;
  getIndicatorTimer = () => this.indicatorTimer;
  getIgnitionPulseTimer = () => this.ignitionPulseTimer;

  updateRoomMaterials = () => {
    const exponent = this.config.feedback.longTermLightFlicker?.emissiveExponent ?? 1;
    const visualFactor = Math.max(this.roomLighting.getVisualFactor(), this.roomLighting.getAfterglowFactor?.() ?? 0)
      * Math.pow(this.getStartupLightFactor(), exponent)
      * this.getTerminalLightFactor()
      * this.diagnostics.getBlackoutFactor();
    this.getRoomMaterials().forEach((material) => {
      if (!material.userData.roomLightControlled) return;
      const flickerFactor = Math.pow(this.getFixtureFactor(material), exponent);
      material.emissiveIntensity = (material.userData.baseEmissiveIntensity ?? 1) * visualFactor * flickerFactor;
      material.needsUpdate = true;
    });
  };

  updateLighting = () => {
    const snapshot = this.getSnapshot();
    const outputLow = snapshot.mode === "running" && snapshot.warning?.outputLow ? 1 : 0;
    const emergency = this.getEmergencyAmount();
    const outputConfig = this.config.feedback.outputLow;
    const outputPulse = outputLow
      ? THREE.MathUtils.lerp(1 - outputConfig.lightFlicker, 1 - outputConfig.lightFlicker * 0.42, this.flickerWave(9, 0.4))
      : 1;
    const emergencyPulse = emergency ? THREE.MathUtils.lerp(0.72, 1.18, this.flickerWave(18, 2.7)) : 1;
    const sceneFactor = this.getStartupLightFactor()
      * outputPulse
      * emergencyPulse
      * this.getTerminalLightFactor()
      * this.diagnostics.getBlackoutFactor();
    const roomFactor = this.roomLighting.getVisualFactor();
    this.controlledLights.forEach((light) => {
      const fixtureFactor = light.userData.roomLightControlled ? this.getFixtureFactor(light) : 1;
      const factor = light.userData.roomLightControlled ? sceneFactor * roomFactor * fixtureFactor : sceneFactor;
      light.intensity = light.userData.baseIntensity * factor;
    });
    this.updateRoomMaterials();
    const post = this.postProcessing;
    if (post.bloomPass) {
      post.bloomPass.strength = this.config.postProcessing.bloom.strength
        + emergency * this.config.feedback.thermalEmergency.bloomBoost;
    }
    this.realism.applyEmergency(emergency, this.flickerWave(10, 1.1));
    if (post.chromaticAberrationPass) {
      post.chromaticAberrationPass.uniforms.amount.value = this.config.postProcessing.chromaticAberration.amount
        + emergency * this.config.feedback.thermalEmergency.chromaticBoost * this.flickerWave(10, 1.1);
    }
    if (post.lutPass) post.lutPass.intensity = this.config.postProcessing.lut?.intensity ?? 1;
    if (post.colorAdjustmentPass) this.applyColorAdjustments(post.colorAdjustmentPass, emergency);
    if (post.sharpenPass) {
      const sharpen = this.config.postProcessing.sharpen ?? {};
      post.sharpenPass.uniforms.amount.value = (sharpen.amount ?? 0) + (this.getZoomActive() ? sharpen.zoomBoost ?? 0 : 0);
    }
    if (post.lensDistortionPass) this.applyLensDistortion(post.lensDistortionPass, emergency);
  };

  updateCamera = () => {
    const camera = this.camera;
    camera.rotation.z -= this.appliedCameraRoll;
    this.appliedCameraRoll = 0;
    const snapshot = this.getSnapshot();
    const startupFault = snapshot.mode === "startupFault"
      ? Math.exp(-Math.max(0, this.config.feedback.startupFault.resetSeconds - (snapshot.resetPending ?? 0)) * 2)
      : 0;
    const outputLow = snapshot.mode === "running" && snapshot.warning?.outputLow ? 1 : 0;
    const shake = this.getStartupAmount() * this.config.feedback.startup.cameraShake
      + this.getIgnitionPulseAmount() * this.config.feedback.ignitionPulse.cameraShake
      + startupFault * this.config.feedback.startupFault.cameraShake
      + outputLow * this.config.feedback.outputLow.cameraShake * this.flickerWave(11, 0.7)
      + this.getEmergencyAmount() * this.config.feedback.thermalEmergency.cameraShake * this.flickerWave(14, 1.9);
    if (shake <= 0) return;
    const time = this.getTime();
    camera.position.x += Math.sin(time * 39.1) * shake;
    camera.position.y += Math.sin(time * 53.7) * shake * 0.45;
    this.appliedCameraRoll = Math.sin(time * 31.3) * shake * 0.6;
    camera.rotation.z += this.appliedCameraRoll;
  };
}
