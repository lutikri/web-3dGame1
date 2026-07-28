const DEFAULT_COMMON_MUSIC = [
  "Menu_Musical1",
  "Menu_Musical2",
  "Menu_Musical4",
  "Menu_Musical5",
  "Menu_Musical6",
];

export function chooseMenuMusic({
  commonMusicKeys = DEFAULT_COMMON_MUSIC,
  rareMusicKey = "Menu_Musical3_rare",
  rareChance = 1 / 20,
  previousKey = null,
  random = Math.random,
} = {}) {
  if (rareMusicKey && random() < rareChance) return rareMusicKey;
  const withoutPrevious = commonMusicKeys.filter((key) => key !== previousKey);
  const choices = withoutPrevious.length ? withoutPrevious : commonMusicKeys;
  if (!choices.length) return null;
  return choices[Math.floor(random() * choices.length)] ?? choices[0];
}

export class MenuAudioRuntime {
  constructor({
    audio,
    ambienceKey = "Menu_Ambience1",
    commonMusicKeys = DEFAULT_COMMON_MUSIC,
    rareMusicKey = "Menu_Musical3_rare",
    rareChance = 1 / 20,
    random = Math.random,
  }) {
    Object.assign(this, {
      audio,
      ambienceKey,
      commonMusicKeys,
      rareMusicKey,
      rareChance,
      random,
    });
    this.active = false;
    this.musicKey = null;
    this.previousMusicKey = null;
  }

  setActive = (active) => {
    const nextActive = Boolean(active);
    if (nextActive === this.active) return this.musicKey;
    this.active = nextActive;
    if (!nextActive) {
      this.audio.setLoop(this.ambienceKey, false);
      if (this.musicKey) this.audio.setLoop(this.musicKey, false);
      this.previousMusicKey = this.musicKey;
      this.musicKey = null;
      return null;
    }

    this.musicKey = chooseMenuMusic({
      commonMusicKeys: this.commonMusicKeys,
      rareMusicKey: this.rareMusicKey,
      rareChance: this.rareChance,
      previousKey: this.previousMusicKey,
      random: this.random,
    });
    this.audio.setLoop(this.ambienceKey, true);
    if (this.musicKey) this.audio.setLoop(this.musicKey, true);
    return this.musicKey;
  };

  snapshot = () => ({
    active: this.active,
    ambienceKey: this.ambienceKey,
    musicKey: this.musicKey,
  });
}
