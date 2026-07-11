import * as THREE from "three";

const SCREEN_W = 1024;
const SCREEN_H = 512;
const UPDATE_INTERVAL = 0.35;

export function createStatusScreen({ brightness = 1 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;

  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: new THREE.Color().setRGB(brightness, brightness, brightness),
    toneMapped: false,
  });

  const state = {
    elapsed: UPDATE_INTERVAL,
    mesh: null,
    material,
    texture,
    snapshot: null,
  };

  drawStandby(ctx);
  texture.needsUpdate = true;

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
      material.color.setRGB(brightness * safeFactor, brightness * safeFactor, brightness * safeFactor);
    },

    update(dt) {
      state.elapsed += dt;
      if (state.elapsed < UPDATE_INTERVAL) return;

      state.elapsed = 0;
      if (!state.snapshot || state.snapshot.mode === "standby") {
        drawStandby(ctx);
      } else {
        drawStatus(ctx, state.snapshot);
      }
      texture.needsUpdate = true;
    },

    getState() {
      return {
        attached: Boolean(state.mesh),
        data: state.snapshot,
      };
    },
  };
}

function drawStandby(ctx) {
  drawBackground(ctx);
  ctx.fillStyle = "#16482e";
  ctx.font = "700 40px Consolas, monospace";
  ctx.fillText("FUSION CORE CONSOLE", 56, 86);

  ctx.fillStyle = "#4f8067";
  ctx.font = "700 30px Consolas, monospace";
  ctx.fillText("STANDBY", 56, 168);
  ctx.fillText("PRESS START", 56, 220);
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

  ctx.fillStyle = warning ? "#ff5d55" : complete ? "#a8ffbf" : "#45ff92";
  ctx.shadowColor = warning ? "#ff3428" : "#1cff79";
  ctx.shadowBlur = 18;
  ctx.font = "700 36px Consolas, monospace";
  ctx.fillText("FUSION CORE STATUS", 48, 68);

  ctx.shadowBlur = 8;
  ctx.font = "700 34px Consolas, monospace";
  ctx.fillText(`PHASE: ${data.phase.name}`, 48, 126);
  ctx.fillText(`TIME: ${formatTime(data.remaining)}`, 704, 126);

  ctx.font = "700 28px Consolas, monospace";
  drawRow(ctx, "TEMP", `${Math.round(data.plasmaTemp)} MK`, 190, data.warning.tempHigh);
  drawRow(ctx, "CONTAIN", `${Math.round(data.containment)}%`, 242, data.warning.fieldWeak);
  drawRow(ctx, "OUTPUT", `${Math.round(data.powerOutput)} / ${Math.round(data.targetOutput)} MW`, 294, data.warning.outputLow);
  drawRow(ctx, "BURN", `${Math.round(data.burnRate * 100)}%`, 346, data.warning.coreStall);
  const ignitionProgress = Math.round((data.ignitionHold / 0.5) * 100);
  const stallReadout = data.reactionStalled
    ? `${Math.round(data.coreStall)}%  IGN ${ignitionProgress}%`
    : `${Math.round(data.coreStall)}%  PULSE ${Math.round(data.pulseCharge)}%`;
  drawRow(ctx, "STALL", stallReadout, 398, data.warning.coreStall);
  drawRow(ctx, "STRESS", `${Math.round(data.coreStress)}%`, 450, data.warning.coreStress);
  drawEmergencyBanner(ctx, data);

  ctx.fillStyle = warning ? "#ff5d55" : data.status.includes("STABLE") || complete ? "#45ff92" : "#ffcf5a";
  ctx.font = "700 28px Consolas, monospace";
  ctx.fillText(`STATUS: ${data.status}`, 48, 492);

  ctx.shadowBlur = 0;
}

function drawSelfTest(ctx, data) {
  drawBackground(ctx);
  const progress = Math.max(0, Math.min(1, data.selfTestProgress ?? 0));
  const remaining = Math.max(0, Math.ceil((data.selfTestDuration ?? 0) - (data.selfTestElapsed ?? 0)));
  const sweep = Math.floor(progress * 24);

  ctx.fillStyle = "#45ff92";
  ctx.shadowColor = "#1cff79";
  ctx.shadowBlur = 18;
  ctx.font = "900 58px Consolas, monospace";
  ctx.fillText("SELF-TEST", 48, 96);

  ctx.shadowBlur = 8;
  ctx.font = "700 30px Consolas, monospace";
  ctx.fillText("INDICATOR BUS CHECK", 48, 158);
  ctx.fillText(`TIME: ${remaining} SEC`, 704, 158);

  ctx.strokeStyle = "rgba(69, 255, 146, 0.52)";
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 210, SCREEN_W - 96, 46);
  ctx.fillStyle = "rgba(69, 255, 146, 0.28)";
  ctx.fillRect(56, 218, (SCREEN_W - 112) * progress, 30);

  ctx.font = "700 26px Consolas, monospace";
  drawRow(ctx, "LAMPS", `${progress < 0.34 ? "COLOR CYCLE" : "HOLD"}`, 318, false);
  drawRow(ctx, "GAUGES", `${progress < 0.78 ? "SWEEP " + String(sweep).padStart(2, "0") : "RETURN"}`, 370, false);
  drawRow(ctx, "CONTROLS", "LOCAL RESPONSE", 422, false);

  ctx.fillStyle = "#ffcf5a";
  ctx.font = "700 25px Consolas, monospace";
  ctx.fillText("WATCH PANEL RESPONSE", 48, 492);
  ctx.shadowBlur = 0;
}

