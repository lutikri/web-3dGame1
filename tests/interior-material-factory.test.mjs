import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createInteriorMaterialFactory } from "../src/materials/InteriorMaterialFactory.js";
import { CONFIG } from "../src/OperatorGameConfig.js";

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
  const roughnessMap = new THREE.Texture();
  factory.applyCustomTextureMaps(custom, { map, ormMap, roughnessMap }, { textureRepeat: [2, 3] });
  assert.equal(custom.map, map);
  assert.equal(custom.aoMap, ormMap);
  assert.equal(custom.metalnessMap, ormMap);
  assert.equal(custom.roughnessMap, roughnessMap);
  assert.deepEqual(map.repeat.toArray(), [2, 3]);
  assert.deepEqual(roughnessMap.repeat.toArray(), [2, 3]);
  assert.deepEqual(patched, ["Wall"]);
});

test("rock and signs materials expose their authored PBR texture sets", () => {
  const { rock1, signs1 } = CONFIG.interior.specialMaterials;

  assert.deepEqual(rock1.materialNames, ["M_Rock1"]);
  assert.match(rock1.maps.preview.roughness, /T_Rock1_Roughness/);
  assert.equal(rock1.maps.preview.orm, undefined);
  assert.deepEqual(signs1.materialNames, ["M_Signs1"]);
  assert.match(signs1.maps.preview.orm, /T_Signs1_OcclusionRoughnessMetallic/);
  assert.match(signs1.maps.preview.emissive, /T_Signs1_Emissive/);
  assert.equal(signs1.emissiveIntensity, 1);
});
