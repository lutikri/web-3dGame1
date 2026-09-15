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

test("brief paper uses an opaque masked material with a restrained albedo", () => {
  const { briefPaper } = CONFIG.interior.specialMaterials;

  assert.equal(briefPaper.color, "#aaa69d");
  assert.equal(briefPaper.transparent, undefined);
  assert.equal(briefPaper.alphaTest, 0.5);
  assert.equal(briefPaper.side, THREE.DoubleSide);
});

test("service terminal exposes authored PBR body and adjustable masked glass materials", () => {
  const { terminalBody, terminalScreen, terminalScreenGlass } = CONFIG.interior.specialMaterials;

  assert.deepEqual(terminalBody.materialNames, ["M_TerminalBase"]);
  assert.match(terminalBody.maps.preview.baseColor, /T_Terminal1_BaseColor/);
  assert.match(terminalBody.maps.preview.normal, /T_Terminal1_Normal/);
  assert.match(terminalBody.maps.preview.orm, /T_Terminal1_OcclusionRoughnessMetallic/);
  assert.deepEqual(terminalScreen.materialNames, ["M_TerminalScreen"]);
  assert.deepEqual(terminalScreenGlass.materialNames, ["M_TerminalScreenGlass"]);
  assert.equal(terminalScreenGlass.maps.initial.mask, "assets/runtime-textures/T_Terminal1_ScreenDirt1_Interactive_Preview_1024.png");
  assert.equal(terminalScreenGlass.maps.preview, undefined);
  assert.equal(terminalScreenGlass.transparent, true);
  assert.equal(terminalScreenGlass.depthTest, false);
  assert.equal(terminalScreenGlass.depthWrite, false);
  assert.equal(terminalScreenGlass.maskAsAlphaMap, true);
  assert.equal(terminalScreenGlass.maskOverlay, undefined);
});

test("core viewport uses its authored PBR texture set", () => {
  const { coreViewport1 } = CONFIG.interior.specialMaterials;

  assert.deepEqual(coreViewport1.materialNames, ["M_CoreViewport1"]);
  assert.match(coreViewport1.maps.preview.baseColor, /T_CoreViewport1_BaseColor/);
  assert.match(coreViewport1.maps.preview.normal, /T_CoreViewport1_Normal/);
  assert.match(coreViewport1.maps.preview.orm, /T_CoreViewport1_OcclusionRoughnessMetallic/);
});

test("cheap dirty glass binds a contrasted transparency mask instead of tinting the full screen", () => {
  const factory = createInteriorMaterialFactory({
    panelConfig: {},
    specialMaterials: { glass: { transparent: true, maskAsAlphaMap: true, alphaMapContrast: 2.3, depthTest: false, depthWrite: false } },
    getPanelTextureMaps: () => null,
    setupMaskOverlay: () => {},
    updateMaskOverlay: () => {},
    patchMaterial: () => {},
  });
  const glass = factory.createCustomMaterials().glass;
  const maskMap = new THREE.Texture();
  factory.applyCustomTextureMaps(glass, { maskMap }, {
    transparent: true,
    maskAsAlphaMap: true,
    alphaMapContrast: 2.3,
    depthTest: false,
    depthWrite: false,
  });

  assert.equal(glass.map, null);
  assert.equal(glass.alphaMap, maskMap);
  assert.equal(glass.alphaMapContrast, 2.3);
  assert.equal(glass.clone().alphaMapContrast, 2.3);
  assert.equal(glass.userData.maskMap, maskMap);
  assert.equal(glass.depthTest, false);
  assert.equal(glass.depthWrite, false);
});
