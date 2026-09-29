import { getFrameTraceStepLabel } from "./FrameTraceRuntime.js?v=zone-owned-large-meshes";

export class AnimationLoop {
  constructor({
    clock,
    steps,
    getPaused = () => false,
    pausedSteps = [],
    maxDelta = 0.05,
    schedulingPolicy,
    getFrameDelay = schedulingPolicy?.getDelayMs ?? (() => null),
    requestFrame = (callback) => requestAnimationFrame(callback),
    requestDelayedFrame = (callback, delayMs) => setTimeout(callback, delayMs),
    frameTrace = null,
  }) {
    this.clock = clock;
    this.steps = steps;
    this.getPaused = getPaused;
    this.pausedSteps = pausedSteps;
    this.maxDelta = maxDelta;
    this.schedulingPolicy = schedulingPolicy;
    this.getFrameDelay = getFrameDelay;
    this.requestFrame = requestFrame;
    this.requestDelayedFrame = requestDelayedFrame;
    this.frameTrace = frameTrace;
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
    const rawDelta = this.clock.getDelta();
    const dt = Math.min(rawDelta, this.maxDelta);
    const paused = this.getPaused();
    const tracing = this.frameTrace?.beginFrame?.({ deltaSeconds: rawDelta, paused }) === true;
    try {
      const steps = paused ? this.pausedSteps : this.steps;
      const stepDt = paused ? 0 : dt;
      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index];
        if (tracing) {
          this.frameTrace.measureStep(getFrameTraceStepLabel(step, index, paused), () => step(stepDt));
        } else {
          step(stepDt);
        }
      }
    } finally {
      if (tracing) this.frameTrace.endFrame();
    }
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
