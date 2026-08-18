import * as THREE from "three";
import {
  applyStatusScreenMaterialConfig,
  createStatusScreenMaterial,
} from "./panels/StatusScreenMaterial.js?v=status-viewport-prefab";

const SCREEN_W = 1024;
const SCREEN_H = 512;
const UPDATE_INTERVAL = 0.35;
const TERMINAL_COLUMNS = 44;
const TERMINAL_ROWS = 20;
const TERMINAL_FONT_SIZE = 24;
const TERMINAL_LINE_HEIGHT = 23.5;
const TERMINAL_SCALE_X = 1.35;
const TERMINAL_LEFT = 48;
const TERMINAL_TOP = 39;
const COLOR_NORMAL = "#45ff92";
const COLOR_LABEL = "#2fbf70";
const COLOR_VALUE = "#abffd0";
const COLOR_WARNING = "#ffcf5a";
const COLOR_FAULT = "#ff5d55";
const COLOR_OFF = "#5f7769";

export function createStatusScreen({ brightness = 1, config = null } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const previousCanvas = document.createElement("canvas");
  previousCanvas.width = SCREEN_W;
  previousCanvas.height = SCREEN_H;

  const ctx = canvas.getContext("2d");
  const previousCtx = previousCanvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  const previousTexture = new THREE.CanvasTexture(previousCanvas);
  previousTexture.colorSpace = THREE.SRGBColorSpace;
  previousTexture.flipY = false;

  const initialConfig = config ?? { brightness };
  const material = createStatusScreenMaterial({
    currentTexture: texture,
    previousTexture,
    width: SCREEN_W,
    height: SCREEN_H,
    config: initialConfig,
  });

  const state = {
    elapsed: UPDATE_INTERVAL,
    persistenceAge: 1000,
    mesh: null,
    material,
    texture,
    previousTexture,
    snapshot: null,
  };

  drawStandby(ctx);
  previousCtx.drawImage(canvas, 0, 0);
  texture.needsUpdate = true;
  previousTexture.needsUpdate = true;

  return {
    attachToMesh(mesh) {
      state.mesh = mesh;
      mesh.material = material;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    },

    setSnapshot(snapshot, force = false) {
      state.snapshot = snapshot;
      if (force) state.elapsed = UPDATE_INTERVAL;
    },

    setPowerFactor(factor = 1) {
      const safeFactor = THREE.MathUtils.clamp(Number(factor ?? 1), 0, 1);
      material.uniforms.uPowerFactor.value = safeFactor;
    },

    applyConfig(nextConfig) {
      return applyStatusScreenMaterialConfig(material, nextConfig);
    },

    update(dt) {
      const safeDt = Math.max(0, Number(dt) || 0);
      material.uniforms.uTime.value += safeDt;
      state.persistenceAge += safeDt;
      material.uniforms.uPersistenceAge.value = state.persistenceAge;
      state.elapsed += safeDt;
      if (state.elapsed < UPDATE_INTERVAL) return;

      state.elapsed = 0;
      previousCtx.clearRect(0, 0, SCREEN_W, SCREEN_H);
      previousCtx.drawImage(canvas, 0, 0);
      if (!state.snapshot || state.snapshot.mode === "standby") {
        drawStandby(ctx);
      } else {
        drawStatus(ctx, state.snapshot);
      }
      state.persistenceAge = 0;
      material.uniforms.uPersistenceAge.value = 0;
      previousTexture.needsUpdate = true;
      texture.needsUpdate = true;
    },

    dispose() {
      texture.dispose();
      previousTexture.dispose();
      material.dispose();
    },

    getState() {
      return {
        attached: Boolean(state.mesh),
        data: state.snapshot,
        effects: { ...material.userData.statusScreenEffects },
      };
    },
  };
}

