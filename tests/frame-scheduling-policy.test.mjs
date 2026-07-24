import assert from "node:assert/strict";
import test from "node:test";

import { FrameSchedulingPolicy } from "../src/runtime/FrameSchedulingPolicy.js";

test("frame scheduling policy separates hidden, unfocused, and prewarm states", () => {
  const documentRef = new EventTarget();
  const windowRef = new EventTarget();
  let focused = false;
  documentRef.hidden = false;
  documentRef.hasFocus = () => focused;
  const policy = new FrameSchedulingPolicy({ documentRef, windowRef });

  assert.equal(policy.getDelayMs(), 100);
  const release = policy.acquireForegroundLease();
  assert.equal(policy.getDelayMs(), null);
  documentRef.hidden = true;
  assert.equal(policy.getDelayMs(), 1000);
  documentRef.hidden = false;
  release();
  assert.equal(policy.getDelayMs(), 100);
  focused = true;
  assert.equal(policy.getDelayMs(), null);
  policy.dispose();
});

test("frame scheduling policy notifies subscribers on browser state and lease changes", () => {
  const documentRef = new EventTarget();
  const windowRef = new EventTarget();
  documentRef.hidden = false;
  documentRef.hasFocus = () => true;
  const policy = new FrameSchedulingPolicy({ documentRef, windowRef });
  let notifications = 0;
  policy.subscribe(() => { notifications += 1; });

  documentRef.dispatchEvent(new Event("visibilitychange"));
  windowRef.dispatchEvent(new Event("blur"));
  const release = policy.acquireForegroundLease();
  release();
  assert.equal(notifications, 4);
  policy.dispose();
});