function drawStartupFault(ctx, data) {
  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = "#030000";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  const blink = Math.floor(performance.now() / 140) % 2 === 0;
  const color = blink ? "#ff4b42" : "#8f1f1b";

  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.strokeRect(34, 32, SCREEN_W - 68, SCREEN_H - 64);
  ctx.fillStyle = color;
  ctx.shadowColor = "#ff241a";
  ctx.shadowBlur = blink ? 26 : 8;
  ctx.textAlign = "center";
  ctx.font = "900 76px Consolas, monospace";
  ctx.fillText("START-UP FAIL", SCREEN_W / 2, 164);
  ctx.font = "800 38px Consolas, monospace";
  ctx.fillText("COMMAND SEQUENCE CONFLICT", SCREEN_W / 2, 254);
  ctx.shadowBlur = 8;
  ctx.font = "800 42px Consolas, monospace";
  ctx.fillText(`RESET PENDING  ${Math.ceil(data.resetPending)} SEC`, SCREEN_W / 2, 354);
  ctx.font = "700 25px Consolas, monospace";
  ctx.fillText("START INHIBIT ACTIVE", SCREEN_W / 2, 425);
  ctx.textAlign = "start";
  ctx.shadowBlur = 0;
}

function drawTerminalStatus(ctx, data) {
  ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);
  ctx.fillStyle = "#010202";
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  if (data.terminalBlackout) return;

  const complete = data.mode === "complete";
  const destroyed = data.failureType === "coreDestroyed";
  const color = complete ? "#72ff9d" : destroyed ? "#ff4b42" : "#ffcf5a";
  const lines = complete
    ? ["SHIFT COMPLETE", "CORE SECURED", "CONTROLLED SHUTDOWN"]
    : destroyed
      ? ["FAIL SAFE", "CORE DESTROYED", "EMERGENCY SHUTDOWN"]
      : ["SHIFT FAILED", "FAIL-SAFE ACTIVE", "CORE SHUTDOWN"];

  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.strokeRect(34, 32, SCREEN_W - 68, SCREEN_H - 64);
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.textAlign = "center";
  ctx.font = "900 72px Consolas, monospace";
  ctx.fillText(lines[0], SCREEN_W / 2, 154);
  ctx.font = "900 56px Consolas, monospace";
  ctx.fillText(lines[1], SCREEN_W / 2, 262);
  ctx.shadowBlur = 8;
  ctx.font = "700 34px Consolas, monospace";
  ctx.fillText(lines[2], SCREEN_W / 2, 360);
  ctx.font = "700 24px Consolas, monospace";
  ctx.fillText("AUTOMATIC PROTECTION SEQUENCE", SCREEN_W / 2, 430);
  ctx.textAlign = "start";
  ctx.shadowBlur = 0;
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

  ctx.save();
  ctx.fillStyle = "rgba(8, 0, 0, 0.82)";
  ctx.fillRect(32, 154, SCREEN_W - 64, 172);
  ctx.strokeStyle = meltdown ? "#ff3428" : "#ffcf5a";
  ctx.lineWidth = 6;
  ctx.strokeRect(38, 160, SCREEN_W - 76, 160);

  ctx.shadowColor = meltdown ? "#ff3428" : "#ffcf5a";
  ctx.shadowBlur = 22;
  ctx.fillStyle = meltdown ? "#ff5d55" : "#ffcf5a";
  ctx.font = "900 64px Consolas, monospace";
  ctx.textAlign = "center";
  ctx.fillText(meltdown ? "MELTDOWN IMMINENT" : stall ? "CORE STALL" : "THERMAL RUNAWAY", SCREEN_W / 2, 236);

  ctx.font = "700 30px Consolas, monospace";
  ctx.fillText(
    stall
      ? data.reactionStalled
        ? `FUEL >30  COOLANT <58  HOLD PULSE ${Math.round((data.ignitionHold / 0.5) * 100)}%`
        : `BURN ${Math.round(data.burnRate * 100)}%  PULSE ${Math.round(data.pulseCharge)}%`
      : `TEMP ${Math.round(data.plasmaTemp)} MK  STRESS ${Math.round(data.coreStress)}%`,
    SCREEN_W / 2,
    286,
  );
  ctx.restore();
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

  ctx.fillStyle = "rgba(69, 255, 146, 0.04)";
  for (let y = 0; y < SCREEN_H; y += 6) {
    ctx.fillRect(0, y, SCREEN_W, 2);
  }
}

function drawRow(ctx, label, value, y, warning = false) {
  ctx.fillStyle = "#2fbf70";
  ctx.fillText(`${label}:`, 64, y);
  ctx.fillStyle = warning ? "#ff5d55" : "#abffd0";
  ctx.fillText(value, 360, y);
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
