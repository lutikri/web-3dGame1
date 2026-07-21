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
