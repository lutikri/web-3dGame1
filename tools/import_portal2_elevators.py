from pathlib import Path

import bpy
from mathutils import Vector

from SourceIO.blender_bindings.models import import_model
from SourceIO.blender_bindings.models.common import put_into_collections
from SourceIO.blender_bindings.operators.import_settings_base import ModelOptions
from SourceIO.library.shared.content_manager import ContentManager
from SourceIO.library.shared.content_manager.providers.vpk_provider import VPKContentProvider
from SourceIO.library.utils.tiny_path import TinyPath


PORTAL2_ROOT = Path(r"F:\Progrram Files\SteamLibrary\steamapps\common\Portal 2")
OUTPUT_BLEND = Path(r"D:\D_Documents\CodexDocs\Portal2_Elevators.blend")

VPKS = [
    PORTAL2_ROOT / "portal2" / "pak01_dir.vpk",
    PORTAL2_ROOT / "portal2_dlc1" / "pak01_dir.vpk",
    PORTAL2_ROOT / "portal2_dlc2" / "pak01_dir.vpk",
]

ASSET_GROUPS = {
    "MODERN ELEVATOR CORE": [
        "models/elevator/elevator.mdl",
        "models/elevator/elevator_b.mdl",
        "models/elevator/elevator_entrance.mdl",
        "models/elevator/elevator_escape.mdl",
        "models/elevator/elevator_frame_section.mdl",
        "models/elevator/elevator_tube_512.mdl",
        "models/elevator/elevator_tube_opener.mdl",
        "models/elevator/elevator_roof_collar.mdl",
        "models/elevator/elevator_roof_collar_glass.mdl",
        "models/elevator/elevator_hole.mdl",
        "models/elevator/elevator_hole_rim.mdl",
        "models/elevator/elevator_central_pipe.mdl",
    ],
    "MODERN ELEVATOR TURBINE AND RUBBLE": [
        "models/elevator/elevator_blades.mdl",
        "models/elevator/elevator_turbine_static.mdl",
        "models/elevator/elevator_turbine_glass.mdl",
        "models/elevator/elevator_turbine_off.mdl",
        "models/elevator/elevator_rubble.mdl",
        "models/elevator/elevator_rubble_01.mdl",
        "models/elevator/turretsinelevator.mdl",
    ],
    "ROUND AND INDUSTRIAL ELEVATORS": [
        "models/props/round_elevator_body.mdl",
        "models/props/round_elevator_doors.mdl",
        "models/props/elevator_caps/elevator_caps.mdl",
        "models/props/elevatorshaft_wall/elevatorshaft_wall.mdl",
        "models/props_basement/just_elevator.mdl",
        "models/props_gameplay/industrial_elevator_a.mdl",
        "models/props_gameplay/industrial_elevator_b.mdl",
        "models/props_gameplay/industrial_elevator_2_a.mdl",
    ],
    "OLD APERTURE ELEVATOR": [
        "models/props_underground/entrance_elevator.mdl",
        "models/props_underground/entrance_elevator_band.mdl",
        "models/props_underground/entrance_elevator_sign.mdl",
        "models/props_underground/entrance_elevator_sign_02.mdl",
        "models/props_underground/elevator_a.mdl",
        "models/props_underground/elevator_enclosure.mdl",
        "models/props_underground/elevator_rails.mdl",
        "models/props_underground/elevator_door_top.mdl",
        "models/props_underground/elevator_door_bottom.mdl",
        "models/props_underground/underground_fizzlersupport_elevator.mdl",
    ],
}


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)


