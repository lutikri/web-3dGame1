import assert from "node:assert/strict";
import test from "node:test";

import { createTutorialHintQueue } from "../src/app/TutorialHintQueue.js";

test("tutorial hint queue does not reveal or sound the same active hint twice", () => {
  const previousWindow = globalThis.window;
  globalThis.window = {
    setTimeout: (callback) => { callback(); return 1; },
    clearTimeout: () => {},
  };
  let shows = 0;
  const element = {
    hidden: true,
    innerHTML: "",
    textContent: "",
    getBoundingClientRect: () => ({}),
    classList: { add: () => {}, remove: () => {} },
  };
  try {
    const queue = createTutorialHintQueue({
      element,
      translate: (key) => key,
      onShow: () => { shows += 1; },
    });
    queue.show({ id: "move", textKey: "move" });
    queue.show({ id: "move", textKey: "move" });
    assert.equal(shows, 1);
    assert.equal(queue.getActiveId(), "move");
  } finally {
    globalThis.window = previousWindow;
  }
});
