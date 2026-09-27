import os
import sys
import tempfile
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
ADDON_PARENT = PROJECT_ROOT / "tools" / "blender"
if str(ADDON_PARENT) not in sys.path:
    sys.path.insert(0, str(ADDON_PARENT))

import site12_authoring


def assert_true(value, message):
    if not value:
        raise AssertionError(message)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    site12_authoring.register()
    scene = bpy.context.scene
    collections = site12_authoring.setup_scene_collections(scene, reparent_legacy=True)
    assert_true(collections["root"].name == site12_authoring.ROOT_COLLECTION, "missing authoring root")

    mesh = bpy.data.meshes.new("SM_TestPipe")
    mesh.from_pydata(
        [(-1, -0.2, -0.2), (1, -0.2, -0.2), (1, 0.2, -0.2), (-1, 0.2, -0.2),
         (-1, -0.2, 0.2), (1, -0.2, 0.2), (1, 0.2, 0.2), (-1, 0.2, 0.2)],
        [],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)],
    )
    mesh.update()
    obj = bpy.data.objects.new("SM_TestPipe", mesh)
    collections["level_export"].objects.link(obj)
    obj.location = (2.0, 3.0, 4.0)

    collider = site12_authoring.create_box_collider_for_object(obj, scene)
    assert_true(collider.parent == obj, "collider is not parented")
    assert_true(collider.name.startswith("UBX_SM_TestPipe"), "collider name is invalid")

    rigid_mesh = bpy.data.meshes.new("SM_TestCrate")
    rigid_mesh.from_pydata(
        [(-0.5, -0.5, -0.5), (0.5, -0.5, -0.5), (0.5, 0.5, -0.5), (-0.5, 0.5, -0.5),
         (-0.5, -0.5, 0.5), (0.5, -0.5, 0.5), (0.5, 0.5, 0.5), (-0.5, 0.5, 0.5)],
        [],
        [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (4, 0, 3, 7)],
    )
    rigid_mesh.update()
    rigid_visual = bpy.data.objects.new("SM_TestCrate", rigid_mesh)
    collections["level_export"].objects.link(rigid_visual)
    rigid_visual.location = (-3.0, 1.0, 2.0)
    site12_authoring.create_box_collider_for_object(rigid_visual, scene)
    rigid_root = site12_authoring.make_level_rigid_body(
        rigid_visual,
        rigid_id="TestCrate01",
        scene=scene,
        mass=12.5,
        draggable=True,
        persistent=True,
    )
    assert_true(rigid_root.name == "RB_TestCrate01", "level rigid root was not named")
    assert_true(rigid_visual.parent == rigid_root, "level rigid visual is not parented to RB root")
    assert_true(rigid_root.get("tg_kind") == "level_rigid_body", "level rigid metadata is missing")
    assert_true(rigid_root.get("tg_rigid_mass") == 12.5, "level rigid mass was not stored")
    assert_true(site12_authoring._level_rigid_root(rigid_visual) == rigid_root, "visual does not resolve its RB root")
    assert_true(site12_authoring._level_rigid_root(next(iter(rigid_visual.children))) == rigid_root, "collider does not resolve its RB root")

    rigid_copy = site12_authoring.duplicate_level_rigid_body(
        rigid_root,
        rigid_id="TestCrate02",
        offset=(1.5, 0.0, 0.0),
        scene=scene,
    )
    rigid_copy_visual = next(
        child for child in rigid_copy.children_recursive
        if child.type == "MESH" and child.get("tg_kind") != "collider"
    )
    rigid_copy_collider = next(iter(site12_authoring._collider_children(rigid_copy)))
    rigid_source_collider = next(iter(site12_authoring._collider_children(rigid_root)))
    assert_true(rigid_copy.name == "RB_TestCrate02", "duplicated RB root was not named")
    assert_true(rigid_copy.get("tg_rigid_id") == "TestCrate02", "duplicated RB ID was not stored")
    assert_true(rigid_copy_visual.data == rigid_visual.data, "duplicated RB visual data is not linked")
    assert_true(rigid_copy_collider.data == rigid_source_collider.data, "duplicated RB collider data is not linked")
    assert_true(round(rigid_copy.location.x - rigid_root.location.x, 3) == 1.5, "duplicated RB offset was not applied")

    instance, definition = site12_authoring.convert_object_to_rigid_prefab(
        obj,
        prefab_type="TestPipe1",
        instance_id="Smoke01",
        scene=scene,
        start_locked=True,
        beat_tag="smoke_test",
    )
    assert_true(instance.instance_collection == definition, "instance is not bound to definition")
    assert_true(tuple(round(value, 3) for value in instance.location) == (2.0, 3.0, 4.0), "placement changed")
    assert_true(any(child.name.startswith("UBX_") for child in definition.all_objects), "definition has no collider")
    resolved_instance, resolved_definition = site12_authoring.resolve_prefab_context(instance)
    assert_true(resolved_instance == instance and resolved_definition == definition, "instance context was not resolved")
    visual = next(obj for obj in definition.all_objects if obj.get("tg_kind") == "prefab_visual")
    resolved_instance, resolved_definition = site12_authoring.resolve_prefab_context(visual)
    assert_true(resolved_instance == instance and resolved_definition == definition, "source-part context was not resolved")

    errors, _warnings = site12_authoring.validate_scene(scene)
    assert_true(not errors, "validation failed: " + "; ".join(errors))

    level_output = os.path.join(tempfile.gettempdir(), "site12_authoring_level_rigid_smoke.glb")
    site12_authoring.export_level(scene, level_output)
    assert_true(os.path.isfile(level_output) and os.path.getsize(level_output) > 0, "level rigid export failed")

    legacy_definition = bpy.data.collections.new("SM_LegacyRadio")
    bpy.data.scenes[site12_authoring.PREFAB_LIBRARY_SCENE].collection.children.link(legacy_definition)
    legacy_instance = bpy.data.objects.new("SM_LegacyRadio.001", None)
    legacy_instance.instance_type = "COLLECTION"
    legacy_instance.instance_collection = legacy_definition
    collections["legacy"].objects.link(legacy_instance)
    legacy_instance.location = (5.0, 0.0, 0.0)
    legacy_marker = bpy.data.objects.new("PF_radio_SmokeRadio01", None)
    collections["level_export"].objects.link(legacy_marker)
    legacy_marker.location = legacy_instance.location
    adopted, archived = site12_authoring.migrate_legacy_prefab_instance(legacy_instance, marker=legacy_marker, scene=scene)
    assert_true(adopted.name == "PF_radio_SmokeRadio01", "legacy instance did not adopt the marker name")
    assert_true(archived.name == "LEGACY_PF_radio_SmokeRadio01", "legacy marker was not archived")
    assert_true({collection.name for collection in adopted.users_collection} == {collections["placement"].name}, "legacy instance remained in preview collections")

    legacy_chair_definition = bpy.data.collections.new("SM_Chair1")
    bpy.data.scenes[site12_authoring.PREFAB_LIBRARY_SCENE].collection.children.link(legacy_chair_definition)
    legacy_chair_visual = bpy.data.objects.new("SM_Chair1", bpy.data.meshes.new("SM_Chair1"))
    legacy_chair_definition.objects.link(legacy_chair_visual)
    legacy_chair_preview = bpy.data.objects.new("SM_Chair1.001", None)
    legacy_chair_preview.instance_type = "COLLECTION"
    legacy_chair_preview.instance_collection = legacy_chair_definition
    collections["legacy"].objects.link(legacy_chair_preview)
    legacy_chair_marker = bpy.data.objects.new("PF_Chair1_TestChair", None)
    collections["level_export"].objects.link(legacy_chair_marker)
    legacy_chair_marker.location = (7.0, 8.0, 9.0)
    migrated, skipped = site12_authoring.migrate_legacy_prefabs(scene)
    migrated_chair = bpy.data.objects.get("PF_Chair1_TestChair")
    assert_true(not skipped, "known legacy prefab migration was skipped")
    assert_true(migrated_chair in migrated, "legacy prefab was not migrated")
    assert_true(migrated_chair.instance_collection == legacy_chair_definition, "legacy definition was not retained")
    assert_true(tuple(round(value, 3) for value in migrated_chair.location) == (7.0, 8.0, 9.0), "legacy marker transform changed")
    assert_true(migrated_chair.get("tg_marker_name") == "PF_Chair1_TestChair", "legacy marker name was not preserved")
    migrated_chair.name = "PF_Chair1_TestChair.001"
    migrated_chair["tg_marker_name"] = "PF_Chair1_TestChair"
    repaired, conflicts = site12_authoring.repair_prefab_instance_names(scene)
    assert_true(not conflicts, "GLB-safe prefab-name repair reported a conflict")
    assert_true(("PF_Chair1_TestChair.001", "PF_Chair1_TestChair_001") in repaired, f"Blender numeric suffix was not repaired: {repaired}")
    assert_true(migrated_chair.name == "PF_Chair1_TestChair_001", "repaired prefab name is not GLB-safe")
    assert_true(migrated_chair.get("tg_marker_name") == migrated_chair.name, "marker metadata was not synchronized")

    bpy.ops.import_scene.gltf(filepath=level_output)
    exported_rigids = {
        candidate.get("tg_rigid_id"): candidate
        for candidate in bpy.data.objects
        if candidate.get("tg_rigid_id") in {"TestCrate01", "TestCrate02"}
    }
    assert_true(set(exported_rigids) == {"TestCrate01", "TestCrate02"}, "duplicated RB metadata was not exported")
    assert_true(exported_rigids["TestCrate01"].get("tg_rigid_persistent") is True, "level rigid persistence tag was not exported")
    assert_true("UBX_TestCrate02_01" in bpy.data.objects, "duplicated RB collider was not exported")

    output = os.path.join(tempfile.gettempdir(), "site12_authoring_smoke.glb")
    site12_authoring.export_prefab_definition(definition, output)
    assert_true(os.path.isfile(output) and os.path.getsize(output) > 0, "prefab export failed")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=output)
    imported_names = set(bpy.data.objects.keys())
    assert_true("SM_TestPipe1" in imported_names, "visual mesh name was not preserved")
    assert_true("UBX_SM_TestPipe1_01" in imported_names, "collider name was not preserved")
    assert_true(bpy.data.objects["SM_TestPipe1"].get("tg_kind") == "prefab_visual", "GLB extras were not preserved")
    print("[Site12AuthoringSmoke] PASS")


if __name__ == "__main__":
    main()
