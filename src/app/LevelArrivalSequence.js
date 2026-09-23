import { getTerminalShiftConfig, resolveTerminalShiftId } from "./panels/ServiceTerminalShiftConfig.js?v=level-arrival-intro";

const MONTHS = {
  en: ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"],
  ru: ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"],
};

const ARRIVAL_COPY = {
  qualification: {
    title: { en: "QUALIFICATION SHIFT", ru: "КВАЛИФИКАЦИОННАЯ СМЕНА" },
    subtitle: { en: "FIRST OPERATOR QUALIFICATION", ru: "ПЕРВАЯ КВАЛИФИКАЦИЯ ОПЕРАТОРА" },
  },
  diagnostic: {
    title: { en: "INSTRUMENT RELIABILITY", ru: "НАДЁЖНОСТЬ ПРИБОРОВ" },
    subtitle: { en: "LOCAL INSTRUMENT VERIFICATION", ru: "ПРОВЕРКА ЛОКАЛЬНЫХ ПРИБОРОВ" },
  },
  efficiency: {
    title: { en: "OPERATING COST TRIAL", ru: "ИСПЫТАНИЕ ЗАТРАТ" },
    subtitle: { en: "FUEL ECONOMY EVALUATION", ru: "ОЦЕНКА РАСХОДА ТОПЛИВА" },
  },
};

const SYSTEM_COPY = {
  en: { accessLabel: "PERSONNEL ACCESS", status: "ARRIVAL CONFIRMED" },
  ru: { accessLabel: "ДОСТУП ПЕРСОНАЛА", status: "ПРИБЫТИЕ ПОДТВЕРЖДЕНО" },
};

export function getLevelArrivalConfig(levelId, language = "en") {
  const locale = language === "ru" ? "ru" : "en";
  const shiftId = resolveTerminalShiftId(levelId);
  const shift = getTerminalShiftConfig(shiftId);
  const copy = ARRIVAL_COPY[shiftId] ?? ARRIVAL_COPY.qualification;
  return {
    shiftId,
    location: `${shift.site} / ${shift.shaft}`,
    accessLabel: SYSTEM_COPY[locale].accessLabel,
    dateTime: `${formatArrivalDate(shift.date, locale)}   ${shift.time}`,
    status: SYSTEM_COPY[locale].status,
    title: copy.title[locale],
    subtitleTop: `${shift.site} / ${shift.shaft}`,
    subtitleBottom: copy.subtitle[locale],
  };
}

