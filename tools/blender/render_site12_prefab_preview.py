import os
from pathlib import Path

import bpy
from mathutils import Vector


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = PROJECT_ROOT / "renders" / "blender" / "site12_loose_pipe_prefab.png"


def point_camera(camera, target):
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def main():
    instance = bpy.data.objects.get("PF_LoosePipe1_QualificationScare01")
    if instance is None:
        raise RuntimeError("Loose pipe example instance is missing")

    scene = bpy.context.scene
    bpy.context.view_layer.update()
    for obj in scene.objects:
        obj.hide_render = obj != instance

    center = instance.matrix_world.translation.copy()
    radius = max(max(instance.dimensions), 0.8)

    camera_data = bpy.data.cameras.new("TGLOBAL_VerifyCamera")
    camera = bpy.data.objects.new("TGLOBAL_VerifyCamera", camera_data)
    scene.collection.objects.link(camera)
    camera.location = center + Vector((radius * 1.6, -radius * 1.9, radius * 1.15))
    camera_data.lens = 58
    point_camera(camera, center)
    scene.camera = camera

    key_data = bpy.data.lights.new("TGLOBAL_VerifyKey", "AREA")
    key_data.energy = 850
    key_data.shape = "DISK"
    key_data.size = radius * 2.2
    key = bpy.data.objects.new("TGLOBAL_VerifyKey", key_data)
    scene.collection.objects.link(key)
    key.location = center + Vector((radius, -radius, radius * 2.5))
    point_camera(key, center)

    fill_data = bpy.data.lights.new("TGLOBAL_VerifyFill", "AREA")
    fill_data.energy = 400
    fill_data.size = radius * 2.5
    fill = bpy.data.objects.new("TGLOBAL_VerifyFill", fill_data)
    scene.collection.objects.link(fill)
    fill.location = center + Vector((-radius * 1.5, radius, radius))
    point_camera(fill, center)

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(OUTPUT)
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("TGLOBAL_VerifyWorld")
    scene.world.color = (0.025, 0.025, 0.025)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    if not OUTPUT.is_file() or OUTPUT.stat().st_size == 0:
        raise RuntimeError("Preview render was not written")
    print(f"[Site12AuthoringPreview] {OUTPUT}")


if __name__ == "__main__":
    main()
