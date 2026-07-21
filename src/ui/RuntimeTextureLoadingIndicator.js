export class RuntimeTextureLoadingIndicator {
  constructor({ documentRef = document, isBootComplete, getLabel }) {
    this.isBootComplete = isBootComplete;
    this.getLabel = getLabel;
    this.state = { total: 0, completed: 0, active: 0, hideTimer: 0 };
    this.element = documentRef.createElement("div");
    this.element.className = "texture-loading-indicator";
    this.element.hidden = true;
    this.element.innerHTML = '<span class="texture-loading-spinner" aria-hidden="true"></span><span></span>';
    documentRef.body.appendChild(this.element);
    this.render();
  }

  start = () => {
    if (!this.isBootComplete()) return;
    if (this.state.active === 0 && this.state.hideTimer <= 0) {
      this.state.total = 0;
      this.state.completed = 0;
    }
    this.state.total += 1;
    this.state.active += 1;
    this.state.hideTimer = 0;
    this.render();
  };

  complete = () => {
    if (!this.isBootComplete()) return;
    this.state.completed = Math.min(this.state.completed + 1, this.state.total);
    this.state.active = Math.max(0, this.state.active - 1);
    if (this.state.active === 0) this.state.hideTimer = 1.6;
    this.render();
  };

  update = (dt) => {
    if (this.state.active > 0) {
      this.render();
      return;
    }
    if (this.state.hideTimer <= 0) return;
    this.state.hideTimer = Math.max(0, this.state.hideTimer - dt);
    if (this.state.hideTimer <= 0) this.render();
  };

  render() {
    const shouldShow =
      this.isBootComplete() &&
      this.state.total > 0 &&
      (this.state.active > 0 || this.state.hideTimer > 0);
    this.element.hidden = !shouldShow;
    this.element.classList.toggle("is-active", shouldShow);
    const label = this.element.querySelector("span:last-child");
    if (label) label.textContent = `${this.getLabel()} ${this.state.completed} / ${this.state.total}`;
  }
}
