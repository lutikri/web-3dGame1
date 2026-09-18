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
});
