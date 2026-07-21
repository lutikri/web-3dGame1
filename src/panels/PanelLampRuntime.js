export class PanelLampRuntime {
  constructor({ config, materials, warningKeys, diagnostics, getIndicatorTimer, getStartupTimer, getTime, flickerWave }) {
    this.config = config;
    this.materials = materials;
    this.warningKeys = warningKeys;
    this.diagnostics = diagnostics;
    this.getIndicatorTimer = getIndicatorTimer;
    this.getStartupTimer = getStartupTimer;
    this.getTime = getTime;
    this.flickerWave = flickerWave;
  }

  resolve(lamp, snapshot, index = 0) {
    return this.#startupMaterial() ?? this.#statusMaterial(lamp, snapshot, index);
  }

  #statusMaterial(lamp, snapshot, index) {
    const materials = this.materials;
    if (snapshot.mode === "startupFault") {
      const fault = this.config.feedback.startupFault;
      const age = Math.max(0, fault.resetSeconds - (snapshot.resetPending ?? 0));
      if (age < fault.greenLampSeconds) return materials.lampGreen;
      if (age < fault.greenLampSeconds + fault.redLampSeconds) return materials.lampRed;
      return materials.lampOff;
    }
    if (this.getIndicatorTimer() > 0) return this.#indicatorMaterial(lamp);
    if (this.diagnostics.getBlackoutFactor() < 0.12) return materials.lampOff;
    const override = this.diagnostics.getLampRuntimeOverride(lamp.name, this.getTime());
    if (override) return this.#overrideMaterial(override);
    if (snapshot.terminalElapsed != null) return this.#terminalMaterial(lamp, snapshot);

    if (lamp.name === "LightCase1_Light_UnderDemand") {
      if (snapshot.warning?.underDemandCritical) return materials.lampRed;
      if (snapshot.warning?.underDemand) return materials.lampAmber;
      return materials.lampOff;
    }
    if (lamp.name === "LightCase1_Light_OverDemand") {
      if (snapshot.warning?.overDemandCritical) return materials.lampRed;
      if (snapshot.warning?.overDemand) return materials.lampAmber;
      return materials.lampOff;
    }
    if (lamp.name === "LightCase1_Light_ReactionEfficiency") {
      if (snapshot.mode === "standby") return materials.lampOff;
      if (snapshot.warning?.outputSurge && this.flickerWave(13, 2.4) < 0.38) return materials.lampOff;
      if (snapshot.reactionEfficiency >= 72) return materials.lampGreen;
      if (snapshot.reactionEfficiency >= 45) return materials.lampAmber;
      if (snapshot.reactionEfficiency >= 20) return materials.lampRed;
      return this.flickerWave(7, 2.4) > 0.42 ? materials.lampRed : materials.lampOff;
    }
    if (lamp.name === "LightCase1_Light_FuelQuality") {
      return snapshot.mode === "standby" ? materials.lampOff : this.#overrideMaterial(snapshot.fuelBlend?.material ?? "green");
    }
    const warningKey = this.warningKeys[lamp.name];
    if (!warningKey || !snapshot.warning?.[warningKey]) return materials.lampOff;
    if (this.#shouldFastBlink(warningKey, snapshot)
      && this.flickerWave(this.config.feedback.thermalEmergency.lampFlickerFrequency, index) < 0.48) {
      return materials.lampOff;
    }
    if (warningKey === "outputLow"
      && this.flickerWave(this.config.feedback.outputLow.lampFlickerFrequency, 1.8) <= 0.22) {
      return materials.lampOff;
    }
    if (warningKey === "coreStall") return snapshot.warning?.coreStallCritical ? materials.lampRed : materials.lampAmber;
    return warningKey === "coreStress" || warningKey === "tempHigh" ? materials.lampRed : materials.lampAmber;
  }

  #terminalMaterial(lamp, snapshot) {
    const materials = this.materials;
    if (snapshot.terminalBlackout) return materials.lampOff;
    if (snapshot.mode === "complete") {
      return lamp.name === "LightCase1_Light_ReactionEfficiency" || lamp.name === "LightCase1_Light_FuelQuality"
        ? materials.lampGreen : materials.lampOff;
    }
    const warningKey = this.warningKeys[lamp.name];
    if (snapshot.failureType === "coreDestroyed") {
      if (warningKey === "coreStress" || warningKey === "tempHigh") return materials.lampRed;
      if (warningKey === "instability") return materials.lampAmber;
      return materials.lampOff;
    }
    return warningKey === "coreStall" || warningKey === "outputLow" ? materials.lampAmber : materials.lampOff;
  }

  #indicatorMaterial(lamp) {
    const ratio = Math.max(0, Math.min(1, this.getIndicatorTimer() / this.config.feedback.indicatorTest.duration));
    const color = ratio < 1 / 3 ? "red" : ratio < 2 / 3 ? "green" : "amber";
    if (this.diagnostics.getLampSelfTestOverride(lamp.name, color) === "off") return this.materials.lampOff;
    return this.#overrideMaterial(color);
  }

  #overrideMaterial(name) {
    if (name === "red") return this.materials.lampRed;
    if (name === "green") return this.materials.lampGreen;
    if (name === "amber" || name === "yellow") return this.materials.lampAmber;
    return this.materials.lampOff;
  }

  #startupMaterial() {
    const timer = this.getStartupTimer();
    if (timer <= 0) return null;
    const elapsed = this.config.feedback.startup.duration - timer;
    if (elapsed < 0.2) return this.materials.lampRed;
    if (elapsed < 0.4) return this.materials.lampAmber;
    if (elapsed < 0.62) return this.materials.lampGreen;
    const blinkWindow = elapsed - 0.62;
    if (blinkWindow < 0.7) return Math.floor(blinkWindow / 0.175) % 2 === 0
      ? this.materials.lampGreen : this.materials.lampOff;
    return null;
  }

  #shouldFastBlink(key, snapshot) {
    if (key === "tempHigh") return Boolean(snapshot.warning?.tempCritical || snapshot.warning?.thermalSoak);
    if (key === "coreStress") return Boolean(snapshot.warning?.coreStress);
    if (key === "instability") return Boolean(snapshot.warning?.tempCritical || snapshot.warning?.outputSurge);
    if (key === "coreStall") return Boolean(snapshot.warning?.coreStallCritical);
    return false;
  }
}
