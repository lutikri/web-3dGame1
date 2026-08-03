import test from "node:test";
import assert from "node:assert/strict";

import {
  getThrowStrength,
  isMovementCode,
  isNewInventoryWheelGesture,
  isTextEditingTarget,
} from "../src/player/OperatorInputRuntime.js";

test("operator input runtime classifies movement and editing input", () => {
  assert.equal(isMovementCode("KeyW"), true);
  assert.equal(isMovementCode("KeyP"), false);
  assert.equal(isTextEditingTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextEditingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTextEditingTarget({ tagName: "CANVAS" }), false);
});

test("Q remains a normal drop on a tap and gains bounded throw strength when held", () => {
  assert.equal(getThrowStrength(0.2), 0);
  assert.equal(getThrowStrength(0.35), 0);
  assert.ok(getThrowStrength(0.7) > 0);
  assert.equal(getThrowStrength(2), 1);
});

test("inventory wheel allows only one selection step per event burst", () => {
  assert.equal(isNewInventoryWheelGesture(1, Number.NEGATIVE_INFINITY), true);
  assert.equal(isNewInventoryWheelGesture(1.03, 1), false);
  assert.equal(isNewInventoryWheelGesture(1.07, 1.03), false);
  assert.equal(isNewInventoryWheelGesture(1.18, 1.07), true);
});
