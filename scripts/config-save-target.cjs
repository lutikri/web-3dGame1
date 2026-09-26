const path = require("node:path");

function createConfigSaveTargets(root) {
  return {
    postProcessing: {
      filePath: path.join(root, "src", "generated", "PostProcessingOverrides.js"),
      exportName: "POST_PROCESSING_OVERRIDES",
    },
    globalScene: {
      filePath: path.join(root, "src", "generated", "GlobalSceneOverrides.js"),
      exportName: "GLOBAL_SCENE_OVERRIDES",
    },
    audio: {
      filePath: path.join(root, "src", "generated", "AudioOverrides.js"),
      exportName: "AUDIO_OVERRIDES",
    },
  };
}

function resolveConfigSaveTarget(root, kind, staticTargets) {
  if (staticTargets[kind]) return staticTargets[kind];
  if (!/^[a-z][A-Za-z0-9]*$/.test(kind)) return null;
  const words = kind.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" ");
  const pascal = words.map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join("");
  const snake = words.map((word) => word.toUpperCase()).join("_");
  return {
    filePath: path.join(root, "src", "generated", `Level${pascal}Overrides.js`),
    exportName: `LEVEL_${snake}_OVERRIDES`,
  };
}

module.exports = { createConfigSaveTargets, resolveConfigSaveTarget };
