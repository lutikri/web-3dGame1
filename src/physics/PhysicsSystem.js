import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";

export async function createPhysicsSystem() {
  const originalWarn = console.warn;
  console.warn = (message, ...args) => {
    if (String(message).includes("using deprecated parameters for the initialization function")) return;
    originalWarn.call(console, message, ...args);
  };
  try {
    await RAPIER.init();
  } finally {
    console.warn = originalWarn;
  }

  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const sceneColliders = new Map();
  const doors = new Map();
  let activeSceneKey = null;
  let character = null;

  function addStaticScene(key, root) {
    removeStaticScene(key);
    root.updateMatrixWorld(true);
    const colliders = [];
    root.traverse((object) => {
      if (!object.isMesh || !object.geometry?.attributes?.position) return;
      const geometry = object.geometry;
      const source = geometry.attributes.position;
      const vertices = new Float32Array(source.count * 3);
      const point = new THREE.Vector3();
      for (let index = 0; index < source.count; index += 1) {
        point.fromBufferAttribute(source, index).applyMatrix4(object.matrixWorld);
        vertices[index * 3] = point.x;
        vertices[index * 3 + 1] = point.y;
        vertices[index * 3 + 2] = point.z;
      }
      const indices = geometry.index
        ? new Uint32Array(geometry.index.array)
        : Uint32Array.from({ length: source.count }, (_, index) => index);
      const collider = world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices));
      collider.setEnabled(key === activeSceneKey);
      colliders.push(collider);
    });
    sceneColliders.set(key, colliders);
    return colliders.length;
  }

  function removeStaticScene(key) {
    (sceneColliders.get(key) ?? []).forEach((collider) => world.removeCollider(collider, false));
    sceneColliders.delete(key);
  }

  function setActiveScene(key) {
    activeSceneKey = key;
    sceneColliders.forEach((colliders, sceneKey) => {
      colliders.forEach((collider) => collider.setEnabled(sceneKey === key));
    });
    doors.forEach((door) => door.body.setEnabled(door.sceneKey === key));
  }

  function createCharacter({ eyePosition, eyeHeight, height, radius, config }) {
    if (character) {
      world.removeCollider(character.collider, false);
      character.controller.free();
    }
    const halfSegment = Math.max(0.001, (height - radius * 2) * 0.5);
    const feetY = eyePosition.y - eyeHeight;
    const center = { x: eyePosition.x, y: feetY + height * 0.5, z: eyePosition.z };
    const collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(halfSegment, radius)
        .setTranslation(center.x, center.y, center.z)
        .setFriction(0),
    );
    const controller = world.createCharacterController(config.controllerOffset ?? 0.01);
    controller.enableAutostep(config.stepHeight ?? 0.3, config.stepMinWidth ?? 0.12, false);
    controller.enableSnapToGround(config.snapToGround ?? 0.35);
    controller.setApplyImpulsesToDynamicBodies(true);
    controller.setCharacterMass(config.mass ?? 75);
    controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(config.maxSlopeDegrees ?? 50));
    controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(config.minSlideDegrees ?? 55));
    character = { collider, controller, eyeHeight, height, radius, verticalVelocity: 0, grounded: false };
    return character;
  }

  function moveCharacter(horizontalDelta, dt) {
    if (!character) return null;
    character.verticalVelocity += world.gravity.y * dt;
    const desiredVertical = character.verticalVelocity * dt;
    const desired = {
      x: horizontalDelta.x,
      y: desiredVertical > 0 ? desiredVertical : Math.min(desiredVertical, -0.001),
      z: horizontalDelta.z,
    };
    character.controller.computeColliderMovement(character.collider, desired);
    const movement = character.controller.computedMovement();
    const current = character.collider.translation();
    character.collider.setTranslation({
      x: current.x + movement.x,
      y: current.y + movement.y,
      z: current.z + movement.z,
    });
    character.grounded = character.controller.computedGrounded();
    if (character.grounded && character.verticalVelocity < 0) character.verticalVelocity = 0;
    const next = character.collider.translation();
    const feetY = next.y - character.height * 0.5;
    return new THREE.Vector3(next.x, feetY + character.eyeHeight, next.z);
  }

  function teleportCharacter(eyePosition) {
    if (!character) return;
    const feetY = eyePosition.y - character.eyeHeight;
    character.collider.setTranslation({
      x: eyePosition.x,
      y: feetY + character.height * 0.5,
      z: eyePosition.z,
    });
    character.verticalVelocity = 0;
  }

  function jump(speed = 3.2) {
    if (!character?.grounded) return false;
    character.verticalVelocity = Math.max(0, speed);
    character.grounded = false;
    return true;
  }

  function configureCharacter(config) {
    if (!character) return;
    character.controller.enableAutostep(config.stepHeight ?? 0.3, config.stepMinWidth ?? 0.12, false);
    character.controller.enableSnapToGround(config.snapToGround ?? 0.35);
    character.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(config.maxSlopeDegrees ?? 50));
    character.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(config.minSlideDegrees ?? 55));
  }

  function createHingedDoor({
    key,
    sceneKey,
    doorMesh,
    colliderMesh,
    initialDegrees = 0,
    minDegrees,
    maxDegrees,
    density = 180,
    angularDamping = 0.65,
    motorStiffness = 55,
    motorDamping = 10,
  }) {
    removeDoor(key);
    doorMesh.updateWorldMatrix(true, false);
    colliderMesh.updateWorldMatrix(true, false);
    const hingePosition = new THREE.Vector3();
    const hingeQuaternion = new THREE.Quaternion();
    const hingeScale = new THREE.Vector3();
    doorMesh.matrixWorld.decompose(hingePosition, hingeQuaternion, hingeScale);

    const fixedBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed()
        .setTranslation(hingePosition.x, hingePosition.y, hingePosition.z)
        .setRotation(hingeQuaternion),
    );
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(hingePosition.x, hingePosition.y, hingePosition.z)
        .setRotation(hingeQuaternion)
        .setLinearDamping(8)
        .setAngularDamping(angularDamping)
        .setCanSleep(false),
    );

    const inverseDoor = new THREE.Matrix4().copy(doorMesh.matrixWorld).invert();
    const colliderInDoor = new THREE.Matrix4().multiplyMatrices(inverseDoor, colliderMesh.matrixWorld);
    const geometry = colliderMesh.geometry;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const center = box.getCenter(new THREE.Vector3()).applyMatrix4(colliderInDoor);
    const size = box.getSize(new THREE.Vector3());
    const relativePosition = new THREE.Vector3();
    const relativeQuaternion = new THREE.Quaternion();
    const relativeScale = new THREE.Vector3();
    colliderInDoor.decompose(relativePosition, relativeQuaternion, relativeScale);
    size.multiply(relativeScale).multiplyScalar(0.5);
    const colliderDesc = RAPIER.ColliderDesc.cuboid(
      Math.max(size.x, 0.01),
      Math.max(size.y, 0.01),
      Math.max(size.z, 0.01),
    )
      .setTranslation(center.x, center.y, center.z)
      .setRotation(relativeQuaternion)
      .setDensity(density)
      .setFriction(0.8);
    world.createCollider(colliderDesc, body);

    const jointData = RAPIER.JointData.revolute(
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 },
    );
    const joint = world.createImpulseJoint(jointData, fixedBody, body, true);
    joint.setLimits(
      THREE.MathUtils.degToRad(minDegrees - initialDegrees),
      THREE.MathUtils.degToRad(maxDegrees - initialDegrees),
    );
    body.setEnabled(sceneKey === activeSceneKey);
    const door = {
      key,
      sceneKey,
      body,
      fixedBody,
      joint,
      doorMesh,
      colliderMesh,
      colliderInDoor,
      initialDegrees,
      motorStiffness,
      motorDamping,
      targetDegrees: null,
    };
    doors.set(key, door);
    return door;
  }

  function removeDoor(key) {
    const door = doors.get(key);
    if (!door) return;
    world.removeImpulseJoint(door.joint, true);
    world.removeRigidBody(door.body);
    world.removeRigidBody(door.fixedBody);
    doors.delete(key);
  }

  function setDoorDragTarget(key, degrees, active, releaseAngularVelocity = 0) {
    const door = doors.get(key);
    if (!door) return false;
    door.targetDegrees = active ? THREE.MathUtils.degToRad(degrees - door.initialDegrees) : null;
    if (active) {
      door.joint.configureMotorPosition(door.targetDegrees, door.motorStiffness, door.motorDamping);
      door.body.wakeUp();
    } else {
      door.joint.configureMotorPosition(0, 0, 0);
      door.body.setAngvel({ x: 0, y: releaseAngularVelocity, z: 0 }, true);
    }
    return true;
  }

  function getDoorDegrees(key) {
    const door = doors.get(key);
    if (!door) return null;
    const fixedRotation = door.fixedBody.rotation();
    const bodyRotation = door.body.rotation();
    const relative = new THREE.Quaternion(
      fixedRotation.x,
      fixedRotation.y,
      fixedRotation.z,
      fixedRotation.w,
    )
      .invert()
      .multiply(new THREE.Quaternion(bodyRotation.x, bodyRotation.y, bodyRotation.z, bodyRotation.w));
    const relativeY = new THREE.Euler().setFromQuaternion(relative, "YXZ").y;
    return door.initialDegrees + THREE.MathUtils.radToDeg(relativeY);
  }

  function step(dt) {
    world.timestep = Math.min(dt, 1 / 30);
    world.step();
    doors.forEach((door) => {
      if (!door.body.isEnabled()) return;
      const position = door.body.translation();
      const rotation = door.body.rotation();
      const worldMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(position.x, position.y, position.z),
        new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
        new THREE.Vector3(1, 1, 1),
      );
      door.doorMesh.parent?.updateWorldMatrix(true, false);
      const parentInverse = new THREE.Matrix4().copy(door.doorMesh.parent.matrixWorld).invert();
      const localMatrix = new THREE.Matrix4().multiplyMatrices(parentInverse, worldMatrix);
      localMatrix.decompose(door.doorMesh.position, door.doorMesh.quaternion, door.doorMesh.scale);
      door.doorMesh.updateWorldMatrix(true, false);
      if (door.colliderMesh) {
        const colliderWorld = new THREE.Matrix4().multiplyMatrices(door.doorMesh.matrixWorld, door.colliderInDoor);
        door.colliderMesh.parent?.updateWorldMatrix(true, false);
        const colliderParentInverse = new THREE.Matrix4().copy(door.colliderMesh.parent.matrixWorld).invert();
        const colliderLocal = new THREE.Matrix4().multiplyMatrices(colliderParentInverse, colliderWorld);
        colliderLocal.decompose(
          door.colliderMesh.position,
          door.colliderMesh.quaternion,
          door.colliderMesh.scale,
        );
      }
    });
  }

  return {
    world,
    addStaticScene,
    setActiveScene,
    createCharacter,
    configureCharacter,
    moveCharacter,
    teleportCharacter,
    jump,
    createHingedDoor,
    setDoorDragTarget,
    getDoorDegrees,
    step,
    hasCharacter: () => Boolean(character),
    hasScene: (key) => sceneColliders.has(key),
    getCharacter: () => character,
  };
}
