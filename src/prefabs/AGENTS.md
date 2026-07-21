# Prefabs

- `PrefabRegistry.js` owns reusable asset, material, behavior, physics, interaction, light, and audio defaults.
- Level configs own stable instance names, transforms, startup state, and explicitly allowed overrides.
- Shared behavior belongs in `behaviors/`; levels may select and configure it but may not duplicate it.
- Blender markers use `PF_<prefabType>_<instanceName>` and must be Empty objects.
- Unknown types, malformed markers, and duplicate stable names are errors.
- Saved overrides must never replace registry-owned behavior, type, asset, material, physics algorithm, or interaction algorithm.
