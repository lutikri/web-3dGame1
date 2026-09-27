from __future__ import annotations


bl_info = {
    "name": "TGLOBAL Site-12 Authoring",
    "author": "TGLOBAL ST / Codex",
    "version": (0, 3, 1),
    "blender": (4, 3, 0),
    "location": "View3D > Sidebar > TGLOBAL",
    "description": "Site-12 level, prefab, collider, validation and GLB export tools",
    "category": "Object",
}

import os
import re
from pathlib import Path

import bpy
from bpy.props import BoolProperty, EnumProperty, PointerProperty, StringProperty
from bpy.types import Operator, Panel, PropertyGroup
from mathutils import Matrix


ROOT_COLLECTION = "TGLOBAL_SITE12"
LEVEL_EXPORT_COLLECTION = "00_LEVEL_EXPORT"
PREFAB_PLACEMENT_COLLECTION = "10_PREFAB_PLACEMENT"
COLLIDER_HELPER_COLLECTION = "20_COLLIDERS"
WORK_COLLECTION = "90_WORK"
LEGACY_WORK_COLLECTION = "LEGACY"
PREFAB_LIBRARY_COLLECTION = "TGLOBAL_PREFAB_LIBRARY"
PREFAB_LIBRARY_SCENE = "TGLOBAL_PREFABS"
TEMP_MARKER_COLLECTION = "_TGLOBAL_EXPORT_MARKERS"

LEGACY_EXPORT_COLLECTIONS = ("Interior2Master",)
LEGACY_PREVIEW_COLLECTIONS = ("SceneBuild_Inst",)
LEGACY_PREFAB_COLLECTIONS = ("PrefabExport", "PrefabsEvelvator")
LEGACY_WORK_COLLECTIONS = (
    "PropsBake",
    "PropsBake_EnvInterior2",
    "Other",
    "Cutters.001",
    "Small rock 01",
    "SceneLevator1_Mesh",
    "SceneLevator1_Prefabs",
    "SM_Elevator1_HP",
    "SM_Elevator1_LP",
)

LEGACY_PREFAB_DEFINITION_HINTS = {
    "analogClock": ("SM_Clock1",),
    "Barrier1": ("SM_Barrier1_FIN",),
    "Chair1": ("SM_Chair1",),
    "Controlpost": ("SM_ControlPost_FIN",),
    "CoreViewport1": ("PF_CoreViewport1",),
    "Desk1": ("SM_Desk1",),
    "DoorBulk1": ("SM_DoorBulk1",),
    "FlashLight": ("SM_Flashligh1", "SM_FlashLight1"),
    "fluorescentLamp": ("SM_Lamp1",),
    "LampDesk1": ("SM_LampDesk1",),
    "LampDome1": ("SM_LampDome1",),
    "operatorPanel": ("SM_Panel1",),
    "PanelStatusViewport1": ("SM_PanelStatusViewport1_FIN",),
    "plasmaView": ("SM_PF_plasmaView_Core1",),
    "radio": ("SM_Radio1",),
    "redBulkLamp": ("SM_Lamp_BulkRed",),
    "serviceDoor": ("SM_Door2_FIN",),
    "Terminal1": ("SM_Terminal1_FIN",),
}


def _safe_identifier(value: str, fallback: str) -> str:
    value = re.sub(r"[^A-Za-z0-9]+", "_", (value or "").strip()).strip("_")
    if not value:
        value = fallback
    if value[0].isdigit():
        value = f"Item_{value}"
    return value


def _scene_root(scene):
    return scene.collection


def _collection_parents(collection):
    parents = []
    for scene in bpy.data.scenes:
        if collection.name in scene.collection.children:
            parents.append(scene.collection)
    for candidate in bpy.data.collections:
        if candidate == collection:
            continue
        if collection.name in candidate.children:
            parents.append(candidate)
    return parents


def _ensure_collection(name, parent):
    collection = bpy.data.collections.get(name)
    if collection is None:
        collection = bpy.data.collections.new(name)
    if collection.name not in parent.children:
        parent.children.link(collection)
    return collection


def _ensure_prefab_library(scene):
    prefab_scene = bpy.data.scenes.get(PREFAB_LIBRARY_SCENE)
    if prefab_scene is None:
        prefab_scene = bpy.data.scenes.new(PREFAB_LIBRARY_SCENE)
    library = _ensure_collection(PREFAB_LIBRARY_COLLECTION, prefab_scene.collection)
    if library.name in scene.collection.children:
        scene.collection.children.unlink(library)
    return library


def _reparent_collection(collection, parent):
    if collection == parent:
        return
    if collection.name not in parent.children:
        parent.children.link(collection)
    for old_parent in list(_collection_parents(collection)):
        if old_parent != parent and collection.name in old_parent.children:
            old_parent.children.unlink(collection)


def _iter_collection_objects(collection):
    seen = set()
    for obj in collection.all_objects:
        if obj.as_pointer() in seen:
            continue
        seen.add(obj.as_pointer())
        yield obj


def _prefab_marker_parts(name):
    if not name.startswith("PF_"):
        return None, None
    remainder = name[3:]
    for prefab_type in sorted(LEGACY_PREFAB_DEFINITION_HINTS, key=len, reverse=True):
        if remainder == prefab_type:
            return prefab_type, "Instance01"
        prefix = f"{prefab_type}_"
        if remainder.startswith(prefix):
            return prefab_type, remainder[len(prefix):]
    parts = remainder.split("_", 1)
    return parts[0], parts[1] if len(parts) > 1 else "Instance01"


def _prefab_definition_for_type(prefab_type):
    for name in LEGACY_PREFAB_DEFINITION_HINTS.get(prefab_type, ()):
        definition = bpy.data.collections.get(name)
        if definition is not None:
            return definition
    return None


def _canonical_prefab_marker_name(name, prefab_type, instance_id="Instance01"):
    name = re.sub(r"\.(\d+)$", r"_\1", str(name or ""))
    prefab_type = _safe_identifier(prefab_type, "UnknownPrefab")
    prefix = f"PF_{prefab_type}"
    if name == prefix or name.startswith(f"{prefix}_"):
        return name
    if name.startswith(prefix):
        suffix = name[len(prefix):]
        if suffix.isdigit():
            return f"{prefix}_{suffix}"
    return f"{prefix}_{_safe_identifier(instance_id, 'Instance01')}"


def resolve_prefab_context(active):
    if active is None:
        return None, None
    if active.type == "EMPTY" and active.instance_type == "COLLECTION" and active.instance_collection:
        if active.get("tg_kind") == "prefab_instance":
            return active, active.instance_collection
    candidates = list(active.users_collection)
    if active.parent:
        candidates.extend(active.parent.users_collection)
    definition = next((collection for collection in candidates if collection.get("tg_kind") == "prefab_definition"), None)
    if definition is None:
        return None, None
    instances = [
        obj for obj in bpy.data.objects
        if obj.get("tg_kind") == "prefab_instance" and obj.instance_collection == definition
    ]
    return (instances[0] if len(instances) == 1 else None), definition


def _link_object(collection, obj):
    if obj.name not in collection.objects:
        collection.objects.link(obj)


def _unlink_object_except(obj, keep_collections):
    keep = {collection.as_pointer() for collection in keep_collections}
    for collection in list(obj.users_collection):
        if collection.as_pointer() not in keep:
            collection.objects.unlink(obj)


