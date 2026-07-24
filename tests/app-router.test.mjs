import assert from "node:assert/strict";
import test from "node:test";

import { createAppRouter } from "../src/app/AppRouter.js";

test("app router reports real action progress instead of completing on the first frame", async () => {
  const previousWindow = globalThis.window;
  const delays = [];
  globalThis.window = { setTimeout: (callback, delay) => { delays.push(delay); callback(); } };
  const classes = new Set();
  const overlay = {
    hidden: true,
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
    },
    getBoundingClientRect: () => ({}),
  };
  const percent = { textContent: "" };
  const barFill = { style: { width: "" } };
  const title = { textContent: "", classList: overlay.classList };
  const status = { textContent: "" };
  const observed = [];

  try {
    const router = createAppRouter({ overlay, percent, title, status, barFill });
    await router.transition({
      title: "SHIFT",
      status: "LOADING",
      action: async ({ setProgress }) => {
        observed.push(percent.textContent);
        setProgress(68);
        observed.push(percent.textContent);
      },
    });
  } finally {
    globalThis.window = previousWindow;
  }

  assert.deepEqual(observed, ["04%", "68%"]);
  assert.equal(percent.textContent, "100%");
  assert.equal(barFill.style.width, "100%");
  assert.equal(delays.includes(200), true);
  assert.equal(delays.filter((delay) => delay === 500).length >= 2, true);
});
