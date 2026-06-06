import * as THREE from "three";

const SCREEN_W = 1024;
const SCREEN_H = 512;
const UPDATE_INTERVAL = 1.5;

const BATCHES = ["IGNITION", "STABLE BURN", "GRID SURGE", "IMPURE FUEL", "FINAL HOLD"];
const STATUSES = ["NOMINAL", "WATCH TEMP", "FIELD DRIFT", "LOAD RISING", "OUTPUT TRIM"];

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
    active: false,
    elapsed: 0,
    mesh: null,
    material,
    texture,
    data: makeRandomStatus(),
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

    setActive(active) {
      state.active = active;
      state.elapsed = UPDATE_INTERVAL;
      if (!active) {
        drawStandby(ctx);
        texture.needsUpdate = true;
      }
    },

    update(dt) {
      if (!state.active) return;
      state.elapsed += dt;
      if (state.elapsed < UPDATE_INTERVAL) return;

      state.elapsed = 0;
      state.data = makeRandomStatus(state.data);
      drawStatus(ctx, state.data);
      texture.needsUpdate = true;
    },

    getState() {
      return {
        active: state.active,
        attached: Boolean(state.mesh),
        data: state.data,
      };
    },
  };
}

function makeRandomStatus(previous = {}) {
  const batch = pick(BATCHES);
  const prod = clamp((previous.prod ?? 120) + randomInt(-18, 34), 0, 999);
  const damage = clamp((previous.damage ?? 8) + randomInt(-2, 7), 0, 100);
  const output = clamp(randomInt(48, 96), 0, 100);
  const stability = clamp(randomInt(54, 99), 0, 100);
  const status = damage > 72 ? "DAMAGE HIGH" : stability < 62 ? "FIELD DRIFT" : pick(STATUSES);

  return {
    batch,
    prod,
    damage,
    output,
    stability,
    status,
    time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
  };
}

function drawStandby(ctx) {
  drawBackground(ctx);
  ctx.fillStyle = "#16482e";
  ctx.font = "700 40px Consolas, monospace";
  ctx.fillText("SMALL STATUS SCREEN", 56, 86);

  ctx.fillStyle = "#4f8067";
  ctx.font = "700 30px Consolas, monospace";
  ctx.fillText("STANDBY", 56, 168);
  ctx.fillText("PRESS Button_Test", 56, 220);
}

function drawStatus(ctx, data) {
  drawBackground(ctx);

  ctx.fillStyle = "#45ff92";
  ctx.shadowColor = "#1cff79";
  ctx.shadowBlur = 18;
  ctx.font = "700 36px Consolas, monospace";
  ctx.fillText("FUSION CORE STATUS", 48, 68);

  ctx.shadowBlur = 8;
  ctx.font = "700 46px Consolas, monospace";
  ctx.fillText(`BATCH: ${data.batch}`, 48, 138);

  ctx.font = "700 34px Consolas, monospace";
  drawRow(ctx, "PROD", `${String(data.prod).padStart(3, "0")} MW`, 210);
  drawRow(ctx, "OUTPUT", `${data.output}%`, 270);
  drawRow(ctx, "STABILITY", `${data.stability}%`, 330);
  drawRow(ctx, "DAMAGE", `${data.damage}%`, 390, data.damage > 70);

  ctx.fillStyle = data.status.includes("HIGH") || data.status.includes("DRIFT") ? "#ffcf5a" : "#45ff92";
  ctx.font = "700 34px Consolas, monospace";
  ctx.fillText(`STATUS: ${data.status}`, 48, 462);

  ctx.fillStyle = "#1e7f4c";
  ctx.font = "700 24px Consolas, monospace";
  ctx.fillText(data.time, 818, 68);

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

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
