export function applyAxisRotation(object, axis, angle) {
  if (axis === "x") object.rotateX(angle);
  else if (axis === "y") object.rotateY(angle);
  else object.rotateZ(angle);
}
