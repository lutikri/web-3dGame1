import { isTextEditingTarget } from "../player/OperatorInputRuntime.js?v=compact-loading-game";

export class ScreenshotCaptureRuntime {
  constructor({
    captureFrame,
    documentRef = document,
    urlApi = URL,
    canCapture = () => true,
    now = () => new Date(),
    setTimeoutFn = globalThis.setTimeout.bind(globalThis),
    clearTimeoutFn = globalThis.clearTimeout.bind(globalThis),
    reportError = (error) => console.error("[Screenshot]", error),
  }) {
    Object.assign(this, { captureFrame, documentRef, urlApi, canCapture, now, setTimeoutFn, clearTimeoutFn, reportError });
    this.pending = null;
    this.wired = false;
    this.disposed = false;
    this.downloadUrls = new Map();
  }

  wire = () => {
    if (this.wired || this.disposed) return;
    this.wired = true;
    this.documentRef.addEventListener("keydown", this.handleKeyDown);
  };

  handleKeyDown = (event) => {
    if (event.code !== "F9" || event.repeat || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey
      || isTextEditingTarget(event.target) || !this.canCapture() || this.disposed) return;
    event.preventDefault();
    this.capture().catch(this.reportError);
  };

  capture = () => {
    if (this.pending) return this.pending;
    if (this.disposed || !this.canCapture()) return Promise.reject(new Error("Screenshot capture is unavailable"));
    // Defer into one microtask so repeated callers share one capture and download.
    this.pending = Promise.resolve().then(async () => {
      if (this.disposed) throw new Error("Screenshot capture was disposed");
      const { canvas, width, height, samples } = this.captureFrame((source) => {
        const copy = this.documentRef.createElement("canvas");
        copy.width = source.width;
        copy.height = source.height;
        const context = copy.getContext("2d");
        if (!context) throw new Error("Unable to create the screenshot canvas");
        // Copy in the render call, before WebGL clears its non-preserved drawing buffer.
        context.drawImage(source, 0, 0);
        return copy;
      });
      try {
        const blob = await new Promise((resolve, reject) => canvas.toBlob(
          (result) => result ? resolve(result) : reject(new Error("Unable to encode screenshot PNG")), "image/png",
        ));
        if (this.disposed) throw new Error("Screenshot capture was disposed");
        const filename = `baseload-${this.now().toISOString().replace(/[:.]/g, "-")}-${width}x${height}.png`;
        const url = this.urlApi.createObjectURL(blob);
        this.downloadUrls.set(url, null);
        const link = this.documentRef.createElement("a");
        link.href = url;
        link.download = filename;
        try {
          this.documentRef.body.append(link);
          link.click();
        } finally {
          link.remove();
          this.downloadUrls.set(url, this.setTimeoutFn(() => this.#releaseUrl(url), 1000));
        }
        return { filename, width, height, samples };
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }).finally(() => { this.pending = null; });
    return this.pending;
  };

  dispose = () => {
    this.disposed = true;
    this.documentRef.removeEventListener("keydown", this.handleKeyDown);
    this.wired = false;
    for (const url of this.downloadUrls.keys()) this.#releaseUrl(url);
  };

  #releaseUrl(url) {
    if (!this.downloadUrls.has(url)) return;
    this.clearTimeoutFn(this.downloadUrls.get(url));
    this.downloadUrls.delete(url);
    this.urlApi.revokeObjectURL(url);
  }
}
