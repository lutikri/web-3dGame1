const STRINGS = {
  en: {
    "loading.coreBoot": "CORE BOOT",
    "loading.initializing": "INITIALIZING OPERATOR CONSOLE",
    "loading.firstShift": "YOUR FIRST FUSION SHIFT",
    "loading.shiftLoad": "SHIFT LOAD",
    "loading.preparing": "PREPARING OPERATOR CONSOLE",
    "loading.shift": "SHIFT",
    "loading.textures": "Loading textures",
    "briefing.prompt": "HOLD TO INSPECT · ENTER TO CONTINUE",
    "results.report": "SHIFT REPORT",
    "results.profile": "OPERATOR PROFILE",
    "results.awaiting": "Awaiting shift data.",
    "menu.subtitle": "FUSION CORE SHIFT CONSOLE",
    "actions.newShift": "START NEW SHIFT",
    "actions.levelSelect": "LEVEL SELECT",
    "actions.mainMenu": "MAIN MENU",
    "actions.play": "PLAY",
    "actions.profile": "PROFILE",
    "actions.settings": "SETTINGS",
    "actions.back": "BACK",
    "actions.resume": "RESUME",
    "actions.menu": "MENU",
    "actions.restart": "RESTART",
    "levels.route": "LEVEL ROUTE",
    "levels.intro.title": "INTRO SHIFT",
    "levels.intro.description": "First supervised fusion operation",
    "levels.exploring.title": "EXPLORING AROUND",
    "levels.exploring.description": "The tutorial shift in the service corridor",
    "levels.unexpected.title": "UNEXPECTED STUFF",
    "levels.unexpected.description": "Instrument faults route",
    "levels.fuel.title": "FUEL PROBLEMS",
    "levels.fuel.description": "Fuel quality route",
    "levels.freeplay.title": "FREEPLAY",
    "levels.freeplay.description": "Same console, loose targets",
    "levels.competitive.title": "COMPETITIVE",
    "levels.competitive.description": "Score route placeholder",
    "profile.dossier": "OPERATOR DOSSIER",
    "profile.status": "STATUS",
    "profile.provisional": "PROVISIONAL SHIFT OPERATOR",
    "profile.placeholder": "Performance history, route unlocks, incident tags, and operator notes will live here.",
    "pause.title": "PAUSED",
    "settings.title": "SETTINGS",
    "settings.fov": "FOV",
    "settings.uiScale": "UI SCALE",
    "settings.shadows": "SHADOWS",
    "settings.gtao": "AO",
    "settings.wizard": "SETUP WIZARD",
    "controls.fuelInjection": "FUEL INJECTION",
    "controls.magneticField": "MAGNETIC FIELD",
    "controls.coolantFlow": "COOLANT FLOW",
    "controls.indicatorTest": "INDICATOR TEST",
    "controls.startCore": "START CORE",
    "controls.pulse": "PULSE",
    "controls.vent": "EMERGENCY VENT / PURGE",
    "controls.roomLights": "ROOM LIGHTS",
    "controls.bulkhead": "BULKHEAD HANDLE",
    "controls.holdBulkhead": "HOLD TO OPEN BULKHEAD",
    "controls.on": "ON",
    "controls.off": "OFF",
    "subtitles.field-weak": "Easy. Need a field under it first.",
    "subtitles.first-quench": "Damn. Drowned it. Back off the coolant... give it fuel...",
    "subtitles.pulse-ready": "Come on. Take the spark.",
    "subtitles.restart-success": "There you are.",
    "subtitles.first-redline": "Nope. That's way too hot.",
    "subtitles.high-load": "Hold together. Just a little longer.",
    "subtitles.door-live-core": "Yeah, no. Can't leave it burning.",
    "subtitles.door-interlocked": "Of course. Interlocked until shutdown.",
    "subtitles.shift-complete": "Core's down. I'm done here.",
    "subtitles.core-destroyed": "That's gone. I need out. Now.",
    "subtitles.fail-safe": "Fail-safe caught it. Time to go.",
    "subtitles.startup-command-fault": "Shouldn't have done that.",
    "subtitles.shift-start": "All right... let's wake you up.",
  },
  ru: {
    "loading.coreBoot": "ЗАПУСК ЯДРА",
    "loading.initializing": "ИНИЦИАЛИЗАЦИЯ ПУЛЬТА ОПЕРАТОРА",
    "loading.firstShift": "ВАША ПЕРВАЯ СМЕНА",
    "loading.shiftLoad": "ЗАГРУЗКА СМЕНЫ",
    "loading.preparing": "ПОДГОТОВКА ПУЛЬТА ОПЕРАТОРА",
    "loading.shift": "СМЕНА",
    "loading.textures": "Загрузка текстур",
    "briefing.prompt": "УДЕРЖИВАЙТЕ ДЛЯ ПРОСМОТРА · ENTER — ПРОДОЛЖИТЬ",
    "results.report": "ОТЧЁТ О СМЕНЕ",
    "results.profile": "ПРОФИЛЬ ОПЕРАТОРА",
    "results.awaiting": "Ожидание данных смены.",
    "menu.subtitle": "ПУЛЬТ УПРАВЛЕНИЯ ТЕРМОЯДЕРНЫМ ЯДРОМ",
    "actions.newShift": "НАЧАТЬ НОВУЮ СМЕНУ",
    "actions.levelSelect": "ВЫБОР СМЕНЫ",
    "actions.mainMenu": "ГЛАВНОЕ МЕНЮ",
    "actions.play": "ИГРАТЬ",
    "actions.profile": "ПРОФИЛЬ",
    "actions.settings": "НАСТРОЙКИ",
    "actions.back": "НАЗАД",
    "actions.resume": "ПРОДОЛЖИТЬ",
    "actions.menu": "МЕНЮ",
    "actions.restart": "ПЕРЕЗАПУСТИТЬ",
    "levels.route": "МАРШРУТ СМЕН",
    "levels.intro.title": "ВВОДНАЯ СМЕНА",
    "levels.intro.description": "Первая контролируемая работа с ядром",
    "levels.exploring.title": "ИССЛЕДОВАНИЕ",
    "levels.exploring.description": "Учебная смена в сервисном коридоре",
    "levels.unexpected.title": "НЕОЖИДАННОСТИ",
    "levels.unexpected.description": "Маршрут неисправностей приборов",
    "levels.fuel.title": "ПРОБЛЕМЫ С ТОПЛИВОМ",
    "levels.fuel.description": "Маршрут качества топлива",
    "levels.freeplay.title": "СВОБОДНЫЙ РЕЖИМ",
    "levels.freeplay.description": "Тот же пульт, свободные цели",
    "levels.competitive.title": "СОРЕВНОВАНИЕ",
    "levels.competitive.description": "Рейтинговый маршрут",
    "profile.dossier": "ДОСЬЕ ОПЕРАТОРА",
    "profile.status": "СТАТУС",
    "profile.provisional": "СТАЖЁР-ОПЕРАТОР",
    "profile.placeholder": "Здесь появятся история смен, открытые маршруты, инциденты и заметки оператора.",
    "pause.title": "ПАУЗА",
    "settings.title": "НАСТРОЙКИ",
    "settings.fov": "УГОЛ ОБЗОРА",
    "settings.uiScale": "МАСШТАБ ИНТЕРФЕЙСА",
    "settings.shadows": "ТЕНИ",
    "settings.gtao": "AO",
    "settings.wizard": "МАСТЕР НАСТРОЙКИ",
    "controls.fuelInjection": "ПОДАЧА ТОПЛИВА",
    "controls.magneticField": "МАГНИТНОЕ ПОЛЕ",
    "controls.coolantFlow": "ПОТОК ОХЛАДИТЕЛЯ",
    "controls.indicatorTest": "ПРОВЕРКА ИНДИКАТОРОВ",
    "controls.startCore": "ЗАПУСК ЯДРА",
    "controls.pulse": "ИМПУЛЬС",
    "controls.vent": "АВАРИЙНЫЙ СБРОС",
    "controls.roomLights": "ОСВЕЩЕНИЕ",
    "controls.bulkhead": "РУКОЯТКА ШЛЮЗА",
    "controls.holdBulkhead": "УДЕРЖИВАЙТЕ, ЧТОБЫ ОТКРЫТЬ ШЛЮЗ",
    "controls.on": "ВКЛ",
    "controls.off": "ВЫКЛ",
    "subtitles.field-weak": "Спокойно. Сначала нужно поднять поле.",
    "subtitles.first-quench": "Чёрт. Залил плазму. Меньше охладителя... добавить топлива...",
    "subtitles.pulse-ready": "Давай. Лови искру.",
    "subtitles.restart-success": "Вот так.",
    "subtitles.first-redline": "Нет. Слишком горячо.",
    "subtitles.high-load": "Держись. Ещё немного.",
    "subtitles.door-live-core": "Нет уж. Нельзя уходить, пока ядро горит.",
    "subtitles.door-interlocked": "Ну конечно. Заблокировано до остановки.",
    "subtitles.shift-complete": "Ядро остановлено. Я закончил.",
    "subtitles.core-destroyed": "Ему конец. Нужно выбираться. Сейчас.",
    "subtitles.fail-safe": "Защита сработала. Пора уходить.",
    "subtitles.startup-command-fault": "Не стоило этого делать.",
    "subtitles.shift-start": "Ладно... пора тебя разбудить.",
  },
};

