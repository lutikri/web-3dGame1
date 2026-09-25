# TGLOBAL Site-12 Authoring

Blender add-on for the Site-12 level and prefab pipeline.

## Installation

The development install is a directory junction from Blender's user add-on directory to this folder. Enable **TGLOBAL Site-12 Authoring** in Blender Preferences, then open the `TGLOBAL` tab in the 3D View sidebar.

## Authoring model

- A placed prefab is one Blender collection instance with `tg_kind=prefab_instance`.
- Its collection stores the visual mesh, `UBX_`/`UCX_` colliders, sockets, and prefab metadata.
- Prefab definitions live in the separate `TGLOBAL_PREFABS` Blender Scene, so source geometry never appears at the level origin.
- Export builds temporary plain `PF_<type>_<instance>` Empty markers. No permanent marker/preview duplicate pair is required.
- Physics defaults remain owned by the game's `PrefabRegistry`. Blender stores only authoring metadata and intentional per-instance state.

## Main actions

- **Setup / Repair Scene Structure** creates the canonical collections and reparents known legacy roots without deleting objects.
- **Create Box Collider** creates a wireframe `UBX_` child and also links it into the central collider helper collection.
- **Show Colliders** toggles every recognized collider object, including prefab-library colliders, without changing export data.
- **Make Rigid Prefab** converts the active mesh and its collider children into a prefab definition and replaces the level mesh with one collection instance.
- **Migrate Legacy Prefabs** replaces the old `PF_` marker + hidden `SceneBuild_Inst` preview pairs with one visible authoritative collection instance. Unsupported markers remain untouched and are reported.
- **Repair Prefab Names** makes the selected level's prefab IDs GLB-safe (`.001` becomes `_001`) and synchronizes stale marker metadata after artist renames.
- **Adopt Legacy Instance** migrates a selected legacy collection instance plus its selected/nearby `PF_` Empty. The instance becomes authoritative and the old marker is archived outside level export.
- **Edit Prefab Source** switches from a selected level instance to its real meshes in the `TGLOBAL_PREFABS` scene. **Return to Level** selects the originating instance again.
- **Validate Site-12 Scene** reports malformed instances, duplicate IDs, missing colliders, and incomplete `RB_` roots.
- **Export Active Prefab GLB** exports the selected collection instance's definition.
- **Validate + Export Level GLB** exports static level content plus temporary prefab Empty markers.

The exporter uses GLB, Y-up, Draco mesh compression and custom-property extras. Prefabs keep lightweight placeholder material slots because runtime materials own their textures; cameras, lights, and animations are disabled.

The `.blend` collection is the editable source. Files under `assets/mesh/prefabs/` are runtime build outputs. Level export and prefab export are intentionally separate: level export writes static level geometry plus temporary `PF_` markers, while **Export Active Prefab GLB** writes the selected prefab definition.
