import * as THREE from "three";

export function createSceneInspector({ scene }) {
  function findObject(name) {
    let match = null;
    scene.traverse((object) => {
      if (!match && object.name === name) match = object;
    });
    return match;
  }

  function getObjectTransform(nameOrObject) {
    const object = typeof nameOrObject === "string" ? findObject(nameOrObject) : nameOrObject;
    if (!object) return null;
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    object.updateWorldMatrix(true, false);
    object.matrixWorld.decompose(worldPosition, worldQuaternion, worldScale);
    return {
      name: object.name,
      type: object.type,
      parent: object.parent?.name ?? "",
      localPosition: object.position.toArray().map(roundTransformNumber),
      localRotationDegrees: [
        THREE.MathUtils.radToDeg(object.rotation.x),
        THREE.MathUtils.radToDeg(object.rotation.y),
        THREE.MathUtils.radToDeg(object.rotation.z),
      ].map(roundTransformNumber),
      localScale: object.scale.toArray().map(roundTransformNumber),
      worldPosition: worldPosition.toArray().map(roundTransformNumber),
      worldRotationDegrees: new THREE.Euler()
        .setFromQuaternion(worldQuaternion)
        .toArray()
        .slice(0, 3)
        .map((value) => roundTransformNumber(THREE.MathUtils.radToDeg(value))),
      worldScale: worldScale.toArray().map(roundTransformNumber),
    };
  }

  function listObjects(pattern = "") {
    const matcher = pattern ? new RegExp(pattern, "i") : null;
    const names = [];
    scene.traverse((object) => {
      if (object.name && (!matcher || matcher.test(object.name))) names.push(object.name);
    });
    return names;
  }

  return { findObject, getObjectTransform, listObjects };
}

function roundTransformNumber(value) {
  return Number(value.toFixed(3));
}
