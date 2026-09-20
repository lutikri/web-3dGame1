# Fusion Core Canonical Rules

This document is the authoritative gameplay contract for the current FCU-16 browser simulation.

## Player-facing language

Use industrial fusion-core operator language. Call progression segments phases or burn phases, never batches. Prefer instrument symptoms over arcade instructions.

## Main instruments

- `PLASMA TEMP`, `MK`, approximately `0–180`. High warning begins near `140`; critical behavior begins around `155`; late high-output play intentionally reaches roughly `150–170`.
- `CONTAINMENT` / `STABILITY`, `%`, `0–100`. Higher is safer, but excessive field strength consumes power and reduces useful efficiency.
- `POWER OUTPUT`, `MW`, approximately `0–1200`. The target follows grid demand; maximum output is not automatically optimal.

## Controls

- `Fuel Injection` increases heat and output, consumes fuel, and weakens stability when field strength is insufficient.
- `Magnetic Field` improves containment but costs energy and can reduce net output when overused.
- `Coolant Flow` removes heat gradually; excess coolant can quench the reaction and reduce output.
- `Emergency Vent / Purge` is a held emergency action. It rapidly reduces thermal pressure, sacrifices output, and costs stability/resources. Short rescue pulses are valid; periodic optimal use is not.

## Thermal and electrical state

- Lowering fuel reduces new heating but does not instantly cool plasma.
- `thermalSoak` is retained structural heat. It slows recovery and contributes to `CORE STRESS`.
- `outputSurge` is unstable bus output caused by deep-red temperature or weak containment. It may fluctuate output and intensify lamps, needle jitter, camera feedback, and post-processing.
- `CORE STRESS` grows non-linearly from critical temperature, soak, weak containment, and vent stress. Mild heat is survivable; sustained redline operation escalates quickly.
- Over-demand adds thermal load. Under-demand alone must not shake the camera.

## Secondary values and warnings

Use `CORE STRESS`, `Fuel Reserve`, `Heat Sink Capacity`, `Reaction Efficiency`, and `Grid Demand / Target Output`.

Warning lamps include `TEMP HIGH`, `FIELD WEAK`, `OUTPUT LOW`, `INSTABILITY`, `QUENCH RISK`, and `CORE STRESS`. The Panel1 under/over-demand lamps are yellow for moderate error and red for severe error. Reaction efficiency progresses green, yellow, red, then blinking red for very poor operation.

## Audible alarms

- `UNDER DEMAND` and `OVER DEMAND` require distinct audible warnings tied to the same moderate/severe demand-error bands as their panel lamps.
- Entering or leaving the target band must not produce audio chatter. Audible requests use dwell time, hysteresis, deduplication, and a bounded repeat cadence.
- Simulation and panel runtimes publish typed alarm state only. A central `Announcement System` owns playback, speaker routing, priority, interruption, repetition, acknowledgement, and silence state.
- Safety-critical alarms have priority over demand-compliance warnings. Mutually exclusive under/over-demand warnings must never play over one another.
- `ALARM SILENCE` affects permitted audio only. It does not clear the warning lamp, simulation state, qualification exposure timer, recorded shift metric, or terminal outcome.

`Control_Btn_Test` runs the indicator diagnostic, not gameplay start. Startup lamp feedback is deterministic: red, yellow, green, then two short green blinks before live status.

## Burn phases

1. `FIELD PRECHARGE`
2. `PLASMA IGNITION`
3. `STABLE BURN`
4. `DEMAND SURGE`
5. `SUSTAINED HIGH LOAD`

Small screens may show exact target bands. Warning and thought text should describe symptoms rather than reveal the solution.

## Shift recording

Classification should use current mechanics: demand error, efficiency, output, temperature, over/under-demand duration, critical temperature, thermal soak, output surge, core stress, quench, instability, vent time and activations, control movement, and average control positions.

Normal late hot operation does not by itself earn `REDLINE PHILOSOPHER`; require real soak, very high temperatures, or repeated redline behavior. `NERVOUS PURGE TECH` must be reachable through repeated short vent pulses.

Canonical profile names remain defined by the shift report implementation; new profiles must be derived from recorded behavior rather than one isolated threshold.

## Primary player-facing report metrics

The main Shift Report presents only three metrics:

1. `GRID COMPLIANCE`
   - percentage of scored shift time inside the accepted demand band;
   - primary measure of whether the operator delivered the assigned power.

2. `OPERATING EFFICIENCY`
   - average reaction efficiency across the active burn;
   - summarizes fuel, field, temperature, containment, and useful output quality.

3. `PEAK CORE STRESS`
   - maximum Core Stress reached during the shift;
   - reports the worst mechanical condition and identifies a safety trip.

The report also displays one terminal result:

- `QUALIFICATION PASSED`;
- `RETRY REQUIRED`;
- or an equivalent shift-specific completion result.

Detailed recorder values remain available for internal classification and debugging but are not presented as a large player-facing table.

## Qualification result

Surviving the 180-second sequence is necessary but not sufficient for `QUALIFICATION PASSED`.

Qualification evaluates the complete active burn and requires:

- completion of all authored burn phases and demand ramps;
- sufficient `GRID COMPLIANCE` across scored time;
- acceptable operating efficiency and containment;
- bounded warning/critical exposure, stalls, safety events, and emergency interventions;
- no terminal safety trip or destroyed-core outcome.

Thresholds belong to the qualification shift profile so they can be tuned without changing the shared reactor simulation. The acceptance contract is behavioral: leaving controls nearly unchanged must fail, reasonable novice corrections after instruction must pass, and one recoverable mistake must not automatically invalidate the whole shift.

Current provisional calibration scores after a 12-second grace period. Passing requires at least 45% of scored time within 12% of grid demand, at least two non-precharge phases with 45% compliance, average efficiency of 62% or better, no demand deviation above 25% lasting longer than 42 seconds, and bounded stress/critical-state exposure. The Shift Report exposes `GRID COMPLIANCE` and `PHASES PASSED`; these values remain subject to playtest tuning.