def add_label(text, location, size=0.35):
    curve = bpy.data.curves.new(f"{text}_Label", type="FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.size = size
    curve.extrude = 0.005
    label = bpy.data.objects.new(f"{text}_Label", curve)
    label.location = location
    bpy.context.scene.collection.objects.link(label)
    return label


def make_content_manager():
    content_manager = ContentManager()
    for vpk in VPKS:
        if vpk.exists():
            content_manager.add_child(VPKContentProvider(TinyPath(str(vpk))))
    return content_manager


def import_asset(content_manager, options, model_path, offset):
    tiny_path = TinyPath(model_path)
    buffer = content_manager.find_file(tiny_path)
    if buffer is None:
        return None, f"{model_path}: missing"

    try:
        model_container = import_model(tiny_path, buffer, content_manager, options)
        collection_name = model_path.removeprefix("models/").removesuffix(".mdl").replace("/", "__")
        collection = put_into_collections(
            model_container,
            collection_name,
            bodygroup_grouping=options.bodygroup_grouping,
        )
        for obj in collection.all_objects:
            obj.location += offset
        add_label(Path(model_path).stem, offset + Vector((0.0, -2.6, 0.15)))
        return model_path, None
    except Exception as exc:
        return None, f"{model_path}: {exc}"


def add_reference_beam(location):
    material = bpy.data.materials.new("Reference_Blue_Elevator_Energy")
    material.use_nodes = True
    material.blend_method = "BLEND"
    material.use_screen_refraction = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (0.35, 0.65, 1.0, 0.22)
        bsdf.inputs["Alpha"].default_value = 0.22
        bsdf.inputs["Emission Color"].default_value = (0.25, 0.5, 1.0, 1.0)
        bsdf.inputs["Emission Strength"].default_value = 0.7

    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.35, depth=5.0, location=location + Vector((0, 0, 2.5)))
    beam = bpy.context.object
    beam.name = "Reference_Blue_Elevator_Energy_Cylinder"
    beam.data.materials.append(material)
    beam.display_type = "TEXTURED"


def add_lighting_and_camera():
    bpy.ops.object.light_add(type="AREA", location=(15.0, -18.0, 15.0))
    key = bpy.context.object
    key.name = "Reference_Key_Area"
    key.data.energy = 650
    key.data.size = 9

    bpy.ops.object.light_add(type="POINT", location=(42.0, -23.0, 5.0))
    blue = bpy.context.object
    blue.name = "Reference_Blue_Elevator_Glow"
    blue.data.color = (0.38, 0.62, 1.0)
    blue.data.energy = 350
    blue.data.shadow_soft_size = 5

    bpy.ops.object.camera_add(location=(25.0, -45.0, 18.0), rotation=(1.18, 0.0, 0.52))
    bpy.context.scene.camera = bpy.context.object


def main():
    clear_scene()
    content_manager = make_content_manager()
    options = ModelOptions.default()
    options.import_textures = True
    options.import_animations = False
    options.import_physics = False

    imported = []
    failed = []
    columns = 4
    spacing_x = 9.0
    spacing_y = 8.0
    section_y = 0.0

    for group_name, assets in ASSET_GROUPS.items():
        add_label(group_name, Vector((13.5, section_y + 3.0, 0.25)), size=0.62)
        for index, asset in enumerate(assets):
            offset = Vector(((index % columns) * spacing_x, section_y - (index // columns) * spacing_y, 0.0))
            ok, error = import_asset(content_manager, options, asset, offset)
            if ok:
                imported.append(ok)
            if error:
                failed.append(error)
        rows = (len(assets) + columns - 1) // columns
        section_y -= rows * spacing_y + 7.0

    add_reference_beam(Vector((27.0, -33.0, 0.0)))
    add_lighting_and_camera()

    bpy.context.scene["portal2_source_vpks"] = [str(vpk) for vpk in VPKS]
    bpy.context.scene["portal2_elevator_imported_assets"] = imported
    bpy.context.scene["portal2_elevator_failed_assets"] = failed
    bpy.context.scene.render.engine = "BLENDER_EEVEE"
    bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
    print(f"IMPORTED {len(imported)} ASSETS")
    print(f"FAILED {len(failed)} ASSETS")
    for item in failed:
        print("FAILED:", item)


if __name__ == "__main__":
    main()
