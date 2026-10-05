// Static screenshot galleries; this page does not initialize the game runtime.
import { getLandingLabels, localizeLanding, localizeScreenshot } from "./localization.js";

const language = localizeLanding();
const labels = getLandingLabels(language);
// Start phone Q&A collapsed; preserve any choices made after page load.
if (window.matchMedia("(max-width: 600px)").matches) {
  for (const answer of document.querySelectorAll(".questions details")) answer.open = false;
}
const screenshots = [
  { file: "control-booth", caption: "Control Booth A — Site-12", alt: "The analog gauges and green CRT of the reactor console in Control Booth A.", position: "65% center" },
  { file: "shaft-03-corridor", caption: "Shaft 03 — Site-12", alt: "A concrete corridor with the posted facility map on the wall.", position: "center" },
  { file: "core-observation", caption: "Core observation — Site-12", alt: "Purple plasma visible through the reactor observation window.", position: "center" },
  { file: "reactor-controls", caption: "Reactor controls — Site-12", alt: "Physical controls beneath the reactor gauges.", position: "center" },
  { file: "site-12-entrance", caption: "Entrance — Site-12", alt: "The entrance checkpoint with an old computer and Terragen sign.", position: "center" },
  { file: "partial-power-loss", caption: "Lights out — Site-12", alt: "A flashlight illuminates the observation console in the dark.", position: "center" },
  { file: "observation-console", caption: "Observation console — Site-12", alt: "The illuminated observation console beneath the plasma viewport.", position: "center" },
  { file: "qualification-terminal", caption: "Service terminal — Site-12", alt: "The old entrance terminal displaying an operator assignment.", position: "center" },
  { file: "service-corridor", caption: "Service corridor — Site-12", alt: "A dim service corridor with illuminated direction signs.", position: "center" },
  { file: "plasma-viewport", caption: "Plasma viewport — Site-12", alt: "A close view of purple plasma through the observation window.", position: "center" },
  { file: "emergency-flashlight", caption: "Emergency lighting — Site-12", alt: "A flashlight beam illuminates site safety notices and a clock.", position: "center" },
  { file: "entrance-blackout", caption: "Entrance blackout — Site-12", alt: "The entrance checkpoint and service terminal during a blackout.", position: "center" },
].map((shot) => localizeScreenshot(shot, language));
const galleryIntervalMs = 3000;
// Fixed sequence selected for the landing gallery.
const galleryOrder = [1, 0, 8, 4, 9, 7, 5, 3, 11];
const image = document.querySelector("#gallery-image");
const caption = document.querySelector("#gallery-caption");
const count = document.querySelector("#gallery-count");
const dialog = document.querySelector(".image-viewer");
const viewerImage = document.querySelector("#viewer-image");
const viewerCaption = document.querySelector("#viewer-caption");
const viewerCount = document.querySelector("#viewer-count");
const gallery = document.querySelector(".gallery");
const galleryStatus = document.querySelector(".gallery-status");
const galleryToggle = document.querySelector(".gallery-toggle");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let galleryIndex = 0;
let viewerIndex = 0;
let galleryTimer = null;
let userPaused = reducedMotion.matches;
let hoveringGallery = false;
let pageInactive = false;

function imageUrl(file, width) {
  // These captures are copied to assets/landing by the existing static build.
  return new URL(`./assets/landing/${file}-${width}.webp`, document.baseURI).href;
}

function updateImage(target, shot) {
  target.srcset = `${imageUrl(shot.file, 1280)} 1280w, ${imageUrl(shot.file, 2560)} 2560w`;
  target.src = imageUrl(shot.file, 1280);
  target.alt = shot.alt;
  target.style.objectPosition = shot.position;
}

function stepGallery(step) {
  galleryIndex = (galleryIndex + step + galleryOrder.length) % galleryOrder.length;
  const shot = screenshots[galleryOrder[galleryIndex]];
  updateImage(image, shot);
  caption.textContent = shot.caption;
  count.textContent = `${galleryIndex + 1} / ${galleryOrder.length}`;
}

function updateAutoplay() {
  window.clearInterval(galleryTimer);
  galleryTimer = null;
  const paused = userPaused || reducedMotion.matches || hoveringGallery
    || gallery.contains(document.activeElement) || document.hidden || dialog.open || pageInactive;
  galleryStatus.setAttribute("aria-live", paused ? "polite" : "off");
  galleryToggle.textContent = userPaused ? "▶" : "Ⅱ";
  galleryToggle.setAttribute("aria-pressed", String(userPaused));
  galleryToggle.setAttribute("aria-label", userPaused ? labels.resume : labels.pause);
  if (!paused) galleryTimer = window.setInterval(() => stepGallery(1), galleryIntervalMs);
}

galleryToggle.addEventListener("click", () => {
  userPaused = !userPaused;
  updateAutoplay();
});
gallery.addEventListener("pointerenter", (event) => {
  if (event.pointerType !== "mouse") return;
  hoveringGallery = true;
  updateAutoplay();
});
gallery.addEventListener("pointerleave", () => {
  hoveringGallery = false;
  updateAutoplay();
});
gallery.addEventListener("focusin", updateAutoplay);
gallery.addEventListener("focusout", () => window.queueMicrotask(updateAutoplay));
document.addEventListener("visibilitychange", updateAutoplay);
reducedMotion.addEventListener("change", updateAutoplay);
window.addEventListener("pagehide", () => {
  pageInactive = true;
  updateAutoplay();
});
window.addEventListener("pageshow", () => {
  pageInactive = false;
  updateAutoplay();
});

// Warm the same responsive image candidates before the slideshow advances.
for (const index of galleryOrder.slice(1)) {
  const preload = new Image();
  preload.sizes = image.sizes;
  updateImage(preload, screenshots[index]);
}
stepGallery(0);
updateAutoplay();

for (const button of document.querySelectorAll("[data-gallery-step]")) {
  button.addEventListener("click", () => stepGallery(Number(button.dataset.galleryStep)));
}
gallery.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  stepGallery(event.key === "ArrowLeft" ? -1 : 1);
});

function showViewer(index) {
  viewerIndex = (index + screenshots.length) % screenshots.length;
  const shot = screenshots[viewerIndex];
  updateImage(viewerImage, shot);
  viewerImage.sizes = "(max-width: 1556px) 100vw, 1464px";
  viewerCaption.textContent = shot.caption;
  viewerCount.textContent = `${viewerIndex + 1} / ${screenshots.length}`;
}

for (const button of document.querySelectorAll("[data-media]")) {
  if (language === "ru") {
    const shot = screenshots[Number(button.dataset.media)];
    button.setAttribute("aria-label", `${labels.enlarge}: ${shot.shortCaption}`);
    button.querySelector("img").alt = shot.alt;
    button.closest("figure").querySelector("figcaption").textContent = shot.shortCaption;
  }
  button.addEventListener("click", () => {
    showViewer(Number(button.dataset.media));
    dialog.showModal();
    updateAutoplay();
  });
}
for (const button of document.querySelectorAll("[data-viewer-step]")) {
  button.addEventListener("click", () => showViewer(viewerIndex + Number(button.dataset.viewerStep)));
}
document.querySelector(".viewer-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", updateAutoplay);
dialog.addEventListener("click", (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
});
dialog.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  showViewer(viewerIndex + (event.key === "ArrowLeft" ? -1 : 1));
});
