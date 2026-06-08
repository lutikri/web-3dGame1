import * as THREE from "three";

const SCREEN_W = 1024;
const SCREEN_H = 512;
const UPDATE_INTERVAL = 0.35;

export function createStatusScreen() {
  const canvas = document.createElement("canvas");
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;

  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
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
  ctx.fillText("PRESS Button_Test", 56, 220);
}

function drawStatus(ctx, data) {
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
  drawRow(ctx, "TEMP", `${Math.round(data.plasmaTemp)} MK`, 190, data.warning.tempHigh || data.warning.quenchRisk);
  drawRow(ctx, "CONTAIN", `${Math.round(data.containment)}%`, 242, data.warning.fieldWeak);
  drawRow(ctx, "OUTPUT", `${Math.round(data.powerOutput)} / ${Math.round(data.targetOutput)} MW`, 294, data.warning.outputLow);
  drawRow(ctx, "EFF", `${Math.round(data.reactionEfficiency)}%`, 346, data.reactionEfficiency < 55);
  drawRow(ctx, "CORE STRESS", `${Math.round(data.coreStress)}%`, 398, data.warning.coreStress);

  ctx.fillStyle = warning ? "#ff5d55" : data.status.includes("STABLE") || complete ? "#45ff92" : "#ffcf5a";
  ctx.font = "700 32px Consolas, monospace";
  ctx.fillText(`STATUS: ${data.status}`, 48, 462);

  ctx.shadowBlur = 0;
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
