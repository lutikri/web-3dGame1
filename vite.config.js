import { cpSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const deploymentBase = process.env.DEPLOY_BASE_PATH || "/";

export default defineConfig(({ mode }) => {
  const target = mode === "game" || mode === "landing" ? mode : "combined";
  const inputs = target === "game"
    ? { game: resolve("index.html") }
    : target === "landing"
      ? { landing: resolve("landing.html") }
      : {
          game: resolve("index.html"),
          landing: resolve("landing.html"),
        };

  return {
    base: deploymentBase,
    publicDir: false,
    build: {
      outDir: target === "combined" ? "dist" : `dist-${target}`,
      sourcemap: false,
      rolldownOptions: {
        input: inputs,
      },
    },
    plugins: [operatorGameStaticBuild(target)],
  };
});

function operatorGameStaticBuild(target) {
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
        const bundledHtml = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, "");
        return target === "landing"
          ? bundledHtml.replaceAll('href="./index.html"', 'href="https://play.baseloadgame.com/"')
          : bundledHtml;
      },
    },
    writeBundle() {
      mkdirSync(outputDirectory, { recursive: true });
      const assetSource = target === "landing"
        ? resolve(projectRoot, "assets", "landing")
        : resolve(projectRoot, "assets");
      const assetDestination = target === "landing"
        ? resolve(outputDirectory, "assets", "landing")
        : resolve(outputDirectory, "assets");
      cpSync(assetSource, assetDestination, {
        recursive: true,
      });
      if (target === "landing") {
        renameSync(
          resolve(outputDirectory, "landing.html"),
          resolve(outputDirectory, "index.html"),
        );
      }
      writeFileSync(resolve(outputDirectory, ".nojekyll"), "", "utf8");
    },
  };
}
