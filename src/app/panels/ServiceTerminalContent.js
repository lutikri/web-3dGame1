import {
  getTerminalShiftConfig,
  resolveTerminalShiftId,
  TERMINAL_SHIFT_CONFIG,
  TERMINAL_STATIC_REPORTS,
} from "./ServiceTerminalShiftConfig.js?v=level-arrival-intro";

const SERVICE_TERMINAL_ASSETS = {
  logo: "assets/ui/service-terminal/terragen-systems-logo.png",
  siteImage: "assets/ui/service-terminal/site-12-facility.jpg",
  icons: {
    brief: "assets/ui/service-terminal/icons/shift-brief.svg",
    guide: "assets/ui/service-terminal/icons/operations-guide.svg",
    reports: "assets/ui/service-terminal/icons/shift-reports.svg",
    archive: "assets/ui/service-terminal/icons/archive.svg",
    notices: "assets/ui/service-terminal/icons/notices.svg",
  },
};

const SHARED_COPY = {
  en: {
    brand: "TGLOBAL ST", product: "SITE-12 OPERATIONS TERMINAL",
    strapline: "POWERING A MORE STABLE TOMORROW", location: "SITE-12 // OPERATIONS TERMINAL",
    close: "CLOSE", language: "LANG", back: "BACK",
    tabs: { brief: "SHIFT BRIEF", guide: "OPERATIONS GUIDE", reports: "SHIFT REPORTS", archive: "ARCHIVE", notices: "NOTICES" },
    briefEyebrow: "SHIFT BRIEF", objective: "OBJECTIVE", success: "SUCCESS CRITERIA",
    conditions: "CONDITIONS / RESTRICTIONS", attachments: "ATTACHMENTS",
    guideEyebrow: "OPERATIONS GUIDE", previous: "PREVIOUS", next: "NEXT",
    reportsTitle: "SHIFT REPORTS", reportDate: "DATE", reportEvent: "RECORD",
    archiveTitle: "ARCHIVE", archiveUnavailable: "ARCHIVE FILES UNAVAILABLE.", noticesTitle: "NOTICES",
    emptyGuideTitle: "OPERATING INSTRUCTIONS",
    emptyGuideBody: ["NO ADDITIONAL OPERATING INSTRUCTIONS.", "Standard operating procedure applies."],
  },
  ru: {
    brand: "TGLOBAL ST", product: "ОПЕРАЦИОННЫЙ ТЕРМИНАЛ SITE-12",
    strapline: "СТАБИЛЬНОСТЬ ЗАВТРА НАЧИНАЕТСЯ СЕГОДНЯ", location: "SITE-12 // ОПЕРАЦИОННЫЙ ТЕРМИНАЛ",
    close: "ЗАКРЫТЬ", language: "ЯЗЫК", back: "НАЗАД",
    tabs: { brief: "БРИФ СМЕНЫ", guide: "РУКОВОДСТВО", reports: "ОТЧЁТЫ СМЕН", archive: "АРХИВ", notices: "УВЕДОМЛЕНИЯ" },
    briefEyebrow: "БРИФ СМЕНЫ", objective: "ЗАДАЧА", success: "КРИТЕРИИ УСПЕХА",
    conditions: "УСЛОВИЯ / ОГРАНИЧЕНИЯ", attachments: "ВЛОЖЕНИЯ",
    guideEyebrow: "РУКОВОДСТВО ОПЕРАТОРА", previous: "НАЗАД", next: "ДАЛЕЕ",
    reportsTitle: "ОТЧЁТЫ СМЕН", reportDate: "ДАТА", reportEvent: "ЗАПИСЬ",
    archiveTitle: "АРХИВ", archiveUnavailable: "АРХИВНЫЕ ФАЙЛЫ НЕДОСТУПНЫ.", noticesTitle: "УВЕДОМЛЕНИЯ",
    emptyGuideTitle: "ИНСТРУКЦИИ",
    emptyGuideBody: ["ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ НЕ ПРИЛАГАЮТСЯ.", "Действует стандартный порядок эксплуатации."],
  },
};