def setup_scene_collections(scene, reparent_legacy=True):
    root = _ensure_collection(ROOT_COLLECTION, _scene_root(scene))
    level_export = _ensure_collection(LEVEL_EXPORT_COLLECTION, root)
    placement = _ensure_collection(PREFAB_PLACEMENT_COLLECTION, root)
    colliders = _ensure_collection(COLLIDER_HELPER_COLLECTION, root)
    work = _ensure_collection(WORK_COLLECTION, root)
    legacy = _ensure_collection(LEGACY_WORK_COLLECTION, work)
    prefab_library = _ensure_prefab_library(scene)

    root["tg_kind"] = "level_authoring_root"
    level_export["tg_kind"] = "level_export_root"
    placement["tg_kind"] = "prefab_placement_root"
    colliders["tg_kind"] = "collider_helper_root"
    work["tg_kind"] = "work_root"
    prefab_library["tg_kind"] = "prefab_library"

    if reparent_legacy:
        for name in LEGACY_EXPORT_COLLECTIONS:
            collection = bpy.data.collections.get(name)
            if collection:
                _reparent_collection(collection, level_export)
        for name in LEGACY_PREVIEW_COLLECTIONS:
            collection = bpy.data.collections.get(name)
            if collection:
                _reparent_collection(collection, legacy)
        for name in LEGACY_PREFAB_COLLECTIONS:
            collection = bpy.data.collections.get(name)
            if collection:
                _reparent_collection(collection, prefab_library)
        for name in LEGACY_WORK_COLLECTIONS:
            collection = bpy.data.collections.get(name)
            if collection:
                _reparent_collection(collection, legacy)
        simple_colliders = bpy.data.collections.get("Colliders")
        if simple_colliders:
            _reparent_collection(simple_colliders, colliders)

    settings = scene.site12_authoring
    settings.level_export_collection = level_export.name
    settings.prefab_placement_collection = placement.name
    settings.collider_collection = colliders.name
    settings.prefab_library_collection = prefab_library.name
    return {
        "root": root,
        "level_export": level_export,
        "placement": placement,
        "colliders": colliders,
        "work": work,
        "legacy": legacy,
        "prefab_library": prefab_library,
    }


def _cube_mesh_from_bounds(name, bounds):
    min_x = min(point[0] for point in bounds)
    min_y = min(point[1] for point in bounds)
    min_z = min(point[2] for point in bounds)
    max_x = max(point[0] for point in bounds)
    max_y = max(point[1] for point in bounds)
    max_z = max(point[2] for point in bounds)
    vertices = [
        (min_x, min_y, min_z), (max_x, min_y, min_z),
        (max_x, max_y, min_z), (min_x, max_y, min_z),
        (min_x, min_y, max_z), (max_x, min_y, max_z),
        (max_x, max_y, max_z), (min_x, max_y, max_z),
    ]
    faces = [
        (0, 1, 2, 3), (4, 7, 6, 5),
        (0, 4, 5, 1), (1, 5, 6, 2),
        (2, 6, 7, 3), (4, 0, 3, 7),
    ]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    return mesh


def _collider_children(obj):
    result = []
    stack = list(obj.children)
    while stack:
        child = stack.pop()
        stack.extend(child.children)
        if child.name.upper().startswith(("UBX_", "UCX_", "USP_", "UCP_")) or child.get("tg_kind") == "collider":
            result.append(child)
    return result


def _level_rigid_root(active):
    current = active
    while current is not None:
        if current.name.startswith("RB_") and current.get("tg_kind") == "level_rigid_body":
            return current
        current = current.parent
    return None


def _default_rigid_id(obj):
    name = obj.name.removeprefix("SM_").removesuffix("_FIN")
    return _safe_identifier(name, "RigidProp01")


def _next_level_rigid_id(root):
    """Return a readable, unused stable ID for a copy of ``root``."""
    source_id = _safe_identifier(
        root.get("tg_rigid_id") or root.name.removeprefix("RB_"),
        "RigidProp01",
    )
    match = re.match(r"^(.*?)(?:_(\d+))?$", source_id)
    stem = match.group(1) or source_id
    index = int(match.group(2) or 1) + 1
    used_ids = {
        str(candidate.get("tg_rigid_id"))
        for candidate in bpy.data.objects
        if candidate.get("tg_kind") == "level_rigid_body"
    }
    while True:
        candidate = f"{stem}_{index:02d}"
        if candidate not in used_ids and bpy.data.objects.get(f"RB_{candidate}") is None:
            return candidate
        index += 1


def _set_level_rigid_metadata(root, *, rigid_id, body_type, mass, pushable, draggable,
                              carryable, persistent, friction, restitution,
                              linear_damping, angular_damping, start_locked, beat_tag):
    root["tg_kind"] = "level_rigid_body"
    root["tg_rigid_id"] = _safe_identifier(rigid_id, "RigidProp01")
    root["tg_rigid_body_type"] = body_type
    root["tg_rigid_mass"] = max(0.05, float(mass))
    root["tg_rigid_pushable"] = bool(pushable)
    root["tg_rigid_draggable"] = bool(draggable)
    root["tg_rigid_carryable"] = bool(carryable)
    root["tg_rigid_persistent"] = bool(persistent)
    root["tg_rigid_friction"] = max(0.0, float(friction))
    root["tg_rigid_restitution"] = max(0.0, float(restitution))
    root["tg_rigid_linear_damping"] = max(0.0, float(linear_damping))
    root["tg_rigid_angular_damping"] = max(0.0, float(angular_damping))
    root["tg_rigid_start_locked"] = bool(start_locked)
    root["tg_rigid_beat_tag"] = str(beat_tag or "")


def make_level_rigid_body(
    obj,
    *,
    rigid_id="",
    scene=None,
    body_type="dynamic",
    mass=6.0,
    pushable=True,
    draggable=True,
    carryable=False,
    persistent=False,
    friction=0.75,
    restitution=0.02,
    linear_damping=0.8,
    angular_damping=1.2,
    start_locked=False,
    beat_tag="",
):
    if obj is None or obj.type != "MESH":
        raise ValueError("Make RB requires one active visible mesh object")
    if _level_rigid_root(obj):
        raise ValueError(f'"{obj.name}" is already part of a level rigid body')
    scene = scene or bpy.context.scene
    collections = setup_scene_collections(scene, reparent_legacy=False)
    colliders = _collider_children(obj)
    if not colliders:
        raise ValueError("Make RB requires an existing child collider; use Create Box Collider first")

    rigid_id = _safe_identifier(rigid_id or _default_rigid_id(obj), "RigidProp01")
    root_name = f"RB_{rigid_id}"
    conflict = bpy.data.objects.get(root_name)
    if conflict:
        raise ValueError(f'Object "{root_name}" already exists')

    bpy.context.view_layer.update()
    original_parent = obj.parent
    original_world = obj.matrix_world.copy()
    root = bpy.data.objects.new(root_name, None)
    root.empty_display_type = "CUBE"
    root.empty_display_size = max(0.2, max(obj.dimensions, default=0.5) * 0.2)
    _link_object(collections["level_export"], root)
    root.parent = original_parent
    root.matrix_world = original_world
    obj.parent = root
    obj.matrix_world = original_world

    for index, collider in enumerate(colliders, start=1):
        collider.name = f"UBX_{rigid_id}_{index:02d}"
        if collider.data:
            collider.data.name = collider.name
        collider["tg_kind"] = "collider"
        # Collider helpers remain easy to hide through 20_COLLIDERS, but RB
        # colliders must also be selected by the level GLB exporter.
        _link_object(collections["level_export"], collider)

    _set_level_rigid_metadata(
        root,
        rigid_id=rigid_id,
        body_type=body_type,
        mass=mass,
        pushable=pushable,
        draggable=draggable,
        carryable=carryable,
        persistent=persistent,
        friction=friction,
        restitution=restitution,
        linear_damping=linear_damping,
        angular_damping=angular_damping,
        start_locked=start_locked,
        beat_tag=beat_tag,
    )
    root["tg_rigid_visual_name"] = obj.name
    bpy.context.view_layer.objects.active = root
    obj.select_set(False)
    root.select_set(True)
    return root


