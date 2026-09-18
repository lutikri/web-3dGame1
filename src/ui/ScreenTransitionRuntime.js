let sharedRuntime = null;

export function getScreenTransitionRuntime(options) {
  sharedRuntime ??= createScreenTransitionRuntime(options);
  return sharedRuntime;
}

export function createScreenTransitionRuntime({
  documentRef = globalThis.document,
  requestAnimationFrameFn = globalThis.requestAnimationFrame?.bind(globalThis),
  setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
} = {}) {
  let layer = null;
  let disposed = false;

  async function cover({ tone = "white", durationMs = 900, holdMs = 0 } = {}) {
    const target = ensureLayer();
    configure(target, tone, durationMs);
    target.hidden = false;
    target.classList.remove("is-revealing", "is-covered");
    await waitForPaint();
    target.classList.add("is-covered");
    await wait(durationMs + holdMs);
  }

  async function reveal({ durationMs = 1000 } = {}) {
    if (!layer || layer.hidden) return;
    configure(layer, layer.dataset.tone ?? "white", durationMs);
    layer.classList.add("is-revealing");
    layer.classList.remove("is-covered");
    await wait(durationMs);
    layer.hidden = true;
    layer.classList.remove("is-revealing");
  }

  async function swap(action, options = {}) {
    await cover(options);
    await action?.();
    await reveal({ durationMs: options.revealDurationMs ?? options.durationMs ?? 1000 });
  }

  function dispose() {
    disposed = true;
    layer?.remove();
    layer = null;
  }

  function ensureLayer() {
    if (disposed) throw new Error("Screen transition runtime is disposed");
    if (layer) return layer;
    layer = documentRef.createElement("div");
    layer.className = "screen-transition-layer";
    layer.dataset.tone = "white";
    layer.setAttribute("aria-hidden", "true");
    layer.hidden = true;
    documentRef.body.append(layer);
    return layer;
  }

  function configure(target, tone, durationMs) {
    target.dataset.tone = tone === "black" ? "black" : "white";
    target.style.setProperty("--screen-transition-duration", `${Math.max(0, durationMs)}ms`);
  }

  function wait(ms) {
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => setTimeoutFn(resolve, ms));
  }

  function waitForPaint() {
    if (!requestAnimationFrameFn) return wait(0);
    return new Promise((resolve) => {
      requestAnimationFrameFn(() => requestAnimationFrameFn(resolve));
    });
  }

  return {
    cover,
    reveal,
    swap,
    dispose,
    isCovered: () => Boolean(layer?.classList.contains("is-covered")),
  };
}
