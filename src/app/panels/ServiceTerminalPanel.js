import { getServiceTerminalContent } from "./ServiceTerminalContent.js?v=core-viewport-shutter";

const TAB_ORDER = ["brief", "guide", "reports", "archive", "notices"];


export function createServiceTerminalPanel({
  documentRoot = document,
  getLanguage = () => documentRoot.documentElement?.lang ?? "en",
  onActiveChange = () => {},
  onClose = () => {},
  onBriefViewed = () => {},
  onLanguageChange = () => {},
} = {}) {
  const root = createTerminalRoot(documentRoot);
  let active = false;
  let activeTab = "brief";
  let activeAttachmentId = null;
  let guideIndex = 0;
  let levelId = null;
  let briefReportedForOpen = false;
  const removers = [];

  function wire() {
    listen(root, "click", handleClick);
    listen(documentRoot, "keydown", handleKeyDown, true);
  }

  function open(request = {}) {
    levelId = request.levelId ?? "exploring-around";
    activeTab = "brief";
    activeAttachmentId = null;
    guideIndex = 0;
    briefReportedForOpen = false;
    active = true;
    root.hidden = false;
    root.getBoundingClientRect?.();
    root.classList.add("is-visible");
    render();
    reportBriefViewed();
    onActiveChange(true);
    root.querySelector("[data-terminal-close]")?.focus?.();
    return true;
  }

  function close({ restoreInput = true } = {}) {
    if (!active) return false;
    active = false;
    activeAttachmentId = null;
    root.classList.remove("is-visible");
    root.hidden = true;
    onActiveChange(false);
    if (restoreInput) onClose();
    return true;
  }

  function dispose() {
    close({ restoreInput: false });
    while (removers.length) removers.pop()();
    root.remove();
  }

  function handleClick(event) {
    const closeButton = event.target.closest?.("[data-terminal-close]");
    if (closeButton) return close();
    const languageButton = event.target.closest?.("[data-terminal-language]");
    if (languageButton) {
      onLanguageChange(languageButton.dataset.terminalLanguage);
      render();
      return;
    }
    const backButton = event.target.closest?.("[data-terminal-document-back]");
    if (backButton) {
      activeAttachmentId = null;
      render();
      return;
    }
    const tabButton = event.target.closest?.("[data-terminal-tab]");
    if (tabButton) {
      activeTab = TAB_ORDER.includes(tabButton.dataset.terminalTab) ? tabButton.dataset.terminalTab : "brief";
      activeAttachmentId = null;
      guideIndex = 0;
      render();
      if (activeTab === "brief") reportBriefViewed();
      return;
    }
    const attachmentButton = event.target.closest?.("[data-terminal-attachment]");
    if (attachmentButton) {
      activeAttachmentId = attachmentButton.dataset.terminalAttachment;
      render();
      return;
    }
    const guideButton = event.target.closest?.("[data-terminal-guide-step]");
    if (guideButton) {
      guideIndex = stepGuideIndex(
        guideIndex,
        Number(guideButton.dataset.terminalGuideStep),
        content().guide.slides.length,
      );
      render();
    }
  }

  function handleKeyDown(event) {
    if (!active) return;
    const action = resolveServiceTerminalEscapeAction({ active, attachmentOpen: Boolean(activeAttachmentId) });
    if (event.code === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      if (action === "close-attachment") {
        activeAttachmentId = null;
        render();
      } else if (action === "close-terminal") {
        close();
      }
      return;
    }
    if (activeTab === "guide" && ["ArrowLeft", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
      const delta = event.code === "ArrowLeft" ? -1 : 1;
      guideIndex = stepGuideIndex(guideIndex, delta, content().guide.slides.length);
      render();
    }
  }

  function reportBriefViewed() {
    if (briefReportedForOpen) return;
    briefReportedForOpen = true;
    onBriefViewed({ levelId, source: "serviceTerminal" });
  }

  function render() {
    const copy = content();
    root.lang = language();
    root.querySelector("[data-terminal-brand]").textContent = copy.brand;
    root.querySelector("[data-terminal-product]").textContent = copy.product;
    root.querySelector("[data-terminal-strapline]").textContent = copy.strapline;
    root.querySelector("[data-terminal-location]").textContent = copy.location;
    root.querySelector("[data-terminal-close-label]").textContent = copy.close;
    root.querySelector("[data-terminal-language-label]").textContent = copy.language;
    const nav = root.querySelector("[data-terminal-nav]");
    nav.innerHTML = TAB_ORDER.map((id) => `
      <button type="button" class="service-terminal-tab${activeTab === id ? " is-active" : ""}" data-terminal-tab="${id}">
        ${terminalIcon(id)}<span>${escapeHtml(copy.tabs[id])}</span>
      </button>`).join("");
    root.querySelectorAll("[data-terminal-language]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.terminalLanguage === language());
    });
    root.querySelector("[data-terminal-content]").innerHTML = activeAttachmentId
      ? renderAttachment(copy)
      : renderTab(copy);
  }

  function renderTab(copy) {
    if (activeTab === "guide") return renderGuide(copy);
    if (activeTab === "reports") return renderReports(copy);
    if (activeTab === "archive") return renderArchive(copy);
    if (activeTab === "notices") return renderNotices(copy);
    return renderBrief(copy);
  }

  function renderBrief(copy) {
    return `
      <div class="service-terminal-brief">
        <section class="service-terminal-brief-copy">
          <div class="terminal-orange-rule"></div>
          <p class="terminal-eyebrow">${escapeHtml(copy.brief.eyebrow)}</p>
          <h1>${lineBreaks(copy.brief.title)}</h1>
          <p class="terminal-summary">${copy.brief.summary.map(escapeHtml).join("<br>")}</p>
          <div class="terminal-brief-sections">
            ${copy.brief.sections.map((section) => `
              <section><h2>${escapeHtml(section.title)}</h2><p>${lineBreaks(section.text)}</p></section>`).join("")}
          </div>
        </section>
        <aside class="service-terminal-brief-side">
          <div class="terminal-site-plate" aria-hidden="true">
            <div class="terminal-site-grid"></div>
            <strong>${lineBreaks(copy.brief.siteMessage)}</strong>
            <i></i>
          </div>
          <section class="terminal-attachments">
            <h2>${escapeHtml(copy.brief.attachmentsTitle)}</h2>
            ${copy.brief.attachments.map((attachment) => `
              <button type="button" data-terminal-attachment="${escapeHtml(attachment.id)}">
                ${terminalIcon("document")}<span>${escapeHtml(attachment.title)}</span><b>›</b>
              </button>`).join("")}
          </section>
        </aside>
      </div>`;
  }

  function renderGuide(copy) {
    const slide = copy.guide.slides[guideIndex] ?? copy.guide.slides[0];
    return `
      <section class="terminal-guide">
        <div class="terminal-orange-rule"></div>
        <p class="terminal-eyebrow">${escapeHtml(copy.guide.eyebrow)}</p>
        <p class="terminal-guide-number">${escapeHtml(slide.number)} / ${String(copy.guide.slides.length).padStart(2, "0")}</p>
        <h1>${escapeHtml(slide.title)}</h1>
        ${slide.copy.map((paragraph) => `<p class="terminal-guide-copy">${escapeHtml(paragraph)}</p>`).join("")}
        <div class="terminal-guide-diagram" aria-label="${escapeHtml(slide.title)}">
          ${slide.visual.map((label, index) => `<span><b>${String(index + 1).padStart(2, "0")}</b>${escapeHtml(label)}</span>`).join("")}
        </div>
        <nav class="terminal-guide-controls">
          <button type="button" data-terminal-guide-step="-1" ${guideIndex === 0 ? "disabled" : ""}>‹ ${escapeHtml(copy.guide.previous)}</button>
          <strong>${String(guideIndex + 1).padStart(2, "0")} / ${String(copy.guide.slides.length).padStart(2, "0")}</strong>
          <button type="button" data-terminal-guide-step="1" ${guideIndex === copy.guide.slides.length - 1 ? "disabled" : ""}>${escapeHtml(copy.guide.next)} ›</button>
        </nav>
      </section>`;
  }

  function renderReports(copy) {
    return `
      <section class="terminal-registry">
        <div class="terminal-orange-rule"></div><h1>${escapeHtml(copy.reports.title)}</h1>
        <div class="terminal-registry-row is-heading"><span>${escapeHtml(copy.reports.date)}</span><span>${escapeHtml(copy.reports.event)}</span></div>
        ${copy.reports.entries.map(([date, event]) => `<div class="terminal-registry-row"><time>${escapeHtml(date)}</time><span>${escapeHtml(event)}</span></div>`).join("")}
      </section>`;
  }

  function renderArchive(copy) {
    return `<section class="terminal-empty"><div class="terminal-orange-rule"></div><h1>${escapeHtml(copy.archive.title)}</h1><p>${escapeHtml(copy.archive.message)}</p></section>`;
  }

  function renderNotices(copy) {
    return `
      <section class="terminal-notices"><div class="terminal-orange-rule"></div><h1>${escapeHtml(copy.notices.title)}</h1>
        <article><time>${escapeHtml(copy.notices.date)}</time><h2>${escapeHtml(copy.notices.heading)}</h2><p>${lineBreaks(copy.notices.body)}</p><strong>${escapeHtml(copy.notices.status)}</strong></article>
      </section>`;
  }

  function renderAttachment(copy) {
    const attachment = copy.brief.attachments.find((entry) => entry.id === activeAttachmentId);
    if (!attachment) {
      activeAttachmentId = null;
      return renderBrief(copy);
    }
    const body = attachment.pages
      ? `<div class="terminal-document-pages">${attachment.pages.map((path) => `<img src="${escapeHtml(path)}" alt="${escapeHtml(attachment.title)}" draggable="false">`).join("")}</div>`
      : `<div class="terminal-document-copy"><h2>${escapeHtml(attachment.heading ?? attachment.title)}</h2>
          ${(attachment.paragraphs ?? []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          ${(attachment.sections ?? []).map(([number, title]) => `<div class="terminal-document-row"><b>${escapeHtml(number)}</b><span>${escapeHtml(title)}</span></div>`).join("")}</div>`;
    return `
      <section class="terminal-document-viewer">
        <header><button type="button" data-terminal-document-back>‹ ${escapeHtml(copy.back)}</button><h1>${escapeHtml(attachment.title)}</h1><span>ESC</span></header>
        ${body}
      </section>`;
  }

  function content() {
    return getServiceTerminalContent(levelId, language());
  }

  function language() {
    return getLanguage() === "ru" ? "ru" : "en";
  }

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    removers.push(() => target.removeEventListener(type, handler, options));
  }

  return { wire, open, close, dispose, render, isActive: () => active };
}