def duplicate_level_rigid_body(root, *, rigid_id="", offset=(0.4, 0.0, 0.0), scene=None):
    """Duplicate a unique RB hierarchy while keeping mesh data linked.

    This mirrors Blender's linked duplicate semantics for an authored level
    prop: transform and runtime tags belong to the new RB root, whereas visual
    and collider geometry stay shared until an artist explicitly makes it
    unique.
    """
    if root is None or root.get("tg_kind") != "level_rigid_body":
        raise ValueError("Duplicate RB requires a selected level rigid body")
    scene = scene or bpy.context.scene
    collections = setup_scene_collections(scene, reparent_legacy=False)
    rigid_id = _safe_identifier(rigid_id or _next_level_rigid_id(root), "RigidProp02")
    root_name = f"RB_{rigid_id}"
    if bpy.data.objects.get(root_name):
        raise ValueError(f'Object "{root_name}" already exists')

    source_nodes = [root, *root.children_recursive]
    copies = {}
    for source in source_nodes:
        duplicate = source.copy()
        # Object.copy normally shares data, but keeping this explicit makes the
        # instance-style contract clear and protects it from future changes.
        if source.data:
            duplicate.data = source.data
        copies[source] = duplicate
        source_collections = list(source.users_collection)
        if not source_collections:
            source_collections = [collections["level_export"]]
        for collection in source_collections:
            _link_object(collection, duplicate)

    for source, duplicate in copies.items():
        duplicate.parent = copies.get(source.parent, source.parent)
        duplicate.matrix_parent_inverse = source.matrix_parent_inverse.copy()
        duplicate.matrix_basis = source.matrix_basis.copy()

    duplicate_root = copies[root]
    duplicate_root.name = root_name
    duplicate_root.matrix_world = Matrix.Translation(offset) @ root.matrix_world
    duplicate_root["tg_rigid_id"] = rigid_id

    duplicate_colliders = _collider_children(duplicate_root)
    for index, collider in enumerate(duplicate_colliders, start=1):
        collider.name = f"UBX_{rigid_id}_{index:02d}"
        collider["tg_kind"] = "collider"
        _link_object(collections["level_export"], collider)

    duplicate_visual = next(
        (
            candidate for candidate in duplicate_root.children_recursive
            if candidate.type == "MESH" and candidate not in duplicate_colliders
        ),
        None,
    )
    if duplicate_visual is None:
        raise ValueError(f'"{root.name}" has no visual mesh to duplicate')
    duplicate_root["tg_rigid_visual_name"] = duplicate_visual.name

    bpy.context.view_layer.update()
    for selected in bpy.context.selected_objects:
        selected.select_set(False)
    duplicate_root.select_set(True)
    bpy.context.view_layer.objects.active = duplicate_root
    return duplicate_root


def create_box_collider_for_object(obj, scene=None):
    if obj is None or obj.type != "MESH":
        raise ValueError("Box collider requires one active mesh object")
    scene = scene or bpy.context.scene
    collections = setup_scene_collections(scene, reparent_legacy=False)
    existing = _collider_children(obj)
    if existing:
        return existing[0]

    index = 1
    while bpy.data.objects.get(f"UBX_{obj.name}_{index:02d}"):
        index += 1
    name = f"UBX_{obj.name}_{index:02d}"
    mesh = _cube_mesh_from_bounds(name, obj.bound_box)
    collider = bpy.data.objects.new(name, mesh)
    collider.parent = obj
    collider.matrix_parent_inverse = Matrix.Identity(4)
    collider.matrix_basis = Matrix.Identity(4)
    collider.display_type = "WIRE"
    collider.show_in_front = True
    collider.hide_render = True
    collider["tg_kind"] = "collider"
    collider["tg_collider_shape"] = "box"
    _link_object(collections["colliders"], collider)
    return collider


def _rename_collider(collider, visual_name, index):
    collider.name = f"UBX_{visual_name}_{index:02d}"
    if collider.data:
        collider.data.name = collider.name


def convert_object_to_rigid_prefab(
    obj,
    *,
    prefab_type,
    instance_id,
    scene=None,
    body_type="dynamic",
    start_locked=False,
    persistent=True,
    beat_tag="",
    asset_path="",
):
    if obj is None or obj.type != "MESH":
        raise ValueError("Rigid prefab conversion requires one active mesh object")
    scene = scene or bpy.context.scene
    collections = setup_scene_collections(scene, reparent_legacy=False)
    prefab_type = _safe_identifier(prefab_type, "RigidProp1")
    instance_id = _safe_identifier(instance_id, "Instance01")
    definition_name = f"PF_{prefab_type}"
    marker_name = f"PF_{prefab_type}_{instance_id}"

    if bpy.data.objects.get(marker_name):
        raise ValueError(f'Object "{marker_name}" already exists')
    definition = bpy.data.collections.get(definition_name)
    if definition and len(definition.objects):
        raise ValueError(f'Prefab definition "{definition_name}" is not empty')
    if definition is None:
        definition = bpy.data.collections.new(definition_name)
    if definition.name not in collections["prefab_library"].children:
        collections["prefab_library"].children.link(definition)

    bpy.context.view_layer.update()
    original_world = obj.matrix_world.copy()
    original_name = obj.name
    colliders = _collider_children(obj)
    if not colliders:
        colliders = [create_box_collider_for_object(obj, scene)]

    visual_name = f"SM_{prefab_type}"
    obj.name = visual_name
    if obj.data:
        obj.data.name = visual_name
    _link_object(definition, obj)
    _unlink_object_except(obj, [definition])

    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj["tg_kind"] = "prefab_visual"
    obj["tg_original_name"] = original_name

    for index, collider in enumerate(colliders, start=1):
        _rename_collider(collider, visual_name, index)
        _link_object(definition, collider)
        _unlink_object_except(collider, [definition])
        collider.parent = obj
        collider.matrix_parent_inverse = Matrix.Identity(4)
        collider["tg_kind"] = "collider"

    definition["tg_kind"] = "prefab_definition"
    definition["tg_prefab_type"] = prefab_type
    definition["tg_rigid_body"] = True
    definition["tg_body_type"] = body_type
    definition["tg_asset_path"] = asset_path or f"assets/mesh/prefabs/SM_{prefab_type}.glb"

    instance = bpy.data.objects.new(marker_name, None)
    instance.instance_type = "COLLECTION"
    instance.instance_collection = definition
    instance.empty_display_type = "CUBE"
    instance.empty_display_size = max(0.25, max(obj.dimensions, default=0.5) * 0.25)
    _link_object(collections["placement"], instance)
    instance.matrix_world = original_world
    instance["tg_kind"] = "prefab_instance"
    instance["tg_prefab_type"] = prefab_type
    instance["tg_instance_id"] = instance_id
    instance["tg_body_type"] = body_type
    instance["tg_start_locked"] = bool(start_locked)
    instance["tg_persistent"] = bool(persistent)
    if beat_tag:
        instance["tg_beat_tag"] = beat_tag
    bpy.context.view_layer.objects.active = instance
    instance.select_set(True)
    return instance, definition


