import test from "node:test";
import assert from "node:assert/strict";

import { translate } from "../src/app/Localization.js";

test("main menu actions expose matching English and Russian copy", () => {
  assert.equal(translate("actions.startWork", "en"), "START WORK");
  assert.equal(translate("actions.startWork", "ru"), "НАЧАТЬ РАБОТУ");
  assert.equal(translate("actions.credits", "en"), "CREDITS");
  assert.equal(translate("actions.credits", "ru"), "ТИТРЫ");
});
