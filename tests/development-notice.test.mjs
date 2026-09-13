import test from "node:test";
import assert from "node:assert/strict";

import { resolveDevelopmentNoticeLanguage, showDevelopmentNotice } from "../src/app/DevelopmentNotice.js";

test("development notice uses browser language before preflight selection", () => {
  assert.equal(resolveDevelopmentNoticeLanguage("ru-RU"), "ru");
  assert.equal(resolveDevelopmentNoticeLanguage("en-US"), "en");
});

test("development notice waits for explicit acknowledgement and then removes itself", async () => {
  let acknowledge = null;
  let focused = false;
  let removed = false;
  let appended = null;
  const button = {
    focus: () => { focused = true; },
    addEventListener: (event, callback, options) => {
      assert.equal(event, "click");
      assert.equal(options.once, true);
      acknowledge = callback;
    },
  };
  const overlay = {
    className: "",
    innerHTML: "",
    querySelector: (selector) => {
      assert.equal(selector, "[data-development-acknowledge]");
      return button;
    },
    remove: () => { removed = true; },
  };
  const documentRef = {
    createElement: (tag) => { assert.equal(tag, "div"); return overlay; },
    body: { append: (node) => { appended = node; } },
  };
  const pending = showDevelopmentNotice({ documentRef, language: "ru" });
  assert.equal(appended, overlay);
  assert.equal(focused, true);
  assert.equal(removed, false);
  assert.match(overlay.innerHTML, /Реактор, вероятно, не взорвётся/);
  assert.match(overlay.innerHTML, /ПОДТВЕРДИТЬ/);
  acknowledge();
  await pending;
  assert.equal(removed, true);
});