def migrate_legacy_prefab_instance(instance, *, marker=None, scene=None, prefab_type="", instance_id=""):
    if instance is None or instance.type != "EMPTY" or instance.instance_type != "COLLECTION" or instance.instance_collection is None:
        raise ValueError("Select a legacy collection instance Empty")
    scene = scene or bpy.context.scene
    collections = setup_scene_collections(scene, reparent_legacy=False)

    if marker is None:
        candidates = []
        origin = instance.matrix_world.translation
        for obj in scene.objects:
            if obj == instance or obj.type != "EMPTY" or obj.instance_type == "COLLECTION" or not obj.name.startswith("PF_"):
                continue
            distance = (obj.matrix_world.translation - origin).length
            if distance <= 0.15:
                candidates.append((distance, obj))
        if candidates:
            marker = min(candidates, key=lambda item: item[0])[1]

    if marker:
        match = re.match(r"^PF_([^_]+)_(.+)$", marker.name)
        if not match:
            raise ValueError(f'Legacy marker "{marker.name}" does not use PF_<type>_<instance>')
        prefab_type = match.group(1)
        instance_id = match.group(2)

    prefab_type = _safe_identifier(prefab_type, instance.instance_collection.name.removeprefix("PF_").removeprefix("SM_").removesuffix("_FIN"))
    instance_id = _safe_identifier(instance_id, "Instance01")
    stable_name = f"PF_{prefab_type}_{instance_id}"

    if marker:
        legacy_markers = _ensure_collection("LEGACY_PREFAB_MARKERS", collections["legacy"])
        marker.name = f"LEGACY_{stable_name}"
        marker["tg_kind"] = "legacy_marker"
        marker["tg_replaced_by"] = stable_name
        _link_object(legacy_markers, marker)
        _unlink_object_except(marker, [legacy_markers])

    conflict = bpy.data.objects.get(stable_name)
    if conflict and conflict != instance:
        raise ValueError(f'Object "{stable_name}" already exists')
    instance.name = stable_name
    instance["tg_kind"] = "prefab_instance"
    instance["tg_prefab_type"] = prefab_type
    instance["tg_instance_id"] = instance_id
    instance.instance_collection["tg_kind"] = "prefab_definition"
    instance.instance_collection["tg_prefab_type"] = prefab_type
    _link_object(collections["placement"], instance)
    _unlink_object_except(instance, [collections["placement"]])
    return instance, marker


def migrate_legacy_prefabs(scene):
    collections = setup_scene_collections(scene, reparent_legacy=False)
    archive = _ensure_collection("LEGACY_PREFAB_MARKERS", collections["legacy"])
    bpy.context.view_layer.update()
    level_object_ids = {
        obj.as_pointer() for obj in _iter_collection_objects(collections["level_export"])
    }
    markers = [
        obj for obj in _iter_collection_objects(collections["level_export"])
        if obj.type == "EMPTY"
        and obj.instance_type != "COLLECTION"
        and obj.name.startswith("PF_")
        and obj.get("tg_kind") not in {"legacy_marker", "prefab_marker"}
    ]
    preview_instances = [
        obj for obj in scene.objects
        if obj.type == "EMPTY"
        and obj.instance_type == "COLLECTION"
        and obj.instance_collection is not None
        and obj.get("tg_kind") != "prefab_instance"
        and obj.as_pointer() in level_object_ids
    ]
    claimed = set()
    migrated = []
    skipped = []

    for marker in sorted(markers, key=lambda item: item.name.lower()):
        legacy_marker_name = marker.name
        prefab_type, instance_id = _prefab_marker_parts(legacy_marker_name)
        definition = _prefab_definition_for_type(prefab_type)
        if definition is None:
            skipped.append((legacy_marker_name, f'no editable definition for type "{prefab_type}"'))
            continue
        marker_name = _canonical_prefab_marker_name(legacy_marker_name, prefab_type, instance_id)

        candidates = [
            obj for obj in preview_instances
            if obj.as_pointer() not in claimed and obj.instance_collection == definition
        ]
        instance = min(candidates, key=lambda item: (item.location - marker.location).length) if candidates else None
        if instance is None:
            instance = bpy.data.objects.new(f"{marker_name}_INSTANCE", None)
            instance.instance_type = "COLLECTION"
            instance.instance_collection = definition
            instance.empty_display_type = "CUBE"
            instance.empty_display_size = 0.25
        else:
            claimed.add(instance.as_pointer())

        marker_matrix = marker.matrix_world.copy()
        archived_name = f"LEGACY_MARKER_{legacy_marker_name}"
        marker.name = archived_name
        marker["tg_kind"] = "legacy_marker"
        marker["tg_replaced_by"] = marker_name
        marker.hide_viewport = True
        marker.hide_render = True
        _link_object(archive, marker)
        _unlink_object_except(marker, [archive])

        instance.name = marker_name
        _link_object(collections["placement"], instance)
        _unlink_object_except(instance, [collections["placement"]])
        instance.matrix_world = marker_matrix
        instance.hide_viewport = False
        instance.hide_render = False
        instance["tg_kind"] = "prefab_instance"
        instance["tg_prefab_type"] = prefab_type
        instance["tg_instance_id"] = _safe_identifier(instance_id, "Instance01")
        instance["tg_marker_name"] = marker_name
        definition["tg_kind"] = "prefab_definition"
        definition["tg_prefab_type"] = prefab_type
        migrated.append(instance)

    return migrated, skipped


def repair_prefab_instance_names(scene):
    settings = scene.site12_authoring
    placement = bpy.data.collections.get(settings.prefab_placement_collection)
    if placement is None:
        return [], []
    repaired = []
    conflicts = []
    instances = [obj for obj in _iter_collection_objects(placement) if obj.get("tg_kind") == "prefab_instance"]
    for instance in instances:
        prefab_type = instance.get("tg_prefab_type", "")
        instance_id = instance.get("tg_instance_id", "Instance01")
        canonical = _canonical_prefab_marker_name(instance.name, prefab_type, instance_id)
        conflict = bpy.data.objects.get(canonical)
        if conflict and conflict != instance:
            conflicts.append((instance.name, canonical))
            continue
        old_name = instance.name
        stale_marker = instance.get("tg_marker_name")
        instance.name = canonical
        instance["tg_marker_name"] = canonical
        if old_name != canonical or stale_marker != canonical:
            repaired.append((old_name, canonical))
    return repaired, conflicts


def _make_export_marker(instance, marker_collection):
    prefab_type = _safe_identifier(instance.get("tg_prefab_type", ""), "UnknownPrefab")
    instance_id = _safe_identifier(instance.get("tg_instance_id", ""), "Instance01")
    marker_name = _canonical_prefab_marker_name(instance.name, prefab_type, instance_id)
    marker = bpy.data.objects.new(marker_name, None)
    marker.empty_display_type = "PLAIN_AXES"
    marker.matrix_world = instance.matrix_world.copy()
    for key in instance.keys():
        if key != "_RNA_UI":
            marker[key] = instance[key]
    marker["tg_kind"] = "prefab_marker"
    marker_collection.objects.link(marker)
    return marker


