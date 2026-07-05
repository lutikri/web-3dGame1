export class PostProcessingRuntime {
  constructor({ setup, render, resize, dispose, inspect }) {
    this.setupPipeline = setup;
    this.renderPipeline = render;
    this.resizePipeline = resize;
    this.disposePipeline = dispose;
    this.inspectPipeline = inspect;
  }

  setup() {
    return this.setupPipeline();
  }

  render(dt) {
    return this.renderPipeline(dt);
  }

  resize(width, height) {
    return this.resizePipeline(width, height);
  }

  dispose() {
    return this.disposePipeline();
  }

  inspect() {
    return this.inspectPipeline();
  }
}
