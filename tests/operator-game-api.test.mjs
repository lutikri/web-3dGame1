import assert from "node:assert/strict";
import test from "node:test";

import { installOperatorGameApi } from "../src/runtime/OperatorGameApi.js";

test("operator game API installer exposes the composed app contract", () => {
  const host = {};
  const noop = () => {};
  const api = {
    startLevel: noop,
    resetForMenu: noop,
    setInputLocked: noop,
    getState: () => ({}),
    inspectRuntime: () => ({}),
  };
  assert.equal(installOperatorGameApi(host, api), api);
  assert.equal(host.operatorGameDebug, api);
});

test("operator game API installer rejects an incomplete shell contract", () => {
  assert.throws(() => installOperatorGameApi({}, {}), /requires startLevel/);
});