function drawStandby(ctx) {
  drawBackground(ctx);
  drawTerminalText(ctx, 0, 0, "FUSION CORE CONTROL", COLOR_NORMAL);
  drawTerminalRule(ctx, 1, COLOR_LABEL);
  drawTerminalText(ctx, 3, 0, "SYSTEM INITIALIZATION COMPLETE", COLOR_VALUE);

  drawTerminalText(ctx, 5, 0, "01 CONTROL BUS ..................", COLOR_LABEL);
  drawTerminalText(ctx, 5, 37, "READY", COLOR_VALUE);
  drawTerminalText(ctx, 6, 0, "02 FIELD SUPPLY .................", COLOR_LABEL);
  drawTerminalText(ctx, 6, 37, "READY", COLOR_VALUE);
  drawTerminalText(ctx, 7, 0, "03 COOLANT LOOP .................", COLOR_LABEL);
  drawTerminalText(ctx, 7, 37, "READY", COLOR_VALUE);
  drawTerminalText(ctx, 8, 0, "04 CONTAINMENT ..................", COLOR_LABEL);
  drawTerminalText(ctx, 8, 37, "READY", COLOR_VALUE);

  drawTerminalText(ctx, 11, 0, "SYSTEM STATUS ...................", COLOR_LABEL);
  drawTerminalText(ctx, 11, 37, "STANDBY", COLOR_NORMAL, true);
  drawTerminalRule(ctx, 16, COLOR_LABEL);
  drawTerminalText(ctx, 18, 0, "PRESS START TO BEGIN CORE SEQUENCE _", COLOR_VALUE);
}

function drawStatus(ctx, data) {
  if (data.mode === "selfTest") {
    drawSelfTest(ctx, data);
    return;
  }
  if (data.mode === "startupFault") {
    drawStartupFault(ctx, data);
    return;
  }
  if (data.terminalElapsed != null) {
    drawTerminalStatus(ctx, data);
    return;
  }
  drawBackground(ctx);

  const warning = data.mode === "failed";
  const complete = data.mode === "complete";
  const stateWord = warning ? "FAULT" : complete ? "OFF" : "RUN";

  drawTerminalText(ctx, 0, 0, "FUSION CORE CONTROL", warning ? COLOR_FAULT : COLOR_NORMAL);
  drawTerminalText(ctx, 0, 39, formatTime(data.remaining), COLOR_VALUE);
  drawTerminalRule(ctx, 1, COLOR_LABEL);
  drawTerminalText(ctx, 2, 0, "MODE:", COLOR_LABEL);
  drawTerminalText(ctx, 2, 6, String(data.phase.name).slice(0, 21), COLOR_VALUE);
  drawTerminalText(ctx, 2, 30, "STATE:", COLOR_LABEL);
  drawTerminalText(ctx, 2, 37, stateWord, warning ? COLOR_FAULT : complete ? COLOR_OFF : COLOR_NORMAL, warning);

  if (data.fuelBlend?.label) {
    const blendColor = data.fuelBlend.state === "red" ? COLOR_FAULT : data.fuelBlend.state === "off" ? COLOR_OFF : COLOR_LABEL;
    drawTerminalText(ctx, 3, 0, "FUEL MIX:", COLOR_LABEL);
    drawTerminalText(ctx, 3, 10, String(data.fuelBlend.label).slice(0, 24), blendColor);
  }

  drawTerminalMetric(ctx, 5, "PLASMA TEMP", `${Math.round(data.plasmaTemp)} MK`, data.warning.tempHigh ? "HIGH" : "NOM", data.warning.tempHigh);
  drawTerminalMetric(ctx, 6, "TEMP LIMIT", "140 MK", data.warning.tempCritical ? "TRIP" : "SET", data.warning.tempCritical);
  drawTerminalMetric(ctx, 7, "CONTAINMENT", `${Math.round(data.containment)} %`, data.warning.fieldWeak ? "LOW" : "OK", data.warning.fieldWeak);
  drawTerminalMetric(ctx, 8, "CORE STRESS", `${Math.round(data.coreStress)} %`, data.warning.coreStress ? "HIGH" : "OK", data.warning.coreStress);
  drawTerminalMetric(ctx, 9, "THERMAL SOAK", `${Math.round(data.thermalSoak)} %`, data.warning.thermalSoak ? "HIGH" : "OK", data.warning.thermalSoak);

  drawTerminalMetric(ctx, 11, "OUTPUT", `${Math.round(data.powerOutput)} MW`, data.warning.outputLow ? "LOW" : "ON", data.warning.outputLow);
  drawTerminalMetric(ctx, 12, "REQUEST", `${Math.round(data.targetOutput)} MW`, "SET", false);
  drawTerminalMetric(ctx, 13, "BURN RATE", `${Math.round(data.burnRate * 100)} %`, data.warning.coreStall ? "LOW" : "ON", data.warning.coreStall);
  drawTerminalMetric(ctx, 14, "CORE STALL", `${Math.round(data.coreStall)} %`, data.reactionStalled ? "FAULT" : "OK", data.reactionStalled);
  drawTerminalMetric(ctx, 15, "PULSE CHARGE", `${Math.round(data.pulseCharge)} %`, data.pulseCooldown > 0 ? "WAIT" : "READY", false);

  drawTerminalText(ctx, 16, 0, "FUEL RSV", COLOR_LABEL);
  drawTerminalText(ctx, 16, 10, `${Math.round(data.fuelReserve)} %`, COLOR_VALUE);
  drawTerminalText(ctx, 16, 23, "HEAT SINK", COLOR_LABEL);
  drawTerminalText(ctx, 16, 35, `${Math.round(data.heatSinkCapacity)} %`, COLOR_VALUE);

  drawTerminalRule(ctx, 18, warning ? COLOR_FAULT : COLOR_LABEL);
  const statusColor = warning ? COLOR_FAULT : data.status.includes("STABLE") || complete ? COLOR_NORMAL : COLOR_WARNING;
  drawTerminalText(ctx, 19, 0, warning ? "FAULT" : complete ? "STATUS" : "STATUS", statusColor, warning);
  drawTerminalText(ctx, 19, 8, String(data.status).slice(0, 35), statusColor);

  drawEmergencyBanner(ctx, data);
}

