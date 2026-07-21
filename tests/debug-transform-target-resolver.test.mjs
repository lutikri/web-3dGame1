import assert from "node:assert/strict";
import test from "node:test";

import { DebugTransformTargetResolver } from "../src/ui/debug/DebugTransformTargetResolver.js";

test("debug transform target resolver maps authored descriptor kinds to runtime objects", () => {
  const panel = { name: "panel" };
  const root = { name: "prefab" };
  const light = { name: "prefabLight" };
  const levelLight = { name: "levelLight" };
  const globalLight = { name: "globalLight" };
  const resolver = new DebugTransformTargetResolver({
    config: { levelEnvironments: { room: { prefabs: [
      { name: "Panel", behavior: "operatorPanel" }, { name: "Lamp", behavior: "light" },
    ] } } },
    getPanelModel: () => panel,
    getPrefabInstance: (_levelId, key) => key === "Lamp" ? { root, light } : null,
    getPointLight: (levelId, key) => levelId === "room" && key === "task" ? levelLight : key === "sun" ? globalLight : null,
  });

  assert.equal(resolver.resolve({ type: "prefab", levelId: "room", key: "Panel" }), panel);
  assert.equal(resolver.resolve({ type: "prefab", levelId: "room", key: "Lamp" }), root);
  assert.equal(resolver.resolve({ type: "prefabLightOffset", levelId: "room", key: "Lamp" }), light);
  assert.equal(resolver.resolve({ type: "levelPointLight", levelId: "room", key: "task" }), levelLight);
  assert.equal(resolver.resolve({ type: "globalPointLight", key: "sun" }), globalLight);
  assert.equal(resolver.resolve({ type: "unknown" }), null);
});
