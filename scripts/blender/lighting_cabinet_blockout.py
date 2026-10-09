"""Build an editable, material-free cabinet blockout in a standalone Blender file.

Run with Blender --background --factory-startup --python <this file>.
The generated FBX preserves polygon faces for import into the live TempScene.
"""
import bpy
import json
import math
from pathlib import Path
from mathutils import Vector

OUT = Path(__file__).resolve().parents[2] / 'renders' / 'lighting-cabinet-blockout'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.name = 'TempScene'
scene.unit_settings.system = 'METRIC'
scene.unit_settings.length_unit = 'METERS'

collection = bpy.data.collections.new('LightingCabinet_Blockout')
scene.collection.children.link(collection)
root = bpy.data.objects.new('LightingCabinet_Root', None)
collection.objects.link(root)
root['description'] = 'Reference lighting distribution cabinet; untextured editable blockout'
root['cabinet_dimensions_m'] = '0.70 x 0.20 x 1.00'
parts = []

def register(obj, name, parent=root, bevel=0):
    obj.name = name
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.clear()
    if bevel:
        mod = obj.modifiers.new('Blockout edge chamfer', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
    parts.append(obj)
    return obj

def box(name, location, dimensions, parent=root, bevel=0.001):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.scale = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return register(obj, name, parent, bevel)

def cylinder(name, location, radius, depth, axis='Z', parent=root, vertices=16):
    rotation = {'Z': (0, 0, 0), 'X': (0, math.pi/2, 0), 'Y': (math.pi/2, 0, 0)}[axis]
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth,
                                       location=location, rotation=rotation)
    return register(bpy.context.object, name, parent)

def cable(name, points, radius=0.012):
    data = bpy.data.curves.new(name, 'CURVE')
    data.dimensions = '3D'
    data.resolution_u = 8
    data.bevel_depth = radius
    data.bevel_resolution = 1
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = 'AUTO'
        point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    obj.parent = root
    parts.append(obj)
    return obj

# Folded enclosure shell: front faces look along -Y, base rests at Z=0.
box('Cabinet_Back', (0, .093, .5), (.684, .014, .978))
box('Cabinet_LeftWall', (-.344, -.003, .5), (.012, .2, 1))
box('Cabinet_RightWall', (.344, -.003, .5), (.012, .2, 1))
box('Cabinet_TopWall', (0, -.003, .994), (.688, .2, .012))
box('Cabinet_BottomWall', (0, -.003, .006), (.688, .2, .012))
box('FrontFrame_Left', (-.334, -.107, .5), (.032, .025, 1), bevel=.002)
box('FrontFrame_Right', (.334, -.107, .5), (.032, .025, 1), bevel=.002)
box('FrontFrame_Top', (0, -.107, .984), (.636, .025, .032), bevel=.002)
box('FrontFrame_Bottom', (0, -.107, .016), (.636, .025, .032), bevel=.002)

box('Header_Plate', (0, -.09, .883), (.595, .014, .137), bevel=.002)
box('Switches_MountingPanel', (-.112, -.074, .508), (.371, .013, .599))
box('Isolator_MountingPanel', (.19, -.078, .508), (.218, .014, .599), bevel=.002)
box('Panel_BottomRail', (0, -.079, .199), (.597, .022, .018))

for i in range(6):
    z = .758 - i * .100
    prefix = f'Circuit_{i+1:02d}'
    box(prefix+'_FacePlate', (-.112, -.092, z), (.356, .015, .092))
    box(prefix+'_NumberPlate', (-.269, -.103, z), (.028, .006, .037), bevel=0)
    box(prefix+'_BreakerBase', (-.2, -.11, z), (.091, .025, .080), bevel=.002)
    box(prefix+'_BreakerBody', (-.2, -.128, z), (.060, .025, .065), bevel=.002)
    handle = box(prefix+'_BreakerToggle', (-.198, -.148, z+.004), (.055, .026, .022), bevel=.002)
    handle.rotation_euler.x = math.radians(12 if i in (2, 4) else -12)
    box(prefix+'_LabelPlate', (-.08, -.105, z), (.145, .006, .057), bevel=.001)
    cylinder(prefix+'_PilotBezel', (.017, -.108, z), .0175, .015, 'Y')
    cylinder(prefix+'_PilotLens', (.017, -.118, z), .0125, .01, 'Y')

box('Isolator_LabelPlate', (.19, -.091, .735), (.164, .007, .052))
box('Isolator_RecessLeft', (.125, -.105, .532), (.015, .027, .270))
box('Isolator_RecessRight', (.254, -.105, .532), (.015, .027, .270))
box('Isolator_RecessTop', (.1895, -.105, .66), (.114, .027, .014))
box('Isolator_RecessBottom', (.1895, -.105, .404), (.114, .027, .014))
box('Isolator_RecessBack', (.1895, -.095, .532), (.114, .006, .243))
lever = box('Isolator_LeverArm', (.1895, -.125, .535), (.050, .036, .181), bevel=.003)
lever.rotation_euler.x = math.radians(-9)
cylinder('Isolator_HandleGrip', (.1895, -.16, .626), .021, .122, 'X')
cylinder('Isolator_GripEndLeft', (.1245, -.16, .626), .025, .012, 'X')
cylinder('Isolator_GripEndRight', (.2545, -.16, .626), .025, .012, 'X')
box('Isolator_WarningPlate', (.19, -.091, .300), (.164, .007, .061))

