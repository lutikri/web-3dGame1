# Codex Working Contract

This is a static Three.js browser game. `index.html` boots `src/main.js`; `src/OperatorGame.js` is the application composition root.

## Before editing

1. Read `docs/project-structure.md` and the nearest nested `AGENTS.md` for files in scope.
2. Run `git status --short`. Existing changes belong to the user; never rewrite or discard them.
3. Run `npm run check` before implementation.
4. State which system owns the requested behavior and which files are expected to change.

## Scope discipline

- Change one system per task. Do not perform opportunistic cleanup, formatting, renames, or asset moves.
- Prefer 3–5 source files per coherent change. If the task requires a wider migration, split it into independently verified stages.
- Diagnose first. Preserve existing behavior unless the user explicitly requests a behavior change.
- Do not add reusable logic to `OperatorGame.js`; create or extend the owning runtime module.
- Do not add persistence, routing, or panel rendering directly to `AppShell.js`; use the corresponding module under `src/app/`.
- Do not hand-edit `src/generated/` unless the task explicitly concerns saved/exported tuning data.
- Do not move, rename, convert, or delete assets unless explicitly requested.
- Runtime code may load from `assets/`, never from `source-assets/`.

## Ownership rules

- Registries own shared definitions and immutable defaults.
- Level configs own stable placed instances and intentional per-level overrides.
- Runtime modules own cloned objects, event listeners, timers, audio nodes, physics bodies, temporary state, and cleanup.
- App routing owns major context transitions; panel navigation does not trigger route loading.
- Debug UI calls public runtime/config APIs and does not contain gameplay logic.
- Reusable placed-object behavior belongs in `src/prefabs/behaviors/`.

See `docs/project-structure.md` for the current module map and `docs/game/` for game design. Do not copy design rules back into this file.

## Verification

1. Add or update a regression test for behavior or lifecycle changes.
2. Run `npm run check`.
3. After JavaScript/module-path changes, run `npm run stamp-modules -- <short-revision-name>` and then `npm run check` again.
4. For level ownership/lifecycle changes, run `http://localhost:5173/?runtimeSmoke=1` and require `[RuntimeSmoke] PASS`.
5. Use manual browser testing only for visual feel, input comfort, timing, and presentation.

At handoff, report changed systems, verification performed, and any unverified visual/runtime risk.
