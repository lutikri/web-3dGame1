import assert from "node:assert/strict";
import test from "node:test";

import { LoadingCoordinator } from "../src/ui/LoadingCoordinator.js";

test("loading coordinator owns route visibility and completion state", () => {
  const calls = [];
  const routeLifecycle = [];
  const overlay = {
    show: (options) => calls.push(["show", options]),
    finish: (callback) => { calls.push(["finish"]); callback(); },
    skip: () => calls.push(["skip"]),
    update: () => {},
    setProgress: () => {},
    setStatus: () => {},
  };
  const coordinator = new LoadingCoordinator({
    overlay,
    initialComplete: true,
    shouldSkipBoot: () => false,
    onBootComplete: () => {},
    onRouteStart: () => routeLifecycle.push("start"),
    onRouteComplete: () => routeLifecycle.push("complete"),
    dispatchTarget: new EventTarget(),
    isModelPending: () => false,
  });

  coordinator.showRoute({ title: "SHIFT", status: "PREP", progress: 12 });
  assert.equal(coordinator.isComplete(), false);
  coordinator.finishRoute();
  assert.equal(coordinator.isComplete(), true);
  assert.deepEqual(routeLifecycle, ["start", "complete"]);
  assert.deepEqual(calls[0], ["show", { title: "SHIFT", statusText: "PREP", progressValue: 12 }]);
});
