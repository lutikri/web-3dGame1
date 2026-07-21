# Runtime Assets

- This directory contains browser-shipped assets only.
- Do not rename, move, delete, recompress, or regenerate assets unless the task explicitly requires it.
- GLB runtime paths are grouped under `mesh/environment/`, `mesh/panel/`, and `mesh/prefabs/`.
- Runtime audio is Ogg under `sounds/<category>/`; editable and imported source audio belongs under `source-assets/`.
- Before changing a path, search all registries, level configs, HTML, scripts, tests, and documentation that reference it.
- Asset migrations must be isolated from gameplay refactors and verified with path/registry checks.
