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

const TERMINAL_CONTENT = {
  en: {
    assets: SERVICE_TERMINAL_ASSETS,
    brand: "TGLOBAL ST",
    product: "SITE-12 OPERATIONS TERMINAL",
    strapline: "POWERING A MORE STABLE TOMORROW",
    location: "SITE-12 // OPERATIONS TERMINAL",
    close: "CLOSE",
    language: "LANG",
    back: "BACK",
    tabs: {
      brief: "SHIFT BRIEF",
      guide: "OPERATIONS GUIDE",
      reports: "SHIFT REPORTS",
      archive: "ARCHIVE",
      notices: "NOTICES",
    },
    brief: {
      eyebrow: "SHIFT BRIEF",
      title: "FIRST OPERATOR\nQUALIFICATION SHIFT",
      summary: [
        "Supervised baseline run for FCU-16 operator assessment.",
        "Verify stable reactor operation across the scheduled load profile.",
        "Maintain conservative temperature and containment margins.",
      ],
      sections: [
        { title: "OBJECTIVE", text: "Maintain stable reactor operation\nthroughout the scheduled load profile." },
        { title: "SUCCESS CRITERIA", text: "Stable containment, target output maintained,\nno critical alarms." },
        { title: "SHIFT CONDITIONS", text: "Supervised baseline run, normal environmental\nconditions, standard access." },
      ],
      attachmentsTitle: "ATTACHMENTS",
      siteMessage: "INFRASTRUCTURE\nENDURES.",
      attachments: [
        {
          id: "technical-brief",
          title: "ARCHIVED TECHNICAL BRIEF",
          icon: "reports",
          type: "archivedDocument",
          pages: ["assets/ui/briefings/Intro1-us.png"],
        },
        {
          id: "load-profile",
          title: "LOAD PROFILE",
          icon: "guide",
          type: "loadProfile",
          heading: "FCU-16 / LOAD PROFILE",
          points: [
            ["00:00", 140, "FIELD PRECHARGE"],
            ["00:24", 430, "PLASMA IGNITION"],
            ["00:52", 650, "STABLE BURN"],
            ["01:30", 850, "DEMAND SURGE"],
            ["02:15", 980, "SUSTAINED HIGH LOAD"],
            ["03:00", 980, "SHIFT END"],
          ],
        },
      ],
    },
    guide: {
      eyebrow: "OPERATIONS GUIDE",
      slides: [
        {
          number: "01",
          kind: "demandIndicators",
          title: "MATCH GRID DEMAND",
          lead: "Match reactor output to grid demand.",
          copy: ["Use the demand indicators to correct your output while maintaining stable reactor conditions."],
        },
        {
          number: "02",
          kind: "indicatorDefinitions",
          title: "PANEL INDICATORS",
          definitions: [
            ["OVER DEMAND", "Output is above current grid demand."],
            ["UNDER DEMAND", "Output is below current grid demand."],
            ["EFFICIENCY", "How effectively the current reactor settings work together."],
          ],
          note: "Low efficiency indicates a poor operating balance.",
        },
        { number: "03", title: "OPERATING LIMITS", copy: ["Avoid sustained warning and critical conditions."], visual: ["TEMPERATURE", "CONTAINMENT", "CORE STRESS", "GRID DEMAND"] },
        { number: "04", title: "RECOVERY", copy: ["Reduce excess coolant, restore fuel and field, then hold PULSE when available."], visual: ["STABILIZE", "RESTORE", "PULSE"] },
      ],
      previous: "PREVIOUS",
      next: "NEXT",
    },
    reports: {
      title: "SHIFT REPORTS",
      date: "DATE",
      event: "RECORD",
      entries: [
        ["UNKNOWN", "LEGACY REGISTRY RECOVERY FAILED"],
        ["03.2010", "SERVICE TERMINAL INSTALLED"],
        ["04.03.2024", "LOCAL RECORDS ERASED"],
        ["30.04.2037", "OPERATOR QUALIFICATION SESSION"],
      ],
    },
    archive: { title: "ARCHIVE", message: "NO ARCHIVED FILES AVAILABLE." },
    notices: {
      title: "NOTICES",
      date: "30.04.2036",
      heading: "RENOVATION PROGRAM INCOMPLETE",
      body: "Scheduled modernization work could not be completed.\nContinued site operation authorized under\nInfrastructure Continuity Directive.",
      status: "STATUS: SERVICE CONTINUED",
    },
  },
  ru: {
    assets: SERVICE_TERMINAL_ASSETS,
    brand: "TGLOBAL ST",
    product: "ОПЕРАЦИОННЫЙ ТЕРМИНАЛ SITE-12",
    strapline: "СТАБИЛЬНОСТЬ ЗАВТРА НАЧИНАЕТСЯ СЕГОДНЯ",
    location: "SITE-12 // ОПЕРАЦИОННЫЙ ТЕРМИНАЛ",
    close: "ЗАКРЫТЬ",
    language: "ЯЗЫК",
    back: "НАЗАД",
    tabs: {
      brief: "БРИФ СМЕНЫ",
      guide: "РУКОВОДСТВО",
      reports: "ОТЧЁТЫ СМЕН",
      archive: "АРХИВ",
      notices: "УВЕДОМЛЕНИЯ",
    },
    brief: {
      eyebrow: "БРИФ СМЕНЫ",
      title: "ПЕРВАЯ КВАЛ.\nСМЕНА",
      summary: [
        "Контрольный запуск для квалификации оператора FCU-16.",
        "Подтвердите стабильную работу реактора на заданном профиле нагрузки.",
        "Сохраняйте консервативный запас температуры и удержания.",
      ],
      sections: [
        { title: "ЗАДАЧА", text: "Поддерживать стабильную работу реактора\nна всём заданном профиле нагрузки." },
        { title: "КРИТЕРИИ УСПЕХА", text: "Стабильное удержание, соответствие целевой мощности,\nотсутствие критических тревог." },
        { title: "УСЛОВИЯ СМЕНЫ", text: "Контрольный запуск, штатные условия среды,\nстандартный уровень доступа." },
      ],
      attachmentsTitle: "ВЛОЖЕНИЯ",
      siteMessage: "INFRASTRUCTURE\nENDURES.",
      attachments: [
        {
          id: "technical-brief",
          title: "АРХИВНЫЙ ТЕХ. БРИФ",
          icon: "reports",
          type: "archivedDocument",
          pages: ["assets/ui/briefings/Intro1-ru.png", "assets/ui/briefings/Intro1_2-ru.png"],
        },
        {
          id: "load-profile",
          title: "ПРОФИЛЬ НАГРУЗКИ",
          icon: "guide",
          type: "loadProfile",
          heading: "FCU-16 / ПРОФИЛЬ НАГРУЗКИ",
          points: [
            ["00:00", 140, "ПРЕДВАРИТЕЛЬНОЕ ПОЛЕ"],
            ["00:24", 430, "ЗАЖИГАНИЕ ПЛАЗМЫ"],
            ["00:52", 650, "СТАБИЛЬНОЕ ГОРЕНИЕ"],
            ["01:30", 850, "СКАЧОК СПРОСА"],
            ["02:15", 980, "ВЫСОКАЯ НАГРУЗКА"],
            ["03:00", 980, "КОНЕЦ СМЕНЫ"],
          ],
        },
      ],
    },
    guide: {
      eyebrow: "РУКОВОДСТВО ОПЕРАТОРА",
      slides: [
        {
          number: "01",
          kind: "demandIndicators",
          title: "МОЩНОСТЬ ПО ЗАПРОСУ СЕТИ",
          lead: "Поддерживайте мощность реактора в соответствии с запросом сети.",
          copy: ["Следите за индикаторами ВЫШЕ СПРОСА (OVER DEMAND) и НИЖЕ СПРОСА (UNDER DEMAND) и корректируйте работу реактора, сохраняя его стабильность."],
        },
        {
          number: "02",
          kind: "indicatorDefinitions",
          title: "ИНДИКАТОРЫ ПАНЕЛИ",
          definitions: [
            ["OVER DEMAND", "Мощность выше текущего запроса сети."],
            ["UNDER DEMAND", "Мощность ниже текущего запроса сети."],
            ["EFFICIENCY", "Насколько эффективно сочетаются текущие настройки реактора."],
          ],
          note: "Низкая эффективность указывает на неоптимальный режим работы.",
        },
        { number: "03", title: "РАБОЧИЕ ПРЕДЕЛЫ", copy: ["Не допускайте длительных предупреждений и критических состояний."], visual: ["ТЕМПЕРАТУРА", "УДЕРЖАНИЕ", "НАГРУЗКА ЯДРА", "СПРОС СЕТИ"] },
        { number: "04", title: "ВОССТАНОВЛЕНИЕ", copy: ["Уменьшите охлаждение, восстановите топливо и поле, затем удерживайте PULSE."], visual: ["СТАБИЛИЗАЦИЯ", "ВОССТАНОВЛЕНИЕ", "ИМПУЛЬС"] },
      ],
      previous: "НАЗАД",
      next: "ДАЛЕЕ",
    },
    reports: {
      title: "ОТЧЁТЫ СМЕН",
      date: "ДАТА",
      event: "ЗАПИСЬ",
      entries: [
        ["НЕИЗВЕСТНО", "ВОССТАНОВЛЕНИЕ СТАРОГО РЕЕСТРА НЕ УДАЛОСЬ"],
        ["03.2010", "СЛУЖЕБНЫЙ ТЕРМИНАЛ УСТАНОВЛЕН"],
        ["04.03.2024", "ЛОКАЛЬНЫЕ ЗАПИСИ УДАЛЕНЫ"],
        ["30.04.2037", "КВАЛИФИКАЦИОННАЯ СЕССИЯ ОПЕРАТОРА"],
      ],
    },
    archive: { title: "АРХИВ", message: "АРХИВНЫЕ ФАЙЛЫ НЕДОСТУПНЫ." },
    notices: {
      title: "УВЕДОМЛЕНИЯ",
      date: "30.04.2036",
      heading: "ПРОГРАММА МОДЕРНИЗАЦИИ НЕ ЗАВЕРШЕНА",
      body: "Плановые работы по модернизации завершить не удалось.\nДальнейшая эксплуатация объекта разрешена\nДирективой о непрерывности инфраструктуры.",
      status: "СТАТУС: СЛУЖБА ПРОДОЛЖЕНА",
    },
  },
};

export function getServiceTerminalContent(_levelId, language = "en") {
  return TERMINAL_CONTENT[language === "ru" ? "ru" : "en"];
}
