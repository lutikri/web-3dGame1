import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const revision = process.argv[2];
if (!/^[A-Za-z0-9._-]+$/.test(revision ?? "")) {
  throw new Error("Usage: node scripts/stamp-module-revision.mjs <revision>");
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = listJavaScriptFiles(path.join(root, "src"));
const modulePattern = /(["'`])((?:\.\.?\/)[^"'`?\s]+\.js)(?:\?v=[^"'`\s]+)?\1/g;

for (const file of sourceFiles) {
  let source = fs.readFileSync(file, "utf8");
  source = source.replace(modulePattern, (_match, quote, modulePath) => {
    return `${quote}${modulePath}?v=${revision}${quote}`;
  });
  if (path.basename(file) === "main.js") {
    source = source.replace(
      /const APP_BUILD_REVISION = "[^"]+";/,
      `const APP_BUILD_REVISION = "${revision}";`,
    );
  }
  fs.writeFileSync(file, source);
}

const indexPath = path.join(root, "index.html");
const indexSource = fs
  .readFileSync(indexPath, "utf8")
  .replace(/src="src\/main\.js(?:\?v=[^"]+)?"/, `src="src/main.js?v=${revision}"`);
fs.writeFileSync(indexPath, indexSource);

console.log(`[module-revision] stamped ${sourceFiles.length} modules with ${revision}`);

function listJavaScriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(target);
    return entry.isFile() && entry.name.endsWith(".js") ? [target] : [];
  });
}