export function createLevelArrivalSequence({
  root,
  documentRef = globalThis.document,
  AudioClass = globalThis.Audio,
  soundConfig = null,
  getMasterVolume = () => 1,
  setTimeoutFn = globalThis.setTimeout?.bind(globalThis),
  clearTimeoutFn = globalThis.clearTimeout?.bind(globalThis),
  requestAnimationFrameFn = globalThis.requestAnimationFrame?.bind(globalThis),
  randomFn = Math.random,
} = {}) {
  const elements = root ? {
    lines: [...root.querySelectorAll("[data-arrival-line]")],
    title: root.querySelector("[data-arrival-title]"),
    subtitleTop: root.querySelector("[data-arrival-subtitle-top]"),
    subtitleBottom: root.querySelector("[data-arrival-subtitle-bottom]"),
  } : null;
  let run = null;

  async function play(config, { onCovered, onInputReady } = {}) {
    cancel({ revealInput: false });
    if (!root || !elements || !config) {
      onCovered?.();
      onInputReady?.();
      return false;
    }

    const current = createRun(onInputReady);
    run = current;
    applyCopy(config);
    root.hidden = false;
    root.classList.remove("is-revealing-world", "is-title-visible", "is-title-fading", "is-input-live");
    documentRef?.body?.classList?.add("level-arrival-active");
    installSkipListeners(current);
    await waitForPaint();
    if (run !== current) return current.promise;
    root.classList.add("is-active");
    onCovered?.();

    schedule(current, 0, () => { current.sound = playIntroSound(); });
    schedule(current, 360, () => scrambleReveal(current, elements.lines[0], config.location, 140));
    schedule(current, 500, () => scrambleReveal(current, elements.lines[1], config.accessLabel, 140));
    schedule(current, 640, () => scrambleReveal(current, elements.lines[2], config.dateTime, 140));
    schedule(current, 780, () => scrambleReveal(current, elements.lines[3], config.status, 140));
    schedule(current, 700, () => { current.canSkip = true; });
    schedule(current, 1400, () => {
      root.classList.add("is-revealing-world");
      documentRef?.body?.classList?.add("level-arrival-world-reveal");
    });
    schedule(current, 2000, () => releaseInput(current));
    schedule(current, 2080, () => root.classList.add("is-title-visible"));
    schedule(current, 3650, () => root.classList.add("is-title-fading"));
    schedule(current, 4400, () => finish(current, { skipped: false }));
    return current.promise;
  }

  function skip() {
    if (!run?.canSkip) return false;
    finish(run, { skipped: true });
    return true;
  }

  function cancel({ revealInput = true } = {}) {
    if (!run) return false;
    finish(run, { skipped: true, revealInput });
    return true;
  }

  function dispose() {
    cancel();
    root?.remove();
  }

  function createRun(onInputReady) {
    const current = {
      timers: new Set(),
      sound: null,
      canSkip: false,
      inputReleased: false,
      onInputReady,
      resolve: null,
      promise: null,
      keyHandler: null,
      pointerHandler: null,
    };
    current.promise = new Promise((resolve) => { current.resolve = resolve; });
    return current;
  }

  function applyCopy(config) {
    const lines = [config.location, config.accessLabel, config.dateTime, config.status];
    elements.lines.forEach((element, index) => {
      element.textContent = "";
      element.classList.remove("is-accent", "is-visible");
      if (index === 3) element.classList.add("is-accent");
      element.dataset.finalText = lines[index] ?? "";
    });
    elements.title.textContent = config.title;
    elements.subtitleTop.textContent = config.subtitleTop;
    elements.subtitleBottom.textContent = config.subtitleBottom;
  }

  function installSkipListeners(current) {
    current.keyHandler = (event) => {
      if (event.repeat || !["Space", "Enter"].includes(event.code)) return;
      if (skip()) event.preventDefault();
    };
    current.pointerHandler = (event) => {
      if (event.button !== 0) return;
      if (skip()) event.preventDefault();
    };
    documentRef?.addEventListener?.("keydown", current.keyHandler, true);
    documentRef?.addEventListener?.("pointerdown", current.pointerHandler, true);
  }

  function scrambleReveal(current, element, finalText, durationMs) {
    if (run !== current || !element) return;
    element.classList.add("is-visible");
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_-";
    const frames = 4;
    for (let frame = 0; frame <= frames; frame += 1) {
      schedule(current, Math.round((durationMs / frames) * frame), () => {
        if (frame === frames) {
          element.textContent = finalText;
          return;
        }
        const settled = Math.floor((finalText.length * frame) / frames);
        element.textContent = [...finalText].map((char, index) => {
          if (char === " " || index < settled) return char;
          return glyphs[Math.floor(randomFn() * glyphs.length)];
        }).join("");
      });
    }
  }

  function playIntroSound() {
    if (!AudioClass || !soundConfig?.path) return null;
    const audio = new AudioClass(soundConfig.path);
    audio.volume = clamp((soundConfig.volume ?? 1) * getMasterVolume(), 0, 1);
    audio.preload = "auto";
    audio.play()?.catch?.(() => {});
    return audio;
  }

  function releaseInput(current) {
    if (current.inputReleased) return;
    current.inputReleased = true;
    root.classList.add("is-input-live");
    current.onInputReady?.();
  }

  function finish(current, { skipped, revealInput = true } = {}) {
    if (!current || run !== current) return;
    current.timers.forEach((timer) => clearTimeoutFn?.(timer));
    current.timers.clear();
    documentRef?.removeEventListener?.("keydown", current.keyHandler, true);
    documentRef?.removeEventListener?.("pointerdown", current.pointerHandler, true);
    if (revealInput) releaseInput(current);
    if (skipped && current.sound) {
      current.sound.pause?.();
      try { current.sound.currentTime = 0; } catch {}
    }
    root.hidden = true;
    root.classList.remove("is-active", "is-revealing-world", "is-title-visible", "is-title-fading", "is-input-live");
    documentRef?.body?.classList?.remove("level-arrival-active", "level-arrival-world-reveal");
    run = null;
    current.resolve?.(!skipped);
  }

  function schedule(current, delayMs, callback) {
    const timer = setTimeoutFn?.(() => {
      current.timers.delete(timer);
      if (run === current) callback();
    }, delayMs);
    if (timer !== undefined) current.timers.add(timer);
    return timer;
  }

  function waitForPaint() {
    if (!requestAnimationFrameFn) return Promise.resolve();
    return new Promise((resolve) => requestAnimationFrameFn(() => requestAnimationFrameFn(resolve)));
  }

  return { play, skip, cancel, dispose, isActive: () => Boolean(run) };
}

function formatArrivalDate(date, locale) {
  const [day, month, year] = String(date).split(".");
  const monthIndex = Number(month) - 1;
  if (!day || !year || monthIndex < 0 || monthIndex > 11) return String(date).toUpperCase();
  return `${day} ${MONTHS[locale][monthIndex]} ${year}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}
