const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");
const { resolveConfigSaveTarget } = require("./scripts/config-save-target.cjs");

const root = __dirname;
const port = Number(process.env.PORT ?? 5173);
const host = process.env.HOST ?? "0.0.0.0";
const clients = new Set();
const watchedDirs = ["src", "styles", "assets"];
const watchedFiles = ["index.html", "README.md", "AGENTS.md"];
const ignoredWatchPaths = [path.resolve(root, "3dGameAssetsDev")];
const watchedFileStates = new Map();
const configSaveTargets = {
  postProcessing: {
    filePath: path.join(root, "src", "generated", "PostProcessingOverrides.js"),
    exportName: "POST_PROCESSING_OVERRIDES",
  },
  globalScene: {
    filePath: path.join(root, "src", "generated", "GlobalSceneOverrides.js"),
    exportName: "GLOBAL_SCENE_OVERRIDES",
  },
};
const liveReloadScript = `
<script>
(() => {
  const events = new EventSource("/__live-reload");
  events.addEventListener("reload", () => location.reload());
  events.onerror = () => console.warn("[dev-server] live reload disconnected");
})();
</script>`;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".wasm": "application/wasm",
};

function sendReload(changedPath) {
  const relativePath = path.relative(root, changedPath);
  console.log(`[dev-server] reload: ${relativePath}`);
  for (const response of clients) {
    response.write(`event: reload\ndata: ${JSON.stringify(relativePath)}\n\n`);
  }
}

function isIgnoredWatchPath(targetPath) {
  const resolvedPath = path.resolve(targetPath);
  return ignoredWatchPaths.some(
    (ignoredPath) => resolvedPath === ignoredPath || resolvedPath.startsWith(`${ignoredPath}${path.sep}`),
  );
}

function seedWatchState(targetPath) {
  if (isIgnoredWatchPath(targetPath) || !fs.existsSync(targetPath)) return;
  const stats = fs.statSync(targetPath);
  if (stats.isDirectory()) {
    fs.readdirSync(targetPath, { withFileTypes: true }).forEach((entry) => {
      seedWatchState(path.join(targetPath, entry.name));
    });
    return;
  }
  watchedFileStates.set(targetPath, `${stats.mtimeMs}:${stats.size}`);
}

function watchPath(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target) || isIgnoredWatchPath(target)) return;
  seedWatchState(target);

  let timer = null;
  fs.watch(target, { recursive: true }, (_eventType, filename) => {
    const changedPath = filename ? path.join(target, filename) : target;
    if (isIgnoredWatchPath(changedPath)) return;

    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.stat(changedPath, (error, stats) => {
        const nextState = error ? "missing" : `${stats.mtimeMs}:${stats.size}`;
        const previousState = watchedFileStates.get(changedPath);
        watchedFileStates.set(changedPath, nextState);
        if (previousState === nextState) return;
        sendReload(changedPath);
      });
    }, 100);
  });
}

function getRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const decodedPath = decodeURIComponent(url.pathname);
  const cleanPath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const resolvedPath = path.resolve(root, cleanPath);

  if (!resolvedPath.startsWith(root)) {
    return null;
  }

  return resolvedPath;
}

function serveFile(request, response) {
  const filePath = getRequestPath(request.url);
  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.setHeader("Content-Type", mimeTypes[extension] ?? "application/octet-stream");
    response.setHeader("Cache-Control", "no-store");

    if (extension === ".html") {
      const html = data.toString("utf8").replace("</body>", `${liveReloadScript}\n</body>`);
      response.end(html);
      return;
    }

    response.end(data);
  });
}

function saveConfig(request, response) {
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 2_000_000) request.destroy();
  });
  request.on("end", () => {
    try {
      const { kind, config } = JSON.parse(body);
      if (kind === "allConfigs" && config && typeof config === "object" && !Array.isArray(config)) {
        const savedPaths = [];
        for (const [configKind, configValue] of Object.entries(config)) {
          const batchTarget = resolveConfigSaveTarget(root, configKind, configSaveTargets);
          if (!batchTarget || !configValue || typeof configValue !== "object" || Array.isArray(configValue)) continue;
          const source =
            `// Generated by the local debug panel. Safe to commit.\n` +
            `export const ${batchTarget.exportName} = ${JSON.stringify(configValue, null, 2)};\n`;
          fs.mkdirSync(path.dirname(batchTarget.filePath), { recursive: true });
          fs.writeFileSync(batchTarget.filePath, source, "utf8");
          savedPaths.push(path.relative(root, batchTarget.filePath));
        }
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: savedPaths.length > 0, paths: savedPaths }));
        return;
      }
      const target = resolveConfigSaveTarget(root, kind, configSaveTargets);
      if (!target || !config || typeof config !== "object" || Array.isArray(config)) {
        response.writeHead(400, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ ok: false, error: "Invalid config save request" }));
        return;
      }

      const source =
        `// Generated by the local debug panel. Safe to commit.\n` +
        `export const ${target.exportName} = ${JSON.stringify(config, null, 2)};\n`;
      fs.mkdirSync(path.dirname(target.filePath), { recursive: true });
      fs.writeFileSync(target.filePath, source, "utf8");
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, path: path.relative(root, target.filePath) }));
    } catch (error) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: false, error: error.message }));
    }
  });
}

const server = http.createServer((request, response) => {
  if (request.url === "/__live-reload") {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    response.write("\n");
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }

  if (request.url === "/__save-config" && request.method === "POST") {
    saveConfig(request, response);
    return;
  }

  serveFile(request, response);
});

for (const relativePath of [...watchedDirs, ...watchedFiles]) {
  watchPath(relativePath);
}

server.listen(port, host, () => {
  console.log(`[dev-server] http://localhost:${port}/`);
  if (host === "0.0.0.0") console.log(`[dev-server] network: http://<your-lan-ip>:${port}/`);
  console.log("[dev-server] live reload watching src/, styles/, assets/, index.html, README.md, AGENTS.md");
});