def _gltf_export(filepath, objects, *, material_mode="EXPORT"):
    filepath = os.path.abspath(bpy.path.abspath(filepath))
    Path(filepath).parent.mkdir(parents=True, exist_ok=True)
    selected = list(bpy.context.selected_objects)
    active = bpy.context.view_layer.objects.active
    visibility = {obj: (obj.hide_viewport, obj.hide_get()) for obj in objects}
    try:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            if obj.name in bpy.context.view_layer.objects:
                obj.hide_viewport = False
                obj.hide_set(False)
                obj.select_set(True)
        bpy.context.view_layer.objects.active = next((obj for obj in objects if obj.name in bpy.context.view_layer.objects), None)
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format="GLB",
            use_selection=True,
            use_active_scene=True,
            export_extras=True,
            export_yup=True,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
            # Bake authored geometry and Smooth by Angle into the runtime mesh.
            # Source images stay external because the runtime material system owns
            # textures; export_image_format="NONE" preserves only material slots.
            export_apply=True,
            export_normals=True,
            export_gn_mesh=True,
            export_materials=material_mode,
            export_image_format="NONE",
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
            export_draco_position_quantization=14,
            export_draco_normal_quantization=10,
            export_draco_texcoord_quantization=12,
        )
    finally:
        bpy.ops.object.select_all(action="DESELECT")
        for obj in selected:
            if obj.name in bpy.context.view_layer.objects:
                obj.select_set(True)
        for obj, (hide_viewport, hidden) in visibility.items():
            if obj.name in bpy.data.objects:
                obj.hide_viewport = hide_viewport
                if obj.name in bpy.context.view_layer.objects:
                    obj.hide_set(hidden)
        if active and active.name in bpy.context.view_layer.objects:
            bpy.context.view_layer.objects.active = active
    return filepath


def export_prefab_definition(definition, filepath):
    if definition is None:
        raise ValueError("Prefab definition collection is missing")
    objects = list(_iter_collection_objects(definition))
    if not objects:
        raise ValueError(f'Prefab definition "{definition.name}" is empty')
    scene_root = bpy.context.scene.collection
    linked_for_export = definition.name not in scene_root.children
    if linked_for_export:
        scene_root.children.link(definition)
    try:
        return _gltf_export(filepath, objects, material_mode="EXPORT")
    finally:
        if linked_for_export and definition.name in scene_root.children:
            scene_root.children.unlink(definition)


