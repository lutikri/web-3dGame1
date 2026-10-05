# BASELOAD landing page

The separate public page is `landing.html`; the existing game remains at `index.html`.

- Local development: `http://localhost:5173/landing.html` after `npm run dev`.
- Russian: `http://localhost:5173/landing.html?lang=ru`; English: `?lang=en` (also the default).
- Static build: both HTML entry points are included by `vite.config.js`. Links are relative and work under the configured `/web-3dGame1/` base.
- Page ownership: `landing.html`, `styles/landing.css`, `src/landing/main.js`, `src/landing/localization.js`.
- The page does not import Three.js, boot the game, or read/write game progress.

## Languages

The EN / RU links select the language through the URL and preserve other query parameters and the current section hash. No language preference is written to game storage. English copy remains in HTML; the Russian text, metadata, accessible labels and screenshot descriptions are authored in `src/landing/localization.js`. Both locales use the same gallery sequence and timing. Russian uses the game's bundled Cyrillic font subsets. Play opens the existing game, whose language is selected through its own setup/settings.

Both language versions use the browser tab and sharing title `Baseload About`.

## Gameplay captures

All 12 supplied PNG captures were copied from `C:\Users\artyo\Desktop\tempbakes\baseloadscreems` into the ignored `source-assets/landing/screenshots/` directory. Originals at the supplied location remain unchanged.

Browser versions live in `assets/landing/`: 1280px and 2560px WebP, Lanczos resize, quality 86. `shaft-03-map.webp` is a crop of the actual map poster in the corridor capture, quality 90. No promotional artwork or simulated gameplay is used.

| Original capture time (2026-10-04 UTC) | Renamed source / web basename |
| --- | --- |
| 22-40-55-469Z | shaft-03-corridor |
| 22-42-27-237Z | site-12-entrance |
| 22-43-40-772Z | qualification-terminal |
| 22-44-19-737Z | service-corridor |
| 22-45-29-128Z | control-booth |
| 22-48-21-708Z | observation-console |
| 22-50-37-858Z | core-observation |
| 22-52-22-440Z | reactor-controls |
| 22-52-47-976Z | plasma-viewport |
| 22-56-01-433Z | partial-power-loss |
| 22-58-24-691Z | emergency-flashlight |
| 22-58-41-871Z | entrance-blackout |

## Page design and content

A single 1050px centered column sits over a dark corridor capture. Typography, green colors, line opacity, menu button treatment and gallery corner marks follow the existing main-menu, boot and settings CSS. The page loads the same bundled Roboto Condensed, Roboto Mono and Inter font files, without importing game styles or runtime.

The header contains a single BASE LOAD wordmark. Below it are the premise and Play link, browser/hardware notes, and a compact nine-frame screenshot carousel with controls over the bottom of the image. The carousel rotates every three seconds: one full cycle takes 27 seconds. Its fixed sequence is Shaft 03, Control Booth A, Service corridor, Entrance, Plasma viewport, Service terminal, Lights out, Reactor controls, Entrance blackout. Emergency lighting, Observation console and Core observation are excluded from this carousel. It has a pause control and pauses during mouse hover, keyboard focus, hidden-tab state and the enlarged screenshot viewer. Reduced-motion preferences disable automatic rotation. It clears its timer on page exit and resumes appropriately after browser back navigation.

The remaining page contains a short premise, a smaller observation screenshot, the user-supplied NOW / NEXT / THEN / LATER roadmap, GAME LOOK media thumbnails with a native dialog viewer, ABOUT SITE-12 / LORE, a solo-development note and Q&A including WHY A BROWSER GAME?. Lore and browser-development copy come from the user. The roadmap includes the planned roughly 1.5-hour browser story and the conditional Unreal/Steam direction; these describe future plans, not completed features. All media comes from the supplied gameplay captures.

## Manual visual check

Phone layout (up to 600px) uses the available screen width, 16px body copy, larger captions and 44px or larger tap targets. The language switch sits next to the wordmark, navigation below it, and Play spans the intro width. GAME LOOK uses one image per row. Q&A starts collapsed on phones while keeping answers available; desktop answers remain expanded by default. Check both languages at 320–430px for readable text, line wrapping, gallery controls and tap comfort.

Check the darker background, compact header and gallery at desktop and mobile widths. Confirm three-second rotation, the fixed nine-frame sequence, pause/resume, readable overlay captions and hover/focus pauses. Enlarge media thumbnails, use left/right arrows and Escape in the viewer, and check Q&A toggles. Both Play links should open the existing game setup/menu flow.
