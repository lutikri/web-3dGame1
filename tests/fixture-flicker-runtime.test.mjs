import test from "node:test";
import assert from "node:assert/strict";
import { FixtureFlickerRuntime } from "../src/lighting/FixtureFlickerRuntime.js";

test("fixture flicker runtime updates shared states once and targets named fixtures", () => {
  const config = {
    enabled: true,
    minIntervalSeconds: 10,
    maxIntervalSeconds: 10,
    durationSeconds: [0.1, 0.1],
  };
  const runtime = new FixtureFlickerRuntime({ config, getTargets: () => targets });
  const shared = runtime.create();
  shared.nextIn = 1;
  const targets = [
    { name: "A", userData: { fixtureName: "shared", fixtureFlicker: shared } },
    { name: "B", userData: { fixtureName: "shared", fixtureFlicker: shared } },
  ];
  runtime.update(0.5);
  assert.equal(shared.nextIn, 0.5);
  assert.deepEqual(runtime.trigger("shared"), ["shared"]);
  assert.ok(shared.duration > 0);
  assert.equal(typeof runtime.getFactor(targets[0]), "number");
});
