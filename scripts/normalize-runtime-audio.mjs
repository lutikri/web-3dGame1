import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const SOURCE_ROOT = path.join(ROOT, "source-assets", "audio", "runtime-sources");
const REPORT_ROOT = path.join(SOURCE_ROOT, "reports");
const BEFORE_REPORT = path.join(REPORT_ROOT, "loudness-before.json");
const STAGING_ROOT = path.join(ROOT, "assets", "sounds", ".normalized-staging");
const dryRun = process.argv.includes("--dry-run");

if (!existsSync(BEFORE_REPORT)) {
  throw new Error(`Missing source audit: ${BEFORE_REPORT}. Run scripts/audit-runtime-audio.mjs first.`);
}

const audit = JSON.parse(readFileSync(BEFORE_REPORT, "utf8"));
const plan = audit.map((row) => buildPlanEntry(row));
mkdirSync(REPORT_ROOT, { recursive: true });
writeFileSync(path.join(REPORT_ROOT, "normalization-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8");
writeFileSync(path.join(REPORT_ROOT, "normalization-plan.csv"), toCsv(plan), "utf8");

printPlanSummary(plan);
if (dryRun) {
  process.stdout.write("Dry run only; runtime OGG files were not changed.\n");
  process.exit(0);
}

const resolvedStaging = path.resolve(STAGING_ROOT);
const resolvedSounds = path.resolve(ROOT, "assets", "sounds");
if (!resolvedStaging.startsWith(`${resolvedSounds}${path.sep}`)) {
  throw new Error(`Unsafe staging path: ${resolvedStaging}`);
}
rmSync(resolvedStaging, { recursive: true, force: true });
mkdirSync(resolvedStaging, { recursive: true });

plan.forEach((entry, index) => {
  process.stdout.write(`[${index + 1}/${plan.length}] ${entry.category}/${entry.soundKey} (${entry.profile})\n`);
  const source = path.join(SOURCE_ROOT, entry.sourcePath);
  const staged = path.join(resolvedStaging, entry.category, `${entry.soundKey}.ogg`);
  mkdirSync(path.dirname(staged), { recursive: true });
  const filter = entry.mode === "loudness"
    ? buildTwoPassLoudnormFilter(source, entry)
    : `volume=${entry.gainDb}dB`;
  run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", source,
    "-map_metadata", "-1", "-vn",
    "-af", filter,
    "-ar", "48000",
    "-c:a", "libvorbis", "-q:a", "4",
    staged,
  ]);
});

plan.forEach((entry) => {
  const staged = path.join(resolvedStaging, entry.category, `${entry.soundKey}.ogg`);
  const runtime = path.join(ROOT, "assets", "sounds", entry.category, `${entry.soundKey}.ogg`);
  if (!existsSync(staged)) throw new Error(`Missing staged output: ${staged}`);
  copyFileSync(staged, runtime);
});
rmSync(resolvedStaging, { recursive: true, force: true });
process.stdout.write(`Normalized and replaced ${plan.length} runtime OGG files.\n`);

function buildPlanEntry(row) {
  const profile = chooseProfile(row);
  const integratedLufs = numberOrNull(row.integratedLufs);
  const truePeakDbtp = numberOrNull(row.truePeakDbtp);
  if (truePeakDbtp == null) throw new Error(`Missing true-peak measurement for ${row.sourcePath}`);
  const requestedMode = profile.mode ?? (integratedLufs == null ? "peak" : "gain");
  const mode = requestedMode === "gain" && integratedLufs == null ? "peak" : requestedMode;
  let gainDb = null;
  if (mode === "peak") {
    gainDb = round(profile.targetPeakDbtp - truePeakDbtp, 2);
  } else if (mode === "gain") {
    const loudnessGain = profile.targetLufs - integratedLufs;
    const peakLimitedGain = profile.targetPeakDbtp - truePeakDbtp;
    gainDb = round(Math.min(loudnessGain, peakLimitedGain), 2);
  }
  return {
    soundKey: row.soundKey,
    category: row.category,
    sourcePath: row.sourcePath,
    sourceFormat: row.sourceFormat,
    durationSeconds: row.durationSeconds,
    inputLufs: integratedLufs,
    inputTruePeakDbtp: truePeakDbtp,
    profile: profile.name,
    mode,
    targetLufs: profile.targetLufs ?? null,
    targetPeakDbtp: profile.targetPeakDbtp,
    targetLraLu: profile.targetLraLu ?? null,
    gainDb,
  };
}

