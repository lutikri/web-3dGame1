export function createAppRouter({ overlay, percent, title, status, barFill, releaseInput, onStateChange }) {
  let active = false;

  async function transition({ title: routeTitle, status: routeStatus, action }) {
    if (active) return false;
    active = true;
    onStateChange?.(true);
    releaseInput?.();
    showCurtain();
    await wait(140);
    showLoading(routeTitle, routeStatus);
    await wait(420);
    await action?.();
    await wait(80);
    overlay?.classList.remove("is-loading");
    await wait(100);
    hideCurtain();
    await wait(140);
    active = false;
    onStateChange?.(false);
    return true;
  }

  function showCurtain() {
    if (!overlay) return;
    overlay.classList.remove("is-loading");
    title?.classList.remove("is-visible");
    overlay.hidden = false;
    overlay.getBoundingClientRect();
    overlay.classList.add("is-visible");
  }

  function showLoading(routeTitle, routeStatus) {
    if (!overlay) return;
    if (title) title.textContent = routeTitle;
    if (status) status.textContent = routeStatus;
    if (percent) percent.textContent = "00%";
    if (barFill) barFill.style.width = "0%";
    overlay.classList.add("is-loading");
    title?.classList.add("is-visible");
    window.requestAnimationFrame(() => {
      if (percent) percent.textContent = "100%";
      if (barFill) barFill.style.width = "100%";
    });
  }

  function hideCurtain() {
    if (!overlay) return;
    overlay.classList.remove("is-visible", "is-loading");
    title?.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!overlay.classList.contains("is-visible")) overlay.hidden = true;
    }, 140);
  }

  return {
    transition,
    showCurtain,
    isActive: () => active,
  };
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
