import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createInteriorMaterialFactory } from "../src/materials/InteriorMaterialFactory.js";

test("interior material factory owns panel and custom PBR map binding", () => {
  const patched = [];
  const factory = createInteriorMaterialFactory({
    panelConfig: { placeholderColor: "#123456" },
    specialMaterials: { wall: { name: "Wall", textureRepeat: [2, 3] } },
    getPanelTextureMaps: () => null,
    setupMaskOverlay: () => {},
    updateMaskOverlay: () => {},
    patchMaterial: (material) => patched.push(material.name),
  });
  const panel = factory.createPanelMaterial("Panel");
  assert.equal(panel.color.getHexString(), "123456");
  const custom = factory.createCustomMaterials().wall;
  const map = new THREE.Texture();
  const ormMap = new THREE.Texture();
  factory.applyCustomTextureMaps(custom, { map, ormMap }, { textureRepeat: [2, 3] });
  assert.equal(custom.map, map);
  assert.equal(custom.roughnessMap, ormMap);
  assert.deepEqual(map.repeat.toArray(), [2, 3]);
  assert.deepEqual(patched, ["Wall"]);
});
