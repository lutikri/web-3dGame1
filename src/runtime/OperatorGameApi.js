const REQUIRED_APP_METHODS = ["startLevel", "resetForMenu", "setInputLocked", "getState", "inspectRuntime"];

export function installOperatorGameApi(host, api) {
  for (const method of REQUIRED_APP_METHODS) {
    if (typeof api[method] !== "function") {
      throw new TypeError(`Operator game API requires ${method}()`);
    }
  }
  host.operatorGameDebug = api;
  return api;
}