function drawSelfTest(ctx, data) {
  drawBackground(ctx);
  const progress = Math.max(0, Math.min(1, data.selfTestProgress ?? 0));
  const remaining = Math.max(0, Math.ceil((data.selfTestDuration ?? 0) - (data.selfTestElapsed ?? 0)));
  const sweep = Math.floor(progress * 24);
  drawTerminalText(ctx, 0, 0, "FUSION CORE CONTROL", COLOR_NORMAL);
  drawTerminalText(ctx, 0, 37, `${remaining} SEC`, COLOR_VALUE);
  drawTerminalRule(ctx, 1, COLOR_LABEL);
  drawTerminalText(ctx, 2, 0, "MODE: SYSTEM SELF-TEST", COLOR_VALUE);
  drawTerminalText(ctx, 2, 34, "STATE:", COLOR_LABEL);
  drawTerminalText(ctx, 2, 41, "RUN", COLOR_NORMAL, true);

  drawTerminalText(ctx, 5, 0, "01 INDICATOR BUS .................", COLOR_LABEL);
  drawTerminalText(ctx, 5, 37, progress < 0.34 ? "TEST" : "READY", COLOR_VALUE);
  drawTerminalText(ctx, 6, 0, "02 PANEL LAMPS ..................", COLOR_LABEL);
  drawTerminalText(ctx, 6, 37, progress < 0.34 ? "CYCLE" : "HOLD", COLOR_VALUE);
  drawTerminalText(ctx, 7, 0, "03 GAUGE DRIVE ..................", COLOR_LABEL);
  drawTerminalText(ctx, 7, 37, progress < 0.78 ? "SWEEP" : "READY", COLOR_VALUE);
  drawTerminalText(ctx, 8, 0, "04 LOCAL CONTROLS ...............", COLOR_LABEL);
  drawTerminalText(ctx, 8, 37, progress < 0.9 ? "TEST" : "READY", COLOR_VALUE);

  drawTerminalText(ctx, 11, 0, "GAUGE SWEEP INDEX", COLOR_LABEL);
  drawTerminalText(ctx, 11, 22, String(sweep).padStart(2, "0"), COLOR_VALUE);
  drawTerminalText(ctx, 12, 0, "TEST COMPLETION", COLOR_LABEL);
  drawTerminalText(ctx, 12, 22, `${Math.round(progress * 100)} %`, COLOR_VALUE);
  drawTerminalRule(ctx, 18, COLOR_LABEL);
  drawTerminalText(ctx, 19, 0, "STATUS", COLOR_WARNING, true);
  drawTerminalText(ctx, 19, 8, "WATCH PANEL RESPONSE", COLOR_WARNING);
}

