# System Integration Audit

This audit explains how current and planned game systems combine, where the design conflicts, and what contracts future implementations need.

## Compatible system stack

The following layers reinforce one another when data flows in one direction:

```text
Shift scenario / objectives
        -> true simulation state
        -> incidents and resource modifiers
        -> displayed instrument state
        -> physical panel, lamps, audio, world screens
        -> player actions
        -> recorded shift metrics and report
```

- Reactor simulation, fuel profiles, instrument faults, diagnostics, and shift reports already fit this model.
- Facility access, power bus, pump/feed systems, and operator condition can be added as modifiers and consumers around the same simulation rather than replacing it.
- Prefabs support physical expansion because doors, radios, lights, control posts, clocks, and future pumps can share registry-owned behavior across levels.
- `LevelSession` can coordinate objectives while incidents remain independent runtime services.
- The current browser runtime now has explicit services for level ownership, prefab updates, panel presentation, scene feedback, scene audio, narration, terminal completion, player movement/collision/input, loading, and debug snapshots. Future systems should connect through those services rather than adding another parallel frame loop in `OperatorGame.js`.

## Current flow ownership

- Setup Wizard is application state, not level state. Setup/persistence services own completion, language, graphics, and gamma.
- Assigned Shifts is menu/application state. It does not own scene objects or level runtime state.
- The implied personnel-elevator transfer is part of loading presentation and does not load an environment.
- Entrance Corridor, Entrance Area, service corridor, and Control Booth may belong to one exclusively active environment.
- Shift Brief state belongs to the selected `LevelSession`; briefing presentation remains an app panel concern.
- Qualification unlocks are persistent progression state. Failed qualification does not unlock later assignments and returns the player to the same qualification assignment.
- Exit-door interaction requests terminal completion and the following route transition; it does not directly construct the report.
- Shift Report reads recorded metrics only after the runtime has entered a safe terminal state.

## Current conflicts

### Persistent facility vs exclusive browser environments

The older Unreal draft assumes one persistent facility map. The browser architecture requires exclusive active environment ownership. These ideas are compatible only at the product level, not literally in memory.

Recommended resolution: use one exclusively active environment for connected spaces that must be traversed physically, such as Entrance Corridor, Entrance Area, service corridor, and Control Booth. Split larger sectors behind opaque route transitions when memory or lifecycle isolation requires it. Keep progress, shift state, and shared source-asset caches persistent; unload cloned scenes, physics, lights, audio, and interactions.

### Level definitions vs shift scenarios

Some documents treat each shift as a level; others treat multiple shifts as data over one facility. Do not duplicate the environment for every shift.

Recommended resolution: a level definition selects `environmentId` plus a shift/session profile. Environment aliases reuse architecture; `LevelSession` and incident profiles provide mission variation.

### True state vs displayed state

Instrument-failure gameplay requires gauges to lie or lag, but the current UI can easily read the same snapshot used by simulation logic.

Required contract: keep `trueState`, `displayState`, and warning/sensory outputs distinct. Faults modify display channels, never the authoritative simulation. Debug tools may inspect both.

### Power bus vs current abstract power output

Adding a detailed bus risks double-counting field cost, internal consumers, grid output, batteries, and over-demand heat.

Required contract: the reactor produces gross output; one power-bus system calculates internal consumption, storage flow, and net grid output. Grid-demand scoring reads net output only.

### Operator condition vs accessibility

Stress, fatigue, thirst, and caffeine can enrich long shifts but may make precise physical controls frustrating or inaccessible.

Required contract: condition effects alter feedback and decision pressure before input accuracy. Preserve generous hit targets, configurable intensity, and an accessibility path that removes cursor interference without removing resource consequences.

### App routing vs gameplay lifecycle

Menu panels, briefings, environment transitions, and boot loading currently share similar visuals and can accidentally overlap.

Required contract: `AppRouter` owns major context transitions, `AppPanelController` owns menu panels, boot loading stays independent, and input unlock occurs only after the target runtime and briefing state are ready.

### Composition root vs feature convenience

A new feature often needs scene objects, input, audio, persistence, and debug controls at once. Implementing all of that directly in `OperatorGame.js` is initially convenient but recreates hidden ordering dependencies and makes browser-only failures invisible to unit tests.

Required contract: give the feature one authoritative runtime module, inject narrow getters/commands, register its frame method with `AnimationLoop`, and expose debug state through a snapshot adapter. Direct cross-feature mutation is a conflict even when it appears to work in one level.

## Future-system integration points

### Power bus

Add `PowerBusRuntime` with explicit inputs (gross generation and consumer demand) and outputs (net grid power, battery state, breaker state, bus warnings). Persist only scenario-approved state through `LevelSession` checkpoints.

### Pump and feed room

Implement pumps/valves as reusable prefabs. Their runtime publishes coolant/fuel capacity modifiers; it must not directly mutate gauges or simulation internals.

### Operator condition and staff room

Add `OperatorConditionRuntime` as session state. Staff-room prefabs emit typed actions such as drink, rest, or consume caffeine. Camera/audio/UI feedback subscribes to condition outputs.

### Longer scheduled shifts

Separate facility clock from reactor run time. `LevelSession` owns schedule windows; the reactor simulation owns burn elapsed time. Never infer one clock from the other.

### Additional reactors

Define reactor profiles and panel bindings as data. Avoid branching core runtime behavior by level ID. A reactor type may select simulation parameters, panel prefab, gauge ranges, and supported incidents.

### Save/checkpoint evolution

Each new persistent system needs a schema version, normalization, migration, and an explicit list of checkpoint-owned fields. Runtime object references, Three.js objects, audio nodes, timers, and physics handles are never serialized.

## Integration gate for every new system

Before implementation, answer:

1. Who owns authoritative state?
2. Which typed inputs and outputs cross system boundaries?
3. Is the system global, app-session, level-session, environment-runtime, or prefab-instance scoped?
4. How is it reset, checkpointed, and disposed?
5. Can it be tested without Three.js or the browser?
6. Does it preserve exclusive environment ownership?
7. Does it duplicate an existing simulation cost, warning, or feedback effect?
8. Which existing runtime service receives its update or event, instead of creating another loop/listener hub?

If these answers are explicit, all planned systems above are integrable without replacing the current architecture.
