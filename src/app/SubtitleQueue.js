export function createSubtitleQueue({ element }) {
  const queue = [];
  const seen = new Set();
  let active = null;
  let blocked = false;
  let holdTimer = 0;
  let hideTimer = 0;

  function enqueue({ id, text, duration = 3.4, priority = 0, mode = "thought" } = {}) {
    if (!element || !text || (id && seen.has(id))) return;
    if (id) seen.add(id);
    queue.push({ id, text, duration, priority, mode });
    queue.sort((a, b) => b.priority - a.priority);
    pump();
  }

  function pump() {
    if (!element || blocked || active || queue.length === 0) return;
    active = queue.shift();
    const filmMode = active.mode === "film";
    const fadeSeconds = filmMode ? 0 : 0.7 + Math.random() * 0.5;
    element.style.setProperty("--subtitle-fade-seconds", `${fadeSeconds.toFixed(2)}s`);
    element.dataset.mode = active.mode;
    element.textContent = active.text;
    element.hidden = false;
    element.getBoundingClientRect();
    element.classList.add("is-visible");

    holdTimer = window.setTimeout(() => {
      element.classList.remove("is-visible");
      hideTimer = window.setTimeout(() => {
        element.hidden = true;
        element.textContent = "";
        element.dataset.mode = "";
        active = null;
        pump();
      }, fadeSeconds * 1000);
    }, active.duration * 1000);
  }

  function clear({ resetSeen = false } = {}) {
    queue.length = 0;
    window.clearTimeout(holdTimer);
    window.clearTimeout(hideTimer);
    active = null;
    if (resetSeen) seen.clear();
    if (!element) return;
    element.classList.remove("is-visible");
    element.dataset.mode = "";
    element.hidden = true;
    element.textContent = "";
  }

  function setBlocked(value) {
    blocked = Boolean(value);
    if (!blocked) pump();
  }

  return { enqueue, clear, setBlocked };
}
