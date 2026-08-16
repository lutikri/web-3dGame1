import assert from "node:assert/strict";
import test from "node:test";

import {
  getLoadingStageScale,
  updateLoadingStageScale,
} from "../src/ui/LoadingOverlay.js";

test("loading stage scales a fixed 1920 by 1080 composition without CSS typed arithmetic", () => {
  assert.equal(getLoadingStageScale(1920, 1080), 1);
  assert.equal(getLoadingStageScale(2560, 1080), 1);
  assert.equal(getLoadingStageScale(1280, 720), 2 / 3);
});

test("loading stage writes a browser-compatible numeric scale", () => {
  let property = null;
  let value = null;
  const stage = {
    style: {
      setProperty(nextProperty, nextValue) {
        property = nextProperty;
        value = nextValue;
      },
    },
  };
  const overlay = { querySelector: () => stage };

  const scale = updateLoadingStageScale(overlay, { innerWidth: 1280, innerHeight: 720 });

  assert.equal(scale, 2 / 3);
  assert.equal(property, "--loading-stage-scale");
  assert.equal(value, String(2 / 3));
});
