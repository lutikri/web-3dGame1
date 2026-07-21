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

Source WAV files live in `source-assets/audio/` and are converted with:

```bat
convert-runtime-audio.bat
```

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