export function stepGuideIndex(currentIndex, delta, length) {
  return Math.max(0, Math.min(Math.max(0, length - 1), currentIndex + delta));
}

export function resolveServiceTerminalEscapeAction({ active, attachmentOpen }) {
  if (!active) return null;
  return attachmentOpen ? "close-attachment" : "close-terminal";
}

function createTerminalRoot(documentRoot) {
  const root = documentRoot.createElement("div");
  root.id = "serviceTerminalOverlay";
  root.className = "service-terminal-overlay";
  root.hidden = true;
  root.innerHTML = `
    <section class="service-terminal-shell" role="dialog" aria-modal="true" aria-label="Site-12 operations terminal">
      <aside class="service-terminal-sidebar">
        <header><strong data-terminal-brand></strong><span data-terminal-product></span><i></i></header>
        <nav data-terminal-nav aria-label="Terminal sections"></nav>
        <footer>
          <span>◎</span><b data-terminal-language-label></b>
          <button type="button" data-terminal-language="en">EN</button><i>/</i><button type="button" data-terminal-language="ru">RU</button>
        </footer>
      </aside>
      <div class="service-terminal-workspace">
        <header class="service-terminal-topbar"><span data-terminal-strapline></span><span data-terminal-location></span></header>
        <button class="service-terminal-close" type="button" data-terminal-close><kbd>ESC</kbd><span data-terminal-close-label></span></button>
        <main data-terminal-content></main>
      </div>
    </section>`;
  (documentRoot.body ?? documentRoot.documentElement).append(root);
  return root;
}

function terminalIcon(kind) {
  const paths = {
    brief: "<rect x='6' y='3' width='12' height='18' rx='1'/><path d='M9 8h6M9 12h6M9 16h4'/>",
    guide: "<path d='M4 20V10h4v10M10 20V4h4v16M16 20v-7h4v7'/>",
    reports: "<path d='M6 3h9l4 4v14H6z'/><path d='M15 3v5h4M9 12h7M9 16h7'/>",
    archive: "<path d='M4 7h16v14H4zM3 3h18v4H3z'/><path d='M9 11h6'/>",
    notices: "<path d='M18 16H6l2-3V9a4 4 0 018 0v4z'/><path d='M10 19a2 2 0 004 0'/>",
    document: "<path d='M6 3h9l4 4v14H6z'/><path d='M15 3v5h4M9 12h7M9 16h7'/>",
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind] ?? paths.document}</svg>`;
}

function lineBreaks(value) {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
