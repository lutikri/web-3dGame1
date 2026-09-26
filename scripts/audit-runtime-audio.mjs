import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE_ROOT = path.resolve(ROOT, readArgument("--root") ?? path.join("source-assets", "audio", "runtime-sources"));
const REPORT_ROOT = path.resolve(ROOT, readArgument("--report-root") ?? path.join("source-assets", "audio", "runtime-sources", "reports"));
const AUDIO_EXTENSIONS = new Set([".wav", ".flac", ".aif", ".aiff", ".mp3", ".m4a", ".ogg"]);
const label = sanitizeLabel(readArgument("--label") ?? "before");

const files = collectAudioFiles(SOURCE_ROOT);
if (!files.length) throw new Error(`No source audio found under ${SOURCE_ROOT}`);

mkdirSync(REPORT_ROOT, { recursive: true });
const rows = files.map((file, index) => {
  process.stdout.write(`[${index + 1}/${files.length}] ${path.relative(SOURCE_ROOT, file)}\n`);
  return analyzeFile(file);
});

const jsonPath = path.join(REPORT_ROOT, `loudness-${label}.json`);
const csvPath = path.join(REPORT_ROOT, `loudness-${label}.csv`);
writeFileSync(jsonPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
writeFileSync(csvPath, toCsv(rows), "utf8");

const finiteLoudness = rows.map((row) => row.integratedLufs).filter(Number.isFinite);
process.stdout.write(`Analyzed ${rows.length} files.\n`);
process.stdout.write(`Integrated range: ${Math.min(...finiteLoudness).toFixed(1)} to ${Math.max(...finiteLoudness).toFixed(1)} LUFS.\n`);
process.stdout.write(`JSON: ${path.relative(ROOT, jsonPath)}\n`);
process.stdout.write(`CSV:  ${path.relative(ROOT, csvPath)}\n`);

function analyzeFile(file) {
  const relative = path.relative(SOURCE_ROOT, file).replaceAll("\\", "/");
  const category = relative.split("/")[0];
  const probe = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=sample_rate,channels",
    "-of", "json",
    file,
  ]);
  const probeJson = JSON.parse(probe.stdout || "{}");
  const loudness = run("ffmpeg", [
    "-hide_banner", "-nostats", "-i", file,
    "-af", "loudnorm=I=-18:TP=-2:LRA=11:print_format=json",
    "-f", "null", "-",
  ]);
  const blocks = loudness.stderr.match(/\{\s*"input_i"[\s\S]*?\}/g);
  if (!blocks?.length) throw new Error(`Unable to parse loudness output for ${file}`);
  const result = JSON.parse(blocks.at(-1));
  const stream = probeJson.streams?.[0] ?? {};
  return {
    soundKey: path.basename(file, path.extname(file)),
    category,
    sourcePath: relative,
    sourceFormat: path.extname(file).slice(1).toLowerCase(),
    durationSeconds: round(Number(probeJson.format?.duration), 3),
    sampleRate: Number(stream.sample_rate) || null,
    channels: Number(stream.channels) || null,
    integratedLufs: finiteNumber(result.input_i),
    truePeakDbtp: finiteNumber(result.input_tp),
    loudnessRangeLu: finiteNumber(result.input_lra),
    thresholdLufs: finiteNumber(result.input_thresh),
  };
}

function collectAudioFiles(root) {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const target = path.join(root, entry.name);
      if (entry.isDirectory() && entry.name !== "reports" && !entry.name.startsWith(".")) {
        return collectAudioFiles(target);
      }
      if (entry.isFile() && AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return [target];
      return [];
    })
    .sort((a, b) => a.localeCompare(b));
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.status})\n${result.stderr}`);
  }
  return result;
}

function finiteNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value, digits) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function sanitizeLabel(value) {
  return String(value).replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "") || "report";
}

function toCsv(items) {
  const headers = Object.keys(items[0]);
  const lines = [headers.join(",")];
  items.forEach((item) => {
    lines.push(headers.map((header) => csvCell(item[header])).join(","));
  });
  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
