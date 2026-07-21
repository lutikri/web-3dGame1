# App Layer

- `AppShell.js` composes app services and translates UI actions into game API calls. Keep it free of storage parsing, route animation details, and panel DOM ownership.
- `AppPersistence.js` exclusively owns settings/progress storage keys, migration, validation, and defaults.
- `AppRouter.js` exclusively owns major route transitions and their curtain/loading sequence.
- `AppPanelController.js` exclusively owns app panel visibility and the `app-ui-open` body state.
- `panels/` owns panel-specific DOM behavior. `LevelSelectPanel` owns route drawing, drag, unlock presentation, and progress rendering; `SettingsPanel` owns settings controls and applies them through `gameApi`.
- `panels/BriefingPanel.js` owns briefing localization, image preloading, sheet queue, inspect geometry, vignette variables, dismissal animation, and timers. The shell only reacts to active/dismissed events.
- Subtitles, hints, localization, and tutorial flows remain independent UI services.
- Internal panel navigation is immediate. Only menu/level/restart context changes use route transitions.
- While a briefing or app panel blocks play, input locking must flow through the shell to `gameApi.setInputLocked`.
- Every global event listener or timer introduced by an app service must have an explicit disposal owner.
