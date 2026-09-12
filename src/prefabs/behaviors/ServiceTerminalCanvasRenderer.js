import * as THREE from "three";

import { getServiceTerminalContent } from "../../app/panels/ServiceTerminalContent.js?v=terminal-dirt-png-1024";

export const TERMINAL_WIDTH = 1600;
export const TERMINAL_HEIGHT = 900;
const SIDEBAR_WIDTH = 376;
const TAB_IDS = ["brief", "guide", "reports", "archive", "notices"];

const COLORS = {
  paper: "#f2f2ef",
  sidebar: "#e9e9e6",
  ink: "#16191c",
  muted: "#626970",
  rule: "#bdc1c3",
  active: "#d9d9d6",
  orange: "#ef5b14",
  white: "#fafaf7",
};

export function createServiceTerminalCanvasRenderer({ config = {}, prefabName = "ServiceTerminal" } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = Number(config.textureWidth) || TERMINAL_WIDTH;
  canvas.height = Number(config.textureHeight) || TERMINAL_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(`[ServiceTerminal] Canvas 2D context unavailable for "${prefabName}"`);

  const texture = new THREE.CanvasTexture(canvas);
  texture.name = `${prefabName}_ServiceTerminal`;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const state = {
    language: "en",
    activeTab: "brief",
    activeDocumentId: null,
    guideIndex: 0,
    documentScroll: 0,
    hoveredAction: null,
  };
  const hitRegions = [];
  const images = new Map();

  function draw() {
    activeContext = context;
    activeHitRegions = hitRegions;
    hitRegions.length = 0;
    context.fillStyle = COLORS.paper;
    context.fillRect(0, 0, canvas.width, canvas.height);
    drawSidebar();
    drawTopbar();
    if (state.activeDocumentId) drawDocument();
    else if (state.activeTab === "guide") drawGuide();
    else if (state.activeTab === "reports") drawReports();
    else if (state.activeTab === "archive") drawArchive();
    else if (state.activeTab === "notices") drawNotices();
    else drawBrief();
    texture.needsUpdate = true;
  }

  function drawSidebar() {
    const copy = content();
    context.fillStyle = COLORS.sidebar;
    context.fillRect(0, 0, SIDEBAR_WIDTH, canvas.height);
    line(SIDEBAR_WIDTH, 0, SIDEBAR_WIDTH, canvas.height, COLORS.rule, 2);
    const logo = loadImage(copy.assets.logo);
    if (logo?.complete && logo.naturalWidth) context.drawImage(logo, 42, 18, 278, 72);
    else text(copy.brand, 42, 64, 38, 800);
    text(copy.product, 42, 116, 17, 650, COLORS.muted);
    line(42, 137, 154, 137, COLORS.orange, 7);

    TAB_IDS.forEach((id, index) => {
      const y = 181 + index * 96;
      const action = `tab:${id}`;
      const selected = state.activeTab === id && !state.activeDocumentId;
      const hovered = state.hoveredAction === action;
      if (selected || hovered) {
        context.fillStyle = selected ? COLORS.active : "#e1e1de";
        context.fillRect(18, y, SIDEBAR_WIDTH - 36, 72);
      }
      if (selected) {
        context.fillStyle = COLORS.orange;
        context.fillRect(18, y, 7, 72);
      }
      drawNavGlyph(53, y + 36, index);
      text(copy.tabs[id], 95, y + 45, 25, selected ? 800 : 650);
      region(action, 18, y, SIDEBAR_WIDTH - 36, 72);
    });

    line(42, 744, SIDEBAR_WIDTH - 30, 744, COLORS.rule, 2);
    text(copy.language, 42, 807, 20, 650, COLORS.muted);
    drawLanguage("en", 184, 776);
    text("/", 250, 807, 22, 500, COLORS.muted);
    drawLanguage("ru", 276, 776);
  }

  function drawLanguage(language, x, y) {
    const action = `language:${language}`;
    const active = state.language === language;
    const hovered = state.hoveredAction === action;
    if (hovered) {
      context.fillStyle = COLORS.active;
      context.fillRect(x - 10, y, 57, 43);
    }
    text(language.toUpperCase(), x, y + 31, 22, active ? 800 : 550, active ? COLORS.orange : COLORS.ink);
    region(action, x - 10, y, 57, 43);
  }

  function drawTopbar() {
    const copy = content();
    text(copy.strapline, SIDEBAR_WIDTH + 42, 49, 17, 650, COLORS.muted);
    text(copy.location, canvas.width - 42, 49, 17, 650, COLORS.muted, "right");
    line(SIDEBAR_WIDTH + 42, 72, canvas.width - 42, 72, COLORS.rule, 2);
  }

  function drawBrief() {
    const copy = content().brief;
    const x = SIDEBAR_WIDTH + 42;
    const rightWidth = 370;
    const rightX = canvas.width - rightWidth - 42;
    const leftWidth = rightX - x - 44;
    line(x, 105, x + 96, 105, COLORS.orange, 7);
    text(copy.eyebrow, x, 153, 27, 600, COLORS.muted);
    multiline(copy.title, x, 208, 54, 58, 850, COLORS.ink, leftWidth);
    const summaryY = 341;
    copy.summary.forEach((entry, index) => text(entry, x, summaryY + index * 32, 22, 500, COLORS.ink));

    let sectionY = 471;
    copy.sections.forEach((section) => {
      line(x, sectionY, x + leftWidth, sectionY, COLORS.rule, 2);
      text(section.title, x, sectionY + 39, 24, 800);
      multiline(section.text, x, sectionY + 73, 21, 28, 500, COLORS.ink, leftWidth);
      sectionY += 118;
    });

    drawSitePlate(rightX, 105, rightWidth, 202, copy.siteMessage, loadImage(content().assets.siteImage));
    context.strokeStyle = COLORS.rule;
    context.lineWidth = 2;
    context.strokeRect(rightX, 334, rightWidth, 244);
    text(copy.attachmentsTitle, rightX + 25, 376, 22, 650, COLORS.muted);
    copy.attachments.forEach((attachment, index) => {
      const y = 399 + index * 76;
      const action = `document:${attachment.id}`;
      context.fillStyle = state.hoveredAction === action ? "#e0e0dd" : COLORS.white;
      context.fillRect(rightX + 20, y, rightWidth - 40, 62);
      context.strokeStyle = COLORS.rule;
      context.strokeRect(rightX + 20, y, rightWidth - 40, 62);
      text(attachment.title, rightX + 39, y + 39, 20, 700);
      text("›", rightX + rightWidth - 39, y + 40, 33, 400, COLORS.ink, "right");
      region(action, rightX + 20, y, rightWidth - 40, 62);
    });
  }

  function drawGuide() {
    const copy = content().guide;
    const slide = copy.slides[state.guideIndex] ?? copy.slides[0];
    const x = SIDEBAR_WIDTH + 58;
    const width = canvas.width - x - 58;
    line(x, 112, x + 96, 112, COLORS.orange, 7);
    text(copy.eyebrow, x, 164, 27, 650, COLORS.muted);
    text(`${slide.number} / ${String(copy.slides.length).padStart(2, "0")}`, x + width, 164, 24, 700, COLORS.muted, "right");
    text(slide.title, x, 235, 56, 850);
    if (slide.lead) {
      multiline(slide.lead, x, 282, 24, 31, 750, COLORS.ink, width * 0.9);
      multiline(slide.copy.join(" "), x, 328, 22, 29, 500, COLORS.ink, width * 0.9);
    } else if (slide.copy) {
      multiline(slide.copy.join(" "), x, 282, 24, 32, 500, COLORS.ink, width * 0.78);
    }

    if (slide.kind === "demandIndicators") drawDemandIndicators(x, width);
    else if (slide.kind === "indicatorDefinitions") drawIndicatorDefinitions(slide, x, width);
    else drawGuideCards(slide, x, width);

    guideButton("guide:-1", `‹ ${copy.previous}`, x, 708, 220, state.guideIndex === 0);
    text(`${String(state.guideIndex + 1).padStart(2, "0")} / ${String(copy.slides.length).padStart(2, "0")}`, x + width / 2, 749, 22, 750, COLORS.muted, "center");
    guideButton("guide:1", `${copy.next} ›`, x + width - 220, 708, 220, state.guideIndex === copy.slides.length - 1);
  }

  function guideButton(action, label, x, y, width, disabled) {
    context.fillStyle = disabled ? "#e8e8e5" : state.hoveredAction === action ? COLORS.active : COLORS.white;
    context.fillRect(x, y, width, 62);
    context.strokeStyle = COLORS.rule;
    context.strokeRect(x, y, width, 62);
    text(label, x + width / 2, y + 40, 21, 700, disabled ? "#a1a5a7" : COLORS.ink, "center");
    if (!disabled) region(action, x, y, width, 62);
  }

  function drawReports() {
    const copy = content().reports;
    const x = SIDEBAR_WIDTH + 58;
    const width = canvas.width - x - 58;
    pageTitle(copy.title, x);
    text(copy.date, x, 263, 20, 700, COLORS.muted);
    text(copy.event, x + 300, 263, 20, 700, COLORS.muted);
    let y = 292;
    copy.entries.forEach(([date, record]) => {
      line(x, y, x + width, y, COLORS.rule, 2);
      text(date, x, y + 52, 25, 650);
      text(record, x + 300, y + 52, 25, 650);
      y += 88;
    });
  }

  function drawArchive() {
    const copy = content().archive;
    const x = SIDEBAR_WIDTH + 58;
    pageTitle(copy.title, x);
    text(copy.message, x, 327, 25, 600, COLORS.muted);
  }

  function drawNotices() {
    const copy = content().notices;
    const x = SIDEBAR_WIDTH + 58;
    pageTitle(copy.title, x);
    text(copy.date, x, 271, 22, 700, COLORS.muted);
    line(x, 299, canvas.width - 58, 299, COLORS.rule, 2);
    text(copy.heading, x, 361, 33, 800);
    multiline(copy.body, x, 418, 25, 36, 500, COLORS.ink, 850);
    text(copy.status, x, 590, 23, 800, COLORS.orange);
  }

  function drawDocument() {
    const copy = content();
    const documentData = copy.brief.attachments.find((entry) => entry.id === state.activeDocumentId);
    if (!documentData) {
      state.activeDocumentId = null;
      drawBrief();
      return;
    }
    const x = SIDEBAR_WIDTH + 42;
    const width = canvas.width - x - 42;
    const backAction = "document:back";
    if (state.hoveredAction === backAction) {
      context.fillStyle = COLORS.active;
      context.fillRect(x, 94, 165, 54);
    }
    text(`‹ ${copy.back}`, x + 14, 131, 21, 750);
    region(backAction, x, 94, 165, 54);
    text(documentData.title, x + 194, 132, 30, 800);
    line(x, 164, x + width, 164, COLORS.rule, 2);
    if (documentData.type === "loadProfile") drawLoadProfile(documentData, x, width);
    else drawArchivedDocument(documentData, x, width);
  }

  function drawArchivedDocument(documentData, x, width) {
    const viewport = { x, y: 184, width, height: 668 };
    context.save();
    context.beginPath();
    context.rect(viewport.x, viewport.y, viewport.width, viewport.height);
    context.clip();
    context.fillStyle = "#d8d8d4";
    context.fillRect(viewport.x, viewport.y, viewport.width, viewport.height);
    let y = viewport.y + 22 - state.documentScroll;
    let totalHeight = 0;
    for (const path of documentData.pages ?? []) {
      const image = loadImage(path);
      const ratio = image?.naturalWidth ? image.naturalHeight / image.naturalWidth : 0.67;
      const imageWidth = viewport.width - 80;
      const imageHeight = imageWidth * ratio;
      if (image?.complete && image.naturalWidth) context.drawImage(image, viewport.x + 40, y, imageWidth, imageHeight);
      else {
        context.fillStyle = COLORS.white;
        context.fillRect(viewport.x + 40, y, imageWidth, imageHeight);
        text("LOADING ARCHIVED SCAN...", viewport.x + 72, y + 72, 24, 700, COLORS.muted);
      }
      y += imageHeight + 26;
      totalHeight += imageHeight + 26;
    }
    context.restore();
    state.maxDocumentScroll = Math.max(0, totalHeight + 44 - viewport.height);
    if (state.maxDocumentScroll > 0) {
      const thumbHeight = Math.max(60, viewport.height * viewport.height / (viewport.height + state.maxDocumentScroll));
      const thumbY = viewport.y + (viewport.height - thumbHeight) * state.documentScroll / state.maxDocumentScroll;
      context.fillStyle = COLORS.rule;
      context.fillRect(viewport.x + viewport.width - 8, viewport.y, 8, viewport.height);
      context.fillStyle = COLORS.orange;
      context.fillRect(viewport.x + viewport.width - 8, thumbY, 8, thumbHeight);
    }
    region("document:scroll", viewport.x, viewport.y, viewport.width, viewport.height);
  }

  function drawLoadProfile(documentData, x, width) {
    text(documentData.heading, x, 226, 24, 650, COLORS.muted);
    const chartX = x + 28;
    const chartY = 340;
    const chartWidth = width - 56;
    const points = documentData.points ?? [];
    const stepWidth = chartWidth / Math.max(1, points.length - 1);
    line(chartX, 618, chartX + chartWidth, 618, COLORS.rule, 2);
    context.strokeStyle = COLORS.orange;
    context.lineWidth = 8;
    context.beginPath();
    points.forEach(([, mw], index) => {
      const px = chartX + index * stepWidth;
      const py = 580 - ((mw - 100) / 900) * 235;
      if (index === 0) context.moveTo(px, py);
      else {
        const previousMw = points[index - 1][1];
        const previousY = 580 - ((previousMw - 100) / 900) * 235;
        context.lineTo(px, previousY);
        context.lineTo(px, py);
      }
    });
    context.stroke();
    points.forEach(([time, mw, label], index) => {
      const px = chartX + index * stepWidth;
      const py = 580 - ((mw - 100) / 900) * 235;
      context.fillStyle = COLORS.ink;
      context.beginPath();
      context.arc(px, py, 8, 0, Math.PI * 2);
      context.fill();
      text(time, px, 662, 18, 700, COLORS.muted, index === 0 ? "left" : index === points.length - 1 ? "right" : "center");
      text(`${mw} MW`, px, py - 22, 20, 800, COLORS.ink, index === 0 ? "left" : index === points.length - 1 ? "right" : "center");
      if (index < points.length - 1) multiline(label, px, 721 + (index % 2) * 52, 17, 21, 700, COLORS.ink, stepWidth - 12, index === 0 ? "left" : "center");
    });
  }

  function updateHover(x, y) {
    const next = hitRegions.find((entry) => pointInside(x, y, entry))?.action ?? null;
    if (next === state.hoveredAction) return next;
    state.hoveredAction = next;
    draw();
    return next;
  }

  function activateAt(x, y) {
    const action = hitRegions.find((entry) => pointInside(x, y, entry))?.action;
    if (!action) return null;
    const [type, value] = action.split(":");
    if (type === "tab") {
      state.activeTab = TAB_IDS.includes(value) ? value : "brief";
      state.activeDocumentId = null;
      state.guideIndex = 0;
      state.documentScroll = 0;
    } else if (type === "language") {
      state.language = value === "ru" ? "ru" : "en";
    } else if (type === "document" && value === "back") {
      state.activeDocumentId = null;
      state.documentScroll = 0;
    } else if (type === "document" && value !== "scroll") {
      state.activeDocumentId = value;
      state.documentScroll = 0;
    } else if (type === "guide") {
      const slides = content().guide.slides;
      state.guideIndex = THREE.MathUtils.clamp(state.guideIndex + Number(value), 0, slides.length - 1);
    }
    draw();
    return { type, value, language: state.language };
  }

  function scroll(delta) {
    if (!state.activeDocumentId || !state.maxDocumentScroll) return false;
    state.documentScroll = THREE.MathUtils.clamp(state.documentScroll + Math.sign(delta) * 110, 0, state.maxDocumentScroll);
    draw();
    return true;
  }

  function back() {
    if (!state.activeDocumentId) return false;
    state.activeDocumentId = null;
    state.documentScroll = 0;
    draw();
    return true;
  }

  function setLanguage(language) {
    const normalized = language === "ru" ? "ru" : "en";
    if (state.language === normalized) return false;
    state.language = normalized;
    draw();
    return true;
  }

  function loadImage(path) {
    if (images.has(path)) return images.get(path);
    const image = new Image();
    image.decoding = "async";
    image.onload = draw;
    image.src = path;
    images.set(path, image);
    return image;
  }

  function content() {
    return getServiceTerminalContent("exploring-around", state.language);
  }

  function dispose() {
    texture.dispose();
    images.clear();
  }

  draw();
  return {
    canvas,
    texture,
    state,
    draw,
    updateHover,
    activateAt,
    scroll,
    back,
    setLanguage,
    dispose,
    isDocumentOpen: () => Boolean(state.activeDocumentId),
  };
}

