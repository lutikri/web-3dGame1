import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  base: "/web-3dGame1/",
  publicDir: false,
  build: {
    outDir: "dist",
    sourcemap: true,
    rolldownOptions: {
      input: {
        game: resolve("index.html"),
        landing: resolve("landing.html"),
      },
    },
  },
  plugins: [operatorGameStaticBuild()],
});

function operatorGameStaticBuild() {
  let projectRoot = "";
  let outputDirectory = "";

  return {
    name: "operator-game-static-build",
    apply: "build",
    configResolved(config) {
      projectRoot = config.root;
      outputDirectory = resolve(projectRoot, config.build.outDir);
    },
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        return html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, "");
      },
    },
    writeBundle() {
      mkdirSync(outputDirectory, { recursive: true });
      cpSync(resolve(projectRoot, "assets"), resolve(outputDirectory, "assets"), {
        recursive: true,
      });
      writeFileSync(resolve(outputDirectory, ".nojekyll"), "", "utf8");
    },
  };
}
