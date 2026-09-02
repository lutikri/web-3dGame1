export class DeferredTextureUpgradeQueue {
  constructor({
    windowRef = window,
    canStart,
    isDisabled = () => false,
    delayMs = 4000,
    pollMs = 250,
  }) {
    this.window = windowRef;
    this.canStart = canStart;
    this.isDisabled = isDisabled;
    this.delayMs = delayMs;
    this.pollMs = pollMs;
    this.queue = [];
    this.active = false;
    this.paused = false;
    this.resumeRevision = 0;
  }

  schedule(task) {
    const wait = () => {
      if (this.isDisabled()) return;
      if (!this.canStart()) {
        this.window.setTimeout(wait, this.pollMs);
        return;
      }
      this.window.setTimeout(() => this.enqueue(task), this.delayMs);
    };
    wait();
  }

  enqueue(task) {
    this.queue.push(task);
    this.#process();
  }

  pause() {
    this.paused = true;
    this.resumeRevision += 1;
  }

  resume(delayMs = this.delayMs) {
    const revision = ++this.resumeRevision;
    this.window.setTimeout(() => {
      if (revision !== this.resumeRevision) return;
      this.paused = false;
      this.#process();
    }, Math.max(0, delayMs));
  }

  #process() {
    if (this.paused || this.active || this.queue.length === 0) return;
    this.active = true;
    const task = this.queue.shift();
    const run = async () => {
      if (this.paused) {
        this.queue.unshift(task);
        this.active = false;
        return;
      }
      try {
        await task();
      } finally {
        this.active = false;
        this.window.setTimeout(() => this.#process(), this.pollMs);
      }
    };
    if ("requestIdleCallback" in this.window) {
      this.window.requestIdleCallback(run, { timeout: 3000 });
    } else {
      this.window.setTimeout(run, 0);
    }
  }
}
