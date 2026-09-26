# Audio subsystem

Runtime audio code lives here.

```text
AudioRuntime.js    WebAudio playback, loops, attached one-shots, ambience volumes
SoundRegistry.js   All playable sound keys and groups
```

Runtime sound files live under:

```text
assets/sounds/ambience/
assets/sounds/interaction/
assets/sounds/machinery/
assets/sounds/narration/
assets/sounds/player/
assets/sounds/ui/
```

Canonical source files live in the ignored
`source-assets/audio/runtime-sources/<category>/` mirror. Most are WAV; entries
marked `lossy-source-only` in its manifest are preserved MP3 originals.

Audit and conversion commands:

```text
npm run audio:audit
npm run audio:normalize
npm run audio:audit:runtime
```

Normalization is role-aware: narration, menu music, ambience, machinery beds,
alarms, interactions, and short UI transients use separate loudness or peak
targets. Runtime `volume`, distance attenuation, and mix settings remain in
`SoundRegistry.js` and are intentionally not baked into source files.

The Debug Workspace `AUDIO` page shows active voices and sounds played during
the last eight seconds. Use `EDIT` or the registry search to pin a sound before
tuning it. Per-sound `volume` is a global trim, including loops whose gameplay
volume changes dynamically. `SAVE CONFIGS TO PROJECT` writes audio tuning to
`src/generated/AudioOverrides.js` through the local development server.

Naming conventions:

```text
Ambience_*      -> ambience
Button*, Door*  -> interaction
FusionCore_*    -> machinery
Lamp*, Panel1_* -> machinery
Message*, Radio*-> narration
Footsteps*      -> player
UI_*            -> ui
```

Blender sound-volume markers:

```text
SNDVOL_<soundKey>_<instanceName>
```

Prefab-attached sounds should be configured by prefab behavior/runtime code, not by ad-hoc scene scripts.
