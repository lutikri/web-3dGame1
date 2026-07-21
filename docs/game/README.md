# Game Design Documentation

This directory is the canonical home for OperatorGame product design, progression, reactor rules, fiction, and planned systems.

## Source priority

When documents disagree, use this order:

1. `game-design-ru.md` — current player experience, progression, level flow, tutorials, and release scope.
2. `fusion-core.md` — canonical FCU-16 controls, instruments, reactor behavior, warnings, shift scoring, and failure rules.
3. `system-integration.md` — ownership boundaries and compatibility rules for current and planned systems.
4. `future-unreal-architecture.md` — archived reference for a possible future Unreal version. It is not an implementation plan for the browser game.

Non-canonical possibilities are collected in `ideas-backlog.md`. They are not release commitments.

Code ownership is documented separately in `../project-structure.md`.

The repository root `README.md` is an onboarding and development overview. It must not duplicate detailed progression or game rules.

## Current product model

The player is a Terragen Systems shift operator assigned to an old industrial fusion installation.

The physical reactor panel is the mechanical core of the game. The facility, narration, instrument failures, fuel incidents, reports, and future service rooms increase the consequences and diagnostic depth of operating that panel.

The current first-run route is:

```text
First Site Visit
-> Setup Wizard
-> Main Menu
-> Assigned Shifts
-> Entrance Corridor
-> Entrance Area
-> Control Booth
-> Qualification Shift
-> Return to Entrance
-> Shift Report
-> Assigned Shifts
```

The personnel elevator exists only as an implied off-screen transfer during loading. There is no playable elevator scene in the current scope.

## Current playable package

The first complete game package consists of three shifts:

1. `intro-shift` — First Operator Qualification Shift.
2. `unexpected-stuff` — Instrument Reliability Check.
3. `fuel-problems` — Cost of Running Trial.

The qualification shift is initially assigned.

The other two shifts remain unavailable until qualification is successfully completed. After qualification, both become available and may be completed in either order.

## Current scope boundary

The current release scope includes:

* first-run setup;
* main menu and assigned-shift selection;
* Entrance Corridor;
* Entrance Area;
* service corridor;
* Control Booth;
* three reactor shifts;
* physical return to the entrance after every shift;
* Shift Report;
* progression unlocks.

The Power Bus room, Pump Station, Staff Room, and other sectors may exist as labelled locked doors or inaccessible spaces. They are not required to contain active gameplay in the current scope.

Playable elevator arrival, detailed power routing, operator survival systems, long shifts, maintenance rooms, and expanded horror incidents are tracked in [`ideas-backlog.md`](ideas-backlog.md) and must not block completion of the current three-shift package.