# Cable compartment, with editable Bezier paths in the .blend source.
cable('Cable_LeftFeed', [(-.284,.015,.195),(-.278,-.025,.109),(-.299,-.028,.044)])
cable('Cable_MainFeed_A', [(-.014,.015,.202),(-.065,-.005,.13),(-.153,-.035,.116),(-.189,-.035,.034)], .014)
cable('Cable_MainFeed_B', [(.029,.026,.204),(-.018,.008,.12),(-.108,-.022,.084),(-.123,-.028,.034)], .014)
cable('Cable_Return_A', [(-.083,.045,.199),(-.143,.03,.13),(-.204,.005,.112),(-.238,-.002,.035)], .011)
cable('Cable_Return_B', [(.054,.05,.199),(.009,.047,.087),(-.055,.013,.066),(-.071,.012,.03)], .010)
cable('Cable_RightFeed', [(.285,.031,.193),(.297,.012,.095),(.271,-.022,.043)], .011)
box('Cable_Clamp_Left', (-.184, -.06, .04), (.061, .021, .027))
box('Cable_Clamp_Right', (.245, -.032, .134), (.063, .025, .029))
box('Supply_TerminalCover', (.067, -.068, .066), (.320, .034, .059))
box('Supply_LabelPlate', (-.014, -.088, .066), (.094, .005, .037), bevel=0)

# Door components use hinge-local coordinates; rotate the parent to close it.
hinge = bpy.data.objects.new('Door_HingePivot', None)
collection.objects.link(hinge)
hinge.parent = root
hinge.location = (.356, -.116, .5)
hinge.rotation_euler.z = math.radians(145)
hinge['closed_rotation_z_degrees'] = 0.0
hinge['open_rotation_z_degrees'] = 145.0
box('Door_Skin', (-.341, -.004, 0), (.674, .010, .976), hinge, .002)
box('Door_InnerFrame_FreeEdge', (-.664, .008, 0), (.021, .022, .978), hinge)
box('Door_InnerFrame_HingeEdge', (-.018, .008, 0), (.021, .022, .978), hinge)
box('Door_InnerFrame_Top', (-.341, .008, .479), (.625, .022, .020), hinge)
box('Door_InnerFrame_Bottom', (-.341, .008, -.479), (.625, .022, .020), hinge)
box('Door_AssetPlate', (-.45, .017, .379), (.230, .007, .108), hinge)
box('Door_CircuitDirectoryPlate', (-.334, .016, .017), (.422, .006, .482), hinge)
box('Door_DangerPlate', (-.37, .016, -.333), (.29, .007, .169), hinge)
box('Door_LatchBase', (-.647, .023, -.005), (.056, .032, .068), hinge)
cylinder('Door_LatchSocket', (-.647, .05, -.005), .017, .029, 'Y', hinge)
cylinder('Door_LatchKeyRecess', (-.647, .067, -.005), .009, .004, 'Y', hinge)
box('Door_LatchTongue', (-.693, .014, -.005), (.05, .025, .040), hinge)
for i, z in enumerate((.195, .822), 1):
    box(f'Hinge_{i}_CabinetLeaf', (.335, -.112, z), (.035, .012, .075))
    cylinder(f'Hinge_{i}_Barrel', (.356, -.116, z), .016, .078)

assert len([obj for obj in parts if obj.name.endswith('_BreakerToggle')]) == 6
assert all(len(obj.data.materials) == 0 for obj in parts)
assert abs(hinge.rotation_euler.z - math.radians(145)) < 1e-6

# Store the native editable source before adding any preview camera.
for obj in scene.objects:
    obj.select_set(False)
for obj in collection.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = root
blend_path = OUT / 'LightingCabinet_Blockout.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
bpy.ops.export_scene.gltf(filepath=str(OUT/'LightingCabinet_Blockout.glb'),
                          export_format='GLB', use_selection=True,
                          export_materials='NONE', export_apply=True, export_extras=True,
                          export_yup=True)
bpy.ops.export_scene.fbx(filepath=str(OUT/'LightingCabinet_Blockout.fbx'),
                         use_selection=True, object_types={'MESH', 'EMPTY', 'OTHER'},
                         use_mesh_modifiers=False, bake_anim=False,
                         add_leaf_bones=False, mesh_smooth_type='FACE')

# Workbench preview: neutral solid shading, no material datablocks.
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.studio_light = 'paint.sl'
scene.display.shading.color_type = 'SINGLE'
scene.display.shading.single_color = (.62, .62, .62)
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'BOTH'
scene.display.shading.show_specular_highlight = True
scene.display.shading.background_type = 'WORLD'
scene.world.color = (.16, .16, .16)
scene.render.resolution_x = 1400
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
camera_data = bpy.data.cameras.new('PreviewCamera')
camera = bpy.data.objects.new('PreviewCamera', camera_data)
scene.collection.objects.link(camera)
camera.location = (.64, -3.8, 1.43)
target = Vector((.29, -.06, .50))
camera.rotation_euler = (target- camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 1.55
scene.camera = camera
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(OUT / 'LightingCabinet_Blockout_preview.png')
bpy.ops.render.render(write_still=True)
print('BLOCKOUT_RESULT ' + json.dumps({'blend': str(blend_path), 'parts': len(parts),
                                       'mesh_material_slots': 0, 'door_open_deg': 145}))
