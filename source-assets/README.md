# source-assets

Ignored editable source assets and tool exports.

Runtime code must not load files from this directory. Anything used by the browser belongs under `assets/` after export/compression.

## Layout

```text
audio/                         WAV exports and imported original audio
audio/runtime-sources/         category-organized source mirror for every shipped runtime sound
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
source-assets/audio/runtime-sources/ -> npm run audio:normalize -> assets/sounds/<category>/*.ogg
source-assets/textures/T_*.png  -> tools/generate-runtime-textures.bat -> assets/runtime-textures/*.ktx2
source-assets/scenes/blender/   -> manual GLB export -> assets/mesh/<category>/
```

`audio/runtime-sources/manifest.csv` maps every runtime OGG to its canonical
source copy and records whether only a lossy source is currently available.
`npm run audio:audit` measures the canonical sources without modifying them.
`npm run audio:normalize` uses the checked-in category profiles, stages every
output, and replaces runtime OGG files only after all conversions succeed.

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
