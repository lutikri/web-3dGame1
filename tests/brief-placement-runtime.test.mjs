import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";

import { resolveBriefSocketPrefabs } from "../src/game/BriefPlacementRuntime.js";

function createSockets() {
  const root = new THREE.Group();
  const second = new THREE.Object3D();
  second.name = "SOCKET_Brief_02";
  second.position.set(2, 3, 4);
  const first = new THREE.Object3D();
  first.name = "SOCKET_Brief_01";
  first.position.set(1, 3, 4);
  root.add(second, first);
  return root;
}

test("brief placement maps localized sheets to sorted level sockets", () => {
  const config = {
    sheets: { en: ["en-1.png"], ru: ["ru-1.png", "ru-2.png"] },
    briefingLevelId: "intro-shift",
    holdSeconds: 1.5,
  };
  const english = resolveBriefSocketPrefabs(createSockets(), config, "en");
  const russian = resolveBriefSocketPrefabs(createSockets(), config, "ru");

  assert.equal(english.length, 1);
  assert.equal(english[0].name, "Brief_01");
  assert.equal(english[0].briefSheet.texturePath, "en-1.png");
  assert.equal(russian.length, 2);
  assert.equal(russian[1].name, "Brief_02");
  assert.equal(russian[1].briefSheet.texturePath, "ru-2.png");
  assert.deepEqual(russian[1].position.toArray(), [2, 3, 4]);
});