function drawStartupFault(ctx, data) {
  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = "#030000";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const blink = Math.floor(performance.now() / 140) % 2 === 0;
  const color = blink ? "#ff4b42" : "#8f1f1b";
  drawTerminalText(ctx, 0, 0, "FUSION CORE CONTROL", color);
  drawTerminalRule(ctx, 1, color);
  drawTerminalText(ctx, 3, 0, "START-UP SEQUENCE ABORTED", color);
  drawTerminalText(ctx, 5, 0, "01 COMMAND SEQUENCE .............", color);
  drawTerminalText(ctx, 5, 37, "FAULT", color, blink);
  drawTerminalText(ctx, 6, 0, "02 START PERMISSIVE .............", color);
  drawTerminalText(ctx, 6, 37, "OFF", color);
  drawTerminalText(ctx, 7, 0, "03 CONTROL LATCH ................", color);
  drawTerminalText(ctx, 7, 37, "LOCK", color);
  drawTerminalText(ctx, 10, 0, "RESET DELAY", color);
  drawTerminalText(ctx, 10, 18, `${Math.ceil(data.resetPending)} SEC`, color);
  drawTerminalText(ctx, 12, 0, "OPERATOR ACTION", color);
  drawTerminalText(ctx, 12, 18, "WAIT FOR RESET", color);
  drawTerminalRule(ctx, 18, color);
  drawTerminalText(ctx, 19, 0, "FAULT", color, blink);
  drawTerminalText(ctx, 19, 8, "START INHIBIT ACTIVE", color);
}

function drawTerminalStatus(ctx, data) {
  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = "#010202";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  if (data.terminalBlackout) return;

  const automaticTrip = data.mode === "failed" && data.failureType !== "qualityFailure";
  const color = automaticTrip ? "#ff4b42" : "#72ff9d";
  const lines = getTerminalStatusLines(data);
  drawTerminalText(ctx, 0, 0, "FUSION CORE CONTROL", color);
  drawTerminalText(ctx, 0, 39, "00:00", color);
  drawTerminalRule(ctx, 1, color);
  drawTerminalText(ctx, 2, 0, "MODE: SHUTDOWN", color);
  drawTerminalText(ctx, 2, 30, "STATE:", color);
  drawTerminalText(ctx, 2, 37, automaticTrip ? "TRIP" : "OFF", color, automaticTrip);
  drawTerminalText(ctx, 5, 0, "01 REACTION .....................", color);
  drawTerminalText(ctx, 5, 37, automaticTrip ? "TRIP" : "OFF", color);
  drawTerminalText(ctx, 6, 0, "02 CORE OUTPUT ..................", color);
  drawTerminalText(ctx, 6, 37, "OFF", color);
  drawTerminalText(ctx, 7, 0, "03 CONTAINMENT ..................", color);
  drawTerminalText(ctx, 7, 37, "HOLD", color);
  drawTerminalText(ctx, 10, 0, "SYSTEM MESSAGE", color);
  drawTerminalText(ctx, 11, 3, lines[0], color);
  drawTerminalText(ctx, 12, 3, lines[1], color);
  drawTerminalText(ctx, 13, 3, lines[2], color);
  drawTerminalRule(ctx, 18, color);
  drawTerminalText(ctx, 19, 0, automaticTrip ? "FAULT" : "STATUS", color, automaticTrip);
  drawTerminalText(ctx, 19, 8, lines[3], color);
}

export function getTerminalStatusLines(data) {
  const automaticTrip = data?.mode === "failed" && data?.failureType !== "qualityFailure";
  return automaticTrip
    ? ["FAIL SAFE", "AUTOMATIC TRIP", "CORE SHUTDOWN", "RESTART EXTERNALLY"]
    : ["CORE SHUTDOWN", "REACTION SECURED", "OUTPUT OFFLINE", "LOCAL RESTART AVAILABLE"];
}

