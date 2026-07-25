const PANEL_SOUNDS = [
  "Core1_DefaultLoop1", "Core1_Panel1_AlarmCoreStall", "Core1_Panel1_AlarmHighCoreStress1",
  "Core1_Panel1_AlarmHighTemp1", "Core1_Panel1_Loop", "Core1_Pulse", "Core1_StartupFailed1",
  "Core1_StartupNormal1", "Core1_Stress_Loop", "Core1_Trip1", "Core1_TurnDown",
  "Panel_KnobTick1", "Panel_KnobTick2", "Panel_KnobTick3",
  "Button_Light1", "Button_Light2", "Button_Light3", "ButtonMechanical1", "ButtonMechanical2",
  "ButtonMechanical3", "ButtonMechanical4", "LampTurnOn1",
];
const LAMP_SOUNDS = ["LampConstantBuzz1", "LampConstantBuzz2", "LampConstantBuzzBroken1", "LampTurnOn1"];
const RADIO_SOUNDS = ["MessageEN_Welcome1", "MessageRU_Welcome1", "MessageEN_WelcomeElevator1", "MessageRU_WelcomeElevator1"];
const BULKHEAD_SOUNDS = ["DoorBulk1_Open1", "DoorBulk1_Close1", "DoorBulk1_LatchCrank1"];
const SERVICE_DOOR_SOUNDS = ["DoorPushbar_Open1", "DoorPushbar_Close1"];

export function collectLevelSoundKeys({ levelId, environment, runtimeSoundKeys = [], hasOperatorPanel, soundRegistry }) {
  const keys = new Set(runtimeSoundKeys);
  keys.add("Footsteps1_Walk1");
  if (environment?.tutorial?.enabled) keys.add("UI_Hint2");
  if (hasOperatorPanel) PANEL_SOUNDS.forEach((key) => keys.add(key));
  (environment?.prefabs ?? []).forEach((prefab) => {
    if (prefab.light) LAMP_SOUNDS.forEach((key) => keys.add(key));
    if (prefab.radio) RADIO_SOUNDS.forEach((key) => keys.add(key));
    if (prefab.prefabType === "bulkheadDoor") BULKHEAD_SOUNDS.forEach((key) => keys.add(key));
    if (["serviceDoor", "door2", "ServiceDoor1"].includes(prefab.prefabType)) SERVICE_DOOR_SOUNDS.forEach((key) => keys.add(key));
    if (prefab.barrierGate) [prefab.barrierGate.unlockMotorSoundKey, prefab.barrierGate.unlockBeepSoundKey].filter(Boolean).forEach((key) => keys.add(key));
    if (prefab.controlPost) [prefab.controlPost.buzzSoundKey, prefab.controlPost.alertSoundKey].filter(Boolean).forEach((key) => keys.add(key));
  });
  return [...keys].filter((key) => soundRegistry[key]).sort();
}