export function getServiceTerminalContent(levelId, language = "en") {
  const locale = language === "ru" ? "ru" : "en";
  const shared = SHARED_COPY[locale];
  const shiftId = resolveTerminalShiftId(levelId);
  const shift = getTerminalShiftConfig(shiftId);
  const notices = collectNotices(shift, locale);
  const activeNotice = notices.at(-1);
  const archiveEntries = collectArchiveEntries(shift, locale);
  return {
    assets: SERVICE_TERMINAL_ASSETS,
    shiftId,
    shift: { id: shift.id, date: shift.date, time: shift.time, site: shift.site, shaft: shift.shaft },
    brand: shared.brand, product: shared.product, strapline: shared.strapline, location: shared.location,
    close: shared.close, language: shared.language, back: shared.back, tabs: shared.tabs,
    brief: {
      eyebrow: shared.briefEyebrow,
      title: localize(shift.brief.title, locale),
      summary: [
        `${shift.date} / ${shift.time} · ${shift.shaft} / ${shift.site}`,
        localize(shift.brief.purpose, locale),
      ],
      sections: [
        { title: shared.objective, text: localize(shift.brief.objective, locale) },
        { title: shared.success, text: localize(shift.brief.success, locale) },
        { title: shared.conditions, text: localize(shift.brief.conditions, locale) },
      ],
      attachmentsTitle: shared.attachments,
      siteMessage: "INFRASTRUCTURE\nENDURES.",
      attachments: (shift.brief.attachments ?? []).map((entry) => localizeAttachment(entry, locale)),
    },
    guide: {
      eyebrow: shared.guideEyebrow,
      slides: buildTerminalGuideSlides(shift.guide?.pages ?? [], locale),
      previous: shared.previous,
      next: shared.next,
    },
    reports: {
      title: shared.reportsTitle, date: shared.reportDate, event: shared.reportEvent,
      entries: collectReports(shift, locale),
    },
    archive: {
      title: shared.archiveTitle,
      message: archiveEntries.length ? archiveEntries[0].title : shared.archiveUnavailable,
      entries: archiveEntries,
    },
    notices: {
      title: shared.noticesTitle,
      date: activeNotice?.date ?? shift.date,
      heading: activeNotice?.title ?? "—",
      body: (activeNotice?.body ?? []).join("\n"),
      status: activeNotice?.status ?? "",
      severity: activeNotice?.severity ?? "info",
      entries: notices,
    },
  };
}

export function buildTerminalGuideSlides(pages, language = "en") {
  const locale = language === "ru" ? "ru" : "en";
  const authored = Array.isArray(pages) ? pages : [];
  const resolved = authored.length ? authored : [{
    id: "no-additional-instructions",
    title: { en: SHARED_COPY.en.emptyGuideTitle, ru: SHARED_COPY.ru.emptyGuideTitle },
    body: { en: SHARED_COPY.en.emptyGuideBody, ru: SHARED_COPY.ru.emptyGuideBody },
    cards: { en: [], ru: [] },
  }];
  return resolved.map((page, index) => ({
    id: page.id,
    number: String(index + 1).padStart(2, "0"),
    kind: page.kind,
    title: localize(page.title, locale),
    lead: localize(page.lead, locale),
    copy: localize(page.body, locale) ?? [],
    visual: localize(page.cards, locale) ?? [],
    definitions: (page.definitions ?? []).map(([indicator, definition]) => [indicator, localize(definition, locale)]),
    note: localize(page.note, locale) ?? "",
    empty: !authored.length,
  }));
}

function collectReports(activeShift, locale) {
  const shiftReports = orderedShiftsThrough(activeShift)
    .filter((shift) => shift.report)
    .map((shift) => [shift.report.date, localize(shift.report.event, locale)]);
  return [
    ...TERMINAL_STATIC_REPORTS.map((report) => [report.date, localize(report.event, locale)]),
    ...shiftReports,
  ];
}

function collectNotices(activeShift, locale) {
  return orderedShiftsThrough(activeShift).flatMap((shift) => shift.notices ?? []).map((notice) => ({
    id: notice.id, date: notice.date, title: localize(notice.title, locale),
    body: localize(notice.body, locale) ?? [], status: localize(notice.status, locale),
    severity: notice.severity ?? "info",
  }));
}

function collectArchiveEntries(activeShift, locale) {
  return orderedShiftsThrough(activeShift).flatMap((shift) => shift.archiveEntries ?? []).map((entry) => ({
    ...entry, title: localize(entry.title, locale), body: localize(entry.body, locale),
  }));
}

function orderedShiftsThrough(activeShift) {
  return Object.values(TERMINAL_SHIFT_CONFIG)
    .filter((shift) => shift.order <= activeShift.order)
    .sort((a, b) => a.order - b.order);
}

function localizeAttachment(attachment, locale) {
  return {
    ...attachment,
    title: localize(attachment.title, locale),
    heading: localize(attachment.heading, locale),
    pages: localize(attachment.pages, locale),
    points: localize(attachment.points, locale),
  };
}

function localize(value, locale) {
  if (value == null) return value;
  if (typeof value !== "object" || Array.isArray(value)) return value;
  if (Object.prototype.hasOwnProperty.call(value, "en") || Object.prototype.hasOwnProperty.call(value, "ru")) {
    return value[locale] ?? value.en ?? value.ru;
  }
  return value;
}
