import assert from "node:assert/strict";
import test from "node:test";

import { getTerminalStatusLines } from "../src/StatusScreen.js";

test("status screen separates normal core shutdown from automatic trip", () => {
  assert.deepEqual(getTerminalStatusLines({ mode: "complete", failureType: null }), [
    "CORE SHUTDOWN", "REACTION SECURED", "OUTPUT OFFLINE", "LOCAL RESTART AVAILABLE",
  ]);
  assert.deepEqual(getTerminalStatusLines({ mode: "failed", failureType: "qualityFailure" }), [
    "CORE SHUTDOWN", "REACTION SECURED", "OUTPUT OFFLINE", "LOCAL RESTART AVAILABLE",
  ]);
  assert.deepEqual(getTerminalStatusLines({ mode: "failed", failureType: "coreDestroyed" }), [
    "FAIL SAFE", "AUTOMATIC TRIP", "CORE SHUTDOWN", "RESTART EXTERNALLY",
  ]);
});
