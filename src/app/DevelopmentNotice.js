const COPY = {
  en: {
    sidebar: "UNVERIFIED BUILD",
    sidebarDetail: "SITE-12 / INTERNAL ACCESS",
    status: "SOFTWARE STATUS / NOT FINAL",
    title: "DEVELOPMENT BUILD",
    lead: "The reactor probably will not explode.",
    joke: "If it does, please remember which button you pressed. That would be extremely helpful.",
    detail: "Systems, performance, and operator instructions are still subject to change.",
    confirm: "ACKNOWLEDGE",
  },
  ru: {
    sidebar: "НЕПРОВЕРЕННАЯ СБОРКА",
    sidebarDetail: "SITE-12 / ВНУТРЕННИЙ ДОСТУП",
    status: "СТАТУС ПО / НЕ ФИНАЛЬНАЯ ВЕРСИЯ",
    title: "DEVELOPMENT BUILD",
    lead: "Реактор, вероятно, не взорвётся.",
    joke: "Если всё-таки взорвётся, пожалуйста, запомните, какую кнопку вы нажали. Нам очень пригодится.",
    detail: "Системы, производительность и инструкции оператору ещё могут измениться.",
    confirm: "ПОДТВЕРДИТЬ",
  },
};

export function resolveDevelopmentNoticeLanguage(browserLanguage = "en") {
  return String(browserLanguage).toLowerCase().startsWith("ru") ? "ru" : "en";
}

export function showDevelopmentNotice({
  documentRef = document,
  language = resolveDevelopmentNoticeLanguage(globalThis.navigator?.language),
} = {}) {
  const copy = COPY[language] ?? COPY.en;
  const overlay = documentRef.createElement("div");
  overlay.className = "development-notice-overlay";
  overlay.innerHTML = `
    <section class="development-notice-terminal" role="dialog" aria-modal="true" aria-labelledby="developmentNoticeTitle">
      <header class="development-notice-header">
        <span>TERRAGEN SYSTEMS // INTERNAL RELEASE</span><span>SITE-12 / BUILD STATUS</span>
      </header>
      <div class="development-notice-frame">
        <aside class="development-notice-index">
          <span>00 / ACCESS NOTICE</span>
          <strong>${copy.sidebar}</strong>
          <small>${copy.sidebarDetail}</small>
        </aside>
        <main class="development-notice-content">
          <div class="development-notice-status">${copy.status}</div>
          <h1 id="developmentNoticeTitle">${copy.title}</h1>
          <p class="development-notice-lead">${copy.lead}</p>
          <p class="development-notice-joke">${copy.joke}</p>
          <p class="development-notice-detail">${copy.detail}</p>
        </main>
      </div>
      <footer class="development-notice-footer">
        <span>BUILD / PRE-RELEASE</span>
        <button type="button" data-development-acknowledge><kbd>ENTER</kbd>${copy.confirm}</button>
      </footer>
    </section>`;
  documentRef.body.append(overlay);
  const button = overlay.querySelector("[data-development-acknowledge]");
  button.focus();
  return new Promise((resolve) => button.addEventListener("click", () => {
    overlay.remove();
    resolve();
  }, { once: true }));
}
