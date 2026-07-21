export class FpsMeterRuntime {
  constructor(element = null) {
    this.element = element;
    this.frameCount = 0;
    this.elapsed = 0;
    this.fps = 0;
    this.frameTimeMs = 0;
  }

  update = (dt) => {
    this.frameCount += 1;
    this.elapsed += dt;
    this.frameTimeMs = dt * 1000;
    if (this.elapsed < 0.25) return;
    this.fps = this.frameCount / this.elapsed;
    this.frameCount = 0;
    this.elapsed = 0;
    if (this.element) {
      this.element.textContent = `FPS ${Math.round(this.fps)}`;
      this.element.title = `${this.frameTimeMs.toFixed(1)} ms/frame`;
    }
  };

  snapshot = () => ({
    fps: Number(this.fps.toFixed(1)),
    frameTimeMs: Number(this.frameTimeMs.toFixed(2)),
  });
}