def export_level(scene, filepath):
    settings = scene.site12_authoring
    source = bpy.data.collections.get(settings.level_export_collection)
    placement = bpy.data.collections.get(settings.prefab_placement_collection)
    if source is None:
        raise ValueError("Level export collection is missing")
    if placement is None:
        raise ValueError("Prefab placement collection is missing")

    _repaired, conflicts = repair_prefab_instance_names(scene)
    if conflicts:
        names = ", ".join(f"{source} -> {target}" for source, target in conflicts)
        raise ValueError(f"Prefab marker name conflicts must be resolved before export: {names}")

    old_temp = bpy.data.collections.get(TEMP_MARKER_COLLECTION)
    if old_temp:
        for obj in list(old_temp.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(old_temp)
    marker_collection = bpy.data.collections.new(TEMP_MARKER_COLLECTION)
    scene.collection.children.link(marker_collection)

    markers = []
    renamed_instances = []
    try:
        instances = [obj for obj in _iter_collection_objects(placement) if obj.get("tg_kind") == "prefab_instance"]
        marker_names = [
            _canonical_prefab_marker_name(
                instance.name,
                instance.get("tg_prefab_type", ""),
                instance.get("tg_instance_id", "Instance01"),
            )
            for instance in instances
        ]
        if len(marker_names) != len(set(marker_names)):
            raise ValueError("Prefab marker names must be unique before export")
        for index, instance in enumerate(instances):
            original_name = instance.name
            instance.name = f"__TG_PREFAB_INSTANCE_{index:04d}"
            renamed_instances.append((instance, original_name))
        markers = [_make_export_marker(instance, marker_collection) for instance in instances]
        for marker, marker_name in zip(markers, marker_names):
            marker.name = marker_name
        static_objects = [
            obj for obj in _iter_collection_objects(source)
            if obj.get("tg_export_exclude") is not True and obj.instance_type != "COLLECTION"
        ]
        generated_names = {marker.name for marker in markers}
        static_objects = [obj for obj in static_objects if obj.name not in generated_names]
        # Runtime materials own every shipped texture. Exporting Blender image
        # payloads here can turn this level into a 300+ MB GLB while the loader
        # immediately replaces those materials anyway.
        return _gltf_export(filepath, static_objects + markers, material_mode="EXPORT")
    finally:
        for marker in markers:
            if marker.name in bpy.data.objects:
                bpy.data.objects.remove(marker, do_unlink=True)
        for instance, original_name in renamed_instances:
            if instance.name in bpy.data.objects:
                instance.name = original_name
        if marker_collection.name in bpy.data.collections:
            bpy.data.collections.remove(marker_collection)


def validate_scene(scene):
    settings = scene.site12_authoring
    errors = []
    warnings = []
    placement = bpy.data.collections.get(settings.prefab_placement_collection)
    library = bpy.data.collections.get(settings.prefab_library_collection)
    if placement is None:
        errors.append("Missing prefab placement collection")
    if library is None:
        errors.append("Missing prefab library collection")

    stable_names = set()
    if placement:
        for obj in _iter_collection_objects(placement):
            if obj.get("tg_kind") != "prefab_instance":
                warnings.append(f"{obj.name}: placement object has no prefab_instance metadata")
                continue
            if obj.type != "EMPTY" or obj.instance_type != "COLLECTION" or obj.instance_collection is None:
                errors.append(f"{obj.name}: prefab placement must be a collection instance Empty")
                continue
            prefab_type = obj.get("tg_prefab_type", "")
            instance_id = obj.get("tg_instance_id", "")
            expected = _canonical_prefab_marker_name(obj.name, prefab_type, instance_id)
            if obj.name != expected:
                errors.append(f"{obj.name}: expected stable name {expected}")
            if obj.name in stable_names:
                errors.append(f"{obj.name}: duplicate stable prefab name")
            stable_names.add(obj.name)
            if obj.get("tg_marker_name") != obj.name:
                warnings.append(f"{obj.name}: stale marker metadata; run Repair Prefab Names")
            if obj.get("tg_body_type") == "dynamic" and any(abs(value) < 1e-6 for value in obj.scale):
                errors.append(f"{obj.name}: invalid zero scale")
            definition = obj.instance_collection
            if definition.get("tg_rigid_body") and not any(
                child.name.upper().startswith(("UBX_", "UCX_", "USP_", "UCP_"))
                for child in _iter_collection_objects(definition)
            ):
                errors.append(f"{obj.name}: rigid prefab definition has no collider")

    for obj in scene.objects:
        if obj.name.startswith("RB_"):
            colliders = _collider_children(obj)
            meshes = [child for child in obj.children_recursive if child.type == "MESH" and child not in colliders]
            if not meshes:
                errors.append(f"{obj.name}: unique rigid root has no visual mesh")
            if not colliders:
                errors.append(f"{obj.name}: unique rigid root has no collider")
            if not obj.get("tg_kind"):
                warnings.append(f"{obj.name}: unique rigid root has no metadata")

    report = [f"Errors: {len(errors)}", f"Warnings: {len(warnings)}"]
    report.extend(f"ERROR: {message}" for message in errors)
    report.extend(f"WARN: {message}" for message in warnings)
    settings.validation_report = "\n".join(report)
    return errors, warnings


def _update_collider_visibility(settings, _context):
    for obj in bpy.data.objects:
        if obj.name.upper().startswith(("UBX_", "UCX_", "USP_", "UCP_")) or obj.get("tg_kind") == "collider":
            obj.hide_viewport = not settings.colliders_visible


class SITE12_PG_Settings(PropertyGroup):
    level_export_collection: StringProperty(name="Level Export", default=LEVEL_EXPORT_COLLECTION)
    prefab_placement_collection: StringProperty(name="Prefab Placement", default=PREFAB_PLACEMENT_COLLECTION)
    collider_collection: StringProperty(name="Collider Helpers", default=COLLIDER_HELPER_COLLECTION)
    prefab_library_collection: StringProperty(name="Prefab Library", default=PREFAB_LIBRARY_COLLECTION)
    level_output_path: StringProperty(name="Level GLB", subtype="FILE_PATH", default="//assets/mesh/environment/SM_Interior2.glb")
    prefab_output_dir: StringProperty(name="Prefab Output", subtype="DIR_PATH", default="//assets/mesh/prefabs/")
    prefab_type: StringProperty(name="Prefab Type", default="LoosePipe1")
    instance_id: StringProperty(name="Instance ID", default="Instance01")
    body_type: EnumProperty(
        name="Body Type",
        items=(("dynamic", "Dynamic", "Movable rigid body"), ("fixed", "Fixed", "Fixed body"), ("kinematic", "Kinematic", "Runtime controlled body")),
        default="dynamic",
    )
    start_locked: BoolProperty(name="Start Locked", default=False)
    persistent: BoolProperty(name="Persistent", default=True)
    beat_tag: StringProperty(name="Beat Tag", default="")
    colliders_visible: BoolProperty(name="Show Colliders", default=True, update=_update_collider_visibility)
    validation_report: StringProperty(name="Validation Report", default="Not validated")


class SITE12_OT_SetupScene(Operator):
    bl_idname = "site12.setup_scene"
    bl_label = "Setup / Repair Scene Structure"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        setup_scene_collections(context.scene, reparent_legacy=True)
        self.report({"INFO"}, "Site-12 authoring collections are ready")
        return {"FINISHED"}


class SITE12_OT_CreateBoxCollider(Operator):
    bl_idname = "site12.create_box_collider"
    bl_label = "Create Box Collider"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        try:
            collider = create_box_collider_for_object(context.active_object, context.scene)
        except ValueError as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Created {collider.name}")
        return {"FINISHED"}


class SITE12_OT_MakeLevelRigidBody(Operator):
    bl_idname = "site12.make_level_rigid_body"
    bl_label = "Make RB"
    bl_description = "Mark the selected level mesh and its existing child colliders as one dynamic level rigid body"
    bl_options = {"REGISTER", "UNDO"}

    rigid_id: StringProperty(name="Stable ID", default="RigidProp01")
    body_type: EnumProperty(
        name="Body Type",
        items=(("dynamic", "Dynamic", "Simulated body"), ("fixed", "Fixed", "Static until scripted release"), ("kinematic", "Kinematic", "Runtime driven body")),
        default="dynamic",
    )
    mass: bpy.props.FloatProperty(name="Mass (kg)", default=6.0, min=0.05)
    pushable: BoolProperty(name="Pushable", default=True)
    draggable: BoolProperty(name="Draggable", default=True)
    carryable: BoolProperty(name="Carryable", default=False)
    persistent: BoolProperty(name="Persistent", default=False)
    friction: bpy.props.FloatProperty(name="Friction", default=0.75, min=0.0, max=2.0)
    restitution: bpy.props.FloatProperty(name="Bounciness", default=0.02, min=0.0, max=1.0)
    linear_damping: bpy.props.FloatProperty(name="Linear Damping", default=0.8, min=0.0, max=20.0)
    angular_damping: bpy.props.FloatProperty(name="Angular Damping", default=1.2, min=0.0, max=20.0)
    start_locked: BoolProperty(name="Start Locked", default=False)
    beat_tag: StringProperty(name="Beat Tag", default="")

    @classmethod
    def poll(cls, context):
        return bool(context.active_object and context.active_object.type == "MESH" and not _level_rigid_root(context.active_object))

    def invoke(self, context, _event):
        self.rigid_id = _default_rigid_id(context.active_object)
        return context.window_manager.invoke_props_dialog(self, width=420)

    def draw(self, _context):
        layout = self.layout
        layout.prop(self, "rigid_id")
        layout.prop(self, "body_type")
        layout.prop(self, "mass")
        row = layout.row(align=True)
        row.prop(self, "pushable")
        row.prop(self, "draggable")
        row = layout.row(align=True)
        row.prop(self, "carryable")
        row.prop(self, "persistent")
        layout.prop(self, "friction")
        layout.prop(self, "restitution")
        layout.prop(self, "linear_damping")
        layout.prop(self, "angular_damping")
        layout.prop(self, "start_locked")
        layout.prop(self, "beat_tag")

    def execute(self, context):
        try:
            root = make_level_rigid_body(
                context.active_object,
                rigid_id=self.rigid_id,
                scene=context.scene,
                body_type=self.body_type,
                mass=self.mass,
                pushable=self.pushable,
                draggable=self.draggable,
                carryable=self.carryable,
                persistent=self.persistent,
                friction=self.friction,
                restitution=self.restitution,
                linear_damping=self.linear_damping,
                angular_damping=self.angular_damping,
                start_locked=self.start_locked,
                beat_tag=self.beat_tag,
            )
        except ValueError as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Created {root.name}")
        return {"FINISHED"}


class SITE12_OT_DuplicateLevelRigidBody(Operator):
    bl_idname = "site12.duplicate_level_rigid_body"
    bl_label = "Duplicate RB"
    bl_description = "Create a linked-geometry copy with a new level rigid-body ID"
    bl_options = {"REGISTER", "UNDO"}

    rigid_id: StringProperty(name="New Stable ID", default="RigidProp02")
    offset: bpy.props.FloatVectorProperty(
        name="World Offset (m)",
        default=(0.4, 0.0, 0.0),
        subtype="TRANSLATION",
    )

    @classmethod
    def poll(cls, context):
        return _level_rigid_root(context.active_object) is not None

    def invoke(self, context, _event):
        root = _level_rigid_root(context.active_object)
        self.rigid_id = _next_level_rigid_id(root)
        return context.window_manager.invoke_props_dialog(self, width=420)

    def draw(self, _context):
        layout = self.layout
        layout.label(text="Visual and collider mesh data stay linked.", icon="LINKED")
        layout.prop(self, "rigid_id")
        layout.prop(self, "offset")

    def execute(self, context):
        try:
            root = duplicate_level_rigid_body(
                _level_rigid_root(context.active_object),
                rigid_id=self.rigid_id,
                offset=self.offset,
                scene=context.scene,
            )
        except ValueError as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Duplicated {root.name}")
        return {"FINISHED"}


class SITE12_OT_MakeRigidPrefab(Operator):
    bl_idname = "site12.make_rigid_prefab"
    bl_label = "Create Rigid Prefab"
    bl_options = {"REGISTER", "UNDO"}

    prefab_type: StringProperty(name="Prefab Type", default="RigidProp1")
    instance_id: StringProperty(name="Instance ID", default="Instance01")
    body_type: EnumProperty(
        name="Body Type",
        items=(("dynamic", "Dynamic", "Movable rigid body"), ("fixed", "Fixed", "Fixed body"), ("kinematic", "Kinematic", "Runtime controlled body")),
        default="dynamic",
    )
    start_locked: BoolProperty(name="Start Locked", default=False)
    persistent: BoolProperty(name="Persistent", default=True)
    beat_tag: StringProperty(name="Beat Tag", default="")

    def invoke(self, context, _event):
        settings = context.scene.site12_authoring
        self.prefab_type = settings.prefab_type
        self.instance_id = settings.instance_id
        self.body_type = settings.body_type
        self.start_locked = settings.start_locked
        self.persistent = settings.persistent
        self.beat_tag = settings.beat_tag
        return context.window_manager.invoke_props_dialog(self, width=420)

    def draw(self, _context):
        layout = self.layout
        layout.prop(self, "prefab_type")
        layout.prop(self, "instance_id")
        layout.prop(self, "body_type")
        row = layout.row(align=True)
        row.prop(self, "start_locked")
        row.prop(self, "persistent")
        layout.prop(self, "beat_tag")

    def execute(self, context):
        settings = context.scene.site12_authoring
        settings.prefab_type = self.prefab_type
        settings.instance_id = self.instance_id
        settings.body_type = self.body_type
        settings.start_locked = self.start_locked
        settings.persistent = self.persistent
        settings.beat_tag = self.beat_tag
        try:
            instance, _definition = convert_object_to_rigid_prefab(
                context.active_object,
                prefab_type=self.prefab_type,
                instance_id=self.instance_id,
                scene=context.scene,
                body_type=self.body_type,
                start_locked=self.start_locked,
                persistent=self.persistent,
                beat_tag=self.beat_tag,
            )
        except ValueError as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Created {instance.name}")
        return {"FINISHED"}


class SITE12_OT_MigrateLegacyPrefabs(Operator):
    bl_idname = "site12.migrate_legacy_prefabs"
    bl_label = "Migrate Legacy Prefabs"
    bl_description = "Replace legacy PF marker + hidden preview pairs with visible authoritative collection instances"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        migrated, skipped = migrate_legacy_prefabs(context.scene)
        details = "; ".join(f"{name}: {reason}" for name, reason in skipped[:3])
        if skipped:
            self.report({"WARNING"}, f"Migrated {len(migrated)}; skipped {len(skipped)}. {details}")
        else:
            self.report({"INFO"}, f"Migrated {len(migrated)} legacy prefabs")
        return {"FINISHED"}


class SITE12_OT_RepairPrefabNames(Operator):
    bl_idname = "site12.repair_prefab_names"
    bl_label = "Repair Prefab Names"
    bl_description = "Synchronize prefab marker names and metadata without changing stable runtime IDs"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        repaired, conflicts = repair_prefab_instance_names(context.scene)
        if conflicts:
            details = "; ".join(f"{source} -> {target}" for source, target in conflicts[:3])
            self.report({"ERROR"}, f"Repaired {len(repaired)}; conflicts {len(conflicts)}: {details}")
            return {"CANCELLED"}
        self.report({"INFO"}, f"Repaired {len(repaired)} prefab names / metadata records")
        return {"FINISHED"}


class SITE12_OT_OpenPrefabDefinition(Operator):
    bl_idname = "site12.open_prefab_definition"
    bl_label = "Edit Prefab Source"
    bl_description = "Open the editable prefab definition and select its visual mesh"

    def execute(self, context):
        instance, definition = resolve_prefab_context(context.active_object)
        if definition is None:
            self.report({"ERROR"}, "Select a Site-12 prefab instance or one of its source parts")
            return {"CANCELLED"}
        target_scene = next(
            (scene for scene in bpy.data.scenes if definition.name in scene.collection.children),
            bpy.data.scenes.get(PREFAB_LIBRARY_SCENE),
        )
        if target_scene is None:
            self.report({"ERROR"}, "Prefab library scene is missing")
            return {"CANCELLED"}
        target_scene["tg_return_scene"] = context.scene.name
        if instance:
            target_scene["tg_return_instance"] = instance.name
        if context.area and context.area.type == "VIEW_3D" and getattr(context.space_data, "local_view", None):
            bpy.ops.view3d.localview(frame_selected=False)
        context.window.scene = target_scene
        bpy.ops.object.select_all(action="DESELECT")
        editable_objects = [
            obj for obj in definition.all_objects
            if obj.name in context.view_layer.objects
        ]
        for obj in editable_objects:
            is_collider = obj.name.upper().startswith(("UBX_", "UCX_", "USP_", "UCP_")) or obj.get("tg_kind") == "collider"
            if not is_collider:
                obj.hide_viewport = False
            obj.hide_set(False)
            if not obj.hide_viewport:
                obj.select_set(True)
        visual = next((obj for obj in definition.all_objects if obj.get("tg_kind") == "prefab_visual"), None)
        visual = visual or next((obj for obj in definition.all_objects if obj.type == "MESH" and not obj.name.upper().startswith(("UBX_", "UCX_", "USP_", "UCP_"))), None)
        if visual and visual.name in context.view_layer.objects:
            context.view_layer.objects.active = visual
        if editable_objects and context.area and context.area.type == "VIEW_3D":
            bpy.ops.view3d.localview(frame_selected=False)
            bpy.ops.view3d.view_selected(use_all_regions=False)
        target_scene["tg_edit_definition"] = definition.name
        self.report({"INFO"}, f"Editing {definition.name}")
        return {"FINISHED"}


class SITE12_OT_ReturnToLevel(Operator):
    bl_idname = "site12.return_to_level"
    bl_label = "Return to Level"
    bl_description = "Return to the level instance that opened this prefab definition"

    def execute(self, context):
        scene_name = context.scene.get("tg_return_scene", "")
        target_scene = bpy.data.scenes.get(scene_name)
        if target_scene is None:
            self.report({"ERROR"}, "No level return target is recorded")
            return {"CANCELLED"}
        instance_name = context.scene.get("tg_return_instance", "")
        if context.area and context.area.type == "VIEW_3D" and getattr(context.space_data, "local_view", None):
            bpy.ops.view3d.localview(frame_selected=False)
        context.window.scene = target_scene
        bpy.ops.object.select_all(action="DESELECT")
        instance = bpy.data.objects.get(instance_name)
        if instance and instance.name in context.view_layer.objects:
            instance.select_set(True)
            context.view_layer.objects.active = instance
        return {"FINISHED"}


class SITE12_OT_MigrateLegacyPrefab(Operator):
    bl_idname = "site12.migrate_legacy_prefab"
    bl_label = "Adopt Legacy Instance"
    bl_description = "Replace a legacy PF marker + collection-instance pair with one authoritative collection instance"
    bl_options = {"REGISTER", "UNDO"}

    def execute(self, context):
        active = context.active_object
        selected_marker = next(
            (
                obj for obj in context.selected_objects
                if obj != active and obj.type == "EMPTY" and obj.instance_type != "COLLECTION" and obj.name.startswith("PF_")
            ),
            None,
        )
        settings = context.scene.site12_authoring
        try:
            instance, marker = migrate_legacy_prefab_instance(
                active,
                marker=selected_marker,
                scene=context.scene,
                prefab_type=settings.prefab_type,
                instance_id=settings.instance_id,
            )
        except ValueError as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        suffix = f"; archived {marker.name}" if marker else ""
        self.report({"INFO"}, f"Adopted {instance.name}{suffix}")
        return {"FINISHED"}


class SITE12_OT_Validate(Operator):
    bl_idname = "site12.validate"
    bl_label = "Validate Site-12 Scene"

    def execute(self, context):
        errors, warnings = validate_scene(context.scene)
        if errors:
            self.report({"ERROR"}, f"Validation failed: {len(errors)} errors, {len(warnings)} warnings")
            return {"CANCELLED"}
        self.report({"INFO"}, f"Validation passed with {len(warnings)} warnings")
        return {"FINISHED"}


class SITE12_OT_ExportLevel(Operator):
    bl_idname = "site12.export_level"
    bl_label = "Validate + Export Level GLB"

    def execute(self, context):
        errors, warnings = validate_scene(context.scene)
        if errors:
            self.report({"ERROR"}, f"Export blocked by {len(errors)} validation errors")
            return {"CANCELLED"}
        try:
            filepath = export_level(context.scene, context.scene.site12_authoring.level_output_path)
        except Exception as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Exported {filepath} ({len(warnings)} warnings)")
        return {"FINISHED"}


class SITE12_OT_ExportActivePrefab(Operator):
    bl_idname = "site12.export_active_prefab"
    bl_label = "Export Active Prefab GLB"

    def execute(self, context):
        _instance, definition = resolve_prefab_context(context.active_object)
        if definition is None:
            self.report({"ERROR"}, "Select a Site-12 prefab instance or one of its source parts")
            return {"CANCELLED"}
        prefab_type = definition.get("tg_prefab_type") or definition.name.removeprefix("PF_")
        directory = bpy.path.abspath(context.scene.site12_authoring.prefab_output_dir)
        filepath = os.path.join(directory, f"SM_{prefab_type}.glb")
        try:
            export_prefab_definition(definition, filepath)
        except Exception as error:
            self.report({"ERROR"}, str(error))
            return {"CANCELLED"}
        self.report({"INFO"}, f"Exported {filepath}")
        return {"FINISHED"}


class SITE12_PT_Authoring(Panel):
    bl_label = "Site-12 Authoring"
    bl_idname = "SITE12_PT_authoring"
    bl_space_type = "VIEW_3D"
    bl_region_type = "UI"
    bl_category = "TGLOBAL"

    def draw(self, context):
        layout = self.layout
        settings = context.scene.site12_authoring
        active = context.active_object
        rigid_root = _level_rigid_root(active)
        instance, definition = resolve_prefab_context(active)
        layout.operator("site12.setup_scene", icon="OUTLINER_COLLECTION")
        layout.operator("site12.migrate_legacy_prefabs", icon="FILE_REFRESH")
        layout.operator("site12.repair_prefab_names", icon="SORTALPHA")

        box = layout.box()
        box.label(text="Selected Object", icon="OBJECT_DATA")
        box.label(text=active.name if active else "Nothing selected")
        box.prop(settings, "colliders_visible", toggle=True)
        if rigid_root:
            box = layout.box()
            box.label(text="Level Rigid Body", icon="PHYSICS")
            box.label(text=rigid_root.name)
            box.operator("site12.duplicate_level_rigid_body", icon="DUPLICATE")
            box.prop(rigid_root, '["tg_rigid_id"]', text="Stable ID")
            box.prop(rigid_root, '["tg_rigid_body_type"]', text="Body Type")
            box.prop(rigid_root, '["tg_rigid_mass"]', text="Mass (kg)")
            row = box.row(align=True)
            row.prop(rigid_root, '["tg_rigid_pushable"]', text="Pushable")
            row.prop(rigid_root, '["tg_rigid_draggable"]', text="Draggable")
            row = box.row(align=True)
            row.prop(rigid_root, '["tg_rigid_carryable"]', text="Carryable")
            row.prop(rigid_root, '["tg_rigid_persistent"]', text="Persistent")
            box.prop(rigid_root, '["tg_rigid_friction"]', text="Friction")
            box.prop(rigid_root, '["tg_rigid_restitution"]', text="Bounciness")
            box.prop(rigid_root, '["tg_rigid_linear_damping"]', text="Linear Damping")
            box.prop(rigid_root, '["tg_rigid_angular_damping"]', text="Angular Damping")
            box.prop(rigid_root, '["tg_rigid_start_locked"]', text="Start Locked")
            box.prop(rigid_root, '["tg_rigid_beat_tag"]', text="Beat Tag")
        elif definition:
            box = layout.box()
            box.label(text="Prefab", icon="PACKAGE")
            box.label(text=f"Definition: {definition.name}")
            box.label(text=f"Type: {definition.get('tg_prefab_type', definition.name)}")
            if instance:
                box.label(text=f"Instance: {instance.name}")
                if "tg_start_locked" in instance:
                    box.prop(instance, '["tg_start_locked"]', text="Start Locked")
                if "tg_persistent" in instance:
                    box.prop(instance, '["tg_persistent"]', text="Persistent")
            if context.scene.name == PREFAB_LIBRARY_SCENE:
                box.operator("site12.return_to_level", icon="LOOP_BACK")
            else:
                box.operator("site12.open_prefab_definition", icon="GREASEPENCIL")
            box.operator("site12.export_active_prefab", icon="EXPORT")
        else:
            create = layout.row()
            create.enabled = bool(active and active.type == "MESH" and _collider_children(active))
            create.operator("site12.make_level_rigid_body", icon="PHYSICS")
            if active and active.type == "MESH":
                layout.operator("site12.create_box_collider", icon="MESH_CUBE")
            if active and active.type == "EMPTY" and active.instance_type == "COLLECTION":
                layout.operator("site12.migrate_legacy_prefab", icon="LINKED")

        box = layout.box()
        box.label(text="Validation / Export", icon="CHECKMARK")
        box.prop(settings, "level_output_path")
        box.prop(settings, "prefab_output_dir")
        row = box.row(align=True)
        row.operator("site12.validate", icon="CHECKMARK")
        row.operator("site12.export_level", icon="EXPORT")
        for line in settings.validation_report.splitlines()[:6]:
            box.label(text=line)


CLASSES = (
    SITE12_PG_Settings,
    SITE12_OT_SetupScene,
    SITE12_OT_CreateBoxCollider,
    SITE12_OT_MakeLevelRigidBody,
    SITE12_OT_DuplicateLevelRigidBody,
    SITE12_OT_MakeRigidPrefab,
    SITE12_OT_MigrateLegacyPrefabs,
    SITE12_OT_RepairPrefabNames,
    SITE12_OT_OpenPrefabDefinition,
    SITE12_OT_ReturnToLevel,
    SITE12_OT_MigrateLegacyPrefab,
    SITE12_OT_Validate,
    SITE12_OT_ExportLevel,
    SITE12_OT_ExportActivePrefab,
    SITE12_PT_Authoring,
)


def register():
    for cls in CLASSES:
        bpy.utils.register_class(cls)
    bpy.types.Scene.site12_authoring = PointerProperty(type=SITE12_PG_Settings)


def unregister():
    if hasattr(bpy.types.Scene, "site12_authoring"):
        del bpy.types.Scene.site12_authoring
    for cls in reversed(CLASSES):
        bpy.utils.unregister_class(cls)


if __name__ == "__main__":
    register()
