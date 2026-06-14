import "./OperatorGame.js";
import { createAppShell } from "./app/AppShell.js";

window.operatorGameApp = createAppShell({
  gameApi: window.operatorGameDebug,
});
