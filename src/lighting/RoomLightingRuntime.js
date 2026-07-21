import * as THREE from "three";

export class RoomLightingRuntime {
  constructor({ config, getTime, createStartupPattern, getStartupDuration, getStartupFactor, getStarterFaultFactor, playTurnOn, onVisualChanged, onStateChanged }) {
    this.config = config;
    this.getTime = getTime;
    this.createStartupPattern = createStartupPattern;
    this.getStartupDuration = getStartupDuration;
    this.getStartupFactor = getStartupFactor;
    this.getStarterFaultFactor = getStarterFaultFactor;
    this.playTurnOn = playTurnOn;
    this.onVisualChanged = onVisualChanged;
    this.onStateChanged = onStateChanged;
    const enabled = config.interior.lightToggleButton?.initialOn ?? true;
    this.state = {
      enabled,
      currentFactor: enabled ? 1 : 0,
      switchTimer: 0,
      switchMode: "off",
      afterglowTimer: 0,
      starterFaultTimer: 0,
      starterFaultElapsed: 0,
      toggleTimes: [],
      bootTimer: 0,
      startupPattern: [],
    };
  }

  triggerBoot = () => {
    const wasEnabled = this.state.enabled;
    this.playTurnOn();
    this.state.startupPattern = this.createStartupPattern();
    Object.assign(this.state, {
      enabled: true,
      currentFactor: 0,
      afterglowTimer: 0,
      switchTimer: 0,
      switchMode: "on",
      bootTimer: this.getStartupDuration(this.state.startupPattern),
    });
    this.onVisualChanged();
    if (!wasEnabled) this.onStateChanged();
  };

  toggle = () => {
    const config = this.config.feedback.roomLightSwitch ?? {};
    const now = this.getTime();
    this.state.toggleTimes = this.state.toggleTimes.filter((time) => now - time <= (config.abuseWindowSeconds ?? 4));
    this.state.toggleTimes.push(now);
    if (this.state.starterFaultTimer > 0) return false;
    if (this.state.toggleTimes.length >= (config.abuseToggleCount ?? 6)) {
      this.#triggerStarterFault();
      return false;
    }
    this.setEnabled(!this.state.enabled);
    return true;
  };

  setEnabled = (enabled, { instant = false } = {}) => {
    const wasEnabled = this.state.enabled;
    this.state.starterFaultTimer = 0;
    this.state.starterFaultElapsed = 0;
    if (instant) this.state.toggleTimes = [];
    this.state.enabled = Boolean(enabled);
    if (!instant && this.state.enabled) this.state.startupPattern = this.createStartupPattern();
    this.state.switchMode = this.state.enabled ? "on" : "off";
    this.state.switchTimer = instant ? 0 : this.state.enabled ? this.getStartupDuration(this.state.startupPattern) : 0;
    this.state.bootTimer = 0;
    this.state.afterglowTimer = !instant && wasEnabled && !this.state.enabled
      ? this.config.feedback.roomLightSwitch?.afterglowSeconds ?? 3 : 0;
    if (instant) this.state.currentFactor = this.state.enabled ? 1 : 0;
    if (!instant && !wasEnabled && this.state.enabled) this.playTurnOn();
    this.onVisualChanged();
    this.onStateChanged();
    return this.state.enabled;
  };

  update = (dt) => {
    const state = this.state;
    const button = this.config.interior.lightToggleButton ?? {};
    const config = this.config.feedback.roomLightSwitch ?? {};
    const fadeSeconds = Math.max(0.001, state.enabled ? button.fadeSeconds ?? 0.3 : config.lightFadeOutSeconds ?? 0.14);
    state.bootTimer = Math.max(0, state.bootTimer - dt);
    state.switchTimer = Math.max(0, state.switchTimer - dt);
    state.afterglowTimer = Math.max(0, state.afterglowTimer - dt);
    if (state.starterFaultTimer > 0) {
      state.starterFaultTimer = Math.max(0, state.starterFaultTimer - dt);
      state.starterFaultElapsed += dt;
      state.currentFactor = this.#starterFaultFactor();
      if (state.starterFaultTimer <= 0) {
        state.startupPattern = this.createStartupPattern();
        state.switchMode = "on";
        state.switchTimer = this.getStartupDuration(state.startupPattern);
        state.currentFactor = 0;
      }
    } else if (state.switchMode === "on" && state.switchTimer > 0) {
      state.currentFactor = this.getVisualFactor();
    } else {
      state.currentFactor = THREE.MathUtils.damp(state.currentFactor, state.enabled ? 1 : 0, 4 / fadeSeconds, dt);
    }
    this.onVisualChanged();
  };

  getVisualFactor = () => {
    const state = this.state;
    if (state.starterFaultTimer > 0) return this.#starterFaultFactor();
    if (state.bootTimer > 0) {
      const duration = this.getStartupDuration(state.startupPattern);
      return this.getStartupFactor(state.startupPattern, duration - state.bootTimer);
    }
    if (state.switchTimer > 0 && state.switchMode === "on") {
      const duration = this.getStartupDuration(state.startupPattern);
      return this.getStartupFactor(state.startupPattern, duration - state.switchTimer);
    }
    return state.currentFactor;
  };

  getAfterglowFactor = () => {
    const config = this.config.feedback.roomLightSwitch ?? {};
    const progress = THREE.MathUtils.clamp(this.state.afterglowTimer / Math.max(0.001, config.afterglowSeconds ?? 3), 0, 1);
    return (config.afterglowInitialFactor ?? 0.2) * Math.pow(progress, config.afterglowExponent ?? 2.4);
  };

  inspect = () => ({ ...this.state, toggleTimes: [...this.state.toggleTimes], startupPattern: [...this.state.startupPattern] });

  #triggerStarterFault() {
    Object.assign(this.state, {
      enabled: true,
      switchMode: "fault",
      currentFactor: 0,
      switchTimer: 0,
      bootTimer: 0,
      afterglowTimer: 0,
      starterFaultTimer: this.config.feedback.roomLightSwitch?.starterFaultSeconds ?? 20,
      starterFaultElapsed: 0,
      toggleTimes: [],
    });
    this.onVisualChanged();
    this.onStateChanged();
  }

  #starterFaultFactor() {
    return this.getStarterFaultFactor({
      elapsed: this.state.starterFaultElapsed,
      visualTime: this.getTime(),
      config: this.config.feedback.roomLightSwitch,
    });
  }
}
