# Levels

- Register each level once in `LevelRegistry.js`; metadata and runtime environment derive from the same definition.
- A level config contains environment layout, player spawn, ambient/world tuning, panel placement, behavior bindings, and named prefab instances.
- Reused environments use `environmentId` aliases rather than duplicate loading.
- Prefab arrays merge by stable `name`; schema versions fail loudly when unsupported.
- Environment-specific embedded behavior belongs under `environment.behaviors`; reusable objects belong to the prefab system.
- Level changes must preserve exclusive loading and must not create foreign runtime ownership.
