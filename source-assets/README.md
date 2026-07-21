# source-assets

Ignored editable source assets and tool exports.

Runtime code must not load files from this directory. Anything used by the browser belongs under `assets/` after export/compression.

## Layout

```text
audio/                         WAV exports and imported original audio
audio/imported-mp3/            old/original MP3 references, not runtime files
textures/                      exported PNG texture sets for runtime compression
substance/current/             active Substance Painter projects
substance/legacy/              older Substance Painter projects kept for reference
scenes/blender/                Blender source scenes
models/fbx/                    FBX source mesh exports
models/assbin/                 bake/import intermediates
bakes/marmoset/                Marmoset bake scenes and outputs
source-art/                    PSD, source UI art, source images
reference/showcase/            original showcase screenshots
reference/downloaded-models/   downloaded/reference model experiments
```

## Export flow

```text
source-assets/audio/*.wav       -> convert-runtime-audio.bat -> assets/sounds/<category>/*.ogg
source-assets/textures/T_*.png  -> generate-runtime-textures.bat -> assets/runtime-textures/*.ktx2
source-assets/scenes/blender/   -> manual GLB export -> assets/mesh/<category>/
```

## Cleanup rule

Do not keep generated backups in this tree:

```text
*_autosave_*.spp
*.blend1
*.blend2
*.tmp
*.bak
```

If a file is worth keeping, rename it as an intentional source file instead of relying on an autosave suffix.
