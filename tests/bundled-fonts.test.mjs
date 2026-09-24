import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const fontFiles = [
  "inter-cyrillic.woff2",
  "inter-latin.woff2",
  "roboto-condensed-cyrillic.woff2",
  "roboto-condensed-latin.woff2",
  "roboto-mono-cyrillic.woff2",
  "roboto-mono-latin.woff2",
];

test("UI typography uses bundled Latin and Cyrillic webfonts", () => {
  const stylesheet = readFileSync("styles/operator-game.css", "utf8");
  fontFiles.forEach((file) => {
    assert.equal(existsSync(`assets/fonts/${file}`), true, `${file} must be shipped`);
    assert.match(stylesheet, new RegExp(file.replace(".", "\\.")));
  });
  assert.match(stylesheet, /font-family: "Cascadia Mono"/);
  assert.match(stylesheet, /font-family: "Bahnschrift Condensed"/);
  assert.match(stylesheet, /font-family: "Roboto Condensed"/);
  assert.match(
    stylesheet,
    /\.level-arrival-title h1\s*\{[^}]*font-family: "Roboto Condensed"[^}]*letter-spacing: -0\.018em/s,
  );
  assert.match(
    stylesheet,
    /@keyframes level-arrival-title-in\s*\{[^}]*clip-path: inset\(-0\.18em 100% -0\.2em -0\.08em\)/s,
  );
  assert.match(stylesheet, /\[data-arrival-subtitle-bottom\]::before\s*\{[^}]*content: "\/"/s);
});
