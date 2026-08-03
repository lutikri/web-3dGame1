import test from "node:test";
import assert from "node:assert/strict";

import { ItemInventoryRuntime, ITEM_STATES } from "../src/interactions/ItemInventoryRuntime.js";

function createItem(id, options = {}) {
  return { id, target: {}, label: id, portable: true, ...options };
}

test("short primary click grabs while a completed hold stores without also grabbing", () => {
  const transitions = [];
  const runtime = new ItemInventoryRuntime({
    applyItemState: (item, state) => transitions.push(`${item.id}:${state}`),
  });
  const brief = runtime.register(createItem("brief"));

  runtime.beginPrimary(brief.target);
  runtime.update(0.1);
  runtime.releasePrimary();
  assert.equal(brief.state, ITEM_STATES.GRABBED);

  runtime.beginPrimary(brief.target);
  runtime.update(0.5);
  runtime.releasePrimary();
  assert.equal(brief.state, ITEM_STATES.INVENTORY);
  assert.deepEqual(runtime.getSnapshot().slots.map((item) => item?.id), ["brief", undefined]);
  assert.deepEqual(transitions, ["brief:grabbed", "brief:inventory"]);
});

test("TAKE feedback waits before starting its visible sweep", () => {
  const feedback = [];
  const runtime = new ItemInventoryRuntime({
    setHoldProgress: (progress, active) => feedback.push({ progress, active }),
  });
  const item = runtime.register(createItem("brief"));
  runtime.beginPrimary(item.target);
  runtime.update(0.17);
  assert.deepEqual(feedback, []);
  runtime.update(0.01);
  assert.equal(feedback.at(-1).active, true);
  assert.ok(feedback.at(-1).progress < 0.001);
});

test("full inventory deterministically drops the least recently selected item", () => {
  const transitions = [];
  const runtime = new ItemInventoryRuntime({
    applyItemState: (item, state, context) => transitions.push({ id: item.id, state, reason: context.reason }),
  });
  const brief = runtime.register(createItem("brief", { activationMode: "specialView" }));
  const flashlight = runtime.register(createItem("flashlight", { activationMode: "equipment" }));
  const keycard = runtime.register(createItem("keycard"));
  runtime.store(brief);
  runtime.store(flashlight);

  runtime.beginSelection();
  runtime.moveSelection(1);
  runtime.commitSelection();
  runtime.closeSpecialView();
  runtime.store(keycard);

  assert.deepEqual(runtime.getSnapshot().slots.map((item) => item?.id), ["brief", "keycard"]);
  assert.deepEqual(transitions.at(-2), { id: "flashlight", state: "world", reason: "inventory-replaced" });
});

test("closing a special view returns selection to Nothing and keeps the item stored", () => {
  const runtime = new ItemInventoryRuntime({ openSpecialView: () => true });
  const brief = runtime.register(createItem("brief", { activationMode: "specialView" }));
  runtime.store(brief);
  runtime.beginSelection();
  runtime.moveSelection(1);
  runtime.commitSelection();
  assert.equal(brief.state, ITEM_STATES.SPECIAL_VIEW);

  runtime.closeSpecialView();
  assert.equal(brief.state, ITEM_STATES.INVENTORY);
  assert.equal(runtime.getSnapshot().activeSlotIndex, 0);
  assert.equal(runtime.getSnapshot().slots[0].id, "brief");
});

test("selecting equipment releases a physically grabbed item", () => {
  const transitions = [];
  const runtime = new ItemInventoryRuntime({
    applyItemState: (item, state, context) => transitions.push({ id: item.id, state, reason: context.reason }),
  });
  const chair = runtime.register(createItem("chair", { portable: false }));
  const flashlight = runtime.register(createItem("flashlight", { activationMode: "equipment" }));
  runtime.store(flashlight);
  runtime.grab(chair);

  runtime.beginSelection();
  runtime.moveSelection(1);
  runtime.commitSelection();

  assert.equal(chair.state, ITEM_STATES.WORLD);
  assert.equal(flashlight.state, ITEM_STATES.EQUIPPED);
  assert.equal(transitions.some((entry) => entry.id === "chair" && entry.reason === "inventory-selection"), true);
});

test("state transitions report the previous physical state to their owner", () => {
  const transitions = [];
  const runtime = new ItemInventoryRuntime({
    applyItemState: (_item, state, context) => transitions.push({ state, previousState: context.previousState }),
  });
  const item = runtime.register({ id: "chair", target: {}, portable: true });

  runtime.grab(item);
  runtime.releaseGrabbed();

  assert.deepEqual(transitions, [
    { state: ITEM_STATES.GRABBED, previousState: ITEM_STATES.WORLD },
    { state: ITEM_STATES.WORLD, previousState: ITEM_STATES.GRABBED },
  ]);
});
