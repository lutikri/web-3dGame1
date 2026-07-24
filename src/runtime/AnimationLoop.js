export class AnimationLoop {
  constructor({
    clock,
    steps,
    maxDelta = 0.05,
    schedulingPolicy,
    getFrameDelay = schedulingPolicy?.getDelayMs ?? (() => null),
    requestFrame = (callback) => requestAnimationFrame(callback),
    requestDelayedFrame = (callback, delayMs) => setTimeout(callback, delayMs),
  }) {
    this.clock = clock;
    this.steps = steps;
    this.maxDelta = maxDelta;
    this.schedulingPolicy = schedulingPolicy;
    this.getFrameDelay = getFrameDelay;
    this.requestFrame = requestFrame;
    this.requestDelayedFrame = requestDelayedFrame;
    this.running = false;
    this.scheduleRevision = 0;
    this.unsubscribeScheduling = null;
  }

  start = () => {
    if (this.running) return;
    this.running = true;
    this.unsubscribeScheduling = this.schedulingPolicy?.subscribe?.(this.#reschedule) ?? null;
    this.#tick();
  };

  stop = () => {
    this.running = false;
    this.scheduleRevision += 1;
    this.unsubscribeScheduling?.();
    this.unsubscribeScheduling = null;
  };

  #tick = () => {
    if (!this.running) return;
    const dt = Math.min(this.clock.getDelta(), this.maxDelta);
    for (const step of this.steps) step(dt);
    this.#scheduleNext();
  };

  #reschedule = () => {
    if (!this.running) return;
    this.#scheduleNext();
  };

  #scheduleNext() {
    const revision = ++this.scheduleRevision;
    const callback = () => {
      if (!this.running || revision !== this.scheduleRevision) return;
      this.#tick();
    };
    const delayMs = this.getFrameDelay();
    if (delayMs == null) this.requestFrame(callback);
    else this.requestDelayedFrame(callback, delayMs);
  }
}
