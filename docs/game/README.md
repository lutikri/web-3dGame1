# Game Design Documentation

This directory is the single home for game rules, progression, fiction, and future-system design.

## Source priority

When documents disagree, use this order:

1. `game-design-ru.md` — current product and progression direction.
2. `fusion-core.md` — canonical FCU-16 controls, gauges, thermal behavior, warnings, phases, and shift classification.
3. `system-integration.md` — boundaries and compatibility rules for planned systems.
4. `future-unreal-architecture.md` — reference for a possible future Unreal version, not an implementation map for the browser game.

Code ownership is documented separately in `../project-structure.md`. `README.md` at the repository root is an onboarding and development entry point, not a second design authority.

## How to use this set

- Start with `game-design-ru.md` when deciding what experience or progression to build.
- Use `fusion-core.md` for concrete reactor mechanics and operator-facing terminology.
- Read `system-integration.md` before adding a cross-cutting system; it records compatibility constraints and the required ownership questions.
- Consult `future-unreal-architecture.md` only for long-range concepts. Browser code must follow the current runtime map and lifecycle contracts even when the Unreal draft suggests a persistent world or different implementation technology.

## Current product model

The player is a Terragen Systems shift operator. The reactor panel is the mechanical core; the facility, incidents, operator condition, power bus, maintenance rooms, and narration increase the consequences and diagnostic depth of operating that panel.

The intended first-run route is:

```text
Elevator Arrival -> Facility Entrance -> Control Booth Qualification
-> Shift Report -> Assigned Shifts
```

Later shifts reuse the facility where practical and vary access, objectives, faults, fuel, instruments, scheduling, and enabled systems. In the browser runtime, this still must obey exclusive environment ownership and explicit unload/load transitions.
