import * as THREE from "three";

export async function createPhysicsSystem() {
  const { default: RAPIER } = await import("@dimforge/rapier3d-compat");
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

  let world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const sceneColliders = new Map();
  const doors = new Map();
  const kinematicPrefabs = new Map();
  const rigidPrefabs = new Map();
  let activeSceneKey = null;
  let character = null;
  let characterSpec = null;

  function addStaticScene(key, root) {
    removeStaticScene(key);
    sceneColliders.set(key, []);
    return appendStaticScene(key, root);
  }

  function appendStaticScene(key, root) {
    root.updateMatrixWorld(true);
    const colliders = sceneColliders.get(key) ?? [];
    let addedCount = 0;
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
      addedCount += 1;
    });
    sceneColliders.set(key, colliders);
    return addedCount;
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
    doors.forEach((door) => {
      const enabled = door.enabled !== false && door.sceneKey === key;
      door.body.setEnabled(enabled);
      door.fixedBody.setEnabled(enabled);
    });
    kinematicPrefabs.forEach((prefab) => prefab.body.setEnabled(prefab.sceneKey === key));
    rigidPrefabs.forEach((prefab) => prefab.body.setEnabled(prefab.sceneKey === key));
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
    characterSpec = {
      eyePosition: eyePosition.clone(),
      eyeHeight,
      height,
      radius,
      config: { ...config },
    };
    return character;
  }

  function moveCharacter(horizontalDelta, dt) {
    if (!character) return null;
    character.verticalVelocity += world.gravity.y * dt;
    const desiredVertical = character.verticalVelocity * dt;
    const externalVertical = Number(horizontalDelta.y ?? 0);
    const desired = {
      x: horizontalDelta.x,
      y: externalVertical + (desiredVertical > 0 ? desiredVertical : Math.min(desiredVertical, -0.001)),
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
    maxAngularVelocity = 1.8,
    initialHoldSeconds = 0.45,
    motorStiffness = 55,
    motorDamping = 10,
    restMotorEnabled = false,
    restDegrees = initialDegrees,
    restMotorStiffness = 0,
    restMotorDamping = 0,
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
      .setFriction(0.8)
      .setRestitution(0);
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
    joint.configureMotorPosition(0, motorStiffness * 1.5, motorDamping * 1.5);
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
      restMotorEnabled: Boolean(restMotorEnabled),
      restTargetRadians: THREE.MathUtils.degToRad(restDegrees - initialDegrees),
      restMotorStiffness,
      restMotorDamping,
      maxAngularVelocity,
      initialHoldRemaining: initialHoldSeconds,
      initialHoldSeconds,
      initialPosition: { x: hingePosition.x, y: hingePosition.y, z: hingePosition.z },
      initialRotation: {
        x: hingeQuaternion.x,
        y: hingeQuaternion.y,
        z: hingeQuaternion.z,
        w: hingeQuaternion.w,
      },
      locked: false,
      enabled: true,
      targetDegrees: null,
      motorRemaining: 0,
    };
    doors.set(key, door);
    return door;
  }

  function removeDoor(key) {
    const door = doors.get(key);
    if (!door) return;
    world.removeRigidBody(door.body);
    world.removeRigidBody(door.fixedBody);
    doors.delete(key);
  }

  function setDoorDragTarget(key, degrees, active, releaseAngularVelocity = 0) {
    const door = doors.get(key);
    if (!door) return false;
    if (door.locked && !active) return true;
    door.targetDegrees = active ? THREE.MathUtils.degToRad(degrees - door.initialDegrees) : null;
    if (active) {
      door.joint.configureMotorPosition(door.targetDegrees, door.motorStiffness, door.motorDamping);
      door.motorRemaining = 3;
      door.body.wakeUp();
    } else {
      door.joint.configureMotorPosition(0, 0, 0);
      const cappedVelocity = THREE.MathUtils.clamp(
        releaseAngularVelocity,
        -door.maxAngularVelocity,
        door.maxAngularVelocity,
      );
      door.body.setAngvel({ x: 0, y: cappedVelocity, z: 0 }, true);
      door.motorRemaining = 0;
    }
    return true;
  }

  function setDoorLocked(key, locked, degrees = null) {
    const door = doors.get(key);
    if (!door) return false;
    door.locked = Boolean(locked);
    if (door.locked) {
      const targetDegrees = Number.isFinite(degrees) ? degrees : door.initialDegrees;
      door.targetDegrees = THREE.MathUtils.degToRad(targetDegrees - door.initialDegrees);
      door.motorRemaining = Number.POSITIVE_INFINITY;
      door.body.setTranslation(door.initialPosition, true);
      door.body.setRotation(door.initialRotation, true);
      door.joint.configureMotorPosition(
        door.targetDegrees,
        door.motorStiffness * 12,
        door.motorDamping * 4,
      );
      door.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      door.body.wakeUp();
    } else {
      door.targetDegrees = null;
      door.motorRemaining = 0;
      door.joint.configureMotorPosition(0, 0, 0);
      door.body.wakeUp();
    }
    return true;
  }

  function getDoorDegrees(key) {
    const door = doors.get(key);
    if (!door) return null;
    return getDoorDegreesFromRuntime(door);
  }

  function getDoorDegreesFromRuntime(door) {
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

  function resetDoor(key) {
    const door = doors.get(key);
    if (!door) return false;
    door.targetDegrees = null;
    door.motorRemaining = 0;
    door.locked = false;
    door.initialHoldRemaining = door.initialHoldSeconds;
    door.body.setTranslation(door.initialPosition, true);
    door.body.setRotation(door.initialRotation, true);
    door.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    door.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    door.joint.configureMotorPosition(0, door.motorStiffness * 1.5, door.motorDamping * 1.5);
    door.body.wakeUp();
    return true;
  }

  function configureDoorRestMotor(key, config = {}) {
    const door = doors.get(key);
    if (!door) return false;
    door.restMotorEnabled = Boolean(config.enabled);
    door.restTargetRadians = THREE.MathUtils.degToRad(
      Number(config.degrees ?? door.initialDegrees) - door.initialDegrees,
    );
    door.restMotorStiffness = Number(config.stiffness ?? door.restMotorStiffness ?? 0);
    door.restMotorDamping = Number(config.damping ?? door.restMotorDamping ?? 0);
    return true;
  }

  function setDoorEnabled(key, enabled) {
    const door = doors.get(key);
    if (!door) return false;
    const active = Boolean(enabled) && door.sceneKey === activeSceneKey;
    door.enabled = Boolean(enabled);
    if (!active) {
      resetDoor(key);
    }
    door.body.setEnabled(active);
    door.fixedBody.setEnabled(active);
    if (active) door.body.wakeUp();
    return true;
  }

  function resetDoors(sceneKey = null) {
    doors.forEach((door, key) => {
      if (sceneKey == null || door.sceneKey === sceneKey) resetDoor(key);
    });
  }

  function createKinematicPrefab({
    key,
    sceneKey,
    root,
    colliderMeshes = [],
    friction = 1,
    colliderMode = "boxes",
    floorThickness = 0.12,
    floorInset = 0,
  }) {
    removeKinematicPrefab(key);
    root.updateWorldMatrix(true, true);
    const rootPosition = new THREE.Vector3();
    const rootQuaternion = new THREE.Quaternion();
    const rootScale = new THREE.Vector3();
    root.matrixWorld.decompose(rootPosition, rootQuaternion, rootScale);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(rootPosition.x, rootPosition.y, rootPosition.z)
        .setRotation(rootQuaternion),
    );
    const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const colliders = [];

    if (colliderMode === "floor") {
      const bounds = getMeshesBoundsInRoot(colliderMeshes, inverseRoot);
      if (bounds && !bounds.isEmpty()) {
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const thickness = Math.max(0.01, Number(floorThickness) || 0.12);
        const inset = Math.max(0, Number(floorInset) || 0);
        center.y = bounds.min.y + thickness * 0.5;
        const collider = world.createCollider(
          RAPIER.ColliderDesc.cuboid(
            Math.max(size.x * 0.5 - inset, 0.05),
            thickness * 0.5,
            Math.max(size.z * 0.5 - inset, 0.05),
          )
            .setTranslation(center.x, center.y, center.z)
            .setFriction(friction)
            .setRestitution(0),
          body,
        );
        colliders.push(collider);
      }
    } else {
      colliderMeshes.forEach((mesh) => {
        if (!mesh.geometry?.attributes?.position) return;
        mesh.updateWorldMatrix(true, false);
        const colliderInRoot = new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld);
        mesh.geometry.computeBoundingBox();
        const box = mesh.geometry.boundingBox;
        const center = box.getCenter(new THREE.Vector3()).applyMatrix4(colliderInRoot);
        const size = box.getSize(new THREE.Vector3());
        const relativePosition = new THREE.Vector3();
        const relativeQuaternion = new THREE.Quaternion();
        const relativeScale = new THREE.Vector3();
        colliderInRoot.decompose(relativePosition, relativeQuaternion, relativeScale);
        size.multiply(relativeScale).multiplyScalar(0.5);
        const collider = world.createCollider(
          RAPIER.ColliderDesc.cuboid(
            Math.max(Math.abs(size.x), 0.01),
            Math.max(Math.abs(size.y), 0.01),
            Math.max(Math.abs(size.z), 0.01),
          )
            .setTranslation(center.x, center.y, center.z)
            .setRotation(relativeQuaternion)
            .setFriction(friction)
            .setRestitution(0),
          body,
        );
        colliders.push(collider);
      });
    }
    body.setEnabled(sceneKey === activeSceneKey);
    const prefab = {
      key,
      sceneKey,
      root,
      body,
      colliders,
    };
    kinematicPrefabs.set(key, prefab);
    return prefab;
  }

  function getMeshesBoundsInRoot(meshes, inverseRoot) {
    const bounds = new THREE.Box3();
    const corner = new THREE.Vector3();
    meshes.forEach((mesh) => {
      if (!mesh.geometry?.attributes?.position) return;
      mesh.updateWorldMatrix(true, false);
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      if (!box) return;
      const colliderInRoot = new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld);
      for (const x of [box.min.x, box.max.x]) {
        for (const y of [box.min.y, box.max.y]) {
          for (const z of [box.min.z, box.max.z]) {
            corner.set(x, y, z).applyMatrix4(colliderInRoot);
            bounds.expandByPoint(corner);
          }
        }
      }
    });
    return bounds;
  }

  function updateKinematicPrefab(key, root, options = {}) {
    const prefab = kinematicPrefabs.get(key);
    if (!prefab) return false;
    const sourceRoot = root ?? prefab.root;
    sourceRoot.updateWorldMatrix(true, true);
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    sourceRoot.matrixWorld.decompose(position, quaternion, scale);
    const translation = { x: position.x, y: position.y, z: position.z };
    const rotation = {
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w,
    };
    if (options.immediate) {
      prefab.body.setTranslation(translation, true);
      prefab.body.setRotation(rotation, true);
    } else {
      prefab.body.setNextKinematicTranslation(translation);
      prefab.body.setNextKinematicRotation(rotation);
    }
    return true;
  }

  function removeKinematicPrefab(key) {
    const prefab = kinematicPrefabs.get(key);
    if (!prefab) return;
    world.removeRigidBody(prefab.body);
    kinematicPrefabs.delete(key);
  }

  function setKinematicPrefabEnabled(key, enabled) {
    const prefab = kinematicPrefabs.get(key);
    if (!prefab) return false;
    prefab.body.setEnabled(Boolean(enabled) && prefab.sceneKey === activeSceneKey);
    return true;
  }

  function createRigidPrefab({
    key,
    sceneKey,
    root,
    colliderMeshes = [],
    bodyType = "dynamic",
    density = 80,
    linearDamping = 0.8,
    angularDamping = 1.4,
    friction = 0.8,
    restitution = 0,
    canSleep = true,
  }) {
    removeRigidPrefab(key);
    root.updateWorldMatrix(true, true);
    const rootPosition = new THREE.Vector3();
    const rootQuaternion = new THREE.Quaternion();
    const rootScale = new THREE.Vector3();
    root.matrixWorld.decompose(rootPosition, rootQuaternion, rootScale);
    const desc =
      bodyType === "fixed"
        ? RAPIER.RigidBodyDesc.fixed()
        : RAPIER.RigidBodyDesc.dynamic()
            .setLinearDamping(linearDamping)
            .setAngularDamping(angularDamping)
            .setCanSleep(canSleep);
    const body = world.createRigidBody(
      desc
        .setTranslation(rootPosition.x, rootPosition.y, rootPosition.z)
        .setRotation(rootQuaternion),
    );
    const inverseRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const colliders = [];
    colliderMeshes.forEach((mesh) => {
      if (!mesh.geometry?.attributes?.position) return;
      mesh.updateWorldMatrix(true, false);
      const colliderInRoot = new THREE.Matrix4().multiplyMatrices(inverseRoot, mesh.matrixWorld);
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      if (!box) return;
      const center = box.getCenter(new THREE.Vector3()).applyMatrix4(colliderInRoot);
      const size = box.getSize(new THREE.Vector3());
      const relativePosition = new THREE.Vector3();
      const relativeQuaternion = new THREE.Quaternion();
      const relativeScale = new THREE.Vector3();
      colliderInRoot.decompose(relativePosition, relativeQuaternion, relativeScale);
      size.multiply(relativeScale).multiplyScalar(0.5);
      const collider = world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          Math.max(Math.abs(size.x), 0.01),
          Math.max(Math.abs(size.y), 0.01),
          Math.max(Math.abs(size.z), 0.01),
        )
          .setTranslation(center.x, center.y, center.z)
          .setRotation(relativeQuaternion)
          .setDensity(density)
          .setFriction(friction)
          .setRestitution(restitution),
        body,
      );
      colliders.push(collider);
    });
    body.setEnabled(sceneKey === activeSceneKey);
    const prefab = {
      key,
      sceneKey,
      root,
      body,
      colliders,
      initialPosition: { x: rootPosition.x, y: rootPosition.y, z: rootPosition.z },
      initialRotation: {
        x: rootQuaternion.x,
        y: rootQuaternion.y,
        z: rootQuaternion.z,
        w: rootQuaternion.w,
      },
    };
    rigidPrefabs.set(key, prefab);
    return prefab;
  }

  function removeRigidPrefab(key) {
    const prefab = rigidPrefabs.get(key);
    if (!prefab) return;
    world.removeRigidBody(prefab.body);
    rigidPrefabs.delete(key);
  }

  function setRigidPrefabMode(key, mode) {
    const prefab = rigidPrefabs.get(key);
    if (!prefab) return false;
    if (mode === "inventory") {
      prefab.body.setEnabled(false);
      return true;
    }
    const bodyType = mode === "world"
      ? RAPIER.RigidBodyType.Dynamic
      : RAPIER.RigidBodyType.KinematicPositionBased;
    prefab.body.setBodyType(bodyType, true);
    prefab.body.setEnabled(prefab.sceneKey === activeSceneKey);
    prefab.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    prefab.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    prefab.body.wakeUp();
    return true;
  }

  function setRigidPrefabPose(key, position, rotation, immediate = false) {
    const prefab = rigidPrefabs.get(key);
    if (!prefab || !position || !rotation) return false;
    const translation = { x: position.x, y: position.y, z: position.z };
    const quaternion = { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w };
    if (immediate) {
      prefab.body.setTranslation(translation, true);
      prefab.body.setRotation(quaternion, true);
    } else {
      prefab.body.setNextKinematicTranslation(translation);
      prefab.body.setNextKinematicRotation(quaternion);
    }
    return true;
  }

  function dropRigidPrefab(key, position, rotation, linearVelocity = null) {
    const prefab = rigidPrefabs.get(key);
    if (!prefab) return false;
    setRigidPrefabMode(key, "world");
    setRigidPrefabPose(key, position, rotation, true);
    if (linearVelocity) prefab.body.setLinvel(linearVelocity, true);
    return true;
  }

  function resetRigidPrefab(key, root = null, updateInitial = false) {
    const prefab = rigidPrefabs.get(key);
    if (!prefab) return false;
    if (root) {
      root.updateWorldMatrix(true, true);
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      root.matrixWorld.decompose(position, quaternion, scale);
      if (updateInitial) {
        prefab.initialPosition = { x: position.x, y: position.y, z: position.z };
        prefab.initialRotation = {
          x: quaternion.x,
          y: quaternion.y,
          z: quaternion.z,
          w: quaternion.w,
        };
      }
    }
    prefab.body.setTranslation(prefab.initialPosition, true);
    prefab.body.setRotation(prefab.initialRotation, true);
    prefab.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    prefab.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    prefab.body.wakeUp();
    return true;
  }

  function unloadScene(key) {
    removeStaticScene(key);
    [...doors.entries()].forEach(([doorKey, door]) => {
      if (door.sceneKey === key) removeDoor(doorKey);
    });
    [...kinematicPrefabs.entries()].forEach(([prefabKey, prefab]) => {
      if (prefab.sceneKey === key) removeKinematicPrefab(prefabKey);
    });
    [...rigidPrefabs.entries()].forEach(([prefabKey, prefab]) => {
      if (prefab.sceneKey === key) removeRigidPrefab(prefabKey);
    });
    if (activeSceneKey === key) activeSceneKey = null;
  }

  function resetWorld(eyePosition = characterSpec?.eyePosition) {
    const nextCharacterSpec = characterSpec
      ? {
          ...characterSpec,
          eyePosition: eyePosition?.clone?.() ?? characterSpec.eyePosition.clone(),
          config: { ...characterSpec.config },
        }
      : null;
    world.free();
    world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    sceneColliders.clear();
    doors.clear();
    kinematicPrefabs.clear();
    rigidPrefabs.clear();
    activeSceneKey = null;
    character = null;
    characterSpec = null;
    if (nextCharacterSpec) createCharacter(nextCharacterSpec);
  }

  function step(dt) {
    world.timestep = Math.min(dt, 1 / 30);
    world.step();
    doors.forEach((door) => {
      if (!door.body.isEnabled()) return;
      if (door.targetDegrees != null) {
        door.motorRemaining = door.locked ? Number.POSITIVE_INFINITY : Math.max(0, door.motorRemaining - dt);
        const currentRelativeRadians = THREE.MathUtils.degToRad(
          getDoorDegreesFromRuntime(door) - door.initialDegrees,
        );
        const closeEnough = Math.abs(currentRelativeRadians - door.targetDegrees) < 0.025;
        if (!door.locked && (closeEnough || door.motorRemaining <= 0)) {
          door.targetDegrees = null;
          door.motorRemaining = 0;
          door.joint.configureMotorPosition(0, 0, 0);
        } else if (door.locked) {
          door.body.setTranslation(door.initialPosition, true);
          door.body.setRotation(door.initialRotation, true);
          door.joint.configureMotorPosition(
            door.targetDegrees,
            door.motorStiffness * 12,
            door.motorDamping * 4,
          );
          door.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
      }
      door.initialHoldRemaining = door.locked ? 0 : Math.max(0, door.initialHoldRemaining - dt);
      if (!door.locked && door.initialHoldRemaining > 0 && door.targetDegrees == null) {
        door.joint.configureMotorPosition(0, door.motorStiffness * 1.5, door.motorDamping * 1.5);
      } else if (!door.locked && door.restMotorEnabled && door.targetDegrees == null) {
        door.joint.configureMotorPosition(
          door.restTargetRadians ?? 0,
          door.restMotorStiffness ?? 0,
          door.restMotorDamping ?? 0,
        );
      } else if (!door.locked && door.initialHoldRemaining === 0 && door.targetDegrees == null) {
        door.joint.configureMotorPosition(0, 0, 0);
      }
      const angularVelocity = door.body.angvel();
      const clampedY = THREE.MathUtils.clamp(
        angularVelocity.y,
        -door.maxAngularVelocity,
        door.maxAngularVelocity,
      );
      if (clampedY !== angularVelocity.y) {
        door.body.setAngvel({ x: 0, y: clampedY, z: 0 }, true);
      }
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
    rigidPrefabs.forEach((prefab) => {
      if (!prefab.body.isEnabled()) return;
      const position = prefab.body.translation();
      const rotation = prefab.body.rotation();
      const worldMatrix = new THREE.Matrix4().compose(
        new THREE.Vector3(position.x, position.y, position.z),
        new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w),
        new THREE.Vector3(1, 1, 1),
      );
      prefab.root.parent?.updateWorldMatrix(true, false);
      const parentInverse = new THREE.Matrix4().copy(prefab.root.parent.matrixWorld).invert();
      const localMatrix = new THREE.Matrix4().multiplyMatrices(parentInverse, worldMatrix);
      localMatrix.decompose(prefab.root.position, prefab.root.quaternion, prefab.root.scale);
      prefab.root.updateWorldMatrix(true, true);
    });
  }

  return {
    get world() {
      return world;
    },
    addStaticScene,
    appendStaticScene,
    setActiveScene,
    createCharacter,
    configureCharacter,
    moveCharacter,
    teleportCharacter,
    jump,
    createHingedDoor,
    createKinematicPrefab,
    updateKinematicPrefab,
    setKinematicPrefabEnabled,
    removeKinematicPrefab,
    createRigidPrefab,
    setRigidPrefabMode,
    setRigidPrefabPose,
    dropRigidPrefab,
    removeRigidPrefab,
    resetRigidPrefab,
    setDoorEnabled,
    configureDoorRestMotor,
    setDoorDragTarget,
    setDoorLocked,
    getDoorDegrees,
    resetDoor,
    resetDoors,
    unloadScene,
    resetWorld,
    step,
    hasCharacter: () => Boolean(character),
    hasScene: (key) => sceneColliders.has(key),
    getCharacter: () => character,
    getStats: () => ({
      activeSceneKey,
      staticColliderCount: [...sceneColliders.values()].reduce(
        (total, colliders) => total + colliders.length,
        0,
      ),
      doorCount: doors.size,
      kinematicPrefabCount: kinematicPrefabs.size,
      rigidPrefabCount: rigidPrefabs.size,
      hasCharacter: Boolean(character),
    }),
  };
}
