const DEFAULT_DRAWER_NAMES = [
  "SM_Desk_Drawer1",
  "SM_Desk_Drawer2",
  "SM_Desk_Drawer3",
];

export function createDeskDrawerRuntimes(parts, config = {}, prefabName = "Desk") {
  const drawerNames = config.drawerNames ?? DEFAULT_DRAWER_NAMES;
  return drawerNames.flatMap((name, index) => {
    const mesh = parts.get(name);
    if (!mesh) {
      console.warn(`[DeskDrawer] Missing drawer "${name}" in prefab "${prefabName}"`);
      return [];
    }
    return [{
      mesh,
      name,
      index,
      open: false,
      physicsKey: null,
      closedPosition: config.closedPosition ?? 0.18349,
      openPosition: config.openPosition ?? 0.632626,
    }];
  });
}

export function toggleDeskDrawerRuntime(drawer) {
  if (!drawer) return null;
  drawer.open = !drawer.open;
  return drawer.open ? drawer.openPosition - drawer.closedPosition : 0;
}
