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

  #process() {
    if (this.active || this.queue.length === 0) return;
    this.active = true;
    const task = this.queue.shift();
    const run = async () => {
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
