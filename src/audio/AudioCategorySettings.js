export const AUDIO_CATEGORY_SETTINGS = Object.freeze([
  { group: "music", key: "musicVolume" },
  { group: "ambience", key: "ambienceVolume" },
  { group: "interaction", key: "interactionVolume" },
  { group: "machinery", key: "machineryVolume" },
  { group: "narration", key: "speechVolume" },
  { group: "alarms", key: "alarmsVolume" },
  { group: "player", key: "playerVolume" },
  { group: "ui", key: "uiVolume" },
].map((category) => Object.freeze(category)));
