const TOKEN_PLACEHOLDER_PATTERN = /\{(keys|key|button|wheel)\}/g;

export function createTutorialHintQueue({ element, translate, onShow = () => {} }) {
  let activeId = null;
  let pendingId = null;
  let hideTimer = 0;
  let revealTimer = 0;

  function show({ id, textKey, tokens = {}, delayMs = 0, durationMs = 0 } = {}) {
    if (!element || !id || !textKey) return;
    if (id === activeId || id === pendingId) return;
    window.clearTimeout(revealTimer);
    pendingId = id;
    revealTimer = window.setTimeout(() => {
      pendingId = null;
      window.clearTimeout(hideTimer);
      activeId = id;
      element.innerHTML = renderHint(translate(textKey), tokens);
      element.hidden = false;
      element.getBoundingClientRect();
      element.classList.add("is-visible");
      onShow({ id, textKey });
      if (durationMs > 0) {
        hideTimer = window.setTimeout(() => hide(id), durationMs);
      }
    }, Math.max(0, delayMs));
  }

  function hide(id = activeId) {
    if (!element || !activeId || (id && id !== activeId)) return;
    window.clearTimeout(hideTimer);
    window.clearTimeout(revealTimer);
    element.classList.remove("is-visible");
    const hiddenId = activeId;
    activeId = null;
    pendingId = null;
    window.setTimeout(() => {
      if (activeId || hiddenId !== id) return;
      element.hidden = true;
      element.textContent = "";
    }, 260);
  }

  function clear() {
    window.clearTimeout(hideTimer);
    window.clearTimeout(revealTimer);
    activeId = null;
    pendingId = null;
    if (!element) return;
    element.classList.remove("is-visible");
    element.hidden = true;
    element.textContent = "";
  }

  function getActiveId() {
    return activeId;
  }

  return { show, hide, clear, getActiveId };
}

function renderHint(template, tokens) {
  const parts = [];
  let cursor = 0;
  String(template).replace(TOKEN_PLACEHOLDER_PATTERN, (match, name, offset) => {
    parts.push(escapeHtml(template.slice(cursor, offset)));
    parts.push(renderToken(tokens[name]));
    cursor = offset + match.length;
    return match;
  });
  parts.push(escapeHtml(template.slice(cursor)));
  return `<span class="tutorial-hint-icon" aria-hidden="true">i</span><span class="tutorial-hint-copy">${parts.join("")}</span>`;
}

function renderToken(token) {
  if (Array.isArray(token)) return token.map(renderToken).join("");
  if (!token) return "";
  if (token.type === "key") return `<kbd class="tutorial-key">${escapeHtml(token.label)}</kbd>`;
  if (token.type === "mouse") {
    const sideClass = token.side ? ` is-${escapeHtml(token.side)}` : "";
    return `<span class="tutorial-mouse${sideClass}" role="img" aria-label="${escapeHtml(token.label)}"><span></span></span>`;
  }
  if (token.type === "wheel") {
    return `<span class="tutorial-wheel" role="img" aria-label="${escapeHtml(token.label)}"><span></span></span>`;
  }
  return escapeHtml(token.label ?? "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
