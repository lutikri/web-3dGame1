# Near-Term Roadmap

## 1. Intro Shift — three-minute tutorial

- Keep the shift at 3:00 with five short burn phases.
- Teach cause and effect through the panel, not a permanent instruction list:
  - Field before heavy fuel.
  - Fuel raises heat and output.
  - Coolant controls heat but can quench the burn.
  - Pulse restarts a stalled core when fuel and coolant are correctly set.
  - Vent is an emergency pulse, not a normal operating rhythm.
- Use one gentle, scripted disturbance so the player must make a correction before the final phase.
- Keep phase changes as 9-second ramps instead of instant parameter switches.

## 2. Subtitle / operator-thought system

- Add a bottom-screen subtitle queue owned by `AppShell`.
- Each line needs text, duration, priority, event ID, and a once-per-level flag.
- Normal lines remain for 3–5 seconds; urgent warnings may interrupt low-priority thoughts.
- Do not show subtitles while a briefing sheet or results overlay is visible.
- Suggested intro lines:
  - Start: `All right... let's wake you up.`
  - First weak field: `Easy. Need a field under it first.`
  - First quench: `Damn. Drowned it. Back off the coolant... give it fuel...`
  - Pulse becomes ready after a quench: `Come on. Take the spark.`
  - Successful restart: `There you are.`
  - First deep-red temperature: `Nope. That's way too hot.`
  - Sustained high load: `Hold together. Just a little longer.`
- Door lines:
  - During an active shift: `Yeah, no. Can't leave it burning.`
  - Repeated attempt: `Of course. Interlocked until shutdown.`
  - Successful shift: `Core's down. I'm done here.`
  - Failed but contained: `Fail-safe caught it. Time to go.`
  - Destroyed core: `That's gone. I need out. Now.`

## 3. Bulkhead exit interaction

- Register `SM_Door1_Handle` as a first-person interactive handle.
- Add explicit door states:
  - `locked`: standby or active shift.
  - `exitPending`: terminal shutdown sequence complete.
  - `opening`: handle/door animation is playing.
  - `exited`: hand control to the results route.
- Trying the handle during a shift plays a locked movement/sound and queues a subtitle.
- At shift completion, do not open results automatically.
- Finish terminal shutdown, unlock the bulkhead, illuminate its indicator, and queue the exit subtitle.
- Player approaches and holds/turns the handle; animate the handle first, then the bulkhead.
- Show shift results only after the door interaction completes.
- Preserve a fallback timeout/debug action so a missing mesh or animation cannot trap the player.

## 4. Planned campaign levels

1. `INTRO SHIFT`
   - Basic field/fuel/coolant balance, quench recovery, and physical exit.
2. `INSTRUMENT FAILURE`
   - One gauge or warning circuit becomes unreliable; cross-check other instruments.
3. `FUEL PROBLEMS`
   - Poor or fluctuating fuel quality changes heat/output response.
4. `COLD RECOVERY`
   - Begin with a soaked or stalled core and restore the burn under grid pressure.
5. `MINIMUM SERVICE`
   - Hold a barely sustainable low-output burn with strict fuel/resource limits.
6. `MAXIMUM LOAD`
   - Operate near 150–170 MK while managing heat soak, field margin, and bus surges.

## 5. Interaction and presentation follow-up

- Custom collision meshes.
- Bulkhead door geometry opening animation and handle sounds.
- Controls knob dial markings.
- Controls button retexture.
- Button tooltips/popups.
- Startup task card updated for the three-minute shift.
- Audio layers:
  - Core hum tied to burn rate.
  - Field whine tied to magnetic load.
  - Coolant pump and cavitation.
  - Ignition capacitor charge and pulse impact.
  - Core stall wind-down and terminal alarms.

## 6. Pause/settings follow-up

- Resume.
- Restart.
- Settings.
- FOV.
- UI scale.
- Shadows quality.
- GTAO quality.
- Post-processing presets.
- Texture quality.
- Debug overlay show/hide.

## Done

- `SM_Door1_Handle` locked ±30° attempt, hold-to-turn 360° exit, and results handoff.
- Bottom-center operator thought queue with priority, per-shift deduplication, and 0.7–1.2 second fades.
- Intro thoughts connected to startup, weak field, quench/restart, redline, high load, and terminal outcomes.
- Long-term fluorescent light flicker.
- Correct knob wheel direction.
- Improved first-person movement.
- Indicator test gauge/lamp sequence.
- Fluorescent startup lighting sequence.
- Recoverable core stall and held ignition pulse.
- Smooth phase ramps.
- Terminal complete/failure/core-destroyed sequences.
