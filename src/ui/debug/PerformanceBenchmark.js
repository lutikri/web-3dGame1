import { getGraphicsQualityProfile } from "../../config/GraphicsQualityProfiles.js?v=passive-flashlight-prefab";

const EFFECT_KEYS = [
  "bloom",
  "lut",
  "colorAdjustments",
  "sharpen",
  "lensEffects",
  "lensDistortion",
  "chromaticAberration",
];

export function createPerformanceBenchmark({
  config,
  renderer,
  getComposerSamples,
  getQualityState,
  setQualityState,
  getInputLocked,
  setInputLocked,
  setShadowQuality,
  rebuildPostProcessing,
  resizeRendererTargets,
  getTextureLoadingState,
}) {
  const defaultPostProcessingConfig = structuredClone(config.postProcessing);
  let running = null;
  let lastReport = null;

  function run(options = {}) {
    if (running) return running;
    running = execute(options).finally(() => {
      running = null;
    });
    return running;
  }

  async function execute(options) {
    const benchmarkConfig = config.debug?.performanceBenchmark ?? {};
    const warmupMs = Math.max(0, Number(options.warmupSeconds ?? benchmarkConfig.warmupSeconds ?? 0.75) * 1000);
    const sampleMs = Math.max(500, Number(options.sampleSeconds ?? benchmarkConfig.sampleSeconds ?? 2) * 1000);
    const textureWaitTimeoutMs = Math.max(
      5000,
      Number(options.textureWaitTimeoutSeconds ?? benchmarkConfig.textureWaitTimeoutSeconds ?? 45) * 1000,
    );
    const postProcessingBackup = structuredClone(config.postProcessing);
    const pixelRatioBackup = renderer.getPixelRatio();
    const qualityBackup = getQualityState();
    const inputLockedBackup = getInputLocked();
    const results = [];
    const screenshots = [];
    const presets = createPresets(options.quick);

    setInputLocked(true);
    const loadingProfile = options.skipTextureWait
      ? { durationSeconds: 0, textureCount: 0, completedTextures: 0, worstFrameMs: 0, p95FrameMs: 0 }
      : await profileTextureStreaming(textureWaitTimeoutMs);
    console.info(
      `[OperatorGame benchmark] Textures settled after ${loadingProfile.durationSeconds}s; ` +
        `worst frame ${loadingProfile.worstFrameMs} ms, p95 ${loadingProfile.p95FrameMs} ms`,
    );
    console.info(`[OperatorGame benchmark] Starting ${presets.length} presets at ${window.innerWidth}x${window.innerHeight}`);

    try {
      for (const preset of presets) {
        applyPreset(preset, postProcessingBackup, qualityBackup);
        await wait(warmupMs);
        const sample = await measureFrames(sampleMs);
        const row = {
          preset: preset.name,
          avgFps: Number(sample.avgFps.toFixed(1)),
          avgFrameMs: Number(sample.avgFrameMs.toFixed(2)),
          p95FrameMs: Number(sample.p95FrameMs.toFixed(2)),
          dpr: renderer.getPixelRatio(),
          buffer: `${renderer.domElement.width}x${renderer.domElement.height}`,
          msaa: getComposerSamples(),
        };
        results.push(row);
        if (options.showReport !== false) screenshots.push({ name: preset.name, image: captureThumbnail() });
        console.info(`[OperatorGame benchmark] ${preset.name}: ${row.avgFps} FPS, ${row.avgFrameMs} ms/frame`);
      }
    } finally {
      restorePostProcessingConfig(postProcessingBackup);
      renderer.setPixelRatio(pixelRatioBackup);
      setQualityState(qualityBackup);
      setShadowQuality(qualityBackup.shadows);
      rebuildPostProcessing();
      resizeRendererTargets();
      setInputLocked(inputLockedBackup);
    }

    lastReport = {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      drawingBuffer: `${renderer.domElement.width}x${renderer.domElement.height}`,
      canvasAntialias: renderer.getContext().getContextAttributes()?.antialias ?? null,
      loadingProfile,
      results,
    };
    if (options.showReport !== false) showReport(lastReport, screenshots);
    console.table(results);
    console.info(`[OperatorGame benchmark result] ${JSON.stringify(lastReport)}`);
    return lastReport;
  }

  function createPresets(quick) {
    if (quick) {
      return ["low", "medium", "high"].map((profile) => {
        const quality = getGraphicsQualityProfile(profile);
        return {
          name: `PROFILE ${profile.toUpperCase()}`,
          post: true,
          dpr: quality.pixelRatio,
          msaa: 0,
          shadows: quality.shadowQuality,
          gtao: quality.gtaoQuality,
          effects: quality.effects,
        };
      });
    }
    return [
      { name: "RAW DPR 0.50", post: false, dpr: 0.5 },
      { name: "RAW DPR 0.75", post: false, dpr: 0.75 },
      { name: "RAW DPR 1.00", post: false, dpr: 1 },
      { name: "COMPOSER MSAA 0", post: true, dpr: 1, msaa: 0 },
      { name: "COMPOSER MSAA 4", post: true, dpr: 1, msaa: 4 },
      { name: "BLOOM", post: true, dpr: 1, effects: ["bloom"] },
      { name: "BLOOM + LENS FX", post: true, dpr: 1, effects: ["bloom", "lensEffects"] },
      { name: "LUT", post: true, dpr: 1, effects: ["lut"] },
      { name: "COLOR + VIGNETTE", post: true, dpr: 1, effects: ["colorAdjustments"] },
      { name: "SHARPEN", post: true, dpr: 1, effects: ["sharpen"] },
      { name: "CHROMATIC", post: true, dpr: 1, effects: ["chromaticAberration"] },
      { name: "SHADOWS 512", post: false, dpr: 1, shadows: "min" },
      { name: "SHADOWS 2K", post: false, dpr: 1, shadows: "max" },
      { name: "GTAO MIN", post: true, dpr: 1, gtao: "min" },
      { name: "FULL DPR 0.50 / MSAA 0", restore: true, dpr: 0.5, msaa: 0 },
      { name: "FULL DPR 0.75 / MSAA 0", restore: true, dpr: 0.75, msaa: 0 },
      { name: "FULL DPR 1.00 / MSAA 0", restore: true, dpr: 1, msaa: 0 },
      { name: "FULL DPR 1.00 / MSAA 4", restore: true, dpr: 1, msaa: 4 },
    ];
  }

  function applyPreset(preset, postProcessingBackup, qualityBackup) {
    restorePostProcessingConfig(preset.restore ? postProcessingBackup : defaultPostProcessingConfig);
    config.postProcessing.enabled = Boolean(preset.post || preset.restore);
    for (const key of EFFECT_KEYS) {
      if (config.postProcessing[key] && !preset.restore) {
        config.postProcessing[key].enabled = preset.effects?.includes(key) ?? false;
      }
    }
    config.postProcessing.antiAliasing.method = "off";
    config.postProcessing.antiAliasing.msaaSamples = preset.msaa ?? 0;
    setQualityState({
      shadows: preset.restore ? qualityBackup.shadows : preset.shadows ?? "off",
      gtao: preset.restore ? qualityBackup.gtao : preset.gtao ?? "off",
      ssgi: preset.restore ? qualityBackup.ssgi : "off",
      ssr: preset.restore ? qualityBackup.ssr : "off",
      screenSpaceShadows: preset.restore ? qualityBackup.screenSpaceShadows : "off",
    });
    renderer.setPixelRatio(preset.dpr ?? 1);
    setShadowQuality(preset.restore ? qualityBackup.shadows : preset.shadows ?? "off");
    rebuildPostProcessing();
    resizeRendererTargets();
  }

  async function profileTextureStreaming(timeoutMs) {
    const frameTimes = [];
    const startedAt = performance.now();
    let previousFrame = startedAt;
    let lastSignature = "";
    let lastChangeAt = startedAt;
    const earliestSettleAt =
      startedAt + (Number(config.textureStreaming?.fullLoadDelaySeconds ?? 4) + 3.5) * 1000;

    while (performance.now() - startedAt < timeoutMs) {
      await nextFrame((time) => {
        frameTimes.push(time - previousFrame);
        previousFrame = time;
      });
      const loading = getTextureLoadingState();
      const signature = `${loading.total}:${loading.completed}:${loading.active}`;
      if (signature !== lastSignature) {
        lastSignature = signature;
        lastChangeAt = performance.now();
      }
      const quiet = performance.now() - lastChangeAt >= 2500;
      const finished = loading.active === 0 && loading.completed === loading.total;
      if (performance.now() >= earliestSettleAt && quiet && finished) break;
    }
    const loading = getTextureLoadingState();
    const sorted = [...frameTimes].sort((a, b) => a - b);
    return {
      durationSeconds: Number(((performance.now() - startedAt) / 1000).toFixed(2)),
      textureCount: loading.total,
      completedTextures: loading.completed,
      worstFrameMs: Number((sorted.at(-1) ?? 0).toFixed(2)),
      p95FrameMs: Number((sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] ?? 0).toFixed(2)),
    };
  }

  function restorePostProcessingConfig(source) {
    Object.keys(config.postProcessing).forEach((key) => delete config.postProcessing[key]);
    Object.assign(config.postProcessing, structuredClone(source));
  }

  function captureThumbnail() {
    const source = renderer.domElement;
    const width = Math.min(720, source.width);
    const height = Math.max(1, Math.round((source.height / Math.max(1, source.width)) * width));
    const thumbnail = document.createElement("canvas");
    thumbnail.width = width;
    thumbnail.height = height;
    thumbnail.getContext("2d").drawImage(source, 0, 0, width, height);
    return thumbnail.toDataURL("image/jpeg", 0.82);
  }

  return { run, getLastReport: () => lastReport };
}

