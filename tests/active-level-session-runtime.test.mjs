import assert from "node:assert/strict";
import test from "node:test";

import { ActiveLevelSessionRuntime } from "../src/levels/ActiveLevelSessionRuntime.js";

test("active level session runtime owns start, status transitions and completion notification", () => {
  const resets = [];
  let state = { levelId: "room", status: "running" };
  const session = {
    config: { objectives: [{ id: "exit" }] },
    start: () => structuredClone(state),
    update: () => structuredClone(state),
    emit: (type, detail) => ({ type, detail }),
    reset: (options) => { resets.push(options); return { status: "idle" }; },
    snapshot: () => structuredClone(state),
  };
  const completions = [];
  const events = [];
  const runtime = new ActiveLevelSessionRuntime({
    createSession: ({ levelId }) => {
      assert.equal(levelId, "room");
      return session;
    },
    onComplete: (levelId, snapshot) => completions.push({ levelId, snapshot }),
    onEvent: (event, levelId) => events.push({ event, levelId }),
  });

  assert.equal(runtime.start({ levelId: "room", config: session.config }).status, "running");
  assert.deepEqual(runtime.emit("doorOpened", { target: "Door" }), {
    type: "doorOpened", detail: { target: "Door" },
  });
  assert.deepEqual(events, [{
    event: { type: "doorOpened", detail: { target: "Door" } },
    levelId: "room",
  }]);
  state = { levelId: "room", status: "complete" };
  runtime.update(0.1, {});
  runtime.update(0.1, {});
  assert.equal(completions.length, 1);
  assert.equal(runtime.config, session.config);
  assert.equal(runtime.snapshot().status, "complete");

  runtime.reset({ clearSaved: true });
  assert.deepEqual(resets, [{ clearSaved: true }]);
  assert.equal(runtime.snapshot(), null);
});
