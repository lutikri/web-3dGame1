const ROUTE_LINKS = [
  { from: "qualification", to: "facility", fromSide: "bottom", toSide: "top" },
  { from: "qualification", to: "tests", fromSide: "bottom", toSide: "top" },
];

const LEVEL_UNLOCKS = {
  "intro-shift": [],
  "unexpected-stuff": ["intro-shift"],
  "fuel-problems": ["intro-shift"],
  "shift-coordination": ["unexpected-stuff", "fuel-problems"],
  "exploring-around": ["shift-coordination"],
  "power-bus-training": ["shift-coordination"],
  "longer-shifts": ["shift-coordination"],
  "broken-lamp": ["shift-coordination"],
  "low-fuel": ["shift-coordination"],
  "low-heat-sink": ["shift-coordination"],
  "maximum-load": ["shift-coordination"],
  freeplay: [],
  competitive: ["shift-coordination"],
};

export function createLevelSelectPanel({ levels, progress, root = document }) {
  const scroll = root.querySelector(".level-route-scroll");
  const canvas = root.querySelector(".level-route-canvas");
  const linksSvg = root.querySelector(".route-links-svg");
  let wired = false;

  function wire() {
    if (wired || !scroll) return;
    wired = true;
    let drag = null;
    let suppressClick = false;
    const dragThreshold = 4;
    scroll.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollLeft: scroll.scrollLeft,
        scrollTop: scroll.scrollTop,
        active: false,
      };
    });
    scroll.addEventListener("pointermove", (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.active && Math.hypot(dx, dy) < dragThreshold) return;
      if (!drag.active && !scroll.hasPointerCapture(drag.pointerId)) scroll.setPointerCapture(drag.pointerId);
      drag.active = true;
      suppressClick = true;
      scroll.classList.add("is-dragging");
      scroll.scrollLeft = drag.scrollLeft - dx;
      scroll.scrollTop = drag.scrollTop - dy;
      event.preventDefault();
    });
    const endDrag = (event) => {
      if (!drag) return;
      drag = null;
      scroll.classList.remove("is-dragging");
      if (scroll.hasPointerCapture(event.pointerId)) scroll.releasePointerCapture(event.pointerId);
    };
    scroll.addEventListener("click", (event) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    scroll.addEventListener("pointerup", endDrag);
    scroll.addEventListener("pointercancel", endDrag);
    scroll.addEventListener("lostpointercapture", endDrag);
    window.addEventListener("blur", () => {
      drag = null;
      suppressClick = false;
      scroll.classList.remove("is-dragging");
    });
    window.addEventListener("resize", updateRouteLinks);
  }

  function show() {
    if (!scroll) return;
    requestAnimationFrame(() => {
      updateRouteLinks();
      scroll.scrollTo({ left: 2810, top: 30 });
    });
  }

  function refresh() {
    root.querySelectorAll("[data-level-id]").forEach((node) => {
      const levelId = node.dataset.levelId;
      const level = levels[levelId];
      const completed = Boolean(progress.completedLevels[levelId]);
      const finished = Boolean(progress.finishedLevels[levelId]);
      const unlocked = isUnlocked(levelId);
      const available = Boolean(level?.playable && unlocked);
      node.classList.toggle("is-complete", completed);
      node.classList.toggle("is-finished", finished && !completed);
      node.classList.toggle("is-active", available);
      node.classList.toggle("is-locked", !available);
      node.dataset.completion = completed ? "complete" : finished ? "attempted" : "";
      if ("disabled" in node) node.disabled = !available;
      node.setAttribute("aria-label", `${level?.title ?? levelId}${completed ? " complete" : finished ? " attempted" : ""}`);
    });
  }

  function isUnlocked(levelId) {
    const requirements = LEVEL_UNLOCKS[levelId];
    if (!requirements) return Boolean(levels[levelId]?.playable);
    if (requirements.length === 0) return true;
    return requirements.some((requiredLevelId) => progress.completedLevels[requiredLevelId]);
  }

  function validate() {
    const menuLevelIds = new Set(
      [...root.querySelectorAll("[data-level-id]")].map((node) => node.dataset.levelId).filter(Boolean),
    );
    menuLevelIds.forEach((levelId) => {
      if (!levels[levelId]) throw new Error(`[LevelSelectPanel] Menu references unknown level: ${levelId}`);
    });
    Object.values(levels).forEach((level) => {
      if (level.playable && !menuLevelIds.has(level.id)) {
        console.warn(`[LevelSelectPanel] Playable level is missing from the level menu: ${level.id}`);
      }
    });
  }

  function updateRouteLinks() {
    if (!canvas || !linksSvg) return;
    const canvasRect = canvas.getBoundingClientRect();
    linksSvg.setAttribute("viewBox", `0 0 ${canvas.offsetWidth} ${canvas.offsetHeight}`);
    linksSvg.innerHTML = ROUTE_LINKS.map((link) => {
      const from = getRouteAnchor(link.from, link.fromSide, canvasRect);
      const to = getRouteAnchor(link.to, link.toSide, canvasRect);
      return from && to ? `<path d="${createRoutePath(from, to, link)}" />` : "";
    }).join("");
  }

  function getRouteAnchor(sectionId, side, canvasRect) {
    const section = canvas?.querySelector(`[data-route-section="${sectionId}"]`);
    if (!section) return null;
    const rect = section.getBoundingClientRect();
    const x = rect.left - canvasRect.left;
    const y = rect.top - canvasRect.top;
    const anchors = {
      top: { x: x + rect.width / 2, y },
      right: { x: x + rect.width, y: y + rect.height / 2 },
      bottom: { x: x + rect.width / 2, y: y + rect.height },
      left: { x, y: y + rect.height / 2 },
    };
    return anchors[side] ?? anchors.bottom;
  }

  return { wire, show, refresh, isUnlocked, validate };
}

export function createRoutePath(from, to, link) {
  if (link.fromSide === "bottom" && link.toSide === "top") {
    const midY = Math.round((from.y + to.y) / 2);
    return `M ${round(from.x)} ${round(from.y)} L ${round(from.x)} ${midY} L ${round(to.x)} ${midY} L ${round(to.x)} ${round(to.y)}`;
  }
  if (link.fromSide === "left" && link.toSide === "right") {
    const midX = Math.round((from.x + to.x) / 2);
    return `M ${round(from.x)} ${round(from.y)} L ${midX} ${round(from.y)} L ${midX} ${round(to.y)} L ${round(to.x)} ${round(to.y)}`;
  }
  return `M ${round(from.x)} ${round(from.y)} L ${round(to.x)} ${round(to.y)}`;
}

function round(value) {
  return Math.round(value * 10) / 10;
}
