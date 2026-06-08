const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");

const root = __dirname;
const port = Number(process.env.PORT ?? 5173);
const clients = new Set();
const watchedDirs = ["src", "styles", "assets"];
const watchedFiles = ["index.html", "README.md", "AGENTS.md"];
const ignoredWatchPaths = [path.resolve(root, "3dGameAssetsDev")];
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

function sendReload() {
  for (const response of clients) {
    response.write("event: reload\ndata: now\n\n");
  }
}

function isIgnoredWatchPath(targetPath) {
  const resolvedPath = path.resolve(targetPath);
  return ignoredWatchPaths.some(
    (ignoredPath) => resolvedPath === ignoredPath || resolvedPath.startsWith(`${ignoredPath}${path.sep}`),
  );
}

function watchPath(relativePath) {
  const target = path.join(root, relativePath);
  if (!fs.existsSync(target) || isIgnoredWatchPath(target)) return;

  let timer = null;
  fs.watch(target, { recursive: true }, (_eventType, filename) => {
    if (filename && isIgnoredWatchPath(path.join(target, filename))) return;

    clearTimeout(timer);
    timer = setTimeout(sendReload, 80);
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

  serveFile(request, response);
});

for (const relativePath of [...watchedDirs, ...watchedFiles]) {
  watchPath(relativePath);
}

server.listen(port, () => {
  console.log(`[dev-server] http://localhost:${port}/`);
  console.log("[dev-server] live reload watching src/, styles/, assets/, index.html, README.md, AGENTS.md");
});
