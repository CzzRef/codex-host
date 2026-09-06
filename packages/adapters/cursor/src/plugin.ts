import type { HarnessPluginContext } from "@codexhost/harness-adapter/plugin";

import { CursorAdapter } from "./cursor-adapter.js";

export const CURSOR_COMMAND_ENV = "CODEXHOST_CURSOR_COMMAND";

export function createHarnessAdapter(context: HarnessPluginContext): CursorAdapter {
  const environment = { ...context.environment };
  return new CursorAdapter({
    ...(environment[CURSOR_COMMAND_ENV] ? { command: environment[CURSOR_COMMAND_ENV] } : {}),
    environment,
  });
}
