import * as THREE from "three";

export class PlayerCollisionDebugRuntime {
  constructor({ scene, capsule, camera, config, getCameraRadius }) {
    this.capsule = capsule;
    this.camera = camera;
    this.config = config;
    this.getCameraRadius = getCameraRadius;
    this.views = createViews(Boolean(config?.show));
    scene.add(this.views.group);
  }

  setVisible(visible) {
    this.views.group.visible = Boolean(visible);
  }

  update() {
    const { group, bottom, top, body, step, lean } = this.views;
    if (!group.visible) return;
    const radius = this.capsule.radius;
    const segmentHeight = Math.max(0.001, this.capsule.end.y - this.capsule.start.y);
    bottom.position.copy(this.capsule.start);
    top.position.copy(this.capsule.end);
    bottom.scale.setScalar(radius);
    top.scale.setScalar(radius);
    body.position.copy(this.capsule.start).add(this.capsule.end).multiplyScalar(0.5);
    body.scale.set(radius, segmentHeight, radius);

    const feetY = this.capsule.start.y - radius;
    const stepHeight = Math.max(0.001, this.config?.stepHeight ?? 0);
    step.position.set(this.capsule.start.x, feetY + stepHeight * 0.5, this.capsule.start.z);
    step.scale.set(radius * 1.35, stepHeight, radius * 1.35);
    lean.position.copy(this.camera.position);
    lean.scale.setScalar(this.getCameraRadius());
  }
}

function createViews(visible) {
  const bodyMaterial = createMaterial(0x36f1ff, 0.9);
  const stepMaterial = createMaterial(0x56ff72, 0.8);
  const leanMaterial = createMaterial(0xff4de1, 0.9);
  const group = new THREE.Group();
  group.name = "PlayerCollisionDebug";
  group.renderOrder = 1100;
  group.visible = visible;

  const bottom = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), bodyMaterial);
  const top = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), bodyMaterial);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16, 1, true), bodyMaterial);
  const step = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true), stepMaterial);
  const lean = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), leanMaterial);
  bottom.name = "PlayerCapsule_Bottom";
  top.name = "PlayerCapsule_Top";
  body.name = "PlayerCapsule_Body";
  step.name = "PlayerStepHeight";
  lean.name = "PlayerLeanCollision";
  [bottom, top, body, step, lean].forEach((mesh) => {
    mesh.renderOrder = 1100;
    group.add(mesh);
  });
  return { group, bottom, top, body, step, lean };
}

function createMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity,
    depthTest: false,
  });
}
