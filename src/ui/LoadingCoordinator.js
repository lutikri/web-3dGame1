export class LoadingCoordinator {
  constructor({ overlay, initialComplete = false, shouldSkipBoot, onBootComplete, dispatchTarget = window, isModelPending }) {
    this.overlay = overlay;
    this.complete = initialComplete;
    this.shouldSkipBoot = shouldSkipBoot;
    this.onBootComplete = onBootComplete;
    this.dispatchTarget = dispatchTarget;
    this.isModelPending = isModelPending;
  }

  setProgress = (value) => this.overlay.setProgress(value);
  setStatus = (text) => this.overlay.setStatus(text);
  isComplete = () => this.complete;

  finishBoot = () => {
    if (this.shouldSkipBoot()) {
      this.skip();
      return;
    }
    this.overlay.finish(() => {
      this.complete = true;
      this.#dispatchComplete();
      this.onBootComplete();
    });
  };

  skip = () => {
    this.complete = true;
    this.overlay.skip();
    this.#dispatchComplete();
  };

  showRoute = ({ title, status, progress = 0 } = {}) => {
    this.complete = false;
    this.overlay.show({ title, statusText: status, progressValue: progress });
  };

  finishRoute = (onComplete) => {
    this.overlay.finish(() => {
      this.complete = true;
      onComplete?.();
    });
  };

  update = (dt) => this.overlay.update(dt, this.isModelPending());

  #dispatchComplete() {
    this.dispatchTarget.dispatchEvent(new CustomEvent("operatorgame:loading-complete"));
  }
}

