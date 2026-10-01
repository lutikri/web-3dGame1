# Codex Working Contract

This is a static Three.js browser game. `index.html` boots `src/main.js`; `src/OperatorGame.js` is the application composition root.

## Before editing

1. Read `docs/project-structure.md` and the nearest nested `AGENTS.md` for files in scope.
2. Run `git status --short`. Existing changes belong to the user; never rewrite or discard them.
3. State which system owns the requested behavior and which files are expected to change.

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
- Artist-facing prefab behavior and material parameters must live in registry/config data, appear in the selected prefab's Debug Workspace `PROPERTIES`, apply live through a public runtime/config API, and save through the existing config pipeline. Do not leave iteration-critical tuning values only as runtime or shader constants.

See `docs/project-structure.md` for the current module map and `docs/game/` for game design. Do not copy design rules back into this file.

## Development and verification policy

Keep routine development lightweight. Do not run the full test suite before starting a task.

### During normal development

- Do not run `npm run check` before implementation unless there is a specific reason to establish a baseline.
- After a small or localized change, run only the test file(s) directly related to the changed system when useful.
- For trivial presentation, copy, config, CSS, or clearly isolated changes, tests may be skipped unless the change has meaningful behavioral risk.
- If a bug is being investigated, use the smallest relevant test or command needed to reproduce and verify the problem.
- Do not repeatedly run the same tests after every intermediate edit.

### Full verification

Run `npm run check` only when one of these applies:

- the user explicitly asks for full verification;
- the task changes shared architecture, lifecycle, routing, persistence, physics, or other broadly used runtime behavior;
- several systems were changed together;
- a regression is suspected outside the directly changed system;
- preparing a final production/deployment-ready state.

Prefer running the full suite once, after implementation is complete.

For level ownership/lifecycle changes, run `http://localhost:5173/?runtimeSmoke=1` and require `[RuntimeSmoke] PASS`.

### Module revision stamping

Do not run `npm run stamp-modules` during normal development or routine Codex tasks.

Module revision stamping is a deployment/release operation. Run it only when the user explicitly asks to prepare or deploy a production build.

Do not create large repository-wide diffs solely for cache-busting during ordinary development.

### Repository scope

- Inspect only files relevant to the current task.
- Do not broadly inspect or search `assets/`, `source-assets/`, `docs/archive/`, or `src/generated/` unless the task specifically involves them.
- Avoid dumping large diffs, full generated files, complete test-suite output, or large asset listings into the working context unless necessary.

### Manual verification

- Use manual browser testing only for visual feel, input comfort, timing, and presentation.
- Unless the user explicitly asks Codex to inspect the running visuals, give the user a short manual visual checklist instead of using browser automation for subjective visual acceptance. Automated checks still own syntax, regression, and lifecycle verification.

### Handoff

At the end of a normal task, report:

- what was changed;
- which targeted tests, if any, were run;
- what was not verified.

Do not run additional full-project verification merely to produce a handoff summary.
