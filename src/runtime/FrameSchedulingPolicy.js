export class FrameSchedulingPolicy {
  constructor({
    documentRef = document,
    windowRef = window,
    hiddenDelayMs = 1000,
    unfocusedDelayMs = 100,
  } = {}) {
    this.documentRef = documentRef;
    this.windowRef = windowRef;
    this.hiddenDelayMs = hiddenDelayMs;
    this.unfocusedDelayMs = unfocusedDelayMs;
    this.foregroundLeaseCount = 0;
    this.listeners = new Set();

    this.documentRef?.addEventListener?.("visibilitychange", this.#notify);
    this.windowRef?.addEventListener?.("focus", this.#notify);
    this.windowRef?.addEventListener?.("blur", this.#notify);
  }

  getDelayMs = () => {
    if (this.documentRef?.hidden) return this.hiddenDelayMs;
    if (this.foregroundLeaseCount > 0) return null;
    if (this.documentRef?.hasFocus?.() === false) return this.unfocusedDelayMs;
    return null;
  };

  acquireForegroundLease = () => {
    this.foregroundLeaseCount += 1;
    this.#notify();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.foregroundLeaseCount = Math.max(0, this.foregroundLeaseCount - 1);
      this.#notify();
    };
  };

  subscribe = (listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  dispose = () => {
    this.documentRef?.removeEventListener?.("visibilitychange", this.#notify);
    this.windowRef?.removeEventListener?.("focus", this.#notify);
    this.windowRef?.removeEventListener?.("blur", this.#notify);
    this.listeners.clear();
  };

  #notify = () => {
    for (const listener of this.listeners) listener();
  };
}