export function normalizeLanguage(language) {
  return language === "ru" ? "ru" : "en";
}

export function translate(key, language = document.documentElement.lang) {
  const normalized = normalizeLanguage(language);
  return STRINGS[normalized][key] ?? STRINGS.en[key] ?? key;
}

export function translateRequired(key, language = document.documentElement.lang) {
  const normalized = normalizeLanguage(language);
  const localized = STRINGS[normalized][key];
  const english = STRINGS.en[key];
  if (localized && english) return localized;
  console.error(`[Localization] Missing required EN/RU translation: ${key}`);
  return `[MISSING TRANSLATION: ${key}]`;
}

export function applyLocalization(language, root = document) {
  const normalized = normalizeLanguage(language);
  document.documentElement.lang = normalized;
  root.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = translate(element.dataset.i18n, normalized);
  });
  return normalized;
}

const CONTROL_LABEL_KEYS = {
  "FUEL INJECTION": "controls.fuelInjection",
  "MAGNETIC FIELD": "controls.magneticField",
  "COOLANT FLOW": "controls.coolantFlow",
  "INDICATOR TEST": "controls.indicatorTest",
  "START CORE": "controls.startCore",
  PULSE: "controls.pulse",
  "EMERGENCY VENT / PURGE": "controls.vent",
  "ROOM LIGHTS": "controls.roomLights",
  "BULKHEAD HANDLE": "controls.bulkhead",
  "HOLD TO OPEN BULKHEAD": "controls.holdBulkhead",
};

export function translateControlLabel(label, language = document.documentElement.lang) {
  const key = CONTROL_LABEL_KEYS[label];
  return key ? translate(key, language) : label;
}