export function uvToTerminalPixels(uv, width = TERMINAL_WIDTH, height = TERMINAL_HEIGHT) {
  if (!uv) return null;
  return { x: uv.x * width, y: uv.y * height };
}

function pageTitle(title, x) {
  const ctx = currentContext();
  line(x, 112, x + 96, 112, COLORS.orange, 7, ctx);
  text(title, x, 210, 58, 850, COLORS.ink, "left", ctx);
}

let activeContext = null;
function currentContext() { return activeContext; }

function text(value, x, y, size, weight = 500, color = COLORS.ink, align = "left", forcedContext = null) {
  const ctx = forcedContext ?? activeContext;
  if (!ctx) return;
  ctx.font = `${weight} ${size}px Arial, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(value ?? ""), x, y);
}

function multiline(value, x, y, size, lineHeight, weight, color, maxWidth, align = "left") {
  const ctx = activeContext;
  String(value ?? "").split("\n").forEach((paragraph, paragraphIndex) => {
    const words = paragraph.split(/\s+/);
    let lineValue = "";
    let row = paragraphIndex;
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    words.forEach((word) => {
      const candidate = lineValue ? `${lineValue} ${word}` : word;
      if (lineValue && ctx.measureText(candidate).width > maxWidth) {
        text(lineValue, x, y + row * lineHeight, size, weight, color, align);
        lineValue = word;
        row += 1;
      } else lineValue = candidate;
    });
    if (lineValue) text(lineValue, x, y + row * lineHeight, size, weight, color, align);
  });
}

function line(x1, y1, x2, y2, color, width = 1, forcedContext = null) {
  const ctx = forcedContext ?? activeContext;
  if (!ctx) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function region(action, x, y, width, height) {
  activeRegions()?.push({ action, x, y, width, height });
}

let activeHitRegions = null;
function activeRegions() { return activeHitRegions; }

function pointInside(x, y, rect) {
  return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

function drawNavGlyph(x, y, index) {
  const ctx = activeContext;
  ctx.strokeStyle = COLORS.ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(x - 14, y - 17, 28, 34);
  if (index === 1) {
    ctx.fillStyle = COLORS.ink;
    [-8, 0, 8].forEach((offset, bar) => ctx.fillRect(x - 10 + bar * 8, y + 10 - Math.abs(offset), 5, 8 + Math.abs(offset)));
  } else {
    line(x - 8, y - 7, x + 8, y - 7, COLORS.ink, 3);
    line(x - 8, y + 1, x + 8, y + 1, COLORS.ink, 3);
    line(x - 8, y + 9, x + 5, y + 9, COLORS.ink, 3);
  }
}

function drawSitePlate(x, y, width, height, label, image) {
  const ctx = activeContext;
  ctx.save();
  if (image?.complete && image.naturalWidth) drawCoverImage(ctx, image, x, y, width, height);
  else {
    ctx.fillStyle = "#d4d5d2";
    ctx.fillRect(x, y, width, height);
    for (let offset = -height; offset < width; offset += 36) line(x + offset, y, x + offset + height, y + height, "rgba(45,48,50,.13)", 2);
  }
  ctx.shadowColor = "rgba(242,242,239,.95)";
  ctx.shadowBlur = 5;
  multiline(label, x + width - 24, y + 55, 21, 26, 750, COLORS.ink, 170, "right");
  ctx.shadowBlur = 0;
  line(x + width - 88, y + 94, x + width - 24, y + 94, COLORS.orange, 7);
  ctx.restore();
}

function drawCoverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawGuideCards(slide, x, width) {
  const boxY = 385;
  const gap = 18;
  const visual = slide.visual ?? [];
  const boxWidth = (width - gap * Math.max(0, visual.length - 1)) / Math.max(1, visual.length);
  visual.forEach((label, index) => {
    const boxX = x + index * (boxWidth + gap);
    activeContext.fillStyle = index % 2 ? "#e3e3e0" : COLORS.white;
    activeContext.fillRect(boxX, boxY, boxWidth, 176);
    activeContext.strokeStyle = COLORS.rule;
    activeContext.strokeRect(boxX, boxY, boxWidth, 176);
    text(String(index + 1).padStart(2, "0"), boxX + 22, boxY + 42, 20, 700, COLORS.orange);
    multiline(label, boxX + 22, boxY + 92, 23, 29, 750, COLORS.ink, boxWidth - 44);
  });
}

function drawDemandIndicators(x, width) {
  const y = 418;
  const cardWidth = (width - 36) / 3;
  const cards = [
    ["UNDER DEMAND", "OUTPUT < DEMAND", "↓"],
    ["TARGET BAND", "OUTPUT = DEMAND", "●"],
    ["OVER DEMAND", "OUTPUT > DEMAND", "↑"],
  ];
  cards.forEach(([label, detail, symbol], index) => {
    const cardX = x + index * (cardWidth + 18);
    activeContext.fillStyle = index === 1 ? "#e3e3e0" : COLORS.white;
    activeContext.fillRect(cardX, y, cardWidth, 176);
    activeContext.strokeStyle = index === 1 ? COLORS.orange : COLORS.rule;
    activeContext.lineWidth = index === 1 ? 4 : 2;
    activeContext.strokeRect(cardX, y, cardWidth, 176);
    text(symbol, cardX + cardWidth / 2, y + 72, 46, 850, index === 1 ? COLORS.orange : COLORS.ink, "center");
    text(label, cardX + cardWidth / 2, y + 112, 21, 800, COLORS.ink, "center");
    text(detail, cardX + cardWidth / 2, y + 144, 17, 650, COLORS.muted, "center");
  });
}

function drawIndicatorDefinitions(slide, x, width) {
  (slide.definitions ?? []).forEach(([indicator, definition], index) => {
    const cardY = 326 + index * 104;
    activeContext.fillStyle = index % 2 ? "#e8e8e5" : COLORS.white;
    activeContext.fillRect(x, cardY, width, 86);
    activeContext.strokeStyle = COLORS.rule;
    activeContext.strokeRect(x, cardY, width, 86);
    text(indicator, x + 22, cardY + 37, 22, 850, COLORS.orange);
    text(definition, x + 305, cardY + 37, 20, 550, COLORS.ink);
  });
  line(x, 646, x + width, 646, COLORS.rule, 2);
  text(slide.note, x, 681, 18, 650, COLORS.muted);
}

export function bindServiceTerminalCanvasContext(renderer) {
  activeContext = renderer.context;
  activeHitRegions = renderer.hitRegions;
}
