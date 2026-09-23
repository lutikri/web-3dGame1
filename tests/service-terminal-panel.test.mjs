import test from "node:test";
import assert from "node:assert/strict";

import { getServiceTerminalContent } from "../src/app/panels/ServiceTerminalContent.js";
import {
  resolveServiceTerminalEscapeAction,
  stepGuideIndex,
} from "../src/app/panels/ServiceTerminalPanel.js";

test("service terminal content exposes the required data-driven sections in EN and RU", () => {
  const english = getServiceTerminalContent("exploring-around", "en");
  const russian = getServiceTerminalContent("exploring-around", "ru");

  assert.deepEqual(Object.keys(english.tabs), ["brief", "guide", "reports", "archive", "notices"]);
  assert.equal(english.brief.attachments.length, 2);
  assert.deepEqual(english.brief.attachments.map((entry) => entry.id), ["technical-brief", "load-profile"]);
  assert.equal(english.guide.slides.length, 4);
  assert.equal(english.assets.logo, "assets/ui/service-terminal/terragen-systems-logo.png");
  assert.equal(english.assets.siteImage, "assets/ui/service-terminal/site-12-facility.jpg");
  assert.deepEqual(Object.keys(english.assets.icons), ["brief", "guide", "reports", "archive", "notices"]);
  assert.equal(english.assets.icons.brief, "assets/ui/service-terminal/icons/shift-brief.svg");
  assert.equal(english.assets.icons.notices, "assets/ui/service-terminal/icons/notices.svg");
  assert.deepEqual(english.brief.attachments.map((entry) => entry.icon), ["reports", "guide"]);
  assert.equal(english.brief.attachments[0].pages[0], "assets/ui/briefings/Intro1-us.png");
  assert.equal(russian.brief.attachments[0].pages.length, 2);
  assert.equal(russian.brief.title, "ПЕРВАЯ КВАЛ.\nСМЕНА");
  assert.equal(russian.brief.attachments[0].title, "АРХИВНЫЙ ТЕХ. БРИФ");
  assert.equal(russian.guide.slides[0].kind, "demandIndicators");
  assert.equal(russian.guide.slides[1].kind, "indicatorDefinitions");
  assert.deepEqual(russian.guide.slides[1].definitions[0], ["OVER DEMAND", "Мощность выше текущего запроса сети."]);
  assert.equal(russian.brief.siteMessage, "INFRASTRUCTURE\nENDURES.");
  assert.deepEqual(english.reports.entries[0], ["UNKNOWN", "LEGACY REGISTRY RECOVERY FAILED"]);
  assert.deepEqual(english.reports.entries.at(-1), ["30.04.2037", "OPERATOR QUALIFICATION SESSION"]);
});

test("operations guide navigation stays inside the authored slide range", () => {
  assert.equal(stepGuideIndex(0, -1, 4), 0);
  assert.equal(stepGuideIndex(1, 1, 4), 2);
  assert.equal(stepGuideIndex(3, 1, 4), 3);
});

test("terminal escape hierarchy closes an attachment before the terminal", () => {
  assert.equal(resolveServiceTerminalEscapeAction({ active: false, attachmentOpen: false }), null);
  assert.equal(resolveServiceTerminalEscapeAction({ active: true, attachmentOpen: true }), "close-attachment");
  assert.equal(resolveServiceTerminalEscapeAction({ active: true, attachmentOpen: false }), "close-terminal");
});