function drawEmergencyBanner(ctx, data) {
  const stall = data.warning.coreStallCritical || data.coreStall > 82;
  const activeHeatSoak = data.thermalSoak > 82 && data.plasmaTemp > 145;
  const activeCoreStress = data.coreStress > 88 && data.plasmaTemp > 135;
  const meltdown =
    data.mode === "failed" ||
    activeCoreStress ||
    activeHeatSoak ||
    (data.warning.tempCritical && data.warning.outputSurge);
  const runaway =
    data.plasmaTemp > 165 ||
    (data.warning.thermalSoak && data.plasmaTemp > 140) ||
    (data.warning.coreStress && data.plasmaTemp > 135);
  if (!meltdown && !runaway && !stall) return;

  const blink = Math.floor(performance.now() / 160) % 2 === 0;
  if (!blink && data.mode !== "failed") return;
  const color = meltdown ? COLOR_FAULT : COLOR_WARNING;
  const alert = meltdown ? "MELTDOWN IMMINENT" : stall ? "CORE STALL" : "THERMAL RUNAWAY";
  const detail = stall
    ? data.reactionStalled
      ? `FUEL >30  COOLANT <58  PULSE ${Math.round((data.ignitionHold / 0.5) * 100)}%`
      : `BURN ${Math.round(data.burnRate * 100)}%  PULSE ${Math.round(data.pulseCharge)}%`
    : `TEMP ${Math.round(data.plasmaTemp)} MK  STRESS ${Math.round(data.coreStress)}%`;

  clearTerminalRows(ctx, 17, 3);
  drawTerminalRule(ctx, 17, color);
  drawTerminalText(ctx, 18, 0, meltdown ? "FAULT" : "WARNING", color, true);
  drawTerminalText(ctx, 18, 8, alert, color);
  drawTerminalText(ctx, 19, 8, detail, color);
}

function drawBackground(ctx) {
  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = "#020504";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);

  ctx.strokeStyle = "rgba(69, 255, 146, 0.09)";
  ctx.lineWidth = 1;
  for (let x = 0; x < SCREEN_W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, SCREEN_H);
    ctx.stroke();
  }
  for (let y = 0; y < SCREEN_H; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_W, y);
    ctx.stroke();
  }

}

function drawTerminalMetric(ctx, row, label, value, state, warning) {
  const stateColor = warning ? COLOR_FAULT : state === "SET" ? COLOR_LABEL : COLOR_VALUE;
  drawTerminalText(ctx, row, 0, label, COLOR_LABEL);
  drawTerminalText(ctx, row, 18, value, warning ? COLOR_WARNING : COLOR_VALUE);
  drawTerminalText(ctx, row, 37, state, stateColor, warning);
}

function drawTerminalRule(ctx, row, color) {
  drawTerminalText(ctx, row, 0, "-".repeat(TERMINAL_COLUMNS), color);
}

function drawTerminalText(ctx, row, column, text, color, reverse = false) {
  if (row < 0 || row >= TERMINAL_ROWS || column >= TERMINAL_COLUMNS) return;
  const safeText = String(text ?? "").slice(0, TERMINAL_COLUMNS - column);

  ctx.save();
  ctx.scale(TERMINAL_SCALE_X, 1);
  ctx.font = `700 ${TERMINAL_FONT_SIZE}px Consolas, monospace`;
  ctx.textAlign = "start";
  ctx.textBaseline = "alphabetic";
  const cellWidth = ctx.measureText("0").width;
  const x = TERMINAL_LEFT / TERMINAL_SCALE_X + column * cellWidth;
  const y = TERMINAL_TOP + row * TERMINAL_LINE_HEIGHT;

  if (reverse) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillRect(x - 2, y - TERMINAL_FONT_SIZE + 4, Math.max(cellWidth * safeText.length + 4, cellWidth), TERMINAL_FONT_SIZE + 3);
    ctx.fillStyle = "#020504";
  } else {
    ctx.fillStyle = color;
    ctx.shadowColor = color === COLOR_FAULT ? "#ff3428" : "#1cff79";
    ctx.shadowBlur = 8;
  }

  ctx.fillText(safeText, x, y);
  ctx.restore();
}

function clearTerminalRows(ctx, firstRow, rowCount) {
  const y = TERMINAL_TOP + (firstRow - 1) * TERMINAL_LINE_HEIGHT + 5;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#020504";
  ctx.fillRect(0, y, SCREEN_W, rowCount * TERMINAL_LINE_HEIGHT + 4);
  ctx.restore();
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
