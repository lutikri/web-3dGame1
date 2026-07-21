import * as THREE from "three";

const DEFAULT_DURATION_SECONDS = 80;
const DEFAULT_DOOR_OPEN_HEIGHT = 1.75;
const DEFAULT_DOOR_OPEN_SECONDS = 2.4;

export function createElevatorRuntime(root, parts, config = {}) {
  const cage = parts.get(config.cageName ?? "SM_ElevatorCage1") ?? null;
  const door = parts.get(config.doorName ?? "SM_ElevatorDoor1") ?? null;
  root.userData.elevatorInitialPosition = root.position.clone();
  if (cage) cage.userData.elevatorInitialPosition = cage.position.clone();
  if (door) door.userData.elevatorInitialPosition = door.position.clone();
  return {
    ...config,
    root,
    cage,
    door,
    elapsed: 0,
    arrived: false,
    doorElapsed: 0,
    lastRideDelta: new THREE.Vector3(),
  };
}

export function resetElevatorRuntime(elevatorRuntime) {
  if (!elevatorRuntime) return;
  elevatorRuntime.elapsed = 0;
  elevatorRuntime.arrived = false;
  elevatorRuntime.doorElapsed = 0;
  elevatorRuntime.lastRideDelta?.set?.(0, 0, 0);
  if (elevatorRuntime.root?.userData.elevatorInitialPosition) {
    elevatorRuntime.root.position.copy(elevatorRuntime.root.userData.elevatorInitialPosition);
  }
  if (elevatorRuntime.cage?.userData.elevatorInitialPosition) {
    elevatorRuntime.cage.position.copy(elevatorRuntime.cage.userData.elevatorInitialPosition);
  }
  if (elevatorRuntime.door?.userData.elevatorInitialPosition) {
    elevatorRuntime.door.position.copy(elevatorRuntime.door.userData.elevatorInitialPosition);
  }
}

export function updateElevatorRuntime(elevatorRuntime, dt) {
  if (!elevatorRuntime?.root) return null;
  const previousWorldPosition = new THREE.Vector3();
  elevatorRuntime.root.getWorldPosition(previousWorldPosition);

  const duration = Math.max(0.001, elevatorRuntime.travelDurationSeconds ?? DEFAULT_DURATION_SECONDS);
  elevatorRuntime.elapsed = Math.min(duration, (elevatorRuntime.elapsed ?? 0) + dt);
  const progress = THREE.MathUtils.clamp(elevatorRuntime.elapsed / duration, 0, 1);
  const eased = smoothProgress(progress);
  const startY = Number(elevatorRuntime.startY ?? elevatorRuntime.root.userData.elevatorInitialPosition?.y ?? elevatorRuntime.root.position.y);
  const endY = Number(elevatorRuntime.endY ?? 0);
  elevatorRuntime.root.position.y = THREE.MathUtils.lerp(startY, endY, eased);
  elevatorRuntime.arrived = progress >= 1;

  if (elevatorRuntime.arrived && elevatorRuntime.door) {
    const doorDuration = Math.max(0.001, elevatorRuntime.doorOpenSeconds ?? DEFAULT_DOOR_OPEN_SECONDS);
    elevatorRuntime.doorElapsed = Math.min(doorDuration, (elevatorRuntime.doorElapsed ?? 0) + dt);
    const doorProgress = smoothProgress(elevatorRuntime.doorElapsed / doorDuration);
    const initial = elevatorRuntime.door.userData.elevatorInitialPosition ?? new THREE.Vector3();
    const openHeight = Number(elevatorRuntime.doorOpenHeight ?? DEFAULT_DOOR_OPEN_HEIGHT);
    const axis = elevatorRuntime.doorOpenAxis ?? "y";
    elevatorRuntime.door.position.copy(initial);
    elevatorRuntime.door.position[axis] += openHeight * doorProgress;
  }

  elevatorRuntime.root.updateWorldMatrix(true, true);
  elevatorRuntime.cage?.updateWorldMatrix(true, true);
  elevatorRuntime.door?.updateWorldMatrix(true, true);

  const nextWorldPosition = new THREE.Vector3();
  elevatorRuntime.root.getWorldPosition(nextWorldPosition);
  const delta = nextWorldPosition.sub(previousWorldPosition);
  elevatorRuntime.lastRideDelta.copy(delta);
  return {
    progress,
    arrived: elevatorRuntime.arrived,
    rideDelta: delta,
  };
}

function smoothProgress(progress) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return t * t * (3 - 2 * t);
}
