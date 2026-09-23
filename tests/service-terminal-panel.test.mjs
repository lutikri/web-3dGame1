import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTerminalGuideSlides,
  getServiceTerminalContent,
} from "../src/app/panels/ServiceTerminalContent.js";
import { resolveTerminalShiftId } from "../src/app/panels/ServiceTerminalShiftConfig.js";
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
  assert.deepEqual(english.reports.entries[0], ["UNKNOWN", "OLD REGISTRY RECOVERY FAILED"]);
  assert.deepEqual(english.reports.entries.at(-1), ["30.04.2037", "OPERATOR QUALIFICATION SESSION"]);
});

test("terminal content follows the active shift with fixed dates and shift-specific guides", () => {
  const qualification = getServiceTerminalContent("exploring-around", "en");
  const diagnostic = getServiceTerminalContent("unexpected-stuff", "en");
  const efficiency = getServiceTerminalContent("fuel-problems", "ru");

  assert.equal(resolveTerminalShiftId("exploring-around"), "qualification");
  assert.equal(resolveTerminalShiftId("unexpected-stuff"), "diagnostic");
  assert.equal(resolveTerminalShiftId("fuel-problems"), "efficiency");
  assert.deepEqual(qualification.shift, { id: "qualification", date: "30.04.2037", time: "13:30", site: "SITE-12", shaft: "SHAFT 03" });
  assert.equal(diagnostic.shift.date, "02.05.2037");
  assert.equal(diagnostic.guide.slides.length, 2);
  assert.equal(diagnostic.guide.slides[0].title, "INSTRUMENT RELIABILITY");
  assert.equal(efficiency.shift.time, "21:40");
  assert.equal(efficiency.guide.slides.length, 2);
  assert.equal(efficiency.guide.slides[0].title, "УПРАВЛЕНИЕ ТОПЛИВНОЙ СМЕСЬЮ");
});

test("shift reports accumulate canonical events without replay attempts", () => {
  const qualification = getServiceTerminalContent("qualification", "en");
  const diagnostic = getServiceTerminalContent("diagnostic", "en");
  const efficiency = getServiceTerminalContent("efficiency", "en");

  assert.equal(qualification.reports.entries.length, 4);
  assert.equal(diagnostic.reports.entries.length, 5);
  assert.equal(efficiency.reports.entries.length, 6);
  assert.equal(efficiency.reports.entries.filter(([, event]) => event === "OPERATOR QUALIFICATION SESSION").length, 1);
});

test("guide pages support zero, one, two, and four-plus authored pages in both languages", () => {
  const emptyEn = buildTerminalGuideSlides([], "en");
  const emptyRu = buildTerminalGuideSlides([], "ru");
  const pages = Array.from({ length: 5 }, (_, index) => ({
    id: `page-${index}`,
    title: { en: `Page ${index}`, ru: `Страница ${index}` },
    body: { en: [], ru: [] },
  }));

  assert.equal(emptyEn.length, 1);
  assert.equal(emptyEn[0].title, "OPERATING INSTRUCTIONS");
  assert.equal(emptyRu[0].copy[0], "ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ НЕ ПРИЛАГАЮТСЯ.");
  assert.equal(buildTerminalGuideSlides(pages.slice(0, 1), "en").at(-1).number, "01");
  assert.equal(buildTerminalGuideSlides(pages.slice(0, 2), "en").at(-1).number, "02");
  assert.equal(buildTerminalGuideSlides(pages, "ru").at(-1).number, "05");
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
