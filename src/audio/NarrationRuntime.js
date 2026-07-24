export function createNarrationRuntime({
  getActiveLevelId,
  isPlaybackAllowed,
  getRadioRuntime,
  getConfiguredLine,
  playLine,
  startRadioSpeech,
  resetRadio,
  prefabInstances = null,
  config = null,
  getLevelEnvironmentId = (levelId) => levelId,
  getLanguage = () => document.documentElement.lang,
  dispatchSubtitle = defaultDispatchSubtitle,
  fetchText = defaultFetchText,
}) {
  getRadioRuntime ??= (levelId) => findLevelRadioRuntime(prefabInstances, getLevelEnvironmentId(levelId));
  getConfiguredLine ??= (levelId, language) => findConfiguredNarrationLine(config, getLevelEnvironmentId(levelId), language);
  const timers = new Set();
  const subtitleCache = new Map();
  let playedLevelId = null;

  function scheduleWelcome(levelId = getActiveLevelId()) {
    if (playedLevelId === levelId) return false;
    const runtime = getRadioRuntime(levelId);
    if (!runtime?.radio) return false;
    playedLevelId = levelId;
    schedule(() => playWhenReady(levelId), runtime.radio.welcomeDelaySeconds ?? 0.7);
    return line;
  }

  function playWhenReady(levelId) {
    if (getActiveLevelId() !== levelId) return;
    if (!isPlaybackAllowed(levelId)) {
      schedule(() => playWhenReady(levelId), 0.25);
      return;
    }
    void playWelcome(levelId);
  }

  async function playWelcome(levelId = getActiveLevelId()) {
    const runtime = getRadioRuntime(levelId);
    if (!runtime?.radio) return false;
    const language = getLanguage();
    const line = await resolveLine(getConfiguredLine(levelId, language) ?? getFallbackLine(language));
    if (getActiveLevelId() !== levelId || !isPlaybackAllowed(levelId)) return false;
    startRadioSpeech(runtime.radio, line.duration);
    playLine(runtime, line, levelId);
    const subtitleIdBase = `narrator-welcome-${levelId}-${Date.now()}`;
    line.subtitles.forEach((subtitle, index) => {
      schedule(() => {
        if (getActiveLevelId() !== levelId || !isPlaybackAllowed(levelId)) return;
        dispatchSubtitle({
          id: `${subtitleIdBase}-${index}`,
          text: subtitle.text,
          duration: subtitle.duration,
          priority: 3,
          mode: line.subtitleMode ?? "film",
        });
      }, subtitle.at);
    });
    return true;
  }

  function clear(radioRuntimes = []) {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    playedLevelId = null;
    for (const runtime of radioRuntimes) resetRadio(runtime?.radio);
  }

  function schedule(callback, seconds) {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, Math.max(0, seconds) * 1000);
    timers.add(timer);
    return timer;
  }

  async function resolveLine(line) {
    if (!line?.subtitlePath) return { ...line, subtitles: line?.subtitles ?? [] };
    const subtitles = await loadSubtitles(line.subtitlePath);
    const duration = line.duration ?? subtitles.reduce((max, cue) => Math.max(max, cue.at + cue.duration), 0);
    return { ...line, duration, subtitles };
  }

  async function loadSubtitles(path) {
    if (!subtitleCache.has(path)) {
      subtitleCache.set(
        path,
        fetchText(path)
          .then(parseSrtSubtitles)
          .catch((error) => {
            console.warn(`[Narrator] Failed to load subtitles "${path}"`, error);
            return [];
          }),
      );
    }
    return subtitleCache.get(path);
  }

  return { scheduleWelcome, playWelcome, clear, getRadioRuntime, getConfiguredLine };
}

export function findLevelRadioRuntime(prefabInstances, environmentId) {
  for (const [key, runtime] of prefabInstances?.entries?.() ?? []) {
    if (runtime.radio && key.startsWith(`${environmentId}:`)) return runtime;
  }
  return null;
}

export function findConfiguredNarrationLine(config, environmentId, language) {
  const welcome = config?.levelEnvironments?.[environmentId]?.narration?.welcome;
  const localized = welcome?.[language] ?? welcome?.en ?? welcome?.ru;
  return localized?.soundKey ? localized : null;
}

export function parseSrtSubtitles(source) {
  return String(source)
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeLineIndex < 0) return null;
      const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((part) => part.trim());
      const start = parseSrtTime(startRaw);
      const end = parseSrtTime(endRaw);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      return { at: start, duration: end - start, text: lines.slice(timeLineIndex + 1).join(" ") };
    })
    .filter((cue) => cue?.text);
}

function parseSrtTime(value) {
  const match = String(value).match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!match) return NaN;
  const [, hours, minutes, seconds, millis] = match;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(`0.${millis.padEnd(3, "0").slice(0, 3)}`);
}

function getFallbackLine(language) {
  if (language === "ru") {
    return {
      soundKey: "MessageRU_Welcome1",
      duration: 14,
      subtitles: [
        { at: 0.1, duration: 7.2, text: "Добро пожаловать в Terragen Systems — место, где энергией завтрашнего дня управляет сегодняшний… персонал, успешно прошедший минимально необходимую проверку." },
        { at: 7.4, duration: 3, text: "Ваша квалификационная смена начинается сейчас." },
        { at: 10.4, duration: 3.4, text: "Проследуйте в операторскую. Незамедлительно." },
      ],
    };
  }
  return {
    soundKey: "MessageEN_Welcome1",
    duration: 14,
    subtitles: [
      { at: 0.1, duration: 2.5, text: "Welcome to Terragen Systems!" },
      { at: 2.7, duration: 6.2, text: "Congratulations. You’ve been approved to operate equipment considerably more expensive than you are." },
      { at: 9.1, duration: 4.2, text: "Now—before somebody corrects that mistake—proceed to the Control Booth." },
    ],
  };
}

async function defaultFetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`HTTP ${response.status} ${path}`);
  return response.text();
}

function defaultDispatchSubtitle(detail) {
  window.dispatchEvent(new CustomEvent("operatorgame:subtitle", { detail }));
}
