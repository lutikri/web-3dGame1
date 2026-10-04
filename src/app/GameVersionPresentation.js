import { GAME_VERSION_LABEL } from "../config/GameVersion.js?v=compact-loading-game";

export function applyGameVersion(root = document) {
  for (const label of root.querySelectorAll("[data-game-version]")) {
    label.textContent = GAME_VERSION_LABEL;
  }
}
