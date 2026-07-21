import * as THREE from "three";
import { TransformControls } from "three/addons/controls/TransformControls.js";

export class DebugTransformRuntime {
  constructor({ camera, renderer, scene, resolveObject, suspendInput, restoreInput, createControls = null }) {
    this.scene = scene;
    this.resolveObject = resolveObject;
    this.suspendInput = suspendInput;
    this.restoreInput = restoreInput;
    this.controls = createControls?.(camera, renderer.domElement) ?? new TransformControls(camera, renderer.domElement);
    this.controls.setMode("translate");
    this.controls.setSize(0.85);
    this.controls.addEventListener("objectChange", () => this.edit?.sync());
    scene.add(this.controls);
    this.edit = null;
    this.inputSnapshot = null;
  }

  toggle = (descriptor) => {
    if (this.edit?.id === descriptor?.id) {
      this.stop();
      return false;
    }
    this.stop();
    const edit = this.#resolveEdit(descriptor);
    if (!edit) return false;
    this.edit = edit;
    this.inputSnapshot = this.suspendInput();
    this.controls.attach(edit.object);
    return true;
  };

  stop = () => {
    if (!this.edit) return;
    this.controls.detach();
    if (this.edit.temporary) this.scene.remove(this.edit.object);
    this.edit = null;
    this.restoreInput(this.inputSnapshot);
    this.inputSnapshot = null;
  };

  isEditing = () => Boolean(this.edit);

  #resolveEdit(descriptor) {
    if (!descriptor?.id || !descriptor.position) return null;
    let object = this.resolveObject(descriptor);
    let temporary = false;
    if (!object) {
      object = new THREE.Object3D();
      object.name = `DebugPositionGizmo_${descriptor.id}`;
      object.position.copy(descriptor.position);
      this.scene.add(object);
      temporary = true;
    }
    return {
      ...descriptor,
      object,
      temporary,
      sync: () => {
        descriptor.position.copy?.(object.position);
        if (!descriptor.position.copy) Object.assign(descriptor.position, object.position);
        descriptor.onChange?.();
      },
    };
  }
}
