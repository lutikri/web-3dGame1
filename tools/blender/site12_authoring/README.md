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
- **Make RB** turns the active level mesh and its existing collider children into a unique `RB_<stableId>` level rigid body. It keeps the mesh in the level GLB; no prefab asset or collection instance is created. The selected RB root, its visual mesh, or its collider exposes the physics tags in the same panel.
- **Duplicate RB** makes a second placed RB hierarchy with a new stable ID. Its visual and collider mesh data remain linked to the source, while its transform and physics tags are independent.
- **Migrate Legacy Prefabs** replaces the old `PF_` marker + hidden `SceneBuild_Inst` preview pairs with one visible authoritative collection instance. Unsupported markers remain untouched and are reported.
- **Repair Prefab Names** makes the selected level's prefab IDs GLB-safe (`.001` becomes `_001`) and synchronizes stale marker metadata after artist renames.
- **Register as Prefab** registers a selected collection instance and its source definition. The dialog infers the prefab type, lets you choose a stable instance ID and GLB filename, and preserves placement, source mesh names, hierarchy, materials, and collection offset. The source definition becomes part of `TGLOBAL_PREFABS`. Use this for new collection instances such as `PF_LightPanel1`.
- **Adopt Legacy Instance** migrates a selected legacy collection instance plus its selected/nearby `PF_` Empty. The instance becomes authoritative and the old marker is archived outside level export.
- **Edit Prefab Source** switches from a selected level instance to its real meshes in the `TGLOBAL_PREFABS` scene. **Return to Level** selects the originating instance again.
- **Validate Site-12 Scene** reports malformed instances, duplicate IDs, missing colliders, and incomplete `RB_` roots.
- **Export Active Prefab GLB** exports the selected collection instance's definition.
- **Validate + Export Level GLB** exports static level content plus temporary prefab Empty markers.

The exporter uses GLB, Y-up, Draco mesh compression and custom-property extras. Prefabs keep lightweight placeholder material slots because runtime materials own their textures; cameras, lights, and animations are disabled.

The `.blend` collection is the editable source. Files under `assets/mesh/prefabs/` are runtime build outputs. Level export and prefab export are intentionally separate: level export writes static level geometry, `RB_` bodies, and temporary `PF_` markers, while **Export Active Prefab GLB** writes the selected prefab definition.

## Registering a new collection prefab

1. Select the collection instance in the level and press **Register as Prefab** in the `TGLOBAL` sidebar.
2. For the light controller, use Type `LightPanel1`, an Instance ID such as `Main`, and Asset Filename `PF_LightPanel1.glb`.
3. Press **Export Active Prefab GLB** to write the meshes to the configured Prefab Output folder. Registration's asset filename is used exactly.
4. Press **Validate + Export Level GLB** to write the `PF_LightPanel1_Main` placement Empty. Source meshes are excluded from the level GLB; collection offsets are included in the marker transform.

Level export blocks unregistered collection instances instead of silently omitting them. Registration configures Blender authoring metadata; the game's `PrefabRegistry.js` must also define the type and runtime behavior. `LightPanel1` is already defined there.

After updating the add-on files, use Blender's **Reload Scripts**, or save your work and restart Blender, to load the new action.

## Unique level rigid bodies

Use this for one-off pipes, crates, loose equipment, and other authored level props — not for reusable assets such as lamps or chairs.

1. Select the visible mesh and create/author a child `UBX_` collider.
2. Press **Make RB** and give it a stable ID.
3. Tune the RB root tags: mass, push/drag/carry, persistence, friction, damping, scripted start lock, and optional beat tag.
4. To scatter the same authored prop, select any part of its RB hierarchy and press **Duplicate RB**. Give the copy its own stable ID and place the new root; editing its mesh in Edit Mode updates every linked copy, while RB settings remain per-instance.

The add-on preserves the source mesh name. The stable exported root is `RB_<stableId>` and colliders are normalized to `UBX_<stableId>_<index>`.
