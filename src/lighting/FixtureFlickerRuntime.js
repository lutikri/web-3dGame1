import {
  createFixtureFlickerState,
  getFixtureFlickerFactor,
  triggerFixtureFlickerState,
  updateFixtureFlickerState,
} from "./FluorescentBehavior.js?v=body-motion-debug";

export class FixtureFlickerRuntime {
  constructor({ config, getTargets }) {
    this.config = config;
    this.getTargets = getTargets;
  }

  create = (overrides = null) => createFixtureFlickerState(this.config, overrides);

  update = (dt) => {
    const updated = new Set();
    this.getTargets().forEach((target) => {
      const state = target.userData.fixtureFlicker;
      if (!state || updated.has(state)) return;
      updated.add(state);
      updateFixtureFlickerState(state, dt, this.config);
    });
  };

  updateState = (state, dt, overrides = null) => updateFixtureFlickerState(state, dt, this.config, overrides);

  trigger = (targetName = "") => {
    const triggered = [];
    this.getTargets().forEach((target) => {
      const state = target.userData.fixtureFlicker;
      const name = target.userData.fixtureName ?? target.userData.lightKey ?? target.name;
      if (!state || (targetName && name !== targetName)) return;
      triggerFixtureFlickerState(state, this.config);
      triggered.push(name);
    });
    return [...new Set(triggered)];
  };

  getFactor = (target) => getFixtureFlickerFactor(target);
}
