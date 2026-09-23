const localized = (en, ru) => ({ en, ru });

export const TERMINAL_SHIFT_ID_BY_LEVEL = Object.freeze({
  "intro-shift": "qualification",
  "exploring-around": "qualification",
  "unexpected-stuff": "diagnostic",
  "fuel-problems": "efficiency",
});

export const TERMINAL_STATIC_REPORTS = Object.freeze([
  { date: "UNKNOWN", event: localized("OLD REGISTRY RECOVERY FAILED", "ВОССТАНОВЛЕНИЕ СТАРОГО РЕЕСТРА НЕ УДАЛОСЬ") },
  { date: "03.2010", event: localized("SERVICE TERMINAL INSTALLED", "СЛУЖЕБНЫЙ ТЕРМИНАЛ УСТАНОВЛЕН") },
  { date: "04.03.2024", event: localized("LOCAL RECORDS ERASED", "ЛОКАЛЬНЫЕ ЗАПИСИ УДАЛЕНЫ") },
]);

export const TERMINAL_SHIFT_CONFIG = Object.freeze({
  qualification: {
    id: "qualification",
    order: 1,
    date: "30.04.2037",
    time: "13:30",
    site: "SITE-12",
    shaft: "SHAFT 03",
    brief: {
      title: localized("FIRST OPERATOR\nQUALIFICATION SHIFT", "ПЕРВАЯ КВАЛ.\nСМЕНА"),
      purpose: localized("FCU-16 operator qualification under standard grid load.", "Квалификация оператора FCU-16 при штатной нагрузке сети."),
      objective: localized("Complete operator qualification.\nMatch reactor output to grid demand.", "Пройти квалификацию оператора.\nПоддерживать мощность по запросу сети."),
      success: localized("Stable manual operation, acceptable demand compliance,\nno critical reactor events.", "Стабильное ручное управление, допустимое соответствие спросу,\nбез критических событий реактора."),
      conditions: localized("Standard instrumentation and environmental conditions.\nSupervised operation.", "Штатные приборы и условия среды.\nРабота под наблюдением."),
      attachments: [
        {
          id: "technical-brief",
          icon: "reports",
          title: localized("ARCHIVED TECHNICAL BRIEF", "АРХИВНЫЙ ТЕХ. БРИФ"),
          type: "archivedDocument",
          pages: {
            en: ["assets/ui/briefings/Intro1-us.png"],
            ru: ["assets/ui/briefings/Intro1-ru.png", "assets/ui/briefings/Intro1_2-ru.png"],
          },
        },
        {
          id: "load-profile",
          icon: "guide",
          title: localized("LOAD PROFILE", "ПРОФИЛЬ НАГРУЗКИ"),
          type: "loadProfile",
          heading: localized("FCU-16 / LOAD PROFILE", "FCU-16 / ПРОФИЛЬ НАГРУЗКИ"),
          points: {
            en: [
              ["00:00", 140, "FIELD PRECHARGE"], ["00:24", 430, "PLASMA IGNITION"],
              ["00:52", 650, "STABLE BURN"], ["01:30", 850, "DEMAND SURGE"],
              ["02:15", 980, "SUSTAINED HIGH LOAD"], ["03:00", 980, "SHIFT END"],
            ],
            ru: [
              ["00:00", 140, "ПРЕДВАРИТЕЛЬНОЕ ПОЛЕ"], ["00:24", 430, "ЗАЖИГАНИЕ ПЛАЗМЫ"],
              ["00:52", 650, "СТАБИЛЬНОЕ ГОРЕНИЕ"], ["01:30", 850, "СКАЧОК СПРОСА"],
              ["02:15", 980, "ВЫСОКАЯ НАГРУЗКА"], ["03:00", 980, "КОНЕЦ СМЕНЫ"],
            ],
          },
        },
      ],
    },
    guide: {
      pages: [
        {
          id: "grid-demand",
          kind: "demandIndicators",
          title: localized("MATCH GRID DEMAND", "МОЩНОСТЬ ПО ЗАПРОСУ СЕТИ"),
          lead: localized("Match reactor output to grid demand.", "Поддерживайте мощность реактора по запросу сети."),
          body: localized(
            ["Use the demand indicators to correct output while maintaining stable reactor conditions."],
            ["Следите за OVER DEMAND и UNDER DEMAND, корректируя работу реактора без потери стабильности."],
          ),
        },
        {
          id: "panel-indicators",
          kind: "indicatorDefinitions",
          title: localized("PANEL INDICATORS", "ИНДИКАТОРЫ ПАНЕЛИ"),
          definitions: [
            ["OVER DEMAND", localized("Output is above current grid demand.", "Мощность выше текущего запроса сети.")],
            ["UNDER DEMAND", localized("Output is below current grid demand.", "Мощность ниже текущего запроса сети.")],
            ["EFFICIENCY", localized("How effectively the current settings work together.", "Насколько эффективно сочетаются текущие настройки реактора.")],
          ],
          note: localized("Low efficiency indicates a poor operating balance.", "Низкая эффективность указывает на неоптимальный режим работы."),
        },
        {
          id: "primary-controls",
          title: localized("PRIMARY CONTROLS", "ОСНОВНЫЕ РЕГУЛЯТОРЫ"),
          body: localized(
            ["Fuel raises reaction output. Magnetic field supports containment. Coolant removes heat but excessive flow reduces useful output."],
            ["Топливо повышает мощность реакции. Магнитное поле поддерживает удержание. Охлаждение отводит тепло, но избыточная подача снижает полезную мощность."],
          ),
          cards: localized(["FUEL SUPPLY", "MAG FIELD", "COOLANT FLOW"], ["ПОДАЧА ТОПЛИВА", "МАГН. ПОЛЕ", "ОХЛАЖДЕНИЕ"]),
        },
        {
          id: "control-response",
          title: localized("CONTROL RESPONSE", "РЕАКЦИЯ СИСТЕМЫ"),
          body: localized(
            ["Make measured corrections, observe the instruments, then allow the reactor to settle before correcting again."],
            ["Вносите небольшие изменения, наблюдайте за приборами и дайте реактору стабилизироваться перед следующей корректировкой."],
          ),
          cards: localized(["ADJUST", "OBSERVE", "STABILIZE"], ["ИЗМЕНИТЬ", "НАБЛЮДАТЬ", "СТАБИЛИЗИРОВАТЬ"]),
        },
      ],
    },
    report: { date: "30.04.2037", event: localized("OPERATOR QUALIFICATION SESSION", "КВАЛИФИКАЦИОННАЯ СЕССИЯ ОПЕРАТОРА") },
    notices: [
      {
        id: "modernization-incomplete",
        date: "30.04.2036",
        title: localized("MODERNIZATION PROGRAM INCOMPLETE", "ПРОГРАММА МОДЕРНИЗАЦИИ НЕ ЗАВЕРШЕНА"),
        body: localized(
          ["Scheduled modernization work could not be completed.", "Continued site operation is authorized under the Infrastructure Continuity Directive."],
          ["Плановые работы по модернизации завершить не удалось.", "Дальнейшая эксплуатация разрешена Директивой о непрерывности инфраструктуры."],
        ),
        status: localized("STATUS: SERVICE CONTINUED", "СТАТУС: ЭКСПЛУАТАЦИЯ ПРОДОЛЖЕНА"),
        severity: "info",
      },
    ],
    archiveEntries: [],
  },

  diagnostic: {
    id: "diagnostic",
    order: 2,
    date: "02.05.2037",
    time: "06:00",
    site: "SITE-12",
    shaft: "SHAFT 03",
    brief: {
      title: localized("INSTRUMENT RELIABILITY\nCHECK", "ПРОВЕРКА НАДЁЖНОСТИ\nПРИБОРОВ"),
      purpose: localized("Verification run following incomplete local calibration.", "Проверочный запуск после незавершённой локальной калибровки."),
      objective: localized("Complete the scheduled run.\nIdentify unreliable instrument response.", "Завершить плановый запуск.\nВыявить недостоверные показания приборов."),
      success: localized("Stable operation maintained despite instrument faults.\nPre-start test completed.", "Стабильная работа при отказах приборов.\nПредпусковой тест завершён."),
      conditions: localized("Instrument readings may be incorrect or delayed.\nRedundant indicators remain available.", "Показания могут быть неверными или запаздывать.\nДоступны резервные индикаторы."),
      attachments: [
        {
          id: "reliability-brief",
          icon: "reports",
          title: localized("RELIABILITY CHECK BRIEF", "БРИФ ПРОВЕРКИ ПРИБОРОВ"),
          type: "archivedDocument",
          pages: {
            en: ["assets/ui/briefings/T_Brief_InstrumentReabilityCheckEN.png"],
            ru: ["assets/ui/briefings/T_Brief_InstrumentReabilityCheckRU.png"],
          },
        },
      ],
    },
    guide: {
      pages: [
        {
          id: "instrument-reliability",
          title: localized("INSTRUMENT RELIABILITY", "НАДЁЖНОСТЬ ПРИБОРОВ"),
          body: localized(
            ["Some instruments may display incorrect or delayed readings. Do not rely on a single instrument when abnormal behavior is suspected."],
            ["Некоторые приборы могут показывать неверные или запаздывающие значения. При аномальном поведении не полагайтесь на один прибор."],
          ),
          cards: localized(["COMPARE", "VERIFY", "RESPOND"], ["СРАВНИТЬ", "ПРОВЕРИТЬ", "ДЕЙСТВОВАТЬ"]),
        },
        {
          id: "pre-start-test",
          title: localized("PRE-START TEST", "ПРЕДПУСКОВОЙ ТЕСТ"),
          body: localized(
            ["Run TEST before reactor startup. Verify lamp response and compare redundant indications before ignition."],
            ["Запустите TEST до пуска реактора. Проверьте лампы и сопоставьте резервные показания до зажигания."],
          ),
          cards: localized(["PRESS TEST", "CHECK LAMPS", "CROSS-CHECK"], ["НАЖАТЬ TEST", "ПРОВЕРИТЬ ЛАМПЫ", "СОПОСТАВИТЬ"]),
        },
      ],
    },
    report: { date: "02.05.2037", event: localized("INSTRUMENT RELIABILITY RUN", "ПРОВЕРКА НАДЁЖНОСТИ ПРИБОРОВ") },
    notices: [
      {
        id: "calibration-incomplete",
        date: "01.05.2037",
        title: localized("LOCAL INSTRUMENTATION CALIBRATION INCOMPLETE", "КАЛИБРОВКА ЛОКАЛЬНЫХ ПРИБОРОВ НЕ ЗАВЕРШЕНА"),
        body: localized(
          ["Automatic calibration could not verify all panel channels.", "Manual cross-check procedure is required until further notice."],
          ["Автокалибровка не подтвердила все каналы панели.", "До дальнейшего распоряжения требуется ручная перекрёстная проверка."],
        ),
        status: localized("STATUS: MANUAL VERIFICATION REQUIRED", "СТАТУС: ТРЕБУЕТСЯ РУЧНАЯ ПРОВЕРКА"),
        severity: "warning",
      },
    ],
    archiveEntries: [],
  },

  efficiency: {
    id: "efficiency",
    order: 3,
    date: "07.05.2037",
    time: "21:40",
    site: "SITE-12",
    shaft: "SHAFT 03",
    brief: {
      title: localized("COST OF RUNNING\nTRIAL", "ИСПЫТАНИЕ ЗАТРАТ\nНА ЭКСПЛУАТАЦИЮ"),
      purpose: localized("Fuel economy evaluation under sustained grid demand.", "Оценка расхода топлива при устойчивом запросе сети."),
      objective: localized("Complete the load profile.\nLimit fuel consumption without losing grid output.", "Пройти профиль нагрузки.\nОграничить расход топлива без потери мощности сети."),
      success: localized("Demand maintained with acceptable efficiency\nand remaining fuel reserve.", "Запрос сети выполнен при допустимой эффективности\nи сохранённом запасе топлива."),
      conditions: localized("Restricted fuel allocation.\nFuel blend quality may change during operation.", "Ограниченный запас топлива.\nКачество смеси может меняться во время работы."),
      attachments: [
        {
          id: "cost-brief",
          icon: "reports",
          title: localized("OPERATING COST BRIEF", "БРИФ ПО РАСХОДАМ"),
          type: "archivedDocument",
          pages: {
            en: ["assets/ui/briefings/CostOfRunning1-us.svg"],
            ru: ["assets/ui/briefings/CostOfRunning1-ru.svg"],
          },
        },
      ],
    },
    guide: {
      pages: [
        {
          id: "fuel-blend-control",
          title: localized("FUEL BLEND CONTROL", "УПРАВЛЕНИЕ ТОПЛИВНОЙ СМЕСЬЮ"),
          body: localized(
            ["Fuel quality changes the useful output produced by a given fuel setting. Treat GREEN as nominal, YELLOW as degraded, RED as poor, and OFF as unavailable."],
            ["Качество топлива меняет полезную мощность при той же подаче. GREEN — норма, YELLOW — ухудшение, RED — низкое качество, OFF — подача недоступна."],
          ),
          cards: localized(["GREEN", "YELLOW", "RED", "OFF"], ["GREEN", "YELLOW", "RED", "OFF"]),
        },
        {
          id: "fuel-consumption",
          title: localized("FUEL CONSUMPTION", "РАСХОД ТОПЛИВА"),
          body: localized(
            ["Balance reactor output, operating efficiency, and the remaining fuel reserve. Excess fuel can satisfy demand briefly while reducing the final result."],
            ["Балансируйте мощность, эффективность и остаток топлива. Избыточная подача кратковременно покрывает спрос, но ухудшает итог смены."],
          ),
          cards: localized(["OUTPUT", "EFFICIENCY", "FUEL RESERVE"], ["МОЩНОСТЬ", "ЭФФЕКТИВНОСТЬ", "ЗАПАС ТОПЛИВА"]),
        },
      ],
    },
    report: { date: "07.05.2037", event: localized("OPERATING COST TRIAL", "ИСПЫТАНИЕ СТОИМОСТИ ЭКСПЛУАТАЦИИ") },
    notices: [
      {
        id: "fuel-allocation",
        date: "06.05.2037",
        title: localized("TEMPORARY FUEL ALLOCATION LIMIT", "ВРЕМЕННОЕ ОГРАНИЧЕНИЕ ТОПЛИВА"),
        body: localized(
          ["Site-12 fuel allocation has been reduced for the current operating period.", "Operators are instructed to avoid unnecessary consumption."],
          ["Лимит топлива Site-12 снижен на текущий период эксплуатации.", "Операторам предписано избегать необязательного расхода."],
        ),
        status: localized("STATUS: RESTRICTED ALLOCATION", "СТАТУС: ОГРАНИЧЕННЫЙ ЛИМИТ"),
        severity: "warning",
      },
    ],
    archiveEntries: [],
  },
});

export function resolveTerminalShiftId(levelId) {
  if (TERMINAL_SHIFT_CONFIG[levelId]) return levelId;
  return TERMINAL_SHIFT_ID_BY_LEVEL[levelId] ?? "qualification";
}

export function getTerminalShiftConfig(levelId) {
  return TERMINAL_SHIFT_CONFIG[resolveTerminalShiftId(levelId)];
}
