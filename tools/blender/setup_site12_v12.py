import os
import sys
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ADDON_PARENT = PROJECT_ROOT / "tools" / "blender"
if str(ADDON_PARENT) not in sys.path:
    sys.path.insert(0, str(ADDON_PARENT))

import site12_authoring


def ensure_registered():
    if not hasattr(bpy.types.Scene, "site12_authoring"):
        site12_authoring.register()


def main():
    ensure_registered()
    scene = bpy.context.scene
    site12_authoring.setup_scene_collections(scene, reparent_legacy=True)

    target = bpy.data.objects.get("SM_Pipes1_1_Scare")
    existing = bpy.data.objects.get("PF_LoosePipe1_QualificationScare01")
    definition = None
    if target and not existing:
        instance, definition = site12_authoring.convert_object_to_rigid_prefab(
            target,
            prefab_type="LoosePipe1",
            instance_id="QualificationScare01",
            scene=scene,
            body_type="dynamic",
            start_locked=True,
            persistent=True,
            beat_tag="qualification_exit_scare",
            asset_path="assets/mesh/prefabs/SM_LoosePipe1.glb",
        )
        bpy.context.view_layer.objects.active = instance
    elif existing:
        definition = existing.instance_collection
        bpy.context.view_layer.objects.active = existing

    if definition:
        for obj in list(definition.all_objects):
            if obj.name.upper().startswith(("UBX_", "UCX_", "USP_", "UCP_")):
                for collection in list(obj.users_collection):
                    if collection != definition:
                        collection.objects.unlink(obj)
        output = PROJECT_ROOT / "assets" / "mesh" / "prefabs" / "SM_LoosePipe1.glb"
        site12_authoring.export_prefab_definition(definition, str(output))

    errors, warnings = site12_authoring.validate_scene(scene)
    print(f"[Site12Authoring] validation errors={len(errors)} warnings={len(warnings)}")
    for message in errors:
        print(f"[Site12Authoring][ERROR] {message}")
    for message in warnings:
        print(f"[Site12Authoring][WARN] {message}")

    scene.site12_authoring.level_output_path = str(PROJECT_ROOT / "assets" / "mesh" / "environment" / "SM_Interior2.glb")
    scene.site12_authoring.prefab_output_dir = str(PROJECT_ROOT / "assets" / "mesh" / "prefabs") + os.sep
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath)
    print(f"[Site12Authoring] saved {bpy.data.filepath}")


if __name__ == "__main__":
    main()
