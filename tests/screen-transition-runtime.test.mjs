import assert from "node:assert/strict";
import test from "node:test";

import { createScreenTransitionRuntime } from "../src/ui/ScreenTransitionRuntime.js";

test("screen transition owns a body-level curtain while content swaps underneath", async () => {
  const classes = new Set();
  const layer = {
    className: "",
    classList: {
      add: (...values) => values.forEach((value) => classes.add(value)),
      remove: (...values) => values.forEach((value) => classes.delete(value)),
      contains: (value) => classes.has(value),
    },
    dataset: {},
    style: { setProperty: () => {} },
    setAttribute: () => {},
    remove: () => {},
    hidden: true,
  };
  const appended = [];
  const runtime = createScreenTransitionRuntime({
    documentRef: {
      body: { append: (element) => appended.push(element) },
      createElement: () => layer,
    },
    requestAnimationFrameFn: (callback) => callback(),
    setTimeoutFn: (callback) => callback(),
  });
  const order = [];

  await runtime.swap(() => order.push("swap"), {
    tone: "black",
    durationMs: 0,
    revealDurationMs: 0,
  });

  assert.deepEqual(appended, [layer]);
  assert.deepEqual(order, ["swap"]);
  assert.equal(layer.dataset.tone, "black");
  assert.equal(layer.hidden, true);
  assert.equal(runtime.isCovered(), false);
});
