const SOFTWARE_PATTERN = /swiftshader|llvmpipe|software|microsoft basic render|mesa offscreen/i;
const INTEGRATED_PATTERN = /intel|\buhd\b|\biris\b|radeon(?:\(tm\))? graphics|\bvega\b/i;
const DISCRETE_PATTERN = /nvidia|geforce|quadro|rtx|radeon\s+(?:rx|pro)|apple\s+m\d|intel\s+arc/i;

export function classifyGraphicsAdapter(renderer) {
  const text = String(renderer ?? "").trim();
  if (!text || /unavailable|unknown|masked|webgl renderer/i.test(text)) return "unknown";
  if (SOFTWARE_PATTERN.test(text)) return "software";
  if (INTEGRATED_PATTERN.test(text) && !/intel\s+arc/i.test(text)) return "integrated";
  if (DISCRETE_PATTERN.test(text)) return "discrete";
  return "unknown";
}

export function isHighEndGraphicsAdapter(renderer) {
  const text = normalizeRenderer(renderer);
  if (!text || SOFTWARE_PATTERN.test(text)) return false;
  return isHighEndNvidia(text)
    || isHighEndAmd(text)
    || isHighEndIntelArc(text)
    || isHighEndApple(text);
}

function isHighEndNvidia(text) {
  const match = text.match(/(?:geforce\s+)?rtx\s*(\d{4})\s*(ti|super)?/i);
  if (!match) return false;
  const model = Number(match[1]);
  const generation = Math.floor(model / 1000);
  const performanceClass = model % 100;
  if (generation < 2) return false;
  return performanceClass >= 60;
}

function isHighEndAmd(text) {
  const match = text.match(/radeon\s+(?:rx\s*)?(\d{4})\s*(xtx|xt)?/i);
  if (!match) return false;
  const model = Number(match[1]);
  const generation = Math.floor(model / 1000);
  const modelSuffix = model % 1000;
  if (generation >= 9 && modelSuffix < 100) {
    return modelSuffix >= 70 || (modelSuffix >= 60 && Boolean(match[2]));
  }
  const performanceClass = Math.floor(modelSuffix / 100);
  if (generation < 6) return false;
  if (performanceClass >= 7) return true;
  return performanceClass >= 6 && Boolean(match[2]) && generation >= 9;
}

function isHighEndIntelArc(text) {
  const match = text.match(/intel\s+arc\s+([ab])(\d{3})/i);
  if (!match) return false;
  const model = Number(match[2]);
  return match[1].toLowerCase() === "a" ? model >= 750 : model >= 580;
}

function isHighEndApple(text) {
  const match = text.match(/apple\s+m(\d+)\s*(pro|max|ultra)?/i);
  if (!match) return false;
  const generation = Number(match[1]);
  const variant = match[2]?.toLowerCase() ?? "";
  return Boolean(variant) || generation >= 4;
}

function normalizeRenderer(renderer) {
  return String(renderer ?? "")
    .replace(/^angle\s*\(/i, "")
    .replace(/[(),]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
