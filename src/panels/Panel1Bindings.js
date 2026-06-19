export const PANEL1_GAUGE_RANGES = {
  plasmaTemp: [0, 180],
  containment: [0, 100],
  powerOutput: [0, 1200],
  targetOutput: [0, 1200],
  fuelReserve: [0, 100],
  heatSinkCapacity: [0, 100],
  coreStress: [0, 100],
  reactionEfficiency: [0, 100],
};

export const PANEL1_LAMP_WARNING_KEYS = {
  LightCase1_Light_COREDAMAGE: "coreStress",
  LightCase1_Light_FIELDWEAK: "fieldWeak",
  LightCase1_Light_INSTABILITY: "instability",
  LightCase1_Light_OUTPUTLOW: "outputLow",
  LightCase1_Light_QUENCH_RISK: "coreStall",
  LightCase1_Light_QUENCHRISK: "coreStall",
  LightCase1_Light_TEMPHIGH: "tempHigh",
};
