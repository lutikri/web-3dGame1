import test from "node:test";
import assert from "node:assert/strict";

import { isMovementCode, isTextEditingTarget } from "../src/player/OperatorInputRuntime.js";

test("operator input runtime classifies movement and editing input", () => {
  assert.equal(isMovementCode("KeyW"), true);
  assert.equal(isMovementCode("KeyP"), false);
  assert.equal(isTextEditingTarget({ tagName: "INPUT" }), true);
  assert.equal(isTextEditingTarget({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTextEditingTarget({ tagName: "CANVAS" }), false);
});