function chooseProfile(row) {
  const key = row.soundKey;
  const duration = Number(row.durationSeconds) || 0;
  const hasIntegrated = numberOrNull(row.integratedLufs) != null;
  const transient = !hasIntegrated || duration < 0.4;

  if (row.category === "narration") {
    return loudnessProfile("voice", -18, -2, 9);
  }
  if (/^Menu_Musical/i.test(key)) {
    return loudnessProfile("menu-music", -20, -2, 11);
  }
  if (row.category === "ambience") {
    return loudnessProfile("ambience", -25, -4, 12);
  }
  if (row.category === "player") {
    return loudnessProfile("player-loop", -24, -4, 11);
  }
  if (row.category === "machinery") {
    if (/Alarm|Demand/i.test(key)) {
      return transient
        ? peakProfile("alarm-transient", -6)
        : loudnessProfile("alarm", -18, -2, 8);
    }
    if (/Loop|Working|Buzz|Clock/i.test(key)) {
      if (/Lamp|Clock|ControlPostBuzz/i.test(key)) {
        return loudnessProfile("quiet-machine-bed", -28, -5, 12);
      }
      return loudnessProfile("machine-bed", -24, -4, 12);
    }
    return gainProfile("machine-one-shot", -20, -2);
  }
  if (row.category === "interaction") {
    return transient
      ? peakProfile("interaction-transient", -8)
      : gainProfile("interaction-one-shot", -20, -3);
  }
  if (row.category === "ui") {
    return transient
      ? peakProfile("ui-transient", -10)
      : gainProfile("ui-one-shot", -20, -4);
  }
  if (/Loop|Motor/i.test(key)) {
    return loudnessProfile("misc-bed", -25, -5, 12);
  }
  return transient
    ? peakProfile("misc-transient", -8)
    : gainProfile("misc-one-shot", -20, -3);
}

function buildTwoPassLoudnormFilter(source, entry) {
  const firstPass = run("ffmpeg", [
    "-hide_banner", "-nostats", "-i", source,
    "-af", `loudnorm=I=${entry.targetLufs}:TP=${entry.targetPeakDbtp}:LRA=${entry.targetLraLu}:print_format=json`,
    "-f", "null", "-",
  ]);
  const blocks = firstPass.stderr.match(/\{\s*"input_i"[\s\S]*?\}/g);
  if (!blocks?.length) throw new Error(`Unable to parse normalization pass for ${source}`);
  const measured = JSON.parse(blocks.at(-1));
  return [
    `loudnorm=I=${entry.targetLufs}`,
    `TP=${entry.targetPeakDbtp}`,
    `LRA=${entry.targetLraLu}`,
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    "linear=true",
    "print_format=summary",
  ].join(":");
}

function loudnessProfile(name, targetLufs, targetPeakDbtp, targetLraLu) {
  return { name, mode: "loudness", targetLufs, targetPeakDbtp, targetLraLu };
}

function gainProfile(name, targetLufs, targetPeakDbtp) {
  return { name, mode: "gain", targetLufs, targetPeakDbtp };
}

function peakProfile(name, targetPeakDbtp) {
  return { name, mode: "peak", targetPeakDbtp };
}

function printPlanSummary(items) {
  const groups = new Map();
  items.forEach((item) => groups.set(item.profile, (groups.get(item.profile) ?? 0) + 1));
  process.stdout.write(`Normalization plan: ${items.length} files.\n`);
  [...groups].sort(([a], [b]) => a.localeCompare(b)).forEach(([name, count]) => {
    process.stdout.write(`  ${name}: ${count}\n`);
  });
  const gains = items.map((item) => item.gainDb).filter(Number.isFinite);
  if (gains.length) {
    process.stdout.write(`Static gain range: ${Math.min(...gains).toFixed(2)} to ${Math.max(...gains).toFixed(2)} dB.\n`);
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})\n${result.stderr}`);
  return result;
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits) {
  return Number(value.toFixed(digits));
}

function toCsv(items) {
  const headers = Object.keys(items[0]);
  return `${[
    headers.join(","),
    ...items.map((item) => headers.map((header) => csvCell(item[header])).join(",")),
  ].join("\n")}\n`;
}

function csvCell(value) {
  if (value == null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
