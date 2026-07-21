export class AnimationLoop {
  constructor({
    clock,
    steps,
    maxDelta = 0.05,
    isBackground = () => document.hidden || !document.hasFocus(),
    requestFrame = (callback) => requestAnimationFrame(callback),
    requestBackgroundFrame = (callback) => setTimeout(callback, 1000),
  }) {
    this.clock = clock;
    this.steps = steps;
    this.maxDelta = maxDelta;
    this.isBackground = isBackground;
    this.requestFrame = requestFrame;
    this.requestBackgroundFrame = requestBackgroundFrame;
    this.running = false;
  }

  start = () => {
    if (this.running) return;
    this.running = true;
    this.#tick();
  };

  stop = () => {
    this.running = false;
  };

  #tick = () => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), this.maxDelta);
    for (const step of this.steps) step(dt);
    const schedule = this.isBackground() ? this.requestBackgroundFrame : this.requestFrame;
    schedule(this.#tick);
  };
}

