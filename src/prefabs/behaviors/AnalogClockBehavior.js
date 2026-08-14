import * as THREE from "three";

import { applyAxisRotation } from "../../scene/TransformUtils.js?v=locomotion-weight-pass";

function applyClockHandRotation(hand, axis, angle) {
  if (!hand) return;
  hand.rotation.copy(hand.userData.initialRotation);
  applyAxisRotation(hand, axis, angle);
}

export function createAnalogClockRuntime(parts, config = {}) {
  const hands = {
    seconds: parts.get(config.secondsHandName ?? "SM_Clock1_ArrowSeconds") ?? null,
    minutes: parts.get(config.minutesHandName ?? "SM_Clock1_ArrowMinutes") ?? null,
    hours: parts.get(config.hoursHandName ?? "SM_Clock1_ArrowHours") ?? null,
  };
  Object.values(hands).forEach((hand) => {
    if (!hand) return;
    hand.userData.initialRotation = hand.rotation.clone();
  });
  return {
    ...config,
    hands,
  };
}

export function updateAnalogClockRuntime(clockRuntime, now = new Date()) {
  if (!clockRuntime?.hands) return;
  const milliseconds = now.getMilliseconds();
  const seconds = now.getSeconds() + milliseconds / 1000;
  const minutes = now.getMinutes() + seconds / 60;
  const hours = (now.getHours() % 12) + minutes / 60;
  const axis = clockRuntime.axis ?? "z";
  const direction = clockRuntime.direction ?? -1;
  const smoothSeconds = clockRuntime.smoothSeconds !== false;
  applyClockHandRotation(
    clockRuntime.hands.seconds,
    axis,
    direction * ((smoothSeconds ? seconds : Math.floor(seconds)) / 60) * Math.PI * 2,
  );
  applyClockHandRotation(clockRuntime.hands.minutes, axis, direction * (minutes / 60) * Math.PI * 2);
  applyClockHandRotation(clockRuntime.hands.hours, axis, direction * (hours / 12) * Math.PI * 2);
}