export function measureBenchmarkFrames(durationMs, requestFrame = requestAnimationFrame) {
  return new Promise((resolve) => {
    const frameTimes = [];
    let startTime = 0;
    let previousTime = 0;
    function sampleFrame(time) {
      if (!startTime) {
        startTime = time;
        previousTime = time;
      } else {
        frameTimes.push(time - previousTime);
        previousTime = time;
      }
      if (time - startTime < durationMs) return requestFrame(sampleFrame);
      const elapsedSeconds = Math.max(0.001, (time - startTime) / 1000);
      const sorted = [...frameTimes].sort((a, b) => a - b);
      const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
      resolve({
        avgFps: frameTimes.length / elapsedSeconds,
        avgFrameMs: frameTimes.length ? frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length : 0,
        p95FrameMs: sorted[Math.max(0, p95Index)] ?? 0,
      });
    }
    requestFrame(sampleFrame);
  });
}

function showReport(report, screenshots) {
  document.querySelector("#performanceBenchmarkReport")?.remove();
  const overlay = document.createElement("section");
  overlay.id = "performanceBenchmarkReport";
  overlay.style.cssText = "position:fixed;inset:0;z-index:100000;overflow:auto;background:#07100df2;color:#d7eadf;font:13px/1.4 ui-monospace,monospace;padding:24px;";
  const title = document.createElement("h2");
  title.textContent = `GPU BENCHMARK · ${report.viewport} · canvas AA ${report.canvasAntialias ? "ON" : "OFF"}`;
  const loading = document.createElement("p");
  loading.textContent = `Texture streaming: ${report.loadingProfile.durationSeconds}s, ${report.loadingProfile.completedTextures}/${report.loadingProfile.textureCount} textures, worst frame ${report.loadingProfile.worstFrameMs}ms`;
  const table = document.createElement("table");
  table.style.cssText = "border-collapse:collapse;width:100%;margin-bottom:20px";
  table.innerHTML = "<thead><tr><th>Preset</th><th>FPS</th><th>Avg ms</th><th>P95 ms</th><th>DPR</th><th>Buffer</th><th>MSAA</th></tr></thead>";
  const body = document.createElement("tbody");
  report.results.forEach((row) => {
    const tr = document.createElement("tr");
    [row.preset, row.avgFps, row.avgFrameMs, row.p95FrameMs, row.dpr, row.buffer, row.msaa].forEach((value) => {
      const td = document.createElement("td");
      td.textContent = String(value);
      td.style.cssText = "border:1px solid #365044;padding:5px 8px";
      tr.append(td);
    });
    body.append(tr);
  });
  table.append(body);
  const gallery = document.createElement("div");
  gallery.style.cssText = "display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px";
  screenshots.forEach(({ name, image }) => {
    const card = document.createElement("a");
    card.href = image;
    card.download = `${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.jpg`;
    card.style.cssText = "color:inherit;text-decoration:none;border:1px solid #365044;padding:8px";
    const label = document.createElement("div");
    label.textContent = name;
    const img = document.createElement("img");
    img.src = image;
    img.alt = `${name} benchmark screenshot`;
    img.style.cssText = "display:block;width:100%;margin-top:6px";
    card.append(label, img);
    gallery.append(card);
  });
  overlay.append(title, loading, table, gallery);
  document.body.append(overlay);
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function nextFrame(callback) {
  return new Promise((resolve) => requestAnimationFrame((time) => {
    callback(time);
    resolve();
  }));
}

function measureFrames(durationMs) {
  return measureBenchmarkFrames(durationMs);
}
