import * as THREE from "three";

export class MenuCameraRuntime {
  constructor({ camera, config, getViewMode, eventTarget = globalThis.window }) {
    this.camera = camera;
    this.config = config;
    this.getViewMode = getViewMode;
    this.eventTarget = eventTarget;
    this.pointerX = 0;
    this.pointerY = 0;
    this.yawOffset = 0;
    this.pitchOffset = 0;
    this.wired = false;
  }

  wire() {
    if (this.wired || !this.eventTarget) return;
    this.wired = true;
    this.eventTarget.addEventListener("pointermove", this.handlePointerMove);
    this.eventTarget.addEventListener("pointerleave", this.clearPointer);
    this.eventTarget.addEventListener("blur", this.clearPointer);
  }

  dispose() {
    if (!this.wired || !this.eventTarget) return;
    this.wired = false;
    this.eventTarget.removeEventListener("pointermove", this.handlePointerMove);
    this.eventTarget.removeEventListener("pointerleave", this.clearPointer);
    this.eventTarget.removeEventListener("blur", this.clearPointer);
  }

  handlePointerMove = (event) => {
    const width = Math.max(1, this.eventTarget.innerWidth ?? 1);
    const height = Math.max(1, this.eventTarget.innerHeight ?? 1);
    this.pointerX = THREE.MathUtils.clamp((event.clientX / width) * 2 - 1, -1, 1);
    this.pointerY = THREE.MathUtils.clamp((event.clientY / height) * 2 - 1, -1, 1);
  };

  clearPointer = () => {
    this.pointerX = 0;
    this.pointerY = 0;
  };

  update = (dt) => {
    if (this.getViewMode() !== "menu") {
      this.yawOffset = 0;
      this.pitchOffset = 0;
      return;
    }
    const menuView = this.config.camera.menuView;
    const pointerLook = menuView?.pointerLook ?? {};
    const damping = pointerLook.damping ?? 5;
    const yawTarget = pointerLook.enabled === false
      ? 0
      : THREE.MathUtils.degToRad(-(pointerLook.yawDegrees ?? 1.5) * this.pointerX);
    const pitchTarget = pointerLook.enabled === false
      ? 0
      : THREE.MathUtils.degToRad(-(pointerLook.pitchDegrees ?? 0.8) * this.pointerY);
    this.yawOffset = THREE.MathUtils.damp(this.yawOffset, yawTarget, damping, dt);
    this.pitchOffset = THREE.MathUtils.damp(this.pitchOffset, pitchTarget, damping, dt);

    this.camera.position.copy(menuView.position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.x = THREE.MathUtils.degToRad(menuView.rotationDegrees.x ?? 0) + this.pitchOffset;
    this.camera.rotation.y = THREE.MathUtils.degToRad(menuView.rotationDegrees.y ?? 0) + this.yawOffset;
    this.camera.rotation.z = THREE.MathUtils.degToRad(menuView.rotationDegrees.z ?? 0);
    this.camera.updateMatrixWorld(true);
  };
}
