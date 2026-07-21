import test from "node:test";
import assert from "node:assert/strict";
import { RuntimeTextureLoadingIndicator } from "../src/ui/RuntimeTextureLoadingIndicator.js";

function createDocument() {
  const label = { textContent: "" };
  const element = {
    hidden: false,
    className: "",
    innerHTML: "",
    classList: { toggle: (_name, value) => { element.active = value; } },
    querySelector: () => label,
  };
  return {
    element,
    label,
    createElement: () => element,
    body: { appendChild: () => {} },
  };
}

test("runtime texture indicator owns progress and delayed hiding", () => {
  const documentRef = createDocument();
  let bootComplete = false;
  const indicator = new RuntimeTextureLoadingIndicator({
    documentRef,
    isBootComplete: () => bootComplete,
    getLabel: () => "TEXTURES",
  });
  indicator.start();
  assert.equal(indicator.state.total, 0);
  bootComplete = true;
  indicator.start();
  indicator.complete();
  assert.deepEqual(indicator.state, { total: 1, completed: 1, active: 0, hideTimer: 1.6 });
  assert.equal(documentRef.element.hidden, false);
  indicator.update(1.6);
  assert.equal(documentRef.element.hidden, true);
  assert.equal(documentRef.label.textContent, "TEXTURES 1 / 1");
});
